// Runs the real apps-script/Code.gs against in-memory fakes of Sheets and Drive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGas, loadServer } from '../dev/gas-fakes.mjs';
import { buildGas } from '../scripts/build-gas.mjs';
import { PAGES, DATA_PAGES, WOOD_TYPES, pageByKey } from '../js/schema.js';

const CODE = await buildGas();

function boot() {
  const gas = createGas();
  const srv = loadServer(gas, CODE);
  srv.setup();
  const key = gas.props.getProperty('KEY');
  const call = (req, k = key) =>
    JSON.parse(srv.doPost({ postData: { contents: JSON.stringify({ key: k, ...req }) } }).getContent());
  const sheet = (ssName, tab = ssName) => gas.spreadsheetByName(ssName).getSheetByName(tab);
  return { gas, srv, key, call, sheet };
}

const b64 = (s) => Buffer.from(s).toString('base64');
const colOf = (pageKey, header) => pageByKey(pageKey).columns.findIndex(c => c.header === header) + 1;

test('setup creates the WR folder, nine spreadsheets, the key and the monthly backup', () => {
  const { gas, sheet } = boot();
  const names = [...gas.spreadsheets.values()].map(s => s.getName()).sort();
  assert.deepEqual(names, PAGES.map(p => p.spreadsheet).sort());
  const key = gas.props.getProperty('KEY');
  assert.match(key, /^wr-[0-9a-f]{32}$/);
  assert.ok(gas.logs.some(l => l.includes(key)), 'key is printed in the log');
  const clients = sheet('Client info');
  assert.deepEqual(clients.values()[0], pageByKey('clients').columns.map(c => c.header));
  assert.equal(clients.frozen, 1);
  const root = gas.props.getProperty('ROOT_FOLDER_ID');
  for (const ss of gas.spreadsheets.values()) assert.deepEqual(ss.file.parents, [root], ss.getName());
  assert.deepEqual(gas.triggers.map(t => [t.fn, t.day, t.hour]), [['scheduledBackup', 1, 2]]);
  assert.ok(sheet('WR Backup', 'Summary'));
});

test('setup is safe to run again', () => {
  const { gas, srv } = boot();
  const key = gas.props.getProperty('KEY');
  srv.setup();
  assert.equal(gas.spreadsheets.size, 9);
  assert.equal(gas.triggers.length, 1);
  assert.equal(gas.props.getProperty('KEY'), key);
});

test('columns get number formats and real dropdowns', () => {
  const { sheet } = boot();
  const clients = sheet('Client info');
  assert.equal(clients.formats.get(colOf('clients', 'Phone')).fmt, '@');
  assert.equal(clients.formats.get(colOf('clients', 'Paid amount (USD)')).fmt, '$#,##0.00');
  assert.equal(clients.formats.get(colOf('clients', 'Timestamp')).fmt, 'yyyy-mm-dd hh:mm');
  assert.deepEqual(clients.validations.get(colOf('clients', 'Wood type')).list, WOOD_TYPES);
  assert.deepEqual(clients.validations.get(colOf('clients', 'Payment status')).list, ['Paid', 'Not paid']);
  const expenses = sheet('Monthly expenses');
  assert.equal(expenses.values()[0].length, 28, 'more columns than a new sheet has');
  assert.equal(sheet('Packing & Shipments').formats.get(colOf('packing', 'Volume (m³)')).fmt, '0.000');
});

test('requests need the right access key and a known page', () => {
  const { call } = boot();
  assert.deepEqual(call({ action: 'ping' }, 'wrong'),
    { ok: false, code: 'unauthorized', error: 'Wrong access key. Check WR → Settings.' });
  assert.equal(call({ action: 'ping' }).ok, true);
  assert.equal(call({ action: 'list', page: 'nope' }).code, 'bad_request');
  assert.equal(call({ action: 'list', page: 'backup' }).code, 'bad_request');
  assert.equal(call({ action: 'explode' }).code, 'bad_request');
});

test('bad JSON and the GET health check', () => {
  const { srv } = boot();
  const res = JSON.parse(srv.doPost({ postData: { contents: '{nope' } }).getContent());
  assert.equal(res.ok, false);
  assert.equal(res.code, 'bad_request');
  assert.equal(JSON.parse(srv.doGet().getContent()).app, 'WR');
});

