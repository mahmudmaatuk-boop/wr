import { takeUrls, toast } from './ui.js';
import { currentPath, match } from './router.js';
import { start as startSync } from './sync.js';
import { renderWelcome } from './views/welcome.js';
import { renderPage, renderEdit } from './views/page.js';
import { renderExpenses } from './views/expenses.js';
import { renderDocuments } from './views/documents.js';
import { renderBackup } from './views/backup.js';
import { renderSettings } from './views/settings.js';

const routes = [
  ['/', renderWelcome],
  ['/settings', renderSettings],
  ['/p/expenses', (root) => renderExpenses(root, { tab: 'month' })],
  ['/p/expenses/saved', (root) => renderExpenses(root, { tab: 'saved' })],
  ['/p/expenses/m/:month', (root, p) => renderExpenses(root, { tab: 'month', month: p.month })],
  ['/p/documents', renderDocuments],
  ['/p/backup', renderBackup],
  ['/p/:page', (root, p) => renderPage(root, { page: p.page, tab: 'new' })],
  ['/p/:page/saved', (root, p) => renderPage(root, { page: p.page, tab: 'saved' })],
  ['/p/:page/e/:id', renderEdit],
];

const root = document.getElementById('app');
let renderToken = 0;
let staleUrls = [];
let cleanup = null;

async function render() {
  const token = ++renderToken;
  staleUrls.push(...takeUrls()); // previous screen's images, freed once the new one is up
  const found = match(routes, currentPath()) || match(routes, '/');
  const next = document.createElement('div');
  next.className = 'view';
  let dispose = null;
  try {
    dispose = await found.handler(next, found.params);
  } catch (err) {
    console.error(err);
    toast(`Something went wrong: ${err.message}`, 'error');
    return;
  }
  if (token !== renderToken) {
    if (typeof dispose === 'function') dispose();
    return; // a newer navigation won
  }
  if (typeof cleanup === 'function') cleanup();
  cleanup = dispose;
  root.replaceChildren(next);
  window.scrollTo(0, 0);
  staleUrls.splice(0).forEach(u => URL.revokeObjectURL(u));
}

window.addEventListener('hashchange', render);
render();
startSync();

// iOS-style: the small title appears in the nav bar once the large title scrolls away.
window.addEventListener('scroll', () => document.body.classList.toggle('scrolled', window.scrollY > 40), { passive: true });

// Ask the browser not to clear WR's data under storage pressure.
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker registration failed', err));
  });
}
