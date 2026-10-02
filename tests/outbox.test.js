import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coalesce, mergeView } from '../js/outbox.js';

const save = (id, record, extra = {}) => ({ key: `clients:${id}`, page: 'clients', id, type: 'save', record: { id, ...record }, created: false, seq: 1, version: 1, ...extra });
const del = (id, extra = {}) => ({ key: `clients:${id}`, page: 'clients', id, type: 'delete', seq: 5, version: 1, ...extra });

test('first operation is stored as is', () => {
  const op = save('a', { name: 'A' });
  assert.deepEqual(coalesce(null, op), op);
});

test('save after save keeps the newest data, the queue position and the created flag', () => {
  const first = save('a', { name: 'A' }, { created: true, seq: 1, version: 1 });
  const next = save('a', { name: 'A2' }, { seq: 9 });
  const out = coalesce(first, next);
  assert.equal(out.record.name, 'A2');
  assert.equal(out.seq, 1);
  assert.equal(out.version, 2);
  assert.equal(out.created, true);
});

test('delete of a never-uploaded record cancels both', () => {
  assert.equal(coalesce(save('a', {}, { created: true }), del('a')), null);
});

test('delete while the create is being uploaded is kept', () => {
  const out = coalesce(save('a', {}, { created: true }), del('a'), { inFlight: true });
  assert.equal(out.type, 'delete');
  assert.equal(out.version, 2);
});

test('delete of an existing record replaces the pending save', () => {
  const out = coalesce(save('a', { name: 'A' }, { created: false }), del('a'));
  assert.equal(out.type, 'delete');
  assert.equal(out.seq, 1);
});

test('save while the create is in flight is no longer "created"', () => {
  const out = coalesce(save('a', {}, { created: true }), save('a', { name: 'B' }), { inFlight: true });
  assert.equal(out.created, false);
});

test('errors are cleared when a record is edited again', () => {
  const out = coalesce(save('a', {}, { error: 'boom', attempts: 3 }), save('a', { name: 'B' }));
  assert.equal(out.error, null);
  assert.equal(out.attempts, 0);
});

test('mergeView overlays pending changes on the downloaded rows, newest first', () => {
  const rows = [{ id: '1', name: 'Old one' }, { id: '2', name: 'Two' }, { id: '3', name: 'Three' }];
  const ops = [
    save('2', { name: 'Two edited' }, { seq: 3 }),
    del('3', { seq: 4 }),
    save('9', { name: 'New' }, { seq: 5, created: true }),
  ];
  const view = mergeView(rows, ops);
  assert.deepEqual(view.map(r => r.id), ['9', '2', '1']);
  assert.equal(view[1].name, 'Two edited');
  assert.equal(view[1]._pending, true);
  assert.equal(view[2]._pending, undefined);
});
