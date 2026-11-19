'use strict';
/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const money = (n) => Number(n || 0).toFixed(2);
async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}
function toast(msg, bad) { const d = document.createElement('div'); d.textContent = msg; if (bad) d.className = 'bad'; $('#toast').append(d); setTimeout(() => d.remove(), bad ? 6000 : 3000); }
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };
const badge = (v) => { const c = { Active: 'green', Available: 'green', Good: 'green', Paid: 'green', Returned: 'green', Fulfilled: 'green', Overdue: 'red', Unpaid: 'red', Lost: 'red', Expired: 'red', Suspended: 'amber', Damaged: 'amber', Pending: 'amber', 'On loan': 'blue', Waived: 'blue', Cancelled: '', Unavailable: '' }[v]; return c === undefined ? esc(v) : `<span class="badge ${c ? 'b-' + c : ''}">${esc(v)}</span>`; };
const BADGE_COLS = new Set(['status', 'copy_condition', 'availability', 'payment_status', 'fine_status']);

/* ---------- modal ---------- */
function openModal(title, html, wide) { $('#mTitle').textContent = title; $('#mBody').innerHTML = html; $('#modal .modal-box').classList.toggle('wide', !!wide); $('#modal').classList.remove('hidden'); }
const closeModal = () => $('#modal').classList.add('hidden');
$('#mClose').onclick = closeModal;
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
const confirmBox = (msg) => window.confirm(msg);

