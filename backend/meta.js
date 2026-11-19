// Single source of truth for entities: used by the API (validation, SQL) and sent to the browser (forms).
// field types: text | email | number | date | enum | ref
const E = {};

E.publishers = { table: 'publishers', pk: 'publisher_id', label: 'Publishers', optLabel: 'publisher_name',
  fields: [
    { name: 'publisher_name', label: 'Name', type: 'text', req: true },
    { name: 'city', label: 'City', type: 'text', req: true },
    { name: 'email', label: 'Email', type: 'email' }],
  list: `SELECT p.*, (SELECT COUNT(*) FROM books b WHERE b.publisher_id = p.publisher_id) AS books FROM publishers p`,
  search: ['p.publisher_name', 'p.city'], order: 'p.publisher_name' };

E.authors = { table: 'authors', pk: 'author_id', label: 'Authors', optLabel: "CONCAT(first_name,' ',last_name)",
  fields: [
    { name: 'first_name', label: 'First name', type: 'text', req: true },
    { name: 'last_name', label: 'Last name', type: 'text', req: true },
    { name: 'nationality', label: 'Nationality', type: 'text' }],
  list: `SELECT a.*, (SELECT COUNT(*) FROM book_authors ba WHERE ba.author_id = a.author_id) AS books FROM authors a`,
  search: ['a.first_name', 'a.last_name', 'a.nationality'], order: 'a.last_name, a.first_name' };

E.categories = { table: 'categories', pk: 'category_id', label: 'Categories', optLabel: 'category_name',
  fields: [{ name: 'category_name', label: 'Name', type: 'text', req: true }],
  list: `SELECT c.*, (SELECT COUNT(*) FROM books b WHERE b.category_id = c.category_id) AS books FROM categories c`,
  search: ['c.category_name'], order: 'c.category_name' };

E.plans = { table: 'membership_plans', pk: 'plan_id', label: 'Membership Plans', optLabel: 'plan_name',
  fields: [
    { name: 'plan_name', label: 'Plan name', type: 'text', req: true },
    { name: 'max_books', label: 'Max books', type: 'number', req: true, min: 1 },
    { name: 'loan_days', label: 'Loan duration (days)', type: 'number', req: true, min: 1 },
    { name: 'fine_per_day', label: 'Fine per day', type: 'number', req: true, min: 0, step: '0.01' },
    { name: 'annual_fee', label: 'Annual fee', type: 'number', req: true, min: 0, step: '0.01' }],
  list: `SELECT p.* FROM membership_plans p`, search: ['p.plan_name'], order: 'p.plan_id' };

E.staff = { table: 'staff', pk: 'staff_id', label: 'Staff', optLabel: "CONCAT(full_name,' (',role,')')",
  fields: [
    { name: 'full_name', label: 'Full name', type: 'text', req: true },
    { name: 'role', label: 'Role', type: 'text', req: true },
    { name: 'email', label: 'Email', type: 'email', req: true },
    { name: 'hire_date', label: 'Hire date', type: 'date', req: true }],
  list: `SELECT s.* FROM staff s`, search: ['s.full_name', 's.role', 's.email'], order: 's.full_name' };

E.books = { table: 'books', pk: 'book_id', label: 'Books', optLabel: 'title',
  fields: [
    { name: 'isbn', label: 'ISBN (13 digits)', type: 'text', req: true, pattern: '^[0-9]{13}$' },
    { name: 'title', label: 'Title', type: 'text', req: true },
    { name: 'publisher_id', label: 'Publisher', type: 'ref', ref: 'publishers', req: true },
    { name: 'category_id', label: 'Category', type: 'ref', ref: 'categories', req: true },
    { name: 'publication_year', label: 'Year', type: 'number', req: true, min: 1800 },
    { name: 'language', label: 'Language', type: 'text', req: true, default: 'English' },
    { name: 'price', label: 'Price', type: 'number', req: true, min: 0.01, step: '0.01' }],
  list: `SELECT b.*, p.publisher_name, c.category_name,
    (SELECT GROUP_CONCAT(CONCAT(a.first_name,' ',a.last_name) ORDER BY a.last_name SEPARATOR ', ')
       FROM book_authors ba JOIN authors a ON a.author_id = ba.author_id WHERE ba.book_id = b.book_id) AS authors,
    (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = b.book_id) AS copies
    FROM books b JOIN publishers p ON p.publisher_id = b.publisher_id JOIN categories c ON c.category_id = b.category_id`,
  search: ['b.title', 'b.isbn'], filters: { publisher_id: 'b.publisher_id', category_id: 'b.category_id' }, order: 'b.title' };

E.copies = { table: 'book_copies', pk: 'copy_id', label: 'Book Copies', optLabel: "CONCAT('#',copy_id,' - ',(SELECT title FROM books b WHERE b.book_id = book_copies.book_id))",
  fields: [
    { name: 'book_id', label: 'Book', type: 'ref', ref: 'books', req: true },
    { name: 'shelf_location', label: 'Shelf location', type: 'text', req: true },
    { name: 'copy_condition', label: 'Condition', type: 'enum', opts: ['Good', 'Damaged', 'Lost'], req: true, default: 'Good' },
    { name: 'acquired_date', label: 'Acquired date', type: 'date', req: true }],
  list: `SELECT c.*, b.title,
    CASE WHEN EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL) THEN 'On loan'
         WHEN c.copy_condition = 'Good' THEN 'Available' ELSE 'Unavailable' END AS availability
    FROM book_copies c JOIN books b ON b.book_id = c.book_id`,
  search: ['b.title', 'c.shelf_location'], filters: { book_id: 'c.book_id', copy_condition: 'c.copy_condition' }, order: 'b.title, c.copy_id' };

