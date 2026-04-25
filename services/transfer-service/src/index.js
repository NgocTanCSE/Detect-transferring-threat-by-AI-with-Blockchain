const express = require('express');
const app = express();
const PORT = 3004;
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'transfer-service' }));
app.listen(PORT, () => console.log('transfer-service running on port ' + PORT));
