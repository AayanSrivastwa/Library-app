require('dotenv').config();
const mysql = require('mysql2/promise');

// Single shared pool. dateStrings keeps DATE columns as 'YYYY-MM-DD' strings.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'library_db',
  dateStrings: true,
  decimalNumbers: true,
  connectionLimit: 10,
  namedPlaceholders: false
});

const query = async (sql, params = []) => (await pool.query(sql, params))[0];

// Runs fn(conn) inside START TRANSACTION ... COMMIT, rolling back on any error.
async function withTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, withTx };
