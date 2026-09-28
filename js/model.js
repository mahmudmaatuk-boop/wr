// Pure data logic for WR clients. No DOM, no storage — unit-tested in Node.

export const BASE_TYPES = [
  { value: 'wood', label: 'Wood' },
  { value: 'steel', label: 'Steel' },
  { value: 'hybrid', label: 'Hybrid' },
];

export const STATUSES = [
  { value: 'not_delivered', label: 'Not delivered' },
  { value: 'delivered', label: 'Delivered' },
];

export const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'not_delivered', label: 'Not delivered' },
  { value: 'delivered', label: 'Delivered' },
];

export const labelOf = (list, value) => list.find(x => x.value === value)?.label ?? value;

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

export function newClient() {
  const now = Date.now();
  return {
    id: uid(),
    name: '',
    phone: '',
    email: '',
    photoIds: [],
    woodType: '',
    baseType: 'wood',
    paid: false,
    amountCents: 0,
    status: 'not_delivered',
    createdAt: now,
    updatedAt: now,
  };
}

/** Parse a user-typed dollar amount into integer cents. '' → 0, invalid → NaN. */
export function parseMoney(input) {
  if (input == null) return 0;
  const s = String(input).replace(/[$,\s]/g, '');
  if (s === '') return 0;
  if (!/^\d*(\.\d*)?$/.test(s) || s === '.') return NaN;
  const [whole = '', frac = ''] = s.split('.');
  const f3 = (frac + '000').slice(0, 3);
  const cents = Number(whole || '0') * 100 + Number(f3.slice(0, 2));
  return Number(f3[2]) >= 5 ? cents + 1 : cents;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatMoney = (cents) => usd.format((cents || 0) / 100);

/** Cents → value for an editable input: '' for zero, no trailing '.00'. */
export function centsToInput(cents) {
  if (!cents) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns a map of field → error message. Empty object means valid. */
export function validate(c) {
  const errs = {};
  if (!c.name || !c.name.trim()) errs.name = 'Name is required';
  if (c.email && c.email.trim() && !EMAIL_RE.test(c.email.trim())) errs.email = 'Enter a valid email';
  if (!Number.isInteger(c.amountCents) || c.amountCents < 0) errs.amount = 'Enter a valid amount';
  if (!BASE_TYPES.some(b => b.value === c.baseType)) errs.baseType = 'Choose a base type';
  if (!STATUSES.some(s => s.value === c.status)) errs.status = 'Choose a status';
  return errs;
}

export function normalize(c) {
  const str = (v) => (v == null ? '' : String(v).trim());
  return {
    ...c,
    name: str(c.name),
    phone: str(c.phone),
    email: str(c.email).toLowerCase(),
    woodType: str(c.woodType),
    paid: Boolean(c.paid),
    photoIds: Array.isArray(c.photoIds) ? c.photoIds : [],
  };
}

export function totals(clients) {
  const t = { count: 0, totalCents: 0, paidCents: 0, outstandingCents: 0, toDeliver: 0 };
  for (const c of clients) {
    t.count++;
    t.totalCents += c.amountCents || 0;
    if (c.paid) t.paidCents += c.amountCents || 0;
    else t.outstandingCents += c.amountCents || 0;
    if (c.status !== 'delivered') t.toDeliver++;
  }
  return t;
}

const digits = (s) => String(s || '').replace(/\D/g, '');

export function matches(c, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [c.name, c.email, c.phone].join(' ').toLowerCase();
  if (hay.includes(q)) return true;
  const qd = digits(q);
  return qd.length > 0 && qd === q.replace(/[\s\-().+]/g, '') && digits(c.phone).includes(qd);
}

const FILTER_FNS = {
  all: () => true,
  paid: (c) => c.paid,
  unpaid: (c) => !c.paid,
  delivered: (c) => c.status === 'delivered',
  not_delivered: (c) => c.status !== 'delivered',
};

export function filterClients(clients, filter = 'all', query = '') {
  const f = FILTER_FNS[filter] || FILTER_FNS.all;
  return clients.filter(c => f(c) && matches(c, query));
}

export function woodSuggestions(clients) {
  const seen = new Map();
  for (const c of clients) {
    const w = String(c.woodType || '').trim();
    if (w && !seen.has(w.toLowerCase())) seen.set(w.toLowerCase(), w);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
