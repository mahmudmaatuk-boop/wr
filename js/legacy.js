// One-time import of clients saved by WR 1 (IndexedDB "wr"), which is only read, never changed.
import { getMeta, setMeta } from './store.js';
import { mapOldClient } from './migrate.js';
import { save } from './repo.js';

async function readOld() {
  if (indexedDB.databases) {
    const dbs = await indexedDB.databases();
    if (!dbs.some(d => d.name === 'wr')) return null;
  }
  const db = await new Promise((resolve) => {
    const req = indexedDB.open('wr');
    // Never create the old database: abort if it doesn't exist yet.
    req.onupgradeneeded = (e) => { if (e.oldVersion === 0) req.transaction.abort(); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  if (!db) return null;
  try {
    if (!db.objectStoreNames.contains('clients')) return null;
    const names = ['clients', 'photos'].filter(n => db.objectStoreNames.contains(n));
    const tx = db.transaction(names, 'readonly');
    const getAll = (name) => new Promise((resolve, reject) => {
      if (!names.includes(name)) return resolve([]);
      const req = tx.objectStore(name).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const [clients, photos] = await Promise.all([getAll('clients'), getAll('photos')]);
    return { clients, photos: new Map(photos.map(p => [p.id, p])) };
  } finally {
    db.close();
  }
}

/** Number of WR 1 clients still waiting to be imported (0 when done or none). */
export async function legacyCount() {
  if (await getMeta('legacyImported', false)) return 0;
  try {
    const old = await readOld();
    return old ? old.clients.length : 0;
  } catch {
    return 0;
  }
}

/** Queue every WR 1 client for upload to Client info. Returns how many. */
export async function importLegacy() {
  const old = await readOld();
  const clients = old ? old.clients : [];
  for (const c of clients) await save('clients', mapOldClient(c, old.photos), { isNew: true });
  await setMeta('legacyImported', true);
  return clients.length;
}