E.members = { table: 'members', pk: 'member_id', label: 'Members', optLabel: "CONCAT(first_name,' ',last_name)",
  fields: [
    { name: 'first_name', label: 'First name', type: 'text', req: true },
    { name: 'last_name', label: 'Last name', type: 'text', req: true },
    { name: 'email', label: 'Email', type: 'email', req: true },
    { name: 'phone', label: 'Phone (10 digits)', type: 'text', req: true, pattern: '^[0-9]{10}$' },
    { name: 'join_date', label: 'Join date', type: 'date', req: true },
    { name: 'plan_id', label: 'Membership plan', type: 'ref', ref: 'plans', req: true },
    { name: 'referred_by', label: 'Referred by', type: 'ref', ref: 'members' },
    { name: 'status', label: 'Status', type: 'enum', opts: ['Active', 'Suspended', 'Expired'], req: true, default: 'Active' }],
  list: `SELECT m.*, p.plan_name, CONCAT(r.first_name,' ',r.last_name) AS referred_by_name
    FROM members m JOIN membership_plans p ON p.plan_id = m.plan_id LEFT JOIN members r ON r.member_id = m.referred_by`,
  search: ["CONCAT(m.first_name,' ',m.last_name)", 'm.email', 'm.phone'], filters: { status: 'm.status', plan_id: 'm.plan_id' }, order: 'm.last_name, m.first_name' };

E.resources = { table: 'digital_resources', pk: 'resource_id', label: 'Digital Resources', optLabel: 'title',
  fields: [
    { name: 'title', label: 'Title', type: 'text', req: true },
    { name: 'resource_type', label: 'Type', type: 'enum', opts: ['E-Book', 'Journal', 'Audio Book', 'Video'], req: true },
    { name: 'publisher_id', label: 'Publisher', type: 'ref', ref: 'publishers', req: true },
    { name: 'category_id', label: 'Category', type: 'ref', ref: 'categories', req: true },
    { name: 'file_format', label: 'File format', type: 'text', req: true },
    { name: 'access_url', label: 'Access URL', type: 'text', req: true },
    { name: 'license_expiry', label: 'License expiry', type: 'date', req: true }],
  list: `SELECT d.*, p.publisher_name, c.category_name, (d.license_expiry < CURDATE()) AS expired
    FROM digital_resources d JOIN publishers p ON p.publisher_id = d.publisher_id JOIN categories c ON c.category_id = d.category_id`,
  search: ['d.title'], filters: { resource_type: 'd.resource_type', publisher_id: 'd.publisher_id', category_id: 'd.category_id' }, order: 'd.title' };

E.reservations = { table: 'reservations', pk: 'reservation_id', label: 'Reservations', optLabel: 'reservation_id',
  fields: [
    { name: 'member_id', label: 'Member', type: 'ref', ref: 'members', req: true },
    { name: 'book_id', label: 'Book', type: 'ref', ref: 'books', req: true },
    { name: 'reservation_date', label: 'Reservation date', type: 'date', req: true },
    { name: 'expiry_date', label: 'Expiry date', type: 'date', req: true },
    { name: 'status', label: 'Status', type: 'enum', opts: ['Pending', 'Fulfilled', 'Cancelled', 'Expired'], req: true, default: 'Pending' }],
  list: `SELECT r.*, CONCAT(m.first_name,' ',m.last_name) AS member_name, b.title
    FROM reservations r JOIN members m ON m.member_id = r.member_id JOIN books b ON b.book_id = r.book_id`,
  search: ["CONCAT(m.first_name,' ',m.last_name)", 'b.title'], filters: { status: 'r.status', member_id: 'r.member_id' }, order: 'r.reservation_date DESC, r.reservation_id DESC' };

E.access = { table: 'digital_access_log', pk: 'access_id', label: 'Digital Access Logs', optLabel: 'access_id',
  fields: [
    { name: 'member_id', label: 'Member', type: 'ref', ref: 'members', req: true },
    { name: 'resource_id', label: 'Digital resource', type: 'ref', ref: 'resources', req: true },
    { name: 'access_date', label: 'Access date', type: 'date', req: true },
    { name: 'duration_minutes', label: 'Duration (minutes)', type: 'number', req: true, min: 1 }],
  list: `SELECT a.*, CONCAT(m.first_name,' ',m.last_name) AS member_name, d.title, d.resource_type
    FROM digital_access_log a JOIN members m ON m.member_id = a.member_id JOIN digital_resources d ON d.resource_id = a.resource_id`,
  search: ['d.title', "CONCAT(m.first_name,' ',m.last_name)"], filters: { member_id: 'a.member_id', resource_id: 'a.resource_id' }, order: 'a.access_date DESC, a.access_id DESC',
  noEdit: true };

module.exports = E;
