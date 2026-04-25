const amqp = require('amqplib');

let connection;
let channel;

const ALERT_EXCHANGE = 'security_alerts';

/**
 * Connect to RabbitMQ and start consuming events
 * @param {Function} onEvent Callback when an event is received
 */
const startConsuming = async (onEvent) => {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin123@rabbitmq:5672';
  
  try {
    console.log(`📡 Event Service connecting to RabbitMQ at ${rabbitmqUrl}...`);
    connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();
    
    // Assert Exchange
    await channel.assertExchange(ALERT_EXCHANGE, 'topic', { durable: true });
    
    // Assert Queue (exclusive for this instance of event-service)
    const q = await channel.assertQueue('', { exclusive: true });
    
    // Bind to all alert events
    await channel.bindQueue(q.queue, ALERT_EXCHANGE, 'alert.#');
    
    console.log(`✓ Event Service connected. Listening to exchange: ${ALERT_EXCHANGE}`);
    
    // Consume messages
    channel.consume(q.queue, (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          const routingKey = msg.fields.routingKey;
          console.log(`📥 Received event [${routingKey}]: ${content.alert_type}`);
          
          if (onEvent) {
            onEvent(routingKey, content);
          }
          
          channel.ack(msg);
        } catch (err) {
          console.error('Failed to parse MQ message:', err.message);
          channel.nack(msg, false, false); // Don't requeue malformed messages
        }
      }
    }, { noAck: false });

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err.message);
      setTimeout(() => startConsuming(onEvent), 5000);
    });
    
    connection.on('close', () => {
      console.warn('RabbitMQ connection closed. Reconnecting...');
      setTimeout(() => startConsuming(onEvent), 5000);
    });
    
  } catch (error) {
    console.error('❌ Event Service failed to connect to RabbitMQ:', error.message);
    setTimeout(() => startConsuming(onEvent), 5000);
  }
};

module.exports = { startConsuming };