/* ---------- sortable, paginated table ---------- */
function dataTable(host, cols, rows, actions, pageSize = 10) {
  let sort = null, dir = 1, page = 0;
  const draw = () => {
    let data = rows.slice();
    if (sort) data.sort((a, b) => { const x = a[sort], y = b[sort]; const n = typeof x === 'number' && typeof y === 'number'; return (n ? x - y : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true })) * dir; });
    const pages = Math.max(1, Math.ceil(data.length / pageSize)); page = Math.min(page, pages - 1);
    const slice = data.slice(page * pageSize, (page + 1) * pageSize);
    host.innerHTML = `<div class="tw"><table><thead><tr>${cols.map(([k, l]) => `<th data-k="${k}">${esc(l)}${sort === k ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}${actions ? '<th></th>' : ''}</tr></thead><tbody>
      ${slice.map((r, i) => `<tr>${cols.map(([k]) => `<td>${BADGE_COLS.has(k) && r[k] ? badge(r[k]) : esc(r[k])}</td>`).join('')}${actions ? `<td class="act">${actions(r).map((a, j) => `<button class="btn sm ${a.cls || ''}" data-i="${i}" data-j="${j}">${esc(a.label)}</button>`).join('')}</td>` : ''}</tr>`).join('') || `<tr><td class="empty" colspan="${cols.length + 1}">No records found</td></tr>`}</tbody></table></div>
      <div class="pager"><span>${data.length} record(s)</span><button class="btn sm" id="pp" ${page ? '' : 'disabled'}>Prev</button><span>Page ${page + 1} / ${pages}</span><button class="btn sm" id="pn" ${page < pages - 1 ? '' : 'disabled'}>Next</button></div>`;
    host.querySelectorAll('th[data-k]').forEach((th) => th.onclick = () => { const k = th.dataset.k; dir = sort === k ? -dir : 1; sort = k; draw(); });
    host.querySelectorAll('button[data-i]').forEach((b) => b.onclick = guard(() => actions(slice[b.dataset.i])[b.dataset.j].run(slice[b.dataset.i])));
    $('#pp', host).onclick = () => { page--; draw(); }; $('#pn', host).onclick = () => { page++; draw(); };
  };
  draw();
}
const simpleTable = (rows, cols) => rows.length ? `<div class="tw"><table><thead><tr>${cols.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map(([k]) => `<td>${BADGE_COLS.has(k) ? badge(r[k]) : esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="empty">None</div>';
function bars(rows, labelKey, valueKeys) {
  const max = Math.max(1, ...rows.flatMap((r) => valueKeys.map((k) => Number(r[k]) || 0)));
  return `<div class="bars">${valueKeys.length > 1 ? `<div class="legend">${valueKeys.map((k, i) => `<span><i class="${i ? 'b2' : ''}"></i>${esc(k.replace(/_/g, ' '))}</span>`).join('')}</div>` : ''}${rows.map((r) => valueKeys.map((k, i) => `<div class="row"><div class="lab">${i ? '' : esc(r[labelKey])}</div><div class="bar ${i ? 'b2' : ''}" style="width:${(Number(r[k]) || 0) / max * 70}%"></div><span>${esc(r[k])}</span></div>`).join('')).join('')}</div>`;
}

/* ---------- generic form ---------- */
let META = {};
const optCache = {};
async function options(ent, fresh) { if (fresh || !optCache[ent]) optCache[ent] = await api('/options/' + ent); return optCache[ent]; }
async function openForm(ent, rec, onSaved) {
  const m = META[ent], editing = !!rec;
  const opts = {};
  for (const f of m.fields) if (f.type === 'ref') opts[f.name] = await options(f.ref, true);
  let authors = [], selAuthors = [];
  if (ent === 'books') { authors = await options('authors', true); if (editing) selAuthors = (await api(`/detail/books/${rec[m.pk]}/authors`)).map((a) => a.author_id); }
  const input = (f) => {
    const v = rec ? rec[f.name] : (f.default ?? (f.type === 'date' && f.name !== 'expiry_date' ? '' : ''));
    const req = f.req ? 'required' : '';
    if (f.type === 'ref') return `<select name="${f.name}" ${req}><option value="">${f.req ? '-- select --' : '-- none --'}</option>${opts[f.name].filter((o) => !(f.ref === ent && editing && o.id === rec[m.pk])).map((o) => `<option value="${o.id}" ${String(v) === String(o.id) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    if (f.type === 'enum') return `<select name="${f.name}" ${req}>${f.opts.map((o) => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    const t = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text';
    return `<input name="${f.name}" type="${t}" value="${esc(v)}" ${req} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.type === 'number' ? `step="${f.step || 1}"` : ''} ${f.pattern ? `pattern="${f.pattern}"` : ''}>`;
  };
  openModal((editing ? 'Edit ' : 'Add ') + m.label.replace(/s$/, ''), `<form class="form" id="f">${m.fields.map((f) => `<label>${esc(f.label)}${f.req ? ' *' : ''}${input(f)}</label>`).join('')}
    ${ent === 'books' ? `<label class="full">Authors (Ctrl/Cmd+click for several)<select name="author_ids" multiple size="5">${authors.map((a) => `<option value="${a.id}" ${selAuthors.includes(a.id) ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select></label>` : ''}
    <div class="err" id="ferr"></div><div class="actions"><button type="button" class="btn" id="fc">Cancel</button><button class="btn primary">Save</button></div></form>`);
  $('#fc').onclick = closeModal;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const body = {}; new FormData(e.target).forEach((v, k) => { if (k !== 'author_ids') body[k] = v; });
    if (ent === 'books') body.author_ids = [...e.target.author_ids.selectedOptions].map((o) => o.value);
    try { const r = await api(`/${ent}${editing ? '/' + rec[m.pk] : ''}`, editing ? 'PUT' : 'POST', body); closeModal(); toast(r.message); Object.keys(optCache).forEach((k) => delete optCache[k]); onSaved(); }
    catch (err) { $('#ferr').textContent = err.message; }
  };
}

/* ---------- generic module page ---------- */
const COLS = {
  books: [['book_id', 'ID'], ['isbn', 'ISBN'], ['title', 'Title'], ['authors', 'Authors'], ['publisher_name', 'Publisher'], ['category_name', 'Category'], ['publication_year', 'Year'], ['price', 'Price'], ['copies', 'Copies']],
  authors: [['author_id', 'ID'], ['first_name', 'First name'], ['last_name', 'Last name'], ['nationality', 'Nationality'], ['books', 'Books']],
  publishers: [['publisher_id', 'ID'], ['publisher_name', 'Name'], ['city', 'City'], ['email', 'Email'], ['books', 'Books']],
  categories: [['category_id', 'ID'], ['category_name', 'Name'], ['books', 'Books']],
  copies: [['copy_id', 'Copy'], ['title', 'Book'], ['shelf_location', 'Shelf'], ['copy_condition', 'Condition'], ['availability', 'Availability'], ['acquired_date', 'Acquired']],
  members: [['member_id', 'ID'], ['first_name', 'First'], ['last_name', 'Last'], ['email', 'Email'], ['phone', 'Phone'], ['plan_name', 'Plan'], ['status', 'Status'], ['join_date', 'Joined']],
  plans: [['plan_id', 'ID'], ['plan_name', 'Plan'], ['max_books', 'Max books'], ['loan_days', 'Loan days'], ['fine_per_day', 'Fine / day'], ['annual_fee', 'Annual fee']],
  staff: [['staff_id', 'ID'], ['full_name', 'Name'], ['role', 'Role'], ['email', 'Email'], ['hire_date', 'Hired']],
  resources: [['resource_id', 'ID'], ['title', 'Title'], ['resource_type', 'Type'], ['publisher_name', 'Publisher'], ['category_name', 'Category'], ['file_format', 'Format'], ['access_url', 'Access URL'], ['license_expiry', 'License expiry']],
  reservations: [['reservation_id', 'ID'], ['member_name', 'Member'], ['title', 'Book'], ['reservation_date', 'Reserved'], ['expiry_date', 'Expires'], ['status', 'Status']],
  access: [['access_id', 'ID'], ['member_name', 'Member'], ['title', 'Resource'], ['resource_type', 'Type'], ['access_date', 'Date'], ['duration_minutes', 'Minutes']]
};
const FILTERS = {
  books: [['category_id', 'Category', 'categories'], ['publisher_id', 'Publisher', 'publishers']],
  copies: [['book_id', 'Book', 'books'], ['copy_condition', 'Condition', ['Good', 'Damaged', 'Lost']]],
  members: [['status', 'Status', ['Active', 'Suspended', 'Expired']], ['plan_id', 'Plan', 'plans']],
  resources: [['resource_type', 'Type', ['E-Book', 'Journal', 'Audio Book', 'Video']], ['publisher_id', 'Publisher', 'publishers'], ['category_id', 'Category', 'categories']],
  reservations: [['status', 'Status', ['Pending', 'Fulfilled', 'Cancelled', 'Expired']], ['member_id', 'Member', 'members']],
  access: [['member_id', 'Member', 'members'], ['resource_id', 'Resource', 'resources']]
};
const SEARCH_HINT = { books: 'title or ISBN', members: 'name, email or phone', reservations: 'member or book', access: 'member or resource', resources: 'title' };
const ADD_LABEL = { access: 'Record access', reservations: 'New reservation', members: 'Register member' };

async function detail(ent, r) {
  const id = r[META[ent].pk];
  if (ent === 'books') {
    const b = await api('/detail/books/' + id);
    openModal(b.title, `<dl><dt>ISBN</dt><dd>${esc(b.isbn)}</dd><dt>Publisher</dt><dd>${esc(b.publisher_name)}</dd><dt>Category</dt><dd>${esc(b.category_name)}</dd><dt>Year / Language</dt><dd>${esc(b.publication_year)} / ${esc(b.language)}</dd><dt>Price</dt><dd>${money(b.price)}</dd><dt>Authors</dt><dd>${b.author_list.map((a) => esc(a.first_name + ' ' + a.last_name)).join(', ') || '-'}</dd></dl>
      <h3>Physical copies</h3>${simpleTable(b.copy_list, [['copy_id', 'Copy'], ['shelf_location', 'Shelf'], ['copy_condition', 'Condition'], ['availability', 'Availability'], ['acquired_date', 'Acquired']])}`, true);
  } else if (['authors', 'publishers', 'categories'].includes(ent)) {
    openModal('Books', simpleTable(await api(`/detail/${ent}/${id}/books`), [['book_id', 'ID'], ['title', 'Title'], ['isbn', 'ISBN'], ['publication_year', 'Year']]), true);
  } else if (ent === 'copies') {
    openModal(`Borrowing history - copy #${id}`, simpleTable(await api(`/detail/copies/${id}/history`), [['loan_id', 'Loan'], ['member_name', 'Member'], ['issue_date', 'Issued'], ['due_date', 'Due'], ['return_date', 'Returned']]), true);
  } else if (ent === 'members') {
    const m = await api('/detail/members/' + id);
    openModal(`${m.first_name} ${m.last_name}`, `<dl><dt>Email / Phone</dt><dd>${esc(m.email)} / ${esc(m.phone)}</dd><dt>Plan</dt><dd>${esc(m.plan_name)} (max ${m.max_books} books, ${m.loan_days} days, fine ${money(m.fine_per_day)}/day)</dd><dt>Status</dt><dd>${badge(m.status)}</dd><dt>Referred by</dt><dd>${esc(m.referrer || '-')}</dd></dl>
      <h3>Has referred</h3>${simpleTable(m.referred, [['name', 'Member'], ['join_date', 'Joined']])}
      <h3>Borrowing history</h3>${simpleTable(m.loans, [['loan_id', 'Loan'], ['title', 'Book'], ['issue_date', 'Issued'], ['due_date', 'Due'], ['return_date', 'Returned']])}
      <h3>Reservations</h3>${simpleTable(m.reservations, [['title', 'Book'], ['reservation_date', 'Reserved'], ['expiry_date', 'Expires'], ['status', 'Status']])}
      <h3>Unpaid fines</h3>${simpleTable(m.fines, [['fine_id', 'Fine'], ['title', 'Book'], ['fine_amount', 'Amount'], ['fine_date', 'Date']])}`, true);
  } else if (ent === 'staff') {
    openModal(r.full_name, `<dl><dt>Role</dt><dd>${esc(r.role)}</dd><dt>Email</dt><dd>${esc(r.email)}</dd><dt>Hire date</dt><dd>${esc(r.hire_date)}</dd></dl>`);
  } else if (ent === 'resources') {
    openModal(r.title, `<dl><dt>Type</dt><dd>${esc(r.resource_type)}</dd><dt>Publisher</dt><dd>${esc(r.publisher_name)}</dd><dt>Category</dt><dd>${esc(r.category_name)}</dd><dt>Format</dt><dd>${esc(r.file_format)}</dd><dt>Access URL</dt><dd>${esc(r.access_url)}</dd><dt>License expiry</dt><dd>${esc(r.license_expiry)} ${r.expired ? badge('Expired') : ''}</dd></dl>`);
  }
}
const VIEWABLE = new Set(['books', 'authors', 'publishers', 'categories', 'copies', 'members', 'staff', 'resources']);

async function entityPage(ent) {
  const m = META[ent], host = $('#view');
  host.innerHTML = `<div class="toolbar"><input id="q" placeholder="Search ${SEARCH_HINT[ent] || ''}" size="26"><span id="flt"></span><span class="sp"></span><button class="btn primary" id="add">+ ${ADD_LABEL[ent] || 'Add'}</button></div><div class="card" id="tbl"></div>`;
  const filters = {};
  for (const [p, label, src] of FILTERS[ent] || []) {
    const list = Array.isArray(src) ? src.map((o) => ({ id: o, label: o })) : await options(src);
    const s = document.createElement('select'); s.innerHTML = `<option value="">All ${label.toLowerCase()}s</option>` + list.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('');
    s.onchange = () => { filters[p] = s.value; load(); }; $('#flt').append(s, ' ');
  }
  const load = guard(async () => {
    const qs = new URLSearchParams({ q: $('#q').value, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    const rows = await api(`/${ent}?${qs}`);
    dataTable($('#tbl'), COLS[ent], rows, (r) => {
      const a = [];
      if (VIEWABLE.has(ent)) a.push({ label: 'View', run: (x) => detail(ent, x) });
      if (ent === 'reservations' && r.status === 'Pending') ['Fulfilled', 'Cancelled', 'Expired'].forEach((s) => a.push({ label: s, run: async (x) => { toast((await api(`/reservations/${x.reservation_id}`, 'PUT', { status: s })).message); load(); } }));
      if (!m.noEdit) a.push({ label: 'Edit', run: (x) => openForm(ent, x, load) });
      a.push({ label: 'Delete', cls: 'danger', run: async (x) => { if (confirmBox(`Delete this ${m.label.replace(/s$/, '').toLowerCase()} record?`)) { toast((await api(`/${ent}/${x[m.pk]}`, 'DELETE')).message); load(); } } });
      return a;
    });
  });
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  $('#add').onclick = guard(() => openForm(ent, null, load));
  load();
}

/* ---------- loans (circulation) ---------- */
async function loansPage() {
  const host = $('#view');
  const [members, copies, staff] = await Promise.all([options('members', true), api('/copies-available/list'), options('staff', true)]);
  host.innerHTML = `<div class="card"><h3>Issue a book</h3><form class="form" id="issue">
    <label>Member *<select name="member_id" required><option value="">-- select --</option>${members.map((o) => `<option value="${o.id}">${esc(o.label)} (${esc(o.status)})</option>`).join('')}</select></label>
    <label>Available copy *<select name="copy_id" required><option value="">-- select --</option>${copies.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('')}</select></label>
    <label>Issued by *<select name="issued_by" required><option value="">-- select --</option>${staff.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('')}</select></label>
    <label>Issue date *<input type="date" name="issue_date" value="${today()}" required></label>
    <label>Due date *<input type="date" name="due_date" required></label>
    <label>Member plan<input id="elig" disabled placeholder="Select a member"></label>
    <div class="err" id="ierr"></div><div class="actions"><button class="btn primary">Issue book</button></div></form></div>
    <div class="toolbar"><input id="q" placeholder="Search member or book" size="26"><select id="st"><option value="">All loans</option><option>Active</option><option>Overdue</option><option>Returned</option></select></div><div class="card" id="tbl"></div>`;
  const f = $('#issue');
  let loanDays = 14;
  const setDue = () => { f.due_date.value = f.issue_date.value ? addDays(f.issue_date.value, loanDays) : ''; };
  f.member_id.onchange = guard(async () => {
    if (!f.member_id.value) { $('#elig').value = ''; return; }
    const e = await api(`/members/${f.member_id.value}/eligibility`); loanDays = e.loan_days;
    $('#elig').value = `${e.plan_name}: ${e.active_loans}/${e.max_books} on loan, ${e.loan_days} days, fine ${money(e.fine_per_day)}/day`; setDue();
  });
  f.issue_date.onchange = setDue; setDue();
  f.onsubmit = async (e) => {
    e.preventDefault(); $('#ierr').textContent = '';
    try { const r = await api('/loans/issue', 'POST', Object.fromEntries(new FormData(f))); toast(r.message); loansPage(); }
    catch (err) { $('#ierr').textContent = err.message; }
  };
  const load = guard(async () => {
    const rows = await api(`/loans?${new URLSearchParams({ q: $('#q').value, status: $('#st').value })}`);
    dataTable($('#tbl'), [['loan_id', 'Loan'], ['title', 'Book'], ['copy_id', 'Copy'], ['member_name', 'Member'], ['issued_by_name', 'Issued by'], ['issue_date', 'Issued'], ['due_date', 'Due'], ['return_date', 'Returned'], ['status', 'Status'], ['days_overdue', 'Days late'], ['estimated_fine', 'Est. fine'], ['fine_amount', 'Fine charged']],
      rows, (r) => r.return_date ? [] : [{
        label: 'Return', cls: 'primary', run: async (x) => {
          const msg = x.estimated_fine > 0 ? `Return this book? It is ${x.days_overdue} day(s) late; a fine of ${money(x.estimated_fine)} will be recorded.` : 'Return this book?';
          if (confirmBox(msg)) { toast((await api(`/loans/${x.loan_id}/return`, 'POST', {})).message); loansPage(); }
        }
      }]);
  });
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); }; $('#st').onchange = load; load();
}

/* ---------- fines ---------- */
async function finesPage() {
  const host = $('#view');
  const members = await options('members', true);
  host.innerHTML = `<div class="stats" id="ft"></div><div class="toolbar"><select id="st"><option value="">All fines</option><option>Unpaid</option><option>Paid</option><option>Waived</option></select>
    <select id="mb"><option value="">All members</option>${members.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('')}</select></div><div class="card" id="tbl"></div>`;
  const load = guard(async () => {
    const t = await api('/fines-summary/totals');
    $('#ft').innerHTML = [['Collected (Paid)', t.collected], ['Unpaid', t.unpaid], ['Waived', t.waived]].map(([l, v]) => `<div class="stat"><b>${money(v)}</b><span>${l}</span></div>`).join('');
    const rows = await api(`/fines?${new URLSearchParams({ status: $('#st').value, member_id: $('#mb').value })}`);
    const set = (status) => async (x) => {
      let paid_date; if (status === 'Paid') { paid_date = prompt('Paid date (YYYY-MM-DD)', today()); if (!paid_date) return; }
      toast((await api(`/fines/${x.fine_id}/status`, 'PUT', { payment_status: status, paid_date })).message); load();
    };
    dataTable($('#tbl'), [['fine_id', 'Fine'], ['member_name', 'Member'], ['title', 'Book'], ['due_date', 'Due'], ['return_date', 'Returned'], ['fine_amount', 'Amount'], ['fine_date', 'Fine date'], ['payment_status', 'Status'], ['paid_date', 'Paid on']],
      rows, (r) => ['Paid', 'Waived', 'Unpaid'].filter((s) => s !== r.payment_status).map((s) => ({ label: s === 'Paid' ? 'Record payment' : 'Mark ' + s, run: set(s) })));
  });
  $('#st').onchange = load; $('#mb').onchange = load; load();
}

/* ---------- dashboard ---------- */
async function dashboard() {
  const d = await api('/dashboard'), s = d.stats;
  const cards = [['books', 'Books'], ['copies', 'Physical copies'], ['available_copies', 'Available copies'], ['active_loans', 'Active loans'], ['overdue_loans', 'Overdue loans'], ['members', 'Members'], ['reservations', 'Reservations'], ['unpaid_fines', 'Unpaid fines'], ['digital_resources', 'Digital resources']];
  $('#view').innerHTML = `<div class="stats">${cards.map(([k, l]) => `<div class="stat"><b>${k === 'unpaid_fines' ? money(s[k]) : s[k]}</b><span>${l}</span></div>`).join('')}</div>
    <div class="grid2"><div class="card"><h3>Physical vs digital usage (all time)</h3>${bars([{ type: 'Physical loans', n: s.physical_usage }, { type: 'Digital accesses', n: s.digital_usage }], 'type', ['n'])}</div>
    <div class="card"><h3>Currently overdue</h3>${simpleTable(d.overdue, [['book_title', 'Book'], ['member_name', 'Member'], ['due_date', 'Due'], ['days_overdue', 'Days'], ['estimated_fine', 'Est. fine']])}</div>
    <div class="card"><h3>Recently issued</h3>${simpleTable(d.recent_loans, [['title', 'Book'], ['member_name', 'Member'], ['issue_date', 'Issued']])}</div>
    <div class="card"><h3>Recently registered members</h3>${simpleTable(d.recent_members, [['name', 'Member'], ['join_date', 'Joined'], ['status', 'Status']])}</div>
    <div class="card"><h3>Recent reservations</h3>${simpleTable(d.recent_reservations, [['title', 'Book'], ['member_name', 'Member'], ['reservation_date', 'Date'], ['status', 'Status']])}</div></div>`;
}

/* ---------- reports ---------- */
async function reportsPage() {
  const list = await api('/reports');
  $('#view').innerHTML = `<div class="toolbar"><select id="rs">${list.map((r) => `<option value="${r.key}">${esc(r.title)}</option>`).join('')}</select></div><div id="rep"></div>`;
  const load = guard(async () => {
    const r = await api('/reports/' + $('#rs').value);
    const cols = r.rows.length ? Object.keys(r.rows[0]).map((k) => [k, k.replace(/_/g, ' ')]) : [];
    $('#rep').innerHTML = `${r.chart && r.rows.length ? `<div class="card"><h3>${esc(r.title)}</h3>${bars(r.rows, r.chart.label, r.chart.values)}</div>` : ''}<div class="card" id="rt"></div><div class="card"><h3>SQL used</h3><pre class="sql">${esc(r.sql)}</pre></div>`;
    dataTable($('#rt'), cols, r.rows);
  });
  $('#rs').onchange = load; load();
}

/* ---------- database operations ---------- */
async function adminPage() {
  const tables = await api('/admin/tables');
  $('#view').innerHTML = `<div class="card"><h3>INSERT / UPDATE / DELETE and transactions (safe, scratch rows only)</h3><div class="toolbar">
    <button class="btn primary" id="d1">Run INSERT &rarr; UPDATE &rarr; DELETE</button><button class="btn" id="d2">Transaction + COMMIT</button><button class="btn" id="d3">Transaction + ROLLBACK</button></div><div id="dlog"></div></div>
    <div class="card"><h3>SELECT (read-only table / view browser)</h3><div class="toolbar"><select id="tb">${tables.map((t) => `<option>${t}</option>`).join('')}</select></div><pre class="sql" id="sq"></pre><div id="tt"></div></div>`;
  const show = (r) => { $('#dlog').innerHTML = `<p>${esc(r.message)}</p><pre class="sql">${esc(r.log.map((l) => (l.step ? `[${l.step}] ` : '') + l.sql + (l.result ? `\n    => ${l.result}` : '')).join('\n'))}</pre>`; toast(r.message); };
  $('#d1').onclick = guard(async () => show(await api('/admin/demo/crud', 'POST')));
  $('#d2').onclick = guard(async () => show(await api('/admin/demo/transaction', 'POST', { mode: 'commit' })));
  $('#d3').onclick = guard(async () => show(await api('/admin/demo/transaction', 'POST', { mode: 'rollback' })));
  const load = guard(async () => { const r = await api('/admin/select/' + $('#tb').value); $('#sq').textContent = r.sql + ';'; dataTable($('#tt'), r.rows.length ? Object.keys(r.rows[0]).map((k) => [k, k]) : [], r.rows); });
  $('#tb').onchange = load; load();
}

/* ---------- router ---------- */
const PAGES = [
  ['Overview'], ['dashboard', 'Dashboard', dashboard],
  ['Catalogue'], ['books', 'Books'], ['authors', 'Authors'], ['publishers', 'Publishers'], ['categories', 'Categories'], ['copies', 'Physical copies'],
  ['People'], ['members', 'Members'], ['plans', 'Membership plans'], ['staff', 'Staff'],
  ['Circulation'], ['loans', 'Loans', loansPage], ['reservations', 'Reservations'], ['fines', 'Fines', finesPage],
  ['Digital'], ['resources', 'Digital resources'], ['access', 'Access logs'],
  ['Insights'], ['reports', 'Reports', reportsPage], ['admin', 'Database operations', adminPage]
];
$('#nav').innerHTML = PAGES.map((p) => p.length === 1 ? `<div class="grp">${p[0]}</div>` : `<a data-p="${p[0]}">${p[1]}</a>`).join('');
async function route() {
  const key = location.hash.slice(1) || 'dashboard', p = PAGES.find((x) => x[0] === key && x.length > 1) || PAGES[1];
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.p === p[0]));
  $('#title').textContent = p[1]; $('#sidebar').classList.remove('open');
  try { await (p[2] ? p[2]() : entityPage(p[0])); } catch (e) { $('#view').innerHTML = `<div class="card"><b>Error:</b> ${esc(e.message)}</div>`; }
}
document.querySelectorAll('#nav a').forEach((a) => a.onclick = () => { location.hash = a.dataset.p; });
$('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
window.addEventListener('hashchange', route);
(async () => { try { META = await api('/meta'); } catch (e) { toast(e.message, true); } route(); })();
