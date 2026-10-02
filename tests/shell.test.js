// Every app file must be in the service worker's offline list, or WR breaks offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function jsFiles(dir) {
  const out = [];
  for (const entry of await readdir(new URL(dir, root), { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) out.push(...await jsFiles(`${path}/`));
    else if (entry.name.endsWith('.js')) out.push(`./${path}`);
  }
  return out;
}

test('sw.js caches every file under js/', async () => {
  const sw = await readFile(new URL('sw.js', root), 'utf8');
  const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  for (const file of await jsFiles('js/')) assert.ok(shell.includes(file), `${file} is missing from SHELL in sw.js`);
  for (const file of shell.filter(f => f.startsWith('./js/'))) {
    await assert.doesNotReject(readFile(new URL(file, root)), `${file} is listed but does not exist`);
  }
});

test('app and server versions match', async () => {
  const { APP_VERSION } = await import('../js/version.js');
  const server = await readFile(new URL('apps-script/src/server.js', root), 'utf8');
  const sw = await readFile(new URL('sw.js', root), 'utf8');
  assert.match(server, new RegExp(`WR_VERSION = '${APP_VERSION}'`));
  assert.match(sw, new RegExp(`CACHE_VERSION = 'wr-v${APP_VERSION}'`));
});
