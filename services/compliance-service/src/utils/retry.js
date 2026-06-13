/**
 * Simple retry wrapper for async functions.
 * @param {Function} fn - async function to execute.
 * @param {Object} options - { attempts: number, delay: ms }.
 * @returns {Promise<any>} result of fn if successful.
 */
async function withRetry(fn, { attempts = 3, delay = 500 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  throw lastError;
}

module.exports = { withRetry };
