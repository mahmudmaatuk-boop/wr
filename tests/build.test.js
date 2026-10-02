import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGas } from '../scripts/build-gas.mjs';

test('apps-script/Code.gs is up to date (run: npm run build)', async () => {
  const committed = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  assert.equal(committed, await buildGas());
});
