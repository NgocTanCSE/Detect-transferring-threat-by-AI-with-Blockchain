/**
 * Generic Dead‑Letter Queue (DLQ) setup utility.
 * Used by micro‑services to ensure a dead‑letter exchange and queue are
 * available for any consumer that may need to reject messages.
 *
 * @param {Object} channel - amqplib channel instance.
 * @param {string} baseName - Base name for DLX/DLQ (usually the main exchange name).
 * @returns {Promise<{dlx:string,dlq:string}>} The names of the created DLX and DLQ.
 */
async function setupDLQ(channel, baseName) {
  const dlx = `${baseName}.dlx`;
  const dlq = `${baseName}.dead_letter`;

  // 1️⃣ Declare dead‑letter exchange (topic, durable)
  await channel.assertExchange(dlx, 'topic', { durable: true });

  // 2️⃣ Declare dead‑letter queue (durable)
  await channel.assertQueue(dlq, { durable: true });

  // 3️⃣ Bind dead‑letter queue to all routing keys on the DLX
  await channel.bindQueue(dlq, dlx, '#');

  return { dlx, dlq };
}

module.exports = { setupDLQ };
