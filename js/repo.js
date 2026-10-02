// What the screens use: records of a page (downloaded copy + pending changes),
// refreshing from Google Sheets, and queuing saves and deletes.
import * as store from './store.js';
import { call } from './api.js';
import { pageByKey } from './schema.js';
import { fromRow } from './rows.js';
import { mergeView } from './outbox.js';
import { enqueue } from './sync.js';

export async function records(pageKey) {
  const [cache, ops] = await Promise.all([store.getCache(pageKey), store.allOps()]);
  return mergeView(cache ? cache.rows : [], ops.filter(o => o.page === pageKey));
}

/** Download the page from Google Sheets into the local copy. Throws when offline. */
export async function refresh(pageKey) {
  const page = pageByKey(pageKey);
  const { rows } = await call('list', { page: pageKey });
  await store.setCache(pageKey, rows.map(r => fromRow(page, r)));
}

const clean = (record) => Object.fromEntries(Object.entries(record).filter(([k]) => !k.startsWith('_')));

export function save(pageKey, record, { isNew = false } = {}) {
  return enqueue({ key: `${pageKey}:${record.id}`, page: pageKey, id: record.id, type: 'save', record: clean(record), created: isNew });
}

export function remove(pageKey, id) {
  return enqueue({ key: `${pageKey}:${id}`, page: pageKey, id, type: 'delete' });
}
