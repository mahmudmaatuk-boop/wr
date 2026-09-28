// Backup file format: a single JSON document with photos embedded as base64.
import { normalize, validate } from './model.js';

export const BACKUP_VERSION = 1;

export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** photos: already-serialized records { id, clientId, type, width, height, createdAt, data, thumb } */
export function buildBackup(clients, photos) {
  return {
    app: 'WR',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    clients,
    photos,
  };
}

/** Parse and validate backup text. Throws Error with a user-facing message. */
export function parseBackup(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid backup.');
  }
  if (!doc || doc.app !== 'WR') throw new Error('This file is not a WR backup.');
  if (typeof doc.version !== 'number' || doc.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of WR. Update the app first.');
  }
  if (!Array.isArray(doc.clients) || !Array.isArray(doc.photos)) {
    throw new Error('This file is not a valid backup.');
  }

  const clients = doc.clients.map((raw) => {
    const c = normalize(raw);
    if (!c.id || Object.keys(validate(c)).length) {
      throw new Error(`Backup contains an invalid client${c.name ? ` (“${c.name}”)` : ''}.`);
    }
    return c;
  });

  const clientIds = new Set(clients.map(c => c.id));
  const photos = doc.photos.filter(p =>
    p && typeof p.id === 'string' && typeof p.data === 'string' && clientIds.has(p.clientId));

  const photoIds = new Set(photos.map(p => p.id));
  for (const c of clients) c.photoIds = c.photoIds.filter(id => photoIds.has(id));

  return { clients, photos };
}
