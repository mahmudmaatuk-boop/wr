import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../js/validate.js';
import { pageByKey } from '../js/schema.js';

const clients = pageByKey('clients');
const base = { id: '1', name: 'Sameer', email: '', paid: null, payment: 'Not paid', photos: [] };

test('required fields', () => {
  assert.equal(validate(clients, { ...base, name: '  ' }).name, 'Name is required');
  assert.deepEqual(validate(clients, base), {});
  const vat = validate(pageByKey('vat'), { id: '1', qty: null, description: '', unit: null });
  assert.equal(vat.qty, 'QTY is required');
  assert.equal(vat.description, 'Description is required');
  assert.equal(vat.unit, 'Unit Price USD is required');
});

test('email only checked when filled', () => {
  assert.equal(validate(clients, { ...base, email: 'nope' }).email, 'Enter a valid e-mail');
  assert.equal(validate(clients, { ...base, email: 'a@b.co' }).email, undefined);
});

test('money and numbers', () => {
  assert.equal(validate(clients, { ...base, paid: NaN }).paid, 'Enter a valid amount');
  const raw = pageByKey('raw');
  assert.equal(validate(raw, { id: '1', wood: 'Teak', qty: NaN }).qty, 'Enter a valid number');
  assert.deepEqual(validate(raw, { id: '1', wood: 'Teak', qty: 12 }), {});
});

test('dimensions must be complete when started', () => {
  const raw = pageByKey('raw');
  assert.equal(validate(raw, { id: '1', wood: 'Teak', qty: 1, dims: { l: 200, w: NaN, h: 5 } }).dims,
    'Enter length, width and height');
  assert.deepEqual(validate(raw, { id: '1', wood: 'Teak', qty: 1, dims: { l: 200, w: 30, h: 5 } }), {});
  assert.deepEqual(validate(raw, { id: '1', wood: 'Teak', qty: 1, dims: null }), {});
});

test('months', () => {
  const monthly = pageByKey('monthly');
  assert.equal(validate(monthly, { id: '1', name: 'A', month: '' }).month, 'Month is required');
  assert.equal(validate(monthly, { id: '1', name: 'A', month: '2026-13' }).month, 'Choose a month');
  assert.deepEqual(validate(monthly, { id: '1', name: 'A', month: '2026-10' }), {});
});
