import { takeUrls, toast } from './ui.js';
import { currentPath, match } from './router.js';
import { renderList } from './views/list.js';
import { renderForm } from './views/form.js';
import { renderDetail } from './views/detail.js';
import { renderSettings } from './views/settings.js';

const routes = [
  ['/', renderList],
  ['/new', renderForm],
  ['/c/:id', renderDetail],
  ['/c/:id/edit', renderForm],
  ['/settings', renderSettings],
];

const root = document.getElementById('app');
let renderToken = 0;
let staleUrls = [];

async function render() {
  const token = ++renderToken;
  staleUrls.push(...takeUrls()); // previous screen's photos, freed once the new one is up
  const found = match(routes, currentPath()) || match(routes, '/');
  const next = document.createElement('div');
  next.className = 'view';
  try {
    await found.handler(next, found.params);
  } catch (err) {
    console.error(err);
    toast(`Something went wrong: ${err.message}`, 'error');
    return;
  }
  if (token !== renderToken) return; // a newer navigation won
  root.replaceChildren(next);
  window.scrollTo(0, 0);
  staleUrls.splice(0).forEach(u => URL.revokeObjectURL(u));
}

window.addEventListener('hashchange', render);
render();

// Ask the browser not to evict our data under storage pressure.
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW registration failed', err));
  });
}
