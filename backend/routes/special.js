// Detail views, circulation (issue/return), fines and the dashboard.
const express = require('express');
const { query, withTx } = require('../db');
const { bad, HttpError, wrap } = require('../errors');
const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- Detail views ---------- */
router.get('/detail/books/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const [book] = await query(`SELECT b.*, p.publisher_name, c.category_name FROM books b
    JOIN publishers p ON p.publisher_id=b.publisher_id JOIN categories c ON c.category_id=b.category_id WHERE b.book_id=?`, [id]);
  if (!book) throw new HttpError(404, 'Book not found.');
  book.author_list = await query(`SELECT a.author_id, a.first_name, a.last_name FROM book_authors ba JOIN authors a ON a.author_id=ba.author_id WHERE ba.book_id=?`, [id]);
  book.copy_list = await query(`SELECT c.copy_id, c.shelf_location, c.copy_condition, c.acquired_date,
    CASE WHEN EXISTS (SELECT 1 FROM loans l WHERE l.copy_id=c.copy_id AND l.return_date IS NULL) THEN 'On loan' WHEN c.copy_condition='Good' THEN 'Available' ELSE 'Unavailable' END AS availability
    FROM book_copies c WHERE c.book_id=?`, [id]);
  res.json(book);
}));
const related = {
  authors: [`SELECT b.book_id, b.title, b.isbn, b.publication_year FROM books b JOIN book_authors ba ON ba.book_id=b.book_id WHERE ba.author_id=?`],
  publishers: [`SELECT book_id, title, isbn, publication_year FROM books WHERE publisher_id=?`],
  categories: [`SELECT book_id, title, isbn, publication_year FROM books WHERE category_id=?`],
};
router.get('/detail/:kind/:id/books', wrap(async (req, res) => {
  const r = related[req.params.kind];
  if (!r) throw new HttpError(404, 'Unknown relation');
  res.json(await query(r[0], [req.params.id]));
}));
router.get('/detail/books/:id/authors', wrap(async (req, res) =>
  res.json(await query('SELECT author_id FROM book_authors WHERE book_id=?', [req.params.id]))));

router.get('/detail/copies/:id/history', wrap(async (req, res) => {
  res.json(await query(`SELECT l.loan_id, CONCAT(m.first_name,' ',m.last_name) AS member_name, l.issue_date, l.due_date, l.return_date
    FROM loans l JOIN members m ON m.member_id=l.member_id WHERE l.copy_id=? ORDER BY l.issue_date DESC`, [req.params.id]));
}));

router.get('/detail/members/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const [member] = await query(`SELECT m.*, p.plan_name, p.max_books, p.loan_days, p.fine_per_day FROM members m JOIN membership_plans p ON p.plan_id=m.plan_id WHERE m.member_id=?`, [id]);
  if (!member) throw new HttpError(404, 'Member not found.');
  member.loans = await query(`SELECT l.loan_id, b.title, l.issue_date, l.due_date, l.return_date FROM loans l
    JOIN book_copies c ON c.copy_id=l.copy_id JOIN books b ON b.book_id=c.book_id WHERE l.member_id=? ORDER BY l.issue_date DESC`, [id]);
  member.reservations = await query(`SELECT r.reservation_id, b.title, r.reservation_date, r.expiry_date, r.status FROM reservations r JOIN books b ON b.book_id=r.book_id WHERE r.member_id=?`, [id]);
  member.fines = await query(`SELECT f.fine_id, b.title, f.fine_amount, f.fine_date, f.payment_status FROM fines f JOIN loans l ON l.loan_id=f.loan_id
    JOIN book_copies c ON c.copy_id=l.copy_id JOIN books b ON b.book_id=c.book_id WHERE l.member_id=? AND f.payment_status='Unpaid'`, [id]);
  member.referred = await query(`SELECT member_id, CONCAT(first_name,' ',last_name) AS name, join_date FROM members WHERE referred_by=?`, [id]);
  const [ref] = await query(`SELECT CONCAT(first_name,' ',last_name) AS name FROM members WHERE member_id=?`, [member.referred_by || 0]);
  member.referrer = ref ? ref.name : null;
  res.json(member);
}));

// Eligibility info used by the issue form (plan limits, current loans).
router.get('/members/:id/eligibility', wrap(async (req, res) => {
  const [m] = await query(`SELECT m.status, p.plan_name, p.max_books, p.loan_days, p.fine_per_day,
    (SELECT COUNT(*) FROM loans l WHERE l.member_id=m.member_id AND l.return_date IS NULL) AS active_loans
    FROM members m JOIN membership_plans p ON p.plan_id=m.plan_id WHERE m.member_id=?`, [req.params.id]);
  if (!m) throw new HttpError(404, 'Member not found.');
  res.json(m);
}));

/* ---------- Circulation ---------- */
router.get('/copies-available/list', wrap(async (req, res) =>
  res.json(await query('SELECT copy_id AS id, CONCAT(\'#\',copy_id,\' - \',title,\' [\',shelf_location,\']\') AS label FROM v_available_copies ORDER BY title, copy_id'))));

const STATUS_SQL = `CASE WHEN l.return_date IS NOT NULL THEN 'Returned' WHEN l.due_date < CURDATE() THEN 'Overdue' ELSE 'Active' END`;
router.get('/loans', wrap(async (req, res) => {
  const where = [], params = [];
  const q = (req.query.q || '').trim();
  if (q) { where.push(`(CONCAT(m.first_name,' ',m.last_name) LIKE ? OR b.title LIKE ?)`); params.push(`%${q}%`, `%${q}%`); }
  if (req.query.member_id) { where.push('l.member_id = ?'); params.push(req.query.member_id); }
  if (req.query.status === 'Active') where.push('l.return_date IS NULL');
  else if (req.query.status === 'Overdue') where.push('l.return_date IS NULL AND l.due_date < CURDATE()');
  else if (req.query.status === 'Returned') where.push('l.return_date IS NOT NULL');
  res.json(await query(`SELECT l.loan_id, l.copy_id, b.title, CONCAT(m.first_name,' ',m.last_name) AS member_name, s.full_name AS issued_by_name,
      l.issue_date, l.due_date, l.return_date, ${STATUS_SQL} AS status,
      CASE WHEN l.return_date IS NULL AND l.due_date < CURDATE() THEN DATEDIFF(CURDATE(), l.due_date) ELSE 0 END AS days_overdue,
      CASE WHEN l.return_date IS NULL AND l.due_date < CURDATE() THEN DATEDIFF(CURDATE(), l.due_date) * p.fine_per_day ELSE 0 END AS estimated_fine,
      f.fine_amount, f.payment_status AS fine_status
    FROM loans l JOIN members m ON m.member_id=l.member_id JOIN membership_plans p ON p.plan_id=m.plan_id
    JOIN book_copies c ON c.copy_id=l.copy_id JOIN books b ON b.book_id=c.book_id JOIN staff s ON s.staff_id=l.issued_by
    LEFT JOIN fines f ON f.loan_id=l.loan_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.issue_date DESC, l.loan_id DESC`, params));
}));

router.post('/loans/issue', wrap(async (req, res) => {
  const { member_id, copy_id, issued_by, issue_date, due_date } = req.body;
  if (!member_id || !copy_id || !issued_by) throw bad('Member, copy and staff are required.');
  if (!DATE_RE.test(issue_date || '') || !DATE_RE.test(due_date || '')) throw bad('Issue and due dates are required (YYYY-MM-DD).');
  if (due_date < issue_date) throw bad('Due date must not be earlier than issue date.');
  const id = await withTx(async (conn) => {
    const [[m]] = await conn.query(`SELECT m.status, p.max_books FROM members m JOIN membership_plans p ON p.plan_id=m.plan_id WHERE m.member_id=? FOR UPDATE`, [member_id]);
    if (!m) throw bad('Member not found.');
    if (m.status !== 'Active') throw bad(`Member is ${m.status}; only Active members can borrow.`);
    const [[cnt]] = await conn.query('SELECT COUNT(*) AS n FROM loans WHERE member_id=? AND return_date IS NULL', [member_id]);
    if (cnt.n >= m.max_books) throw bad(`Borrowing limit reached (${cnt.n}/${m.max_books} books on loan).`);
    const [[c]] = await conn.query('SELECT copy_condition FROM book_copies WHERE copy_id=? FOR UPDATE', [copy_id]);
    if (!c) throw bad('Copy not found.');
    if (c.copy_condition !== 'Good') throw bad(`Copy is ${c.copy_condition}; only copies in Good condition can be issued.`);
    const [[act]] = await conn.query('SELECT COUNT(*) AS n FROM loans WHERE copy_id=? AND return_date IS NULL', [copy_id]);
    if (act.n) throw bad('This copy is already issued (active loan exists).');
    const [r] = await conn.query('INSERT INTO loans (copy_id, member_id, issued_by, issue_date, due_date) VALUES (?,?,?,?,?)', [copy_id, member_id, issued_by, issue_date, due_date]);
    return r.insertId;
  });
  res.status(201).json({ message: `Book issued (loan #${id}).`, id });
}));

