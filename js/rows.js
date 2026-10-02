// Convert between app records (keyed by field) and sheet rows (keyed by header).
import { formatDims, parseDims } from './calc.js';

const DRIVE_ID = /\/d\/([\w-]{10,})|[?&]id=([\w-]{10,})/;

export function driveId(url) {
  const m = String(url || '').match(DRIVE_ID);
  return m ? (m[1] || m[2]) : null;
}

/** Displayable image URL for a stored photo link (Drive links use the thumbnail service). */
export function photoSrc(url, size = 400) {
  const id = /^https:\/\/drive\.google\.com\//.test(String(url)) ? driveId(url) : null;
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : url;
}

/** App record → { header: cell }. Photo columns become { keep: [urls] }; the sync layer adds uploads. */
export function toRow(page, record) {
  const row = {};
  for (const col of page.columns) {
    const v = record[col.key];
    switch (col.type) {
      case 'id': row[col.header] = record.id; break;
      case 'money': row[col.header] = Number.isFinite(v) ? v / 100 : ''; break;
      case 'number': row[col.header] = Number.isFinite(v) ? v : ''; break;
      case 'dims': row[col.header] = formatDims(v); break;
      case 'photos': row[col.header] = { keep: (v || []).filter(p => p.url).map(p => p.url) }; break;
      case 'timestamp': if (v) row[col.header] = v; break; // otherwise the server stamps it
      default: row[col.header] = v == null ? '' : String(v).trim();
    }
  }
  return row;
}

function toCents(v) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function toNumber(v) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toMonth(v) {
  const m = String(v || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : String(v || '');
}

/** { header: cell } from the server → app record. */
export function fromRow(page, row) {
  const rec = {};
  for (const col of page.columns) {
    const v = row[col.header];
    switch (col.type) {
      case 'id': rec.id = String(v || ''); break;
      case 'money': rec[col.key] = toCents(v); break;
      case 'number': rec[col.key] = toNumber(v); break;
      case 'dims': rec[col.key] = parseDims(v); break;
      case 'month': rec[col.key] = toMonth(v); break;
      case 'photos': rec[col.key] = String(v || '').split(/\s*\n\s*/).filter(Boolean).map(url => ({ url })); break;
      default: rec[col.key] = v == null ? '' : String(v);
    }
  }
  return rec;
}
