// Controlled DBMS demonstrations. No arbitrary SQL is accepted from the browser.
const express = require('express');
const { query, pool } = require('../db');
const { HttpError, wrap } = require('../errors');
const router = express.Router();

const TABLES = ['publishers', 'authors', 'categories', 'membership_plans', 'staff', 'books', 'book_authors', 'book_copies',
  'digital_resources', 'members', 'loans', 'fines', 'reservations', 'digital_access_log',
  'v_overdue_books', 'v_book_popularity', 'v_member_activity', 'v_available_copies'];

router.get('/tables', (req, res) => res.json(TABLES));
router.get('/select/:table', wrap(async (req, res) => {
  if (!TABLES.includes(req.params.table)) throw new HttpError(404, 'Table not allowed.');
  const sql = `SELECT * FROM ${req.params.table} LIMIT 100`; // whitelisted identifier
  res.json({ sql, rows: await query(sql) });
}));

// INSERT -> UPDATE -> DELETE on a scratch category row; leaves the data unchanged.
router.post('/demo/crud', wrap(async (req, res) => {
  const name = `Demo Category ${Date.now()}`, log = [];
  const step = async (label, sql, params) => {
    const [r] = await pool.query(sql, params);
    log.push({ step: label, sql: pool.format(sql, params), result: r.affectedRows !== undefined ? `${r.affectedRows} row(s) affected` : '' });
    return r;
  };
  const ins = await step('INSERT', 'INSERT INTO categories (category_name) VALUES (?)', [name]);
  const sel = async (label) => { const [rows] = await pool.query('SELECT * FROM categories WHERE category_id = ?', [ins.insertId]);
    log.push({ step: label, sql: pool.format('SELECT * FROM categories WHERE category_id = ?', [ins.insertId]), result: JSON.stringify(rows) }); };
  await sel('SELECT');
  await step('UPDATE', 'UPDATE categories SET category_name = ? WHERE category_id = ?', [name + ' (edited)', ins.insertId]);
  await sel('SELECT');
  await step('DELETE', 'DELETE FROM categories WHERE category_id = ?', [ins.insertId]);
  await sel('SELECT (after delete)');
  res.json({ message: 'INSERT, UPDATE and DELETE executed on a scratch row (net change: none).', log });
}));

// Transaction demo: mode = commit | rollback. Counts are read inside and after the transaction.
router.post('/demo/transaction', wrap(async (req, res) => {
  const mode = req.body.mode === 'commit' ? 'COMMIT' : 'ROLLBACK';
  const conn = await pool.getConnection(), log = [];
  const run = async (sql, params = []) => { const [r] = await conn.query(sql, params); log.push({ sql: conn.format(sql, params) }); return r; };
  try {
    const count = async (label) => { const [[r]] = await conn.query('SELECT COUNT(*) AS n FROM categories'); log.push({ sql: `-- ${label}: categories = ${r.n}` }); };
    await count('before');
    await run('START TRANSACTION');
    await run('INSERT INTO categories (category_name) VALUES (?)', [`TXN ${mode} demo ${Date.now()}`]);
    await count('inside transaction');
    await run(mode);
    await count('after ' + mode);
    res.json({ message: mode === 'COMMIT' ? 'Row was committed and is now permanent (delete it from Categories if unwanted).' : 'Row was rolled back; the table is unchanged.', log });
  } finally { conn.release(); }
}));

module.exports = router;