router.post('/loans/:id/return', wrap(async (req, res) => {
  const rd = req.body.return_date;
  if (rd && !DATE_RE.test(rd)) throw bad('Return date must be YYYY-MM-DD.');
  const out = await withTx(async (conn) => {
    const [[l]] = await conn.query(`SELECT l.*, p.fine_per_day, COALESCE(?, CURDATE()) AS ret FROM loans l
      JOIN members m ON m.member_id=l.member_id JOIN membership_plans p ON p.plan_id=m.plan_id WHERE l.loan_id=? FOR UPDATE`, [rd || null, req.params.id]);
    if (!l) throw new HttpError(404, 'Loan not found.');
    if (l.return_date) throw bad('This book has already been returned.');
    if (String(l.ret) < String(l.issue_date)) throw bad('Return date cannot be before the issue date.');
    await conn.query('UPDATE loans SET return_date=? WHERE loan_id=?', [l.ret, l.loan_id]);
    const [[d]] = await conn.query('SELECT GREATEST(DATEDIFF(?, ?), 0) AS late', [l.ret, l.due_date]);
    const amount = d.late * l.fine_per_day;
    let fine = null;
    if (amount > 0) {
      const [[ex]] = await conn.query('SELECT fine_id FROM fines WHERE loan_id=?', [l.loan_id]); // fines.loan_id is UNIQUE
      if (!ex) { await conn.query('INSERT INTO fines (loan_id, fine_amount, fine_date) VALUES (?,?,?)', [l.loan_id, amount, l.ret]); fine = amount; }
    }
    return { late: d.late, fine };
  });
  res.json({ message: out.fine ? `Returned ${out.late} day(s) late. Fine of ${out.fine} recorded.` : 'Book returned on time. No fine.', ...out });
}));