test('save and list a client; the phone keeps its leading zeros', () => {
  const { call } = boot();
  const res = call({
    action: 'save', page: 'clients', id: 'c1',
    row: {
      Name: 'Sameer Ahmad', Phone: '0096170123456', 'E-mail': 'sameer@example.com', 'Wood type': 'Teak',
      'Base type': 'Hybrid', 'Payment status': 'Paid', 'Paid amount (USD)': 1200.5, 'Products photo': { keep: [] }, ID: 'c1',
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.row.Phone, '0096170123456');
  assert.match(res.row.Timestamp, /^\d{4}-\d{2}-\d{2}T/);
  const rows = call({ action: 'list', page: 'clients' }).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Name, 'Sameer Ahmad');
  assert.equal(rows[0]['Paid amount (USD)'], 1200.5);
  assert.equal(rows[0].Phone, '0096170123456');
  assert.equal(rows[0].ID, 'c1');
});

test('a provided timestamp is used for new rows (old-client import)', () => {
  const { call } = boot();
  const row = call({ action: 'save', page: 'clients', id: 'c1', row: { Name: 'A', Timestamp: '2026-09-28T10:00:00.000Z' } }).row;
  assert.equal(row.Timestamp, '2026-09-28T10:00:00.000Z');
});

test('saving again updates the same row and keeps the timestamp', () => {
  const { call, sheet } = boot();
  const first = call({ action: 'save', page: 'clients', id: 'c1', row: { Name: 'A', 'Payment status': 'Not paid' } }).row;
  const second = call({ action: 'save', page: 'clients', id: 'c1', row: { Name: 'A', 'Payment status': 'Paid', 'Paid amount (USD)': 50 } }).row;
  assert.equal(second.Timestamp, first.Timestamp);
  assert.equal(sheet('Client info').getLastRow(), 2);
  assert.equal(call({ action: 'list', page: 'clients' }).rows[0]['Payment status'], 'Paid');
});

test('columns are matched by header, even after reordering them in Sheets', () => {
  const { call, sheet } = boot();
  call({ action: 'save', page: 'vat', id: 'v1', row: { QTY: 4, Description: 'Table', 'Unit Price USD': 850, 'VAT 11%': 374, 'Total amount due': 3774 } });
  const s = sheet('VAT');
  const swapped = s.values().map(line => [line[1], line[0], ...line.slice(2)]);
  s.getRange(1, 1, swapped.length, swapped[0].length).setValues(swapped);
  call({ action: 'save', page: 'vat', id: 'v1', row: { QTY: 5 } });
  const row = call({ action: 'list', page: 'vat' }).rows[0];
  assert.equal(row.QTY, 5);
  assert.equal(row.Description, 'Table');
  assert.equal(s.values()[0][0], 'Description');
});

test('rows typed by hand in Sheets get an ID', () => {
  const { call, sheet } = boot();
  const s = sheet('Raw Stockage');
  s.appendRow(['Sapele', 12, '300 × 20 × 5', '']);
  const rows = call({ action: 'list', page: 'raw' }).rows;
  assert.equal(rows.length, 1);
  assert.ok(rows[0].ID);
  assert.equal(s.values()[1][3], rows[0].ID);
  assert.equal(rows[0]['Dimensions (cm)'], '300 × 20 × 5');
});

test('photos are uploaded and shared by link; removed ones are trashed', () => {
  const { gas, call } = boot();
  const up = (name) => ({ name, type: 'image/jpeg', data: b64(`jpeg:${name}`) });
  const row = call({ action: 'save', page: 'finished', id: 'f1', row: { 'Wood type': 'Teak', 'Product photo': { keep: [], uploads: [up('a.jpg'), up('b.jpg')] } } }).row;
  const urls = row['Product photo'].split('\n');
  assert.equal(urls.length, 2);
  const files = urls.map(u => gas.file(u.match(/\/d\/([\w-]+)/)[1]));
  assert.ok(files.every(f => f.sharing === 'ANYONE_WITH_LINK'));
  assert.equal(files[0].getBlob().getDataAsString(), 'jpeg:a.jpg');
  const again = call({ action: 'save', page: 'finished', id: 'f1', row: { 'Product photo': { keep: [urls[0]] } } }).row;
  assert.equal(again['Product photo'], urls[0]);
  assert.equal(files[1].isTrashed(), true);
  assert.equal(files[0].isTrashed(), false);
});

test('the keep list cannot add links that were not already in the row', () => {
  const { call } = boot();
  const row = call({ action: 'save', page: 'finished', id: 'f1', row: { 'Wood type': 'Teak', 'Product photo': { keep: ['https://drive.google.com/file/d/someoneElse123/view'] } } }).row;
  assert.equal(row['Product photo'], '');
});

test('client info monthly: one tab per month, newest first; changing the month moves the row', () => {
  const { gas, call } = boot();
  const ss = gas.spreadsheetByName('Client info monthly');
  call({ action: 'save', page: 'monthly', id: 'm1', row: { Month: '2026-10', Name: 'A', 'Amount paid (USD)': 100, 'Total (USD)': 300 } });
  call({ action: 'save', page: 'monthly', id: 'm2', row: { Month: '2026-09', Name: 'B' } });
  call({ action: 'save', page: 'monthly', id: 'm3', row: { Month: '2026-11', Name: 'C' } });
  const tabs = ss.getSheets().map(s => s.getName()).filter(n => /^2026-(09|10|11) /.test(n));
  assert.deepEqual(tabs, ['2026-11 November', '2026-10 October', '2026-09 September']);
  call({ action: 'save', page: 'monthly', id: 'm1', row: { Month: '2026-09' } });
  assert.equal(ss.getSheetByName('2026-10 October').getLastRow(), 1);
  assert.equal(ss.getSheetByName('2026-09 September').getLastRow(), 3);
  const rows = call({ action: 'list', page: 'monthly' }).rows;
  assert.equal(rows.length, 3);
  const moved = rows.find(r => r.ID === 'm1');
  assert.equal(moved.Name, 'A');
  assert.equal(moved.Month, '2026-09');
  assert.equal(moved['Total (USD)'], 300);
  assert.equal(call({ action: 'save', page: 'monthly', id: 'm4', row: { Name: 'No month' } }).code, 'bad_request');
});

test('monthly expenses: saving a month again updates its one row', () => {
  const { call, sheet } = boot();
  const r1 = call({ action: 'save', page: 'expenses', id: '2026-10', row: { Month: '2026-10', Salaries: 4500, 'Total (USD)': 4500 } }).row;
  const r2 = call({ action: 'save', page: 'expenses', id: '2026-10', row: { Month: '2026-10', Salaries: 4500, Fuel: 120, 'Total (USD)': 4620 } }).row;
  assert.equal(sheet('Monthly expenses').getLastRow(), 2);
  assert.equal(r2.Fuel, 120);
  assert.equal(r2.Month, '2026-10');
  assert.ok(r2['Last updated'] >= r1['Last updated']);
  assert.equal(call({ action: 'list', page: 'expenses' }).rows[0]['Total (USD)'], 4620);
});

test('delete removes the row and trashes its photos', () => {
  const { gas, call, sheet } = boot();
  const row = call({ action: 'save', page: 'clients', id: 'c1', row: { Name: 'A', 'Products photo': { keep: [], uploads: [{ name: 'p.jpg', type: 'image/jpeg', data: b64('x') }] } } }).row;
  const file = gas.file(row['Products photo'].match(/\/d\/([\w-]+)/)[1]);
  assert.deepEqual(call({ action: 'delete', page: 'clients', id: 'c1' }), { ok: true, deleted: true });
  assert.equal(sheet('Client info').getLastRow(), 1);
  assert.equal(file.isTrashed(), true);
  assert.deepEqual(call({ action: 'delete', page: 'clients', id: 'c1' }), { ok: true, deleted: false });
});

test('documents are stored privately and can be opened through the script', () => {
  const { gas, call } = boot();
  const row = call({
    action: 'save', page: 'documents', id: 'd1', row: { Title: 'Work permit', 'File name': 'ignored' },
    file: { name: 'permit.pdf', type: 'application/pdf', data: b64('%PDF-1.4 hello') },
  }).row;
  assert.equal(row['File name'], 'permit.pdf');
  assert.equal(row.Type, 'application/pdf');
  assert.equal(row.Size, '14 B');
  const file = gas.file(row['File ID']);
  assert.equal(file.sharing, 'PRIVATE');
  assert.deepEqual(file.parents, [gas.props.getProperty('DOCS_FOLDER_ID')]);
  const got = call({ action: 'getFile', id: 'd1' });
  assert.equal(Buffer.from(got.data, 'base64').toString(), '%PDF-1.4 hello');
  assert.equal(got.name, 'permit.pdf');
  const renamed = call({ action: 'save', page: 'documents', id: 'd1', row: { Title: 'Permit 2026', 'File ID': 'tampered' } }).row;
  assert.equal(renamed['File ID'], row['File ID']);
  assert.equal(renamed.Title, 'Permit 2026');
  call({ action: 'delete', page: 'documents', id: 'd1' });
  assert.equal(file.isTrashed(), true);
  assert.equal(call({ action: 'getFile', id: 'd1' }).code, 'not_found');
  assert.equal(call({ action: 'save', page: 'documents', id: 'd2', row: { Title: 'x' } }).code, 'bad_request');
});

test('text that looks like a formula stays text', () => {
  const { call } = boot();
  call({ action: 'save', page: 'clients', id: 'c1', row: { Name: '=HYPERLINK("x")' } });
  call({ action: 'save', page: 'clients', id: 'c1', row: { Phone: '123' } });
  assert.equal(call({ action: 'list', page: 'clients' }).rows[0].Name, '=HYPERLINK("x")');
});

test('backup copies every page into WR Backup, with a Summary tab', () => {
  const { gas, call } = boot();
  call({ action: 'save', page: 'clients', id: 'c1', row: { Name: 'A', 'Payment status': 'Paid', 'Paid amount (USD)': 1200.5 } });
  call({ action: 'save', page: 'clients', id: 'c2', row: { Name: 'B', 'Payment status': 'Not paid', 'Paid amount (USD)': 300 } });
  call({ action: 'save', page: 'expenses', id: '2026-10', row: { Month: '2026-10', Salaries: 4500, 'Total (USD)': 4500 } });
  call({ action: 'save', page: 'monthly', id: 'm1', row: { Month: '2026-10', Name: 'A', 'Amount paid (USD)': 100 } });
  call({ action: 'save', page: 'monthly', id: 'm2', row: { Month: '2026-09', Name: 'B', 'Amount paid (USD)': 50 } });
  call({ action: 'save', page: 'vat', id: 'v1', row: { QTY: 4, Description: 'Table', 'Unit Price USD': 850, 'VAT 11%': 374, 'Total amount due': 3774 } });
  call({ action: 'save', page: 'raw', id: 'r1', row: { 'Wood type': 'Sapele', Qty: 12 } });
  const res = call({ action: 'backup' });
  assert.equal(res.ok, true);
  const bss = gas.spreadsheetByName('WR Backup');
  assert.deepEqual(bss.getSheets().map(s => s.getName()), ['Summary', ...DATA_PAGES.map(p => p.title)]);
  assert.equal(bss.getSheetByName('Client info').getLastRow(), 3);
  const monthly = bss.getSheetByName('Client info monthly').values();
  assert.equal(monthly.length, 3, 'month tabs merged into one tab');
  assert.deepEqual(monthly.slice(1).map(l => l[0]).sort(), ['2026-09', '2026-10']);
  assert.equal(res.counts['Client info'], 2);
  assert.equal(res.counts['WR-Documents'], 0);
  const summary = bss.getSheetByName('Summary').values();
  assert.equal(summary[0][0], 'WR backup');
  const totals = Object.fromEntries(summary.filter(l => l[0]).map(l => [l[0], l[1]]));
  assert.equal(totals['Client info: paid amount (Paid)'], 1200.5);
  assert.equal(totals['Monthly expenses: all months'], 4500);
  assert.equal(totals['Client info monthly: amount paid'], 150);
  assert.equal(totals['VAT: total amount due'], 3774);
  assert.equal(totals['Raw Stockage: total qty'], 12);
  assert.equal(totals['Client info'], 2);
  assert.equal(call({ action: 'ping' }).lastBackup, res.at);
  call({ action: 'backup' });
  assert.equal(bss.getSheets().length, 9, 'a second backup replaces the tabs');
});

test('the scheduled backup runs on its own', () => {
  const { gas, srv } = boot();
  srv.scheduledBackup();
  assert.ok(gas.props.getProperty('LAST_BACKUP'));
});

test('status lists the sheets and the automatic backup', () => {
  const { call } = boot();
  const s = call({ action: 'status' });
  assert.equal(s.autoBackup, true);
  assert.match(s.backupUrl, /^https:\/\/docs\.google\.com\/spreadsheets\/d\//);
  assert.equal(Object.keys(s.sheets).length, 9);
  assert.match(s.folderUrl, /^https:\/\/drive\.google\.com\/drive\/folders\//);
});

test('resetKey replaces the access key', () => {
  const { gas, srv, call, key } = boot();
  const next = srv.resetKey();
  assert.notEqual(next, key);
  assert.equal(call({ action: 'ping' }, key).code, 'unauthorized');
  assert.equal(call({ action: 'ping' }, gas.props.getProperty('KEY')).ok, true);
});
