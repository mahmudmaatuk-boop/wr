// Talks to the WR Apps Script web app. The URL and access key live only on
// this phone (Settings); requests are text/plain JSON so no CORS preflight.
import { getMeta } from './store.js';

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function connection() {
  return { url: await getMeta('scriptUrl', ''), key: await getMeta('accessKey', '') };
}

export async function isConfigured() {
  const { url, key } = await connection();
  return Boolean(url && key);
}

export async function call(action, payload = {}, { timeout = 30000, conn } = {}) {
  const { url, key } = conn || await connection();
  if (!url || !key) throw new ApiError('not_configured', 'Connect WR to Google Sheets in Settings.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(url, { method: 'POST', body: JSON.stringify({ ...payload, action, key }), signal: ctrl.signal });
  } catch {
    throw new ApiError('network', ctrl.signal.aborted ? 'Google Sheets took too long to answer.' : 'No connection to Google Sheets.');
  } finally {
    clearTimeout(timer);
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError('bad_response', 'Unexpected answer from the server. Check the script URL in Settings.');
  }
  if (!data || data.ok !== true) throw new ApiError(data?.code || 'server', data?.error || 'Something went wrong on the server.');
  return data;
}

export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

export function base64ToBlob(b64, type = 'application/octet-stream') {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
