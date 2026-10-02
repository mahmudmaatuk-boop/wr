import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapOldClient } from '../js/migrate.js';

const old = {
  id: 'old-1', name: ' Sarah Johnson ', phone: '(555) 214-8890', email: 'sarah@example.com',
  photoIds: ['ph1', 'missing'], woodType: 'walnut', baseType: 'hybrid', paid: true, amountCents: 185000,
  status: 'delivered', createdAt: Date.UTC(2026, 8, 28, 10, 0, 0), updatedAt: 0,
};
const photos = new Map([['ph1', { id: 'ph1', blob: { type: 'image/jpeg', size: 10 } }]]);

test('maps a v1 client to a Client info record', () => {
  const rec = mapOldClient(old, photos);
  assert.equal(rec.id, 'old-1');
  assert.equal(rec.name, 'Sarah Johnson');
  assert.equal(rec.phone, '(555) 214-8890');
  assert.equal(rec.email, 'sarah@example.com');
  assert.equal(rec.timestamp, '2026-09-28T10:00:00.000Z');
  assert.equal(rec.base, 'Hybrid');
  assert.equal(rec.payment, 'Paid');
  assert.equal(rec.paid, 185000);
  assert.equal(rec.photos.length, 1);
  assert.equal(rec.photos[0].local, 'ph1');
  assert.equal(rec.photos[0].name, 'ph1.jpg');
  assert.ok(!('status' in rec), 'delivery status is not part of the new form');
});

test('wood type: matches the list ignoring case, otherwise kept as typed', () => {
  assert.equal(mapOldClient({ ...old, woodType: 'TEAK' }).wood, 'Teak');
  assert.equal(mapOldClient({ ...old, woodType: 'sapele ' }).wood, 'Sapele');
  assert.equal(mapOldClient({ ...old, woodType: 'walnut' }).wood, 'walnut');
});

test('unpaid, steel, no amount', () => {
  const rec = mapOldClient({ ...old, paid: false, baseType: 'steel', amountCents: 0, photoIds: [] });
  assert.equal(rec.payment, 'Not paid');
  assert.equal(rec.base, 'Steel');
  assert.equal(rec.paid, 0);
  assert.deepEqual(rec.photos, []);
});
