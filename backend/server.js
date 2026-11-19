const path = require('path');
const express = require('express');
const { pool } = require('./db');
const { translate } = require('./errors');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/health', async (req, res, next) => { try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch (e) { next(e); } });
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/special'));   // must come before the generic /:entity routes
app.use('/api', require('./routes/crud'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API endpoint' }));

// Central error handler
app.use((err, req, res, next) => {
  const { status, message } = translate(err);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Library app running at http://localhost:${port}`));
