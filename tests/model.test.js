import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newClient, validate, normalize, parseMoney, formatMoney, centsToInput,
  totals, matches, filterClients, woodSuggestions, BASE_TYPES, STATUSES,
} from '../js/model.js';

test('newClient has sane defaults', () => {
  const c = newClient();
  assert.equal(typeof c.id, 'string');
  assert.ok(c.id.length > 8);
  assert.equal(c.name, '');
  assert.deepEqual(c.photoIds, []);
  assert.equal(c.baseType, 'wood');
  assert.equal(c.paid, false);
  assert.equal(c.amountCents, 0);
  assert.equal(c.status, 'not_delivered');
  assert.equal(typeof c.createdAt, 'number');
});

test('enums', () => {
  assert.deepEqual(BASE_TYPES.map(b => b.value), ['wood', 'steel', 'hybrid']);
  assert.deepEqual(STATUSES.map(s => s.value), ['not_delivered', 'delivered']);
});

test('parseMoney handles common inputs', () => {
  assert.equal(parseMoney('1,250.5'), 125050);
  assert.equal(parseMoney('$1,250.50'), 125050);
  assert.equal(parseMoney('  99 '), 9900);
  assert.equal(parseMoney('0.1'), 10);
  assert.equal(parseMoney('19.999'), 2000);
  assert.equal(parseMoney(''), 0);
  assert.equal(parseMoney(null), 0);
  assert.ok(Number.isNaN(parseMoney('abc')));
  assert.ok(Number.isNaN(parseMoney('1.2.3')));
  assert.ok(Number.isNaN(parseMoney('-5')));
});

test('formatMoney / centsToInput', () => {
  assert.equal(formatMoney(125050), '$1,250.50');
  assert.equal(formatMoney(0), '$0.00');
  assert.equal(centsToInput(125050), '1250.50');
  assert.equal(centsToInput(9900), '99');
  assert.equal(centsToInput(0), '');
});

test('validate requires a name', () => {
  const errs = validate({ ...newClient(), name: '   ' });
  assert.ok(errs.name);
});

test('validate checks email format only when provided', () => {
  assert.equal(validate({ ...newClient(), name: 'A', email: '' }).email, undefined);
  assert.ok(validate({ ...newClient(), name: 'A', email: 'nope' }).email);
  assert.equal(validate({ ...newClient(), name: 'A', email: 'a@b.co' }).email, undefined);
});

test('validate rejects bad amount and enums', () => {
  assert.ok(validate({ ...newClient(), name: 'A', amountCents: NaN }).amount);
  assert.ok(validate({ ...newClient(), name: 'A', amountCents: -1 }).amount);
  assert.ok(validate({ ...newClient(), name: 'A', baseType: 'plastic' }).baseType);
  assert.ok(validate({ ...newClient(), name: 'A', status: 'lost' }).status);
  assert.deepEqual(validate({ ...newClient(), name: 'A' }), {});
});

test('normalize trims strings and coerces types', () => {
  const n = normalize({ ...newClient(), name: '  Sam ', email: ' A@B.CO ', phone: ' 555 ', woodType: ' Oak ', paid: 1 });
  assert.equal(n.name, 'Sam');
  assert.equal(n.email, 'a@b.co');
  assert.equal(n.phone, '555');
  assert.equal(n.woodType, 'Oak');
  assert.equal(n.paid, true);
});

const sample = () => [
  { ...newClient(), id: '1', name: 'Alice Oak', phone: '555-1000', email: 'alice@x.com', amountCents: 10000, paid: true, status: 'delivered', woodType: 'Oak' },
  { ...newClient(), id: '2', name: 'Bob Steel', phone: '555-2000', email: 'bob@y.com', amountCents: 25050, paid: false, status: 'not_delivered', woodType: 'walnut' },
  { ...newClient(), id: '3', name: 'Cara', phone: '', email: '', amountCents: 5000, paid: false, status: 'delivered', woodType: 'Walnut ' },
];

test('totals', () => {
  assert.deepEqual(totals(sample()), {
    count: 3, totalCents: 40050, paidCents: 10000, outstandingCents: 30050, toDeliver: 1,
  });
  assert.deepEqual(totals([]), { count: 0, totalCents: 0, paidCents: 0, outstandingCents: 0, toDeliver: 0 });
});

test('matches searches name, phone, email case-insensitively', () => {
  const [a] = sample();
  assert.ok(matches(a, 'alice'));
  assert.ok(matches(a, 'OAK'));
  assert.ok(matches(a, '1000'));
  assert.ok(matches(a, 'x.com'));
  assert.ok(matches(a, ''));
  assert.ok(!matches(a, 'bob'));
});

test('matches ignores phone punctuation', () => {
  const [a] = sample();
  assert.ok(matches(a, '5551000'));
});

test('filterClients by filter and query', () => {
  const ids = (list) => list.map(c => c.id);
  assert.deepEqual(ids(filterClients(sample(), 'all', '')), ['1', '2', '3']);
  assert.deepEqual(ids(filterClients(sample(), 'paid', '')), ['1']);
  assert.deepEqual(ids(filterClients(sample(), 'unpaid', '')), ['2', '3']);
  assert.deepEqual(ids(filterClients(sample(), 'delivered', '')), ['1', '3']);
  assert.deepEqual(ids(filterClients(sample(), 'not_delivered', '')), ['2']);
  assert.deepEqual(ids(filterClients(sample(), 'unpaid', 'bob')), ['2']);
});

test('woodSuggestions dedupes case-insensitively and sorts', () => {
  assert.deepEqual(woodSuggestions(sample()), ['Oak', 'walnut']);
});
