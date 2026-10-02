import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGES, DATA_PAGES, WOOD_TYPES, BASE_TYPES, PAYMENT_STATUSES, EXPENSE_CATEGORIES, pageByKey, column,
} from '../js/schema.js';

test('nine pages in the agreed order', () => {
  assert.deepEqual(PAGES.map(p => p.title), [
    'Client info', 'Monthly expenses', 'Client info monthly', 'VAT', 'Packing & Shipments',
    'WR-Documents', 'Raw Stockage', 'Finished Stockage', 'Backup',
  ]);
  assert.equal(DATA_PAGES.length, 8);
  assert.equal(new Set(PAGES.map(p => p.key)).size, 9);
});

test('spreadsheet names match the request', () => {
  assert.equal(pageByKey('clients').spreadsheet, 'Client info');
  assert.equal(pageByKey('expenses').spreadsheet, 'Monthly expenses');
  assert.equal(pageByKey('monthly').spreadsheet, 'Client info monthly');
  assert.equal(pageByKey('backup').spreadsheet, 'WR Backup');
});

test('dropdown lists', () => {
  assert.deepEqual(WOOD_TYPES, [
    'African Walnut', 'African Mahogany', 'Teak', 'Albizia', 'Dahoma', 'Denya', 'Sapele', 'Okoro', 'Black Ofram',
  ]);
  assert.deepEqual(BASE_TYPES, ['Steel', 'Wood', 'Hybrid']);
  assert.deepEqual(PAYMENT_STATUSES, ['Paid', 'Not paid']);
});

test('24 expense categories, all columns of Monthly expenses', () => {
  assert.equal(EXPENSE_CATEGORIES.length, 24);
  assert.equal(EXPENSE_CATEGORIES[9], 'Abou Mahmoud');
  assert.equal(EXPENSE_CATEGORIES[23], 'Ministry of Finance stamp duty');
  const headers = pageByKey('expenses').columns.map(c => c.header);
  for (const cat of EXPENSE_CATEGORIES) assert.ok(headers.includes(cat), cat);
});

test('Client info fields in the requested order', () => {
  assert.deepEqual(pageByKey('clients').columns.map(c => c.header), [
    'Name', 'Timestamp', 'Phone', 'E-mail', 'Products photo', 'Wood type', 'Base type',
    'Payment status', 'Paid amount (USD)', 'ID',
  ]);
});

test('every data page has a unique ID column and unique headers', () => {
  for (const page of DATA_PAGES) {
    const headers = page.columns.map(c => c.header);
    assert.equal(new Set(headers).size, headers.length, page.key);
    assert.equal(page.columns.filter(c => c.type === 'id').length, 1, page.key);
    assert.equal(column(page, 'id').header, 'ID');
  }
});

test('schema is plain data (safe to bake into Code.gs)', () => {
  const copy = JSON.parse(JSON.stringify(PAGES));
  assert.deepEqual(copy, PAGES);
});
