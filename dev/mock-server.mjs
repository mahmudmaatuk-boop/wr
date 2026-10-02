// Local development server: serves the app and answers /api by running the
// real apps-script/Code.gs against in-memory Sheets and Drive (dev/gas-fakes.mjs).
//   npm run dev        → http://localhost:5180, script URL …/api, access key "dev-key"
// Extras for testing: /__offline?on=1 makes /api unreachable; /__inspect dumps the sheets.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGas, loadServer } from './gas-fakes.mjs';
import { buildGas } from '../scripts/build-gas.mjs';

const PORT = Number(process.env.PORT || 5180);
const ORIGIN = `http://localhost:${PORT}`;
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const KEY = process.env.WR_KEY || 'dev-key';
const DELAY = Number(process.env.API_DELAY ?? 300); // Apps Script answers in ~0.3–2 s

const gas = createGas({ fileUrlBase: `${ORIGIN}/fake-drive/d/` });
gas.props.setProperty('KEY', KEY);
const server = loadServer(gas, await buildGas());
server.setup();

let offline = false;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.md': 'text/plain; charset=utf-8',
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

function sheetsDump() {
  const out = {};
  for (const ss of gas.spreadsheets.values()) {
    if (ss.file.trashed) continue;
    out[ss.getName()] = Object.fromEntries(ss.getSheets().map(s => [s.getName(), s.values()]));
  }
  return out;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  try {
    if (url.pathname === '/api') {
      if (offline) { req.socket.destroy(); return; }
      if (req.method !== 'POST') { res.writeHead(405).end(); return; }
      const out = server.doPost({ postData: { contents: await readBody(req) } });
      await new Promise(r => setTimeout(r, DELAY));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }).end(out.getContent());
      return;
    }
    if (url.pathname === '/__offline') {
      offline = url.searchParams.get('on') === '1';
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end(`offline=${offline}`);
      return;
    }
    if (url.pathname === '/__inspect') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(sheetsDump(), null, 1));
      return;
    }
    const drive = url.pathname.match(/^\/fake-drive\/d\/([\w-]+)/);
    if (drive) {
      const file = gas.file(drive[1]);
      if (!file || file.trashed || file.sharing !== 'ANYONE_WITH_LINK') { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': file.mime, 'Cache-Control': 'no-store' }).end(Buffer.from(file.bytes));
      return;
    }
    let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if ((await stat(path).catch(() => null))?.isDirectory()) path = join(path, 'index.html');
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(data);
  } catch (err) {
    if (err.code === 'ENOENT') { res.writeHead(404).end('Not found'); return; }
    console.error(err);
    res.writeHead(500).end(String(err));
  }
}).listen(PORT, () => {
  console.log(`WR dev server  ${ORIGIN}`);
  console.log(`Script URL     ${ORIGIN}/api`);
  console.log(`Access key     ${KEY}`);
});
