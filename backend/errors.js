class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (m) => new HttpError(400, m);

// Translate MySQL errors into friendly messages + HTTP status codes.
function translate(e) {
  if (e instanceof HttpError) return { status: e.status, message: e.message };
  const msg = e.sqlMessage || e.message || 'Unexpected error';
  switch (e.code) {
    case 'ER_DUP_ENTRY': {
      const key = (msg.match(/for key '(?:[^.']+\.)?([^']+)'/) || [])[1] || 'a unique field';
      const nice = { uq_members_email: 'email', uq_members_phone: 'phone number', uq_books_isbn: 'ISBN',
        uq_staff_email: 'email', uq_publishers_name: 'publisher name', uq_categories_name: 'category name',
        uq_plans_name: 'plan name', uq_digital_url: 'access URL', uq_fines_loan: 'loan (a fine already exists for it)',
        PRIMARY: 'record (already exists)' }[key] || key;
      return { status: 409, message: `Duplicate value: this ${nice} already exists.` };
    }
    case 'ER_ROW_IS_REFERENCED_2': {
      const t = (msg.match(/`library_db`\.`([^`]+)`/) || [])[1] || 'other tables';
      return { status: 409, message: `Cannot delete: records in "${t}" still reference this row.` };
    }
    case 'ER_NO_REFERENCED_ROW_2':
      return { status: 400, message: 'Invalid reference: the selected related record does not exist.' };
    case 'ER_CHECK_CONSTRAINT_VIOLATED': {
      const c = (msg.match(/Check constraint '([^']+)'/) || [])[1] || 'a rule';
      const nice = { chk_books_isbn: 'ISBN must be exactly 13 digits', chk_books_price: 'price must be > 0',
        chk_books_year: 'publication year must be 1800-2100', chk_members_email: 'email format is invalid',
        chk_loans_due: 'due date cannot be before issue date', chk_loans_return: 'return date cannot be before issue date',
        chk_fines_payment: 'Paid fines need a paid date; others must not have one',
        chk_res_dates: 'expiry date cannot be before reservation date', chk_access_duration: 'duration must be > 0',
        chk_plans_limits: 'plan values must be positive (fine/fee may be 0)', chk_fines_amount: 'fine must be >= 0' }[c] || c;
      return { status: 400, message: `Validation failed: ${nice}.` };
    }
    case 'ER_BAD_NULL_ERROR': case 'ER_TRUNCATED_WRONG_VALUE': case 'ER_DATA_TOO_LONG':
    case 'ER_WARN_DATA_OUT_OF_RANGE': case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD': case 'WARN_DATA_TRUNCATED':
      return { status: 400, message: `Invalid data: ${msg}` };
    case 'ECONNREFUSED': case 'ER_ACCESS_DENIED_ERROR': case 'ER_BAD_DB_ERROR': case 'PROTOCOL_CONNECTION_LOST':
      return { status: 503, message: `Database connection problem (${e.code}). Check your .env settings and that MySQL is running.` };
    default:
      return { status: 500, message: msg };
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = { HttpError, bad, translate, wrap };
