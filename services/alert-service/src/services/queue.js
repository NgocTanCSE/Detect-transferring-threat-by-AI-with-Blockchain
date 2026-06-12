const amqp = require('amqplib');

let connection;
let channel;

const ALERT_EXCHANGE = 'security_alerts';
const ALERT_DLX = 'security_alerts.dlx';
const ALERT_QUEUE = 'security_alerts.main';
const ALERT_DLQ = 'security_alerts.dead_letter';

/**
 * Connect to RabbitMQ and setup queues/exchanges
 */
const connect = async () => {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin123@rabbitmq:5672';
  
  try {
    console.log(`📡 Connecting to RabbitMQ at ${rabbitmqUrl}...`);
    connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();
    
    // 1. Setup Dead Letter Exchange and Queue
    await channel.assertExchange(ALERT_DLX, 'topic', { durable: true });
    await channel.assertQueue(ALERT_DLQ, { durable: true });
    await channel.bindQueue(ALERT_DLQ, ALERT_DLX, '#'); // Catch everything in DLQ
    
    // 2. Setup Main Exchange
    await channel.assertExchange(ALERT_EXCHANGE, 'topic', { durable: true });
    
    // 3. Setup Main Queue with DLX link and TTL
    // Messages that are nack'd or expired will go to the DLX
    await channel.assertQueue(ALERT_QUEUE, {
      durable: true,
      deadLetterExchange: ALERT_DLX,
      deadLetterRoutingKey: 'alert.dead',
      messageTtl: 30000 // 30 seconds TTL
    });
    
    // Bind main queue to all alert types
    await channel.bindQueue(ALERT_QUEUE, ALERT_EXCHANGE, 'alert.#');
    
    console.log('✓ RabbitMQ Infrastructure (Main + DLQ) Ready.');
    
    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err.message);
      setTimeout(connect, 5000);
    });
    
    connection.on('close', () => {
      console.warn('RabbitMQ connection closed. Reconnecting...');
      setTimeout(connect, 5000);
    });
    
  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:', error.message);
    setTimeout(connect, 5000);
  }
};

/**
 * Get DLQ metrics for the dashboard
 */
const getQueueMetrics = async () => {
  if (!channel) return { main: 0, dead: 0 };
  try {
    const main = await channel.checkQueue(ALERT_QUEUE);
    const dead = await channel.checkQueue(ALERT_DLQ);
    return {
      main: main.messageCount,
      dead: dead.messageCount
    };
  } catch (e) {
    return { main: 0, dead: 0 };
  }
};

/**
 * Publish an alert event
 * @param {Object} alertData The alert details
 */
const publishAlert = async (alertData) => {
  if (!channel) {
    console.error('❌ Cannot publish: RabbitMQ channel not initialized');
    return false;
  }

  try {
    const severity = (alertData.severity || 'medium').toLowerCase();
    const routingKey = `alert.${severity}`;
    
    const success = channel.publish(
      ALERT_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify({
        ...alertData,
        published_at: new Date().toISOString()
      })),
      { persistent: true }
    );
    
    if (success) {
      console.log(`📤 Alert published to MQ: [${severity.toUpperCase()}] ${alertData.alert_type}`);
    }
    return success;
  } catch (error) {
    console.error('❌ Failed to publish alert to MQ:', error.message);
    return false;
  }
};

/**
 * Start background consumer worker
 */
const startWorker = async (processor) => {
  if (!channel) {
    console.error('❌ Cannot start worker: RabbitMQ channel not initialized');
    return;
  }

  try {
    console.log(`📥 Worker starting. Listening on queue: ${ALERT_QUEUE}`);
    
    await channel.consume(ALERT_QUEUE, async (msg) => {
      if (!msg) return;

      const content = JSON.parse(msg.content.toString());
      const headers = msg.properties.headers || {};
      const retryCount = headers['x-retry-count'] || 0;

      try {
        // Simulate processing (e.g. sending email, calling webhook)
        await processor(content);
        
        // Success -> Acknowledge
        channel.ack(msg);
        console.log(`✅ Alert processed successfully: ${content.alert_id || content.id}`);
      } catch (error) {
        console.error(`⚠️ Processing failed (Attempt ${retryCount + 1}):`, error.message);

        if (retryCount < 2) {
          // Retry logic: Re-publish with incremented counter
          const nextRetry = retryCount + 1;
          channel.publish(
            ALERT_EXCHANGE,
            msg.fields.routingKey,
            msg.content,
            { 
              persistent: true,
              headers: { ...headers, 'x-retry-count': nextRetry }
            }
          );
          channel.ack(msg); // Ack the old one so it doesn't stay in queue
          console.log(`🔄 Re-queued for retry ${nextRetry}/3`);
        } else {
          // Max retries reached -> Reject and move to DLQ
          console.error(`❌ Max retries reached. Moving to DLQ: ${ALERT_DLQ}`);
          channel.nack(msg, false, false); // false, false = reject without requeue (goes to DLX)
        }
      }
    }, { noAck: false });
  } catch (error) {
    console.error('❌ Worker error:', error.message);
  }
};

module.exports = {
  connect,
  publishAlert,
  getQueueMetrics,
  startWorker,
  EXCHANGES: { ALERT_EXCHANGE, ALERT_DLX },
  QUEUES: { ALERT_QUEUE, ALERT_DLQ }
};
