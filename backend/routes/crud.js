const express = require('express');
const E = require('../meta');
const { query, pool } = require('../db');
const { bad, HttpError, wrap } = require('../errors');
const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validate + coerce a request body against the entity's field definitions.
function clean(ent, body, partial = false) {
  const out = {};
  for (const f of ent.fields) {
    let v = body[f.name];
    if (v === undefined && partial) continue;
    if (v === '' || v === undefined) v = null;
    if (v === null && f.default !== undefined && !partial) v = f.default;
    if (v === null) {
      if (f.req) throw bad(`${f.label} is required.`);
      out[f.name] = null; continue;
    }
    if (typeof v === 'string') v = v.trim();
    if (f.type === 'number' || f.type === 'ref') {
      v = Number(v);
      if (!Number.isFinite(v)) throw bad(`${f.label} must be a number.`);
      if (f.min !== undefined && v < f.min) throw bad(`${f.label} must be at least ${f.min}.`);
    } else if (f.type === 'date') {
      if (!DATE_RE.test(v)) throw bad(`${f.label} must be a date (YYYY-MM-DD).`);
    } else if (f.type === 'enum') {
      if (!f.opts.includes(v)) throw bad(`${f.label} must be one of: ${f.opts.join(', ')}.`);
    } else if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v)) {
      throw bad(`${f.label} is not a valid email.`);
    }
    if (f.pattern && !new RegExp(f.pattern).test(String(v))) throw bad(`${f.label} has an invalid format.`);
    out[f.name] = v;
  }
  return out;
}

// Per-entity extra checks (business rules that live outside CHECK constraints).
const hooks = {
  async access(d) {
    const [r] = await query('SELECT title, license_expiry < CURDATE() AS expired FROM digital_resources WHERE resource_id = ?', [d.resource_id]);
    if (!r) throw bad('Digital resource not found.');
    if (r.expired) throw bad(`Cannot log access: the license for "${r.title}" has expired.`);
  },
  async copies(d) {
    if (d.copy_condition !== 'Good') return; // marking as Damaged/Lost is always allowed
  }
};

// Entities with a many-to-many author link get an author_ids array.
async function saveAuthors(conn, bookId, ids) {
  if (!Array.isArray(ids)) return;
  await conn.query('DELETE FROM book_authors WHERE book_id = ?', [bookId]);
  for (const a of [...new Set(ids.map(Number))].filter(Boolean))
    await conn.query('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)', [bookId, a]);
}

router.get('/meta', (req, res) => {
  const m = {};
  for (const [k, e] of Object.entries(E)) m[k] = { label: e.label, pk: e.pk, fields: e.fields, noEdit: !!e.noEdit };
  res.json(m);
});

// Dropdown options for any entity.
router.get('/options/:entity', wrap(async (req, res) => {
  const e = E[req.params.entity];
  if (!e) throw new HttpError(404, 'Unknown entity');
  const extra = req.params.entity === 'members' ? ', status, plan_id' : '';
  res.json(await query(`SELECT ${e.pk} AS id, ${e.optLabel} AS label${extra} FROM ${e.table} ORDER BY label`));
}));

function entity(req) {
  const e = E[req.params.entity];
  if (!e) throw new HttpError(404, `Unknown entity "${req.params.entity}"`);
  return e;
}

router.get('/:entity', wrap(async (req, res) => {
  const e = entity(req);
  const where = [], params = [];
  const q = (req.query.q || '').trim();
  if (q && e.search) {
    where.push('(' + e.search.map((c) => `${c} LIKE ?`).join(' OR ') + ')');
    e.search.forEach(() => params.push(`%${q}%`));
  }
  for (const [p, col] of Object.entries(e.filters || {}))
    if (req.query[p]) { where.push(`${col} = ?`); params.push(req.query[p]); }
  const sql = `${e.list}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${e.order}`;
  res.json(await query(sql, params));
}));

router.get('/:entity/:id', wrap(async (req, res) => {
  const e = entity(req);
  const [row] = await query(`SELECT * FROM (${e.list}) AS x WHERE x.${e.pk} = ?`, [req.params.id]);
  if (!row) throw new HttpError(404, 'Record not found.');
  res.json(row);
}));

router.post('/:entity', wrap(async (req, res) => {
  const e = entity(req);
  const d = clean(e, req.body);
  if (hooks[req.params.entity]) await hooks[req.params.entity](d);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const cols = Object.keys(d);
    const [r] = await conn.query(`INSERT INTO ${e.table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((c) => d[c]));
    if (req.params.entity === 'books') await saveAuthors(conn, r.insertId, req.body.author_ids);
    await conn.commit();
    res.status(201).json({ message: `${e.label} record created.`, id: r.insertId });
  } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
}));

router.put('/:entity/:id', wrap(async (req, res) => {
  const e = entity(req);
  if (e.noEdit) throw new HttpError(405, 'This record type cannot be edited.');
  const d = clean(e, req.body, true);
  const cols = Object.keys(d);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (cols.length) {
      const [r] = await conn.query(`UPDATE ${e.table} SET ${cols.map((c) => c + ' = ?').join(',')} WHERE ${e.pk} = ?`, [...cols.map((c) => d[c]), req.params.id]);
      if (!r.affectedRows) throw new HttpError(404, 'Record not found.');
    }
    if (req.params.entity === 'books') await saveAuthors(conn, req.params.id, req.body.author_ids);
    await conn.commit();
    res.json({ message: `${e.label} record updated.` });
  } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
}));

router.delete('/:entity/:id', wrap(async (req, res) => {
  const e = entity(req);
  const [r] = await pool.query(`DELETE FROM ${e.table} WHERE ${e.pk} = ?`, [req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Record not found.');
  res.json({ message: 'Record deleted.' });
}));

module.exports = router;
