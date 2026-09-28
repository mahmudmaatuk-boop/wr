// IndexedDB storage. Clients and photos live in separate stores so the list
// view never has to load full-size images.

const DB_NAME = 'wr';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('clients')) {
        db.createObjectStore('clients', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('photos')) {
        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('clientId', 'clientId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Storage is busy. Close other WR tabs and try again.'));
  });
  return dbPromise;
}

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/** Run fn(stores) inside one transaction; resolves with fn's result once committed. */
async function tx(storeNames, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map(n => [n, t.objectStore(n)]));
    let result;
    Promise.resolve(fn(stores)).then(r => { result = r; }, err => { t.abort(); reject(err); });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  });
}

export const getAllClients = () => tx(['clients'], 'readonly', s => wrap(s.clients.getAll()));
export const getClient = (id) => tx(['clients'], 'readonly', s => wrap(s.clients.get(id)));
export const putClient = (c) => tx(['clients'], 'readwrite', s => { s.clients.put(c); });
export const getPhoto = (id) => tx(['photos'], 'readonly', s => wrap(s.photos.get(id)));
export const getAllPhotos = () => tx(['photos'], 'readonly', s => wrap(s.photos.getAll()));

/** Save a client plus any newly added photos, and remove dropped photos — atomically. */
export function saveClient(client, addedPhotos = [], removedPhotoIds = []) {
  return tx(['clients', 'photos'], 'readwrite', s => {
    for (const p of addedPhotos) s.photos.put(p);
    for (const id of removedPhotoIds) s.photos.delete(id);
    s.clients.put(client);
  });
}

/** Delete a client and every photo that belongs to it. */
export function deleteClient(id) {
  return tx(['clients', 'photos'], 'readwrite', async s => {
    const keys = await wrap(s.photos.index('clientId').getAllKeys(id));
    for (const k of keys) s.photos.delete(k);
    s.clients.delete(id);
  });
}

/** Merge imported records by id: same id replaces, others are added. */
export function importAll(clients, photos) {
  return tx(['clients', 'photos'], 'readwrite', async s => {
    // Replacing a client replaces its photo set too.
    for (const c of clients) {
      const keys = await wrap(s.photos.index('clientId').getAllKeys(c.id));
      for (const k of keys) s.photos.delete(k);
    }
    for (const p of photos) s.photos.put(p);
    for (const c of clients) s.clients.put(c);
  });
}
