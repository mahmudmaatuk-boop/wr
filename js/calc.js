// Pure calculations and formatting. Money is always integer cents.

export const VAT_RATE = 0.11;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatMoney = (cents) => usd.format((Number.isFinite(cents) ? cents : 0) / 100);

/** Typed dollars → cents. '' → null, invalid → NaN. */
export function parseMoney(input) {
  if (input == null) return null;
  const s = String(input).replace(/[$,\s]/g, '');
  if (s === '') return null;
  if (!/^\d*(\.\d*)?$/.test(s) || s === '.') return NaN;
  const [whole = '', frac = ''] = s.split('.');
  const f3 = (frac + '000').slice(0, 3);
  const cents = Number(whole || '0') * 100 + Number(f3.slice(0, 2));
  return Number(f3[2]) >= 5 ? cents + 1 : cents;
}

/** Cents → value for an editable input: '' when empty, no trailing '.00'. */
export function centsToInput(cents) {
  if (!Number.isFinite(cents)) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Typed number → number. '' → null, invalid or negative → NaN. */
export function parseNumber(input) {
  if (input == null) return null;
  const s = String(input).replace(/[,\s]/g, '');
  if (s === '') return null;
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

export function formatNumber(n, maxDecimals = 2) {
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDecimals }).format(n);
}

/** VAT at 11% on QTY × unit price (cents). */
export function vat(qty, unitCents) {
  if (!Number.isFinite(qty) || !Number.isFinite(unitCents)) return { vat: null, total: null };
  const base = Math.round(qty * unitCents);
  const v = Math.round(base * VAT_RATE);
  return { vat: v, total: base + v };
}

/** Volume in m³ for L×W×H in cm, times quantity (empty quantity counts as 1). */
export function volumeM3(dims, qty) {
  if (!dims || ![dims.l, dims.w, dims.h].every(Number.isFinite)) return null;
  const q = Number.isFinite(qty) ? qty : 1;
  return Math.round((dims.l * dims.w * dims.h / 1e6) * q * 1000) / 1000;
}

export const sumCents = (values) => values.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const isMonthKey = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));

export function monthLabel(key) {
  if (!isMonthKey(key)) return String(key || '');
  return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

/** Tab name in the "Client info monthly" spreadsheet. Must match monthTabName_ in Code.gs. */
export const monthTabName = (key) => `${key} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;

const plain = (n) => String(Math.round(n * 1000) / 1000);

export function formatDims(d) {
  if (!d || ![d.l, d.w, d.h].every(Number.isFinite)) return '';
  return `${plain(d.l)} × ${plain(d.w)} × ${plain(d.h)}`;
}

export function parseDims(text) {
  if (!text) return null;
  const parts = String(text).replace(/cm/gi, '').split(/[x×*]/i).map(p => parseNumber(p.trim()));
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return null;
  return { l: parts[0], w: parts[1], h: parts[2] };
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 1024) return `${Number.isFinite(n) ? n : 0} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${Math.round(n / (1024 * 1024) * 10) / 10} MB`;
}

/** Short human name for a file type, from its MIME type or extension. */
export function fileKind(mime = '', name = '') {
  const ext = (String(name).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'PDF';
  if (/jpe?g/.test(mime) || ext === 'jpg' || ext === 'jpeg') return 'JPEG';
  if (/png/.test(mime) || ext === 'png') return 'PNG';
  if (/heic|heif/.test(mime) || ext === 'heic') return 'HEIC';
  if (mime.startsWith('image/')) return 'Image';
  if (/word/.test(mime) || ext === 'doc' || ext === 'docx') return 'Word';
  if (/sheet|excel/.test(mime) || ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'Excel';
  if (/presentation|powerpoint/.test(mime) || ext === 'ppt' || ext === 'pptx') return 'PowerPoint';
  if (mime.startsWith('text/') || ext === 'txt') return 'Text';
  return 'File';
}

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function formatDate(iso, withTime = false) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return (withTime ? dateTimeFmt : dateFmt).format(d);
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}
