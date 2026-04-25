const express = require('express');
const app = express();
const PORT = 3007;
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'event-service' }));
app.listen(PORT, () => console.log('event-service running on port ' + PORT));
