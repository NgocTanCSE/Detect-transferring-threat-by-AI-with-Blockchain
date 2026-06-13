const client = require('prom-client');

// Enable collection of default metrics (process_cpu_seconds_total, etc.)
client.collectDefaultMetrics();

// Histogram for HTTP request duration
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
});

/**
 * Express middleware that tracks request duration.
 */
function requestMetrics(req, res, next) {
  const end = httpRequestDurationSeconds.startTimer();
  res.on('finish', () => {
    const route = req.route && req.route.path ? req.route.path : req.path;
    end({ method: req.method, route, status: res.statusCode });
  });
  next();
}

module.exports = { client, requestMetrics };