/* ---------- Fines ---------- */
router.get('/fines', wrap(async (req, res) => {
  const where = [], params = [];
  if (req.query.status) { where.push('f.payment_status = ?'); params.push(req.query.status); }
  if (req.query.member_id) { where.push('l.member_id = ?'); params.push(req.query.member_id); }
  res.json(await query(`SELECT f.*, l.member_id, CONCAT(m.first_name,' ',m.last_name) AS member_name, b.title, l.due_date, l.return_date
    FROM fines f JOIN loans l ON l.loan_id=f.loan_id JOIN members m ON m.member_id=l.member_id
    JOIN book_copies c ON c.copy_id=l.copy_id JOIN books b ON b.book_id=c.book_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY f.fine_date DESC, f.fine_id DESC`, params));
}));
router.get('/fines-summary/totals', wrap(async (req, res) => {
  const [r] = await query(`SELECT COALESCE(SUM(CASE WHEN payment_status='Paid' THEN fine_amount END),0) AS collected,
    COALESCE(SUM(CASE WHEN payment_status='Unpaid' THEN fine_amount END),0) AS unpaid,
    COALESCE(SUM(CASE WHEN payment_status='Waived' THEN fine_amount END),0) AS waived FROM fines`);
  res.json(r);
}));
router.put('/fines/:id/status', wrap(async (req, res) => {
  const { payment_status, paid_date } = req.body;
  if (!['Unpaid', 'Paid', 'Waived'].includes(payment_status)) throw bad('Status must be Unpaid, Paid or Waived.');
  if (paid_date && !DATE_RE.test(paid_date)) throw bad('Paid date must be YYYY-MM-DD.');
  // chk_fines_payment: Paid <=> paid_date present
  const r = await query(`UPDATE fines SET payment_status=?, paid_date=${payment_status === 'Paid' ? 'COALESCE(?, CURDATE())' : 'NULL'} WHERE fine_id=?`,
    payment_status === 'Paid' ? [payment_status, paid_date || null, req.params.id] : [payment_status, req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Fine not found.');
  res.json({ message: `Fine marked ${payment_status}.` });
}));

/* ---------- Dashboard ---------- */
router.get('/dashboard', wrap(async (req, res) => {
  const [s] = await query(`SELECT
    (SELECT COUNT(*) FROM books) AS books,
    (SELECT COUNT(*) FROM book_copies) AS copies,
    (SELECT COUNT(*) FROM v_available_copies) AS available_copies,
    (SELECT COUNT(*) FROM loans WHERE return_date IS NULL) AS active_loans,
    (SELECT COUNT(*) FROM loans WHERE return_date IS NULL AND due_date < CURDATE()) AS overdue_loans,
    (SELECT COUNT(*) FROM members) AS members,
    (SELECT COUNT(*) FROM reservations) AS reservations,
    (SELECT COALESCE(SUM(fine_amount),0) FROM fines WHERE payment_status='Unpaid') AS unpaid_fines,
    (SELECT COUNT(*) FROM digital_resources) AS digital_resources,
    (SELECT COUNT(*) FROM loans) AS physical_usage,
    (SELECT COUNT(*) FROM digital_access_log) AS digital_usage`);
  const recent_loans = await query(`SELECT l.loan_id, b.title, CONCAT(m.first_name,' ',m.last_name) AS member_name, l.issue_date FROM loans l
    JOIN members m ON m.member_id=l.member_id JOIN book_copies c ON c.copy_id=l.copy_id JOIN books b ON b.book_id=c.book_id ORDER BY l.issue_date DESC, l.loan_id DESC LIMIT 5`);
  const recent_members = await query(`SELECT member_id, CONCAT(first_name,' ',last_name) AS name, join_date, status FROM members ORDER BY join_date DESC, member_id DESC LIMIT 5`);
  const recent_reservations = await query(`SELECT r.reservation_id, b.title, CONCAT(m.first_name,' ',m.last_name) AS member_name, r.status, r.reservation_date FROM reservations r
    JOIN members m ON m.member_id=r.member_id JOIN books b ON b.book_id=r.book_id ORDER BY r.reservation_date DESC, r.reservation_id DESC LIMIT 5`);
  const overdue = await query('SELECT loan_id, member_name, book_title, due_date, days_overdue, estimated_fine FROM v_overdue_books ORDER BY days_overdue DESC');
  res.json({ stats: s, recent_loans, recent_members, recent_reservations, overdue });
}));

module.exports = router;
