// Sends the outbox to Google Sheets, one change at a time, and keeps the
// local copy of each page up to date. Listeners get a status object for the
// "All synced / 2 waiting / Offline" indicators.
import * as store from './store.js';
import { call, isConfigured, blobToBase64 } from './api.js';
import { coalesce } from './outbox.js';
import { pageByKey } from './schema.js';
import { toRow, fromRow } from './rows.js';

const listeners = new Set();
let status = { pending: 0, failed: 0, syncing: false, offline: !navigator.onLine, error: null, configured: false };
let flushing = null;
let inFlight = null;
let seq = Date.now();

function emit(patch) {
  status = { ...status, ...patch };
  listeners.forEach(fn => fn(status));
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

export const getStatus = () => status;

async function recount() {
  const ops = await store.allOps();
  emit({ pending: ops.length, failed: ops.filter(o => o.error).length, configured: await isConfigured() });
}

/** Queue a change ({ key, page, id, type: 'save'|'delete', record?, created? }) and try to send it. */
export async function enqueue(op) {
  const existing = await store.getOp(op.key);
  const next = coalesce(existing, { ...op, seq: ++seq, version: 1, attempts: 0, error: null }, { inFlight: inFlight === op.key });
  if (next) await store.putOp(next);
  else await store.deleteOp(op.key);
  await recount();
  flush();
}

async function encodeFiles(list) {
  return Promise.all(list.map(async p => ({ name: p.name, type: p.type || p.blob.type || 'image/jpeg', data: await blobToBase64(p.blob) })));
}

async function send(op) {
  if (op.type === 'delete') return call('delete', { page: op.page, id: op.id });
  const page = pageByKey(op.page);
  const row = toRow(page, op.record);
  let large = false;
  for (const col of page.columns.filter(c => c.type === 'photos')) {
    const local = (op.record[col.key] || []).filter(p => p.blob);
    if (local.length) large = true;
    row[col.header].uploads = await encodeFiles(local);
  }
  const payload = { page: op.page, id: op.id, row };
  if (op.record.file?.blob) {
    large = true;
    [payload.file] = await encodeFiles([op.record.file]);
  }
  return call('save', payload, { timeout: large ? 180000 : 30000 });
}

async function applyToCache(op, res) {
  const cache = await store.getCache(op.page);
  const rows = cache ? cache.rows.filter(r => r.id !== op.id) : [];
  if (op.type === 'save') {
    const saved = fromRow(pageByKey(op.page), res.row);
    const at = cache ? cache.rows.findIndex(r => r.id === op.id) : -1;
    if (at >= 0) rows.splice(at, 0, saved);
    else rows.push(saved);
  }
  await store.setCache(op.page, rows);
}

/** Send everything waiting in the outbox. Safe to call any time. */
export function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    emit({ syncing: true });
    await recount();
    const tried = new Set();
    try {
      for (;;) {
        const op = (await store.allOps()).find(o => !tried.has(o.key));
        if (!op) break;
        tried.add(op.key);
        inFlight = op.key;
        try {
          const res = await send(op);
          const current = await store.getOp(op.key);
          if (current && current.version === op.version) await store.deleteOp(op.key);
          await applyToCache(op, res);
          emit({ offline: false, error: null });
        } catch (err) {
          if (err.code === 'network') { emit({ offline: true }); break; }
          if (['not_configured', 'unauthorized', 'not_setup', 'bad_response'].includes(err.code)) {
            emit({ error: err.code === 'not_configured' ? null : err.message });
            break;
          }
          const current = await store.getOp(op.key);
          if (current && current.version === op.version) {
            await store.putOp({ ...current, error: err.message, attempts: (current.attempts || 0) + 1 });
          }
        } finally {
          inFlight = null;
          await recount();
        }
      }
    } finally {
      emit({ syncing: false });
      flushing = null;
    }
  })();
  return flushing;
}

/** Start background syncing: now, when the connection returns, and every minute while changes wait. */
export function start() {
  recount().then(flush);
  addEventListener('online', () => { emit({ offline: false }); flush(); });
  addEventListener('offline', () => emit({ offline: true }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush(); });
  setInterval(() => { if (status.pending && !status.syncing) flush(); }, 60000);
}

/** One-line description of the sync state, for pills and rows. */
export function describe(s) {
  if (!s.configured) return s.pending
    ? { text: `${s.pending} saved on this phone`, tone: 'warn', icon: 'cloud-off' }
    : { text: 'Not connected', tone: 'warn', icon: 'cloud-off' };
  if (s.error) return { text: 'Check connection', tone: 'danger', icon: 'alert' };
  if (s.offline) return { text: s.pending ? `Offline · ${s.pending} waiting` : 'Offline', tone: 'warn', icon: 'cloud-off' };
  if (s.syncing && s.pending) return { text: 'Syncing…', tone: 'muted', icon: 'cloud-up' };
  if (s.failed) return { text: `${s.failed} couldn't upload`, tone: 'danger', icon: 'alert' };
  if (s.pending) return { text: `${s.pending} waiting to upload`, tone: 'warn', icon: 'cloud-up' };
  return { text: 'All synced', tone: 'ok', icon: 'cloud-check' };
}
