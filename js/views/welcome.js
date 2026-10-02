// Welcome: big "Welcome", the Website button, and the nine pages as app icons.
import { h, icon } from '../ui.js';
import { PAGES } from '../schema.js';
import { PAGE_UI, WEBSITE } from '../pages.js';
import { isConfigured } from '../api.js';
import { subscribe, describe } from '../sync.js';
import { navigate } from '../router.js';

export async function renderWelcome(root) {
  const configured = await isConfigured();
  const pill = h('span', { class: 'sync-pill', 'aria-live': 'polite' });

  root.replaceChildren(h('main', { class: 'welcome' },
    h('div', { class: 'welcome-top' },
      h('span', { class: 'brand-mark', 'aria-label': 'WR' }, 'WR'),
      h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: () => navigate('/settings') }, icon('settings'))),
    h('h1', { class: 'welcome-title' }, 'Welcome'),
    h('div', { class: 'welcome-actions' },
      h('a', { class: 'btn primary pill', href: WEBSITE, target: '_blank', rel: 'noopener' }, 'Website', icon('external')),
      pill),
    !configured && h('button', { class: 'banner', onclick: () => navigate('/settings') },
      icon('link'),
      h('span', { class: 'banner-text' }, h('strong', {}, 'Connect to Google Sheets'), h('span', {}, 'Until then, entries are kept on this phone.')),
      icon('chevron')),
    h('nav', { class: 'tiles', 'aria-label': 'Pages' }, PAGES.map((p, i) =>
      h('button', { class: 'tile', onclick: () => navigate(`/p/${p.key}`) },
        h('span', { class: `tile-icon t${i + 1}` }, icon(PAGE_UI[p.key].icon)),
        h('span', { class: 'tile-label' }, p.title))))));

  return subscribe((s) => {
    const d = describe(s);
    pill.className = `sync-pill tone-${d.tone}`;
    pill.replaceChildren(icon(d.icon), d.text);
  });
}
