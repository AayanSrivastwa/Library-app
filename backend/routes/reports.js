const express = require('express');
const { query } = require('../db');
const { HttpError, wrap } = require('../errors');
const router = express.Router();

// Each report: title, SQL, optional chart {label, values[]}. Uses existing views, CTEs and window functions.
const R = {
  overdue: { title: 'Overdue books', sql: 'SELECT * FROM v_overdue_books ORDER BY days_overdue DESC' },
  popular: { title: 'Most frequently borrowed books (top 10)', chart: { label: 'title', values: ['total_loans'] },
    sql: 'SELECT title, category_name, total_loans FROM v_book_popularity ORDER BY total_loans DESC, title LIMIT 10' },
  activity: { title: 'Member activity', sql: 'SELECT * FROM v_member_activity ORDER BY physical_loans DESC, member_id' },
  available: { title: 'Available physical copies', sql: 'SELECT * FROM v_available_copies ORDER BY title, copy_id' },
  fines: { title: 'Fine collection summary', chart: { label: 'payment_status', values: ['total_amount'] },
    sql: `SELECT payment_status, COUNT(*) AS fines, SUM(fine_amount) AS total_amount FROM fines GROUP BY payment_status` },
  never: { title: 'Members who never borrowed a book',
    sql: `SELECT m.member_id, CONCAT(m.first_name,' ',m.last_name) AS member_name, m.email, m.join_date, m.status FROM members m
          WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.member_id = m.member_id) ORDER BY m.member_id` },
  noreservation: { title: 'Books with no reservations',
    sql: `SELECT b.book_id, b.title, b.isbn FROM books b LEFT JOIN reservations r ON r.book_id = b.book_id WHERE r.reservation_id IS NULL ORDER BY b.title` },
  category: { title: 'Category-wise borrowing statistics (window RANK)', chart: { label: 'category_name', values: ['total_loans'] },
    sql: `WITH cat AS (
            SELECT c.category_name, COUNT(DISTINCT b.book_id) AS books, COUNT(l.loan_id) AS total_loans
            FROM categories c LEFT JOIN books b ON b.category_id = c.category_id
            LEFT JOIN book_copies bc ON bc.book_id = b.book_id LEFT JOIN loans l ON l.copy_id = bc.copy_id
            GROUP BY c.category_id, c.category_name)
          SELECT category_name, books, total_loans, RANK() OVER (ORDER BY total_loans DESC) AS loan_rank FROM cat ORDER BY loan_rank, category_name` },
  monthly: { title: 'Monthly physical vs digital usage (CTE)', chart: { label: 'month', values: ['physical_loans', 'digital_accesses'] },
    sql: `WITH phys AS (SELECT DATE_FORMAT(issue_date,'%Y-%m') AS ym, COUNT(*) AS n FROM loans GROUP BY ym),
               dig  AS (SELECT DATE_FORMAT(access_date,'%Y-%m') AS ym, COUNT(*) AS n FROM digital_access_log GROUP BY ym),
               months AS (SELECT ym FROM phys UNION SELECT ym FROM dig)
          SELECT months.ym AS month, COALESCE(phys.n,0) AS physical_loans, COALESCE(dig.n,0) AS digital_accesses
          FROM months LEFT JOIN phys ON phys.ym = months.ym LEFT JOIN dig ON dig.ym = months.ym ORDER BY months.ym` },
  ranking: { title: 'Member borrowing rankings (window RANK / DENSE_RANK)', chart: { label: 'member_name', values: ['physical_loans'] },
    sql: `SELECT member_name, plan_name, physical_loans, digital_accesses,
                 RANK() OVER (ORDER BY physical_loans DESC) AS loan_rank,
                 DENSE_RANK() OVER (ORDER BY physical_loans + digital_accesses DESC) AS overall_rank
          FROM v_member_activity ORDER BY loan_rank, member_name` }
};

router.get('/', (req, res) => res.json(Object.entries(R).map(([key, r]) => ({ key, title: r.title }))));
router.get('/:key', wrap(async (req, res) => {
  const r = R[req.params.key];
  if (!r) throw new HttpError(404, 'Unknown report');
  res.json({ title: r.title, chart: r.chart || null, sql: r.sql.replace(/\s+/g, ' ').trim(), rows: await query(r.sql) });
}));
module.exports = router;
