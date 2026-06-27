/**
 * Notification sender - Send notifications to channels
 */

const axios = require('axios');

async function sendNotification(notification) {
  const { id, channel, recipient, severity, message, meta } = notification;

  const channels = {
    email: async () => {
      // Simulated - in production use nodemailer
      console.log(`[NOTIFICATION] Email to ${recipient}: ${message}`);
      return { success: true, simulated: true };
    },
    webhook: async () => {
      try {
        await axios.post(recipient, {
          event: 'alert',
          severity,
          message,
          data: meta
        }, { timeout: 5000 });
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    slack: async () => {
      console.log(`[NOTIFICATION] Slack to ${recipient}: ${message}`);
      return { success: true, simulated: true };
    }
  };

  const sender = channels[channel] || channels.email;
  return await sender();
}

module.exports = {
  sendNotification
};