// Shared tracing middleware – generates / propagates a correlation ID
// All services should import and use this instead of duplicated code.

const { v4: uuidv4 } = require('uuid');

module.exports = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};