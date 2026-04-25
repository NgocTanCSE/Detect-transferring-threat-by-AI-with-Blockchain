const amqp = require('amqplib');

let connection;
let channel;

const ALERT_EXCHANGE = 'security_alerts';
const ALERT_ROUTING_KEY = 'alert.new';

/**
 * Connect to RabbitMQ
 */
const connect = async () => {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin123@rabbitmq:5672';
  
  try {
    console.log(`📡 Connecting to RabbitMQ at ${rabbitmqUrl}...`);
    connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();
    
    // Assert Exchange
    await channel.assertExchange(ALERT_EXCHANGE, 'topic', { durable: true });
    
    console.log('✓ Connected to RabbitMQ and Exchange asserted.');
    
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

module.exports = {
  connect,
  publishAlert,
  EXCHANGES: { ALERT_EXCHANGE },
};
