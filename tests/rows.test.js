import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRow, fromRow, driveId, photoSrc } from '../js/rows.js';
import { pageByKey } from '../js/schema.js';

const clients = pageByKey('clients');

const client = () => ({
  id: 'c-1', name: '  Sameer Ahmad ', timestamp: '', phone: '00961 70 123 456', email: 'sameer@example.com',
  photos: [{ url: 'https://drive.google.com/file/d/abc123DEF456/view' }, { local: 'p1', blob: {}, name: 'p1.jpg' }],
  wood: 'African Walnut', base: 'Hybrid', payment: 'Paid', paid: 120050,
});

test('toRow maps fields to sheet headers', () => {
  const row = toRow(clients, client());
  assert.equal(row.Name, 'Sameer Ahmad');
  assert.equal(row.Phone, '00961 70 123 456');
  assert.equal(row['Paid amount (USD)'], 1200.5);
  assert.equal(row['Payment status'], 'Paid');
  assert.equal(row.ID, 'c-1');
  assert.deepEqual(row['Products photo'], { keep: ['https://drive.google.com/file/d/abc123DEF456/view'] });
  assert.ok(!('Timestamp' in row), 'server fills the timestamp');
});

test('toRow keeps a provided timestamp (old-client import)', () => {
  const row = toRow(clients, { ...client(), timestamp: '2026-09-28T10:00:00.000Z' });
  assert.equal(row.Timestamp, '2026-09-28T10:00:00.000Z');
});

test('fromRow converts back to app values', () => {
  const rec = fromRow(clients, {
    Name: 'Sameer Ahmad', Timestamp: '2026-10-02T09:00:00.000Z', Phone: '00961 70 123 456', 'E-mail': '',
    'Products photo': 'https://drive.google.com/file/d/a1/view\nhttps://drive.google.com/file/d/b2/view',
    'Wood type': 'Teak', 'Base type': 'Steel', 'Payment status': 'Not paid', 'Paid amount (USD)': 99.99, ID: 'c-9',
  });
  assert.equal(rec.id, 'c-9');
  assert.equal(rec.paid, 9999);
  assert.equal(rec.photos.length, 2);
  assert.equal(rec.photos[1].url, 'https://drive.google.com/file/d/b2/view');
  assert.equal(rec.timestamp, '2026-10-02T09:00:00.000Z');
  assert.equal(rec.email, '');
});

test('empty money and numbers become null', () => {
  const rec = fromRow(clients, { Name: 'X', 'Paid amount (USD)': '', ID: 'x' });
  assert.equal(rec.paid, null);
  const packing = fromRow(pageByKey('packing'), { Item: 'Table', Qty: '', 'Volume (m³)': 0.54, 'Dimensions (cm)': '200 × 90 × 75', ID: 'p' });
  assert.equal(packing.qty, null);
  assert.equal(packing.volume, 0.54);
  assert.deepEqual(packing.dims, { l: 200, w: 90, h: 75 });
});

test('months survive even if the sheet turned them into dates', () => {
  const monthly = pageByKey('monthly');
  assert.equal(fromRow(monthly, { Month: '2026-10', Name: 'A', ID: '1' }).month, '2026-10');
  assert.equal(fromRow(monthly, { Month: '2026-10-01T00:00:00.000Z', Name: 'A', ID: '1' }).month, '2026-10');
});

test('round trip for every data page keeps values', () => {
  const vat = pageByKey('vat');
  const rec = { id: 'v1', qty: 4, description: 'Walnut table', unit: 85000, vat: 37400, total: 377400, timestamp: '' };
  const back = fromRow(vat, { ...toRow(vat, rec), Timestamp: '2026-10-02T09:00:00.000Z' });
  assert.equal(back.qty, 4);
  assert.equal(back.unit, 85000);
  assert.equal(back.total, 377400);
  assert.equal(back.description, 'Walnut table');
});

test('drive helpers', () => {
  assert.equal(driveId('https://drive.google.com/file/d/1AbC_dEf-123456/view?usp=drivesdk'), '1AbC_dEf-123456');
  assert.equal(driveId('https://drive.google.com/open?id=1AbC_dEf-123456'), '1AbC_dEf-123456');
  assert.equal(driveId('https://example.com/x.jpg'), null);
  assert.equal(photoSrc('https://drive.google.com/file/d/1AbC_dEf-123456/view', 400),
    'https://drive.google.com/thumbnail?id=1AbC_dEf-123456&sz=w400');
  assert.equal(photoSrc('http://localhost:5180/fake-drive/d/1AbC_dEf-123456/view'),
    'http://localhost:5180/fake-drive/d/1AbC_dEf-123456/view');
});
