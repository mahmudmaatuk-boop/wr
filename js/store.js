// On-phone storage (IndexedDB "wr2"): settings, the last downloaded copy of
// each page, and the outbox of changes waiting to be uploaded.

const DB_NAME = 'wr2';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'page' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Storage is busy. Close other WR windows and try again.'));
  });
  return dbPromise;
}

async function run(storeName, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    let result;
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage error'));
  });
}

export async function getMeta(k, fallback = null) {
  const row = await run('meta', 'readonly', s => s.get(k));
  return row ? row.v : fallback;
}
export const setMeta = (k, v) => run('meta', 'readwrite', s => s.put({ k, v }));

export const getCache = (page) => run('cache', 'readonly', s => s.get(page));
export const setCache = (page, rows) => run('cache', 'readwrite', s => s.put({ page, rows, at: Date.now() }));

export const allOps = async () => (await run('outbox', 'readonly', s => s.getAll())).sort((a, b) => a.seq - b.seq);
export const getOp = (key) => run('outbox', 'readonly', s => s.get(key));
export const putOp = (op) => run('outbox', 'readwrite', s => s.put(op));
export const deleteOp = (key) => run('outbox', 'readwrite', s => s.delete(key));
