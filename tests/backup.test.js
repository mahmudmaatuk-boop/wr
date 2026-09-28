import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, blobToBase64, base64ToBlob, BACKUP_VERSION } from '../js/backup.js';
import { newClient } from '../js/model.js';

const client = () => ({ ...newClient(), id: 'c1', name: 'Alice', amountCents: 1234, photoIds: ['p1'] });
const photo = () => ({ id: 'p1', clientId: 'c1', type: 'image/jpeg', width: 10, height: 20, createdAt: 1, data: 'AAEC', thumb: 'AAE=' });

test('blob <-> base64 round trip preserves bytes', async () => {
  const bytes = new Uint8Array(70000).map((_, i) => i % 256);
  const b64 = await blobToBase64(new Blob([bytes], { type: 'image/jpeg' }));
  const back = base64ToBlob(b64, 'image/jpeg');
  assert.equal(back.type, 'image/jpeg');
  assert.deepEqual(new Uint8Array(await back.arrayBuffer()), bytes);
});

test('build → parse round trip', () => {
  const text = JSON.stringify(buildBackup([client()], [photo()]));
  const { clients, photos } = parseBackup(text);
  assert.equal(clients.length, 1);
  assert.equal(clients[0].name, 'Alice');
  assert.equal(clients[0].amountCents, 1234);
  assert.equal(photos.length, 1);
  assert.equal(photos[0].data, 'AAEC');
});

test('backup carries app marker and version', () => {
  const b = buildBackup([], []);
  assert.equal(b.app, 'WR');
  assert.equal(b.version, BACKUP_VERSION);
  assert.equal(typeof b.exportedAt, 'string');
});

test('parseBackup rejects non-JSON', () => {
  assert.throws(() => parseBackup('not json'), /not a valid/i);
});

test('parseBackup rejects files from other apps', () => {
  assert.throws(() => parseBackup(JSON.stringify({ app: 'Other', version: 1, clients: [], photos: [] })), /not a WR backup/i);
});

test('parseBackup rejects newer versions', () => {
  assert.throws(() => parseBackup(JSON.stringify({ ...buildBackup([], []), version: BACKUP_VERSION + 1 })), /newer version/i);
});

test('parseBackup rejects invalid clients', () => {
  const bad = { ...buildBackup([{ ...client(), name: '' }], []) };
  assert.throws(() => parseBackup(JSON.stringify(bad)), /invalid client/i);
});

test('parseBackup drops photos that belong to no client and strips dangling photoIds', () => {
  const orphan = { ...photo(), id: 'p9', clientId: 'nobody' };
  const c = { ...client(), photoIds: ['p1', 'missing'] };
  const { clients, photos } = parseBackup(JSON.stringify(buildBackup([c], [photo(), orphan])));
  assert.deepEqual(photos.map(p => p.id), ['p1']);
  assert.deepEqual(clients[0].photoIds, ['p1']);
});
