const express = require('express');
const app = express();
const PORT = 3003;
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'alert-service' }));
app.listen(PORT, () => console.log('alert-service running on port ' + PORT));
