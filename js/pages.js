// How each page looks and behaves in the app: icon, button text, live
// calculations and how saved entries are listed. Data shape is in schema.js.
import { pageByKey } from './schema.js';
import {
  formatMoney, formatNumber, formatDims, formatDate, monthKey, monthLabel, sumCents, vat, volumeM3, uid,
} from './calc.js';

const money = (c) => (Number.isFinite(c) ? formatMoney(c) : '');
const join = (...parts) => parts.filter(Boolean).join(' · ');
const sum = (list, key) => list.reduce((s, r) => s + (Number.isFinite(r[key]) ? r[key] : 0), 0);
const dimsText = (d) => (formatDims(d) ? `${formatDims(d)} cm` : '');

export const WEBSITE = 'https://www.woodforlife-wr.com';

export const PAGE_UI = {
  clients: {
    icon: 'users', addLabel: 'Add client', added: 'Client added',
    title: r => r.name || 'Unnamed client',
    sub: r => join(r.wood, r.base && `${r.base} base`) || r.phone || formatDate(r.timestamp),
    right: r => money(r.paid),
    badge: r => (r.payment === 'Paid' ? { text: 'Paid', tone: 'ok' } : { text: 'Not paid', tone: 'warn' }),
    thumb: r => (r.photos || [])[0],
    initials: r => r.name,
    search: r => [r.name, r.phone, r.email, r.wood].join(' '),
    summary: rs => [
      { label: 'Paid', value: money(sumCents(rs.filter(r => r.payment === 'Paid').map(r => r.paid))) },
      { label: 'Not paid', value: String(rs.filter(r => r.payment !== 'Paid').length) },
    ],
  },
  expenses: {
    icon: 'wallet',
    compute: r => {
      const page = pageByKey('expenses');
      const total = sumCents(page.columns.filter(c => /^e\d\d$/.test(c.key)).map(c => r[c.key]));
      return { ...r, total };
    },
  },
  monthly: {
    icon: 'calendar', addLabel: 'Add entry', added: 'Entry added',
    defaults: () => ({ month: monthKey() }),
    title: r => r.name || 'Unnamed',
    sub: r => join(r.items, r.wood),
    right: r => money(r.amountPaid),
    rightSub: r => (Number.isFinite(r.total) ? `of ${money(r.total)}` : ''),
    search: r => [r.name, r.items, r.wood].join(' '),
    sort: (a, b) => (b.month || '').localeCompare(a.month || '') || b._order - a._order,
    groupBy: r => r.month,
    groupLabel: monthLabel,
    groupTotal: rs => `Paid ${money(sum(rs, 'amountPaid'))} · Total ${money(sum(rs, 'total'))}`,
  },
  vat: {
    icon: 'receipt', addLabel: 'Add', added: 'Added',
    compute: r => ({ ...r, ...vat(r.qty, r.unit) }),
    computedTitle: 'Calculated automatically',
    title: r => r.description || 'No description',
    sub: r => join(Number.isFinite(r.qty) && `${formatNumber(r.qty)} × ${money(r.unit)}`, formatDate(r.timestamp)),
    right: r => money(r.total),
    rightSub: r => (Number.isFinite(r.vat) ? `VAT ${money(r.vat)}` : ''),
    search: r => r.description,
    summary: rs => [
      { label: 'VAT 11%', value: money(sum(rs, 'vat')) },
      { label: 'Total due', value: money(sum(rs, 'total')) },
    ],
  },
  packing: {
    icon: 'package', addLabel: 'Add', added: 'Added',
    compute: r => ({ ...r, volume: volumeM3(r.dims, r.qty) }),
    computedTitle: 'Calculated automatically',
    title: r => r.item || 'Item',
    sub: r => join(dimsText(r.dims), r.wood, Number.isFinite(r.qty) && `Qty ${formatNumber(r.qty)}`),
    right: r => (Number.isFinite(r.volume) ? `${formatNumber(r.volume, 3)} m³` : ''),
    rightSub: r => (Number.isFinite(r.weight) ? `${formatNumber(r.weight)} kg` : ''),
    search: r => [r.item, r.wood].join(' '),
    summary: rs => [
      { label: 'Volume', value: `${formatNumber(sum(rs, 'volume'), 3)} m³` },
      { label: 'Approx. weight', value: `${formatNumber(sum(rs, 'weight'))} kg` },
    ],
  },
  documents: { icon: 'folder' },
  raw: {
    icon: 'logs', addLabel: 'Add', added: 'Added',
    title: r => dimsText(r.dims) || 'No dimensions',
    right: r => (Number.isFinite(r.qty) ? `Qty ${formatNumber(r.qty)}` : ''),
    search: r => r.wood,
    sort: (a, b) => (a.wood || '').localeCompare(b.wood || '') || b._order - a._order,
    groupBy: r => r.wood || 'Other',
    groupTotal: rs => `Qty ${formatNumber(sum(rs, 'qty'))}`,
  },
  finished: {
    icon: 'chair', addLabel: 'Add', added: 'Added',
    title: r => r.wood || 'Product',
    sub: r => join(dimsText(r.dims), r.base && `${r.base} base`),
    thumb: r => (r.photos || [])[0],
    search: r => [r.wood, r.base].join(' '),
  },
  backup: { icon: 'cloud-up' },
};

/** A blank record for a page, with its defaults. */
export function newRecord(page) {
  const rec = { id: uid() };
  for (const col of page.columns) {
    if (col.type === 'photos') rec[col.key] = [];
    else if (col.type === 'month') rec[col.key] = monthKey();
    else if (col.default) rec[col.key] = col.default;
  }
  return { ...rec, ...(PAGE_UI[page.key].defaults?.() || {}) };
}

/** Fill in calculated fields (VAT, totals, volume). */
export const compute = (page, record) => (PAGE_UI[page.key].compute ? PAGE_UI[page.key].compute(record) : record);
