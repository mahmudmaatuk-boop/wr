import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMoney, formatMoney, centsToInput, parseNumber, formatNumber, vat, volumeM3, sumCents,
  monthKey, monthLabel, monthTabName, isMonthKey, formatDims, parseDims, formatBytes, fileKind,
} from '../js/calc.js';

test('parseMoney: cents from typed text, null for empty, NaN for junk', () => {
  assert.equal(parseMoney('1,250.5'), 125050);
  assert.equal(parseMoney('$1,250.50'), 125050);
  assert.equal(parseMoney('0.1'), 10);
  assert.equal(parseMoney('19.999'), 2000);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('  '), null);
  assert.equal(parseMoney(null), null);
  assert.ok(Number.isNaN(parseMoney('abc')));
  assert.ok(Number.isNaN(parseMoney('-5')));
});

test('formatMoney / centsToInput', () => {
  assert.equal(formatMoney(125050), '$1,250.50');
  assert.equal(formatMoney(null), '$0.00');
  assert.equal(centsToInput(125050), '1250.50');
  assert.equal(centsToInput(9900), '99');
  assert.equal(centsToInput(null), '');
});

test('parseNumber / formatNumber', () => {
  assert.equal(parseNumber('12'), 12);
  assert.equal(parseNumber('2.5'), 2.5);
  assert.equal(parseNumber('1,200'), 1200);
  assert.equal(parseNumber('.5'), 0.5);
  assert.equal(parseNumber(''), null);
  assert.ok(Number.isNaN(parseNumber('2x')));
  assert.ok(Number.isNaN(parseNumber('-1')));
  assert.equal(formatNumber(1234.5), '1,234.5');
  assert.equal(formatNumber(0.5404, 3), '0.54');
});

test('vat: 11% of qty × unit price, total due includes it', () => {
  assert.deepEqual(vat(4, 85000), { vat: 37400, total: 377400 });
  assert.deepEqual(vat(2, 42000), { vat: 9240, total: 93240 });
  assert.deepEqual(vat(1, 26000), { vat: 2860, total: 28860 });
  assert.deepEqual(vat(3, 333), { vat: 110, total: 1109 });
  assert.deepEqual(vat(null, 100), { vat: null, total: null });
  assert.deepEqual(vat(2, NaN), { vat: null, total: null });
});

test('volumeM3: L×W×H cm × qty, 3 decimals', () => {
  assert.equal(volumeM3({ l: 200, w: 90, h: 75 }, 4), 5.4);
  assert.equal(volumeM3({ l: 120, w: 60, h: 45 }, 1), 0.324);
  assert.equal(volumeM3({ l: 120, w: 60, h: 45 }, null), 0.324);
  assert.equal(volumeM3({ l: 33.3, w: 33.3, h: 33.3 }, 1), 0.037);
  assert.equal(volumeM3(null, 2), null);
  assert.equal(volumeM3({ l: 1, w: NaN, h: 2 }, 1), null);
});

test('sumCents ignores empty values', () => {
  assert.equal(sumCents([100, null, 250, undefined, NaN]), 350);
  assert.equal(sumCents([]), 0);
});

test('months', () => {
  assert.equal(monthKey(new Date(2026, 9, 2)), '2026-10');
  assert.equal(monthKey(new Date(2026, 0, 31)), '2026-01');
  assert.equal(monthLabel('2026-10'), 'October 2026');
  assert.equal(monthTabName('2026-10'), '2026-10 October');
  assert.ok(isMonthKey('2026-10'));
  assert.ok(!isMonthKey('2026-13'));
  assert.ok(!isMonthKey('2026-1'));
});

test('dimensions text round trip', () => {
  assert.equal(formatDims({ l: 200, w: 90, h: 75 }), '200 × 90 × 75');
  assert.equal(formatDims({ l: 1.5, w: 2, h: 0.25 }), '1.5 × 2 × 0.25');
  assert.equal(formatDims(null), '');
  assert.equal(formatDims({ l: 1, w: null, h: 2 }), '');
  assert.deepEqual(parseDims('200 × 90 × 75'), { l: 200, w: 90, h: 75 });
  assert.deepEqual(parseDims('200x90x75 cm'), { l: 200, w: 90, h: 75 });
  assert.deepEqual(parseDims('1.5 * 2 * 0.25'), { l: 1.5, w: 2, h: 0.25 });
  assert.equal(parseDims(''), null);
  assert.equal(parseDims('big'), null);
});

test('formatBytes / fileKind', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1572864), '1.5 MB');
  assert.equal(fileKind('application/pdf', 'a.pdf'), 'PDF');
  assert.equal(fileKind('image/jpeg', 'p.jpg'), 'JPEG');
  assert.equal(fileKind('', 'report.docx'), 'Word');
  assert.equal(fileKind('', 'sheet.xlsx'), 'Excel');
  assert.equal(fileKind('', 'notes'), 'File');
});
