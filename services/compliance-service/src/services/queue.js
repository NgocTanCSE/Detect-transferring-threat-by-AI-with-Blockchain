const amqp = require('amqplib');

let connection = null;
let channel = null;
const EXCHANGE = 'blockchain_events';

async function connect() {
  const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin123@rabbitmq:5672';
  try {
    connection = await amqp.connect(rabbitUrl);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    console.log('✅ Connected to RabbitMQ (Compliance Service)');
  } catch (error) {
    console.error('❌ RabbitMQ connection failed:', error.message);
    setTimeout(connect, 5000);
  }
}

async function publishEvent(routingKey, data) {
  if (!channel) return;
  try {
    const payload = Buffer.from(JSON.stringify(data));
    channel.publish(EXCHANGE, routingKey, payload, { persistent: true });
    console.log(`📤 Published event: ${routingKey}`);
  } catch (error) {
    console.error(`Failed to publish event ${routingKey}:`, error.message);
  }
}

module.exports = {
  connect,
  publishEvent
};
