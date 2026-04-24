const axios = require('axios');
const { aiServiceUrl, requestTimeoutMs } = require('../config/env');

function toUpstreamPath(originalPath) {
  if (!originalPath || originalPath === '/api') {
    return '/';
  }

  if (originalPath.startsWith('/api/')) {
    return originalPath.slice(4);
  }

  return originalPath;
}

function getForwardHeaders(headers) {
  const filtered = { ...headers };
  delete filtered.host;
  delete filtered.connection;
  delete filtered['content-length'];
  return filtered;
}

function buildUpstreamUrl(path, queryParams) {
  const upstreamPath = toUpstreamPath(path);
  const query = new URLSearchParams(queryParams || {}).toString();
  return `${aiServiceUrl}${upstreamPath}${query ? `?${query}` : ''}`;
}

async function forwardRequest(req) {
  const upstreamUrl = buildUpstreamUrl(req.path, req.query);

  return axios({
    method: req.method,
    url: upstreamUrl,
    headers: getForwardHeaders(req.headers),
    data: ['GET', 'DELETE'].includes(req.method.toUpperCase()) ? undefined : req.body,
    responseType: 'arraybuffer',
    validateStatus: () => true,
    timeout: requestTimeoutMs,
  });
}

module.exports = {
  forwardRequest,
};
