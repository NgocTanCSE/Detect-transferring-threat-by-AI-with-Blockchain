const express = require('express');
const app = express();
const PORT = 3006;
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'compliance-service' }));
app.listen(PORT, () => console.log('compliance-service running on port ' + PORT));
