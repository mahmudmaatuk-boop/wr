import { h, icon, topBar, blobUrl, initials } from '../ui.js';
import { getAllClients, getPhoto } from '../db.js';
import { totals, filterClients, formatMoney, FILTERS, BASE_TYPES, labelOf } from '../model.js';
import { navigate } from '../router.js';

// Search + filter survive navigating into a client and back.
const state = { query: '', filter: 'all' };

export async function renderList(root) {
  const clients = (await getAllClients()).sort((a, b) => b.updatedAt - a.updatedAt);
  const t = totals(clients);

  const listEl = h('div', { class: 'client-list', role: 'list' });
  const countEl = h('p', { class: 'list-count', 'aria-live': 'polite' });

  const thumbCache = new Map();
  async function thumbFor(c, holder) {
    const pid = c.photoIds[0];
    if (!pid) return;
    let url = thumbCache.get(pid);
    if (!url) {
      const p = await getPhoto(pid);
      if (!p) return;
      url = blobUrl(p.thumb || p.blob);
      thumbCache.set(pid, url);
    }
    holder.replaceChildren(h('img', { src: url, alt: '', loading: 'lazy' }));
  }

  function renderItems() {
    const shown = filterClients(clients, state.filter, state.query);
    countEl.textContent = clients.length
      ? `${shown.length} of ${clients.length} client${clients.length === 1 ? '' : 's'}`
      : '';
    if (!clients.length) {
      listEl.replaceChildren(h('div', { class: 'empty' },
        h('div', { class: 'empty-icon' }, icon('users')),
        h('h2', {}, 'No clients yet'),
        h('p', {}, 'Add your first client to start tracking orders, payments and deliveries.'),
        h('button', { class: 'btn primary', onclick: () => navigate('/new') }, icon('plus'), 'Add client')));
      return;
    }
    if (!shown.length) {
      listEl.replaceChildren(h('div', { class: 'empty small' },
        h('p', {}, 'No clients match your search.')));
      return;
    }
    listEl.replaceChildren(...shown.map(c => {
      const thumb = h('div', { class: 'thumb' }, h('span', { class: 'initials' }, initials(c.name)));
      thumbFor(c, thumb);
      const meta = [c.woodType, labelOf(BASE_TYPES, c.baseType) + ' base'].filter(Boolean).join(' · ');
      return h('button', { class: 'client-card', role: 'listitem', onclick: () => navigate(`/c/${encodeURIComponent(c.id)}`) },
        thumb,
        h('div', { class: 'card-body' },
          h('div', { class: 'card-row' },
            h('span', { class: 'card-name' }, c.name),
            h('span', { class: 'card-amount' }, formatMoney(c.amountCents))),
          h('div', { class: 'card-meta' }, meta),
          h('div', { class: 'badges' },
            h('span', { class: `badge ${c.paid ? 'ok' : 'warn'}` }, c.paid ? 'Paid' : 'Unpaid'),
            h('span', { class: `badge ${c.status === 'delivered' ? 'ok' : 'muted'}` },
              c.status === 'delivered' ? 'Delivered' : 'Not delivered'))),
        icon('chevron', 'card-chevron'));
    }));
  }

  const chips = h('div', { class: 'chips', role: 'tablist', 'aria-label': 'Filter clients' },
    FILTERS.map(f => h('button', {
      class: `chip ${state.filter === f.value ? 'active' : ''}`,
      role: 'tab',
      'aria-selected': String(state.filter === f.value),
      onclick: (e) => {
        state.filter = f.value;
        chips.querySelectorAll('.chip').forEach(ch => {
          const on = ch === e.currentTarget;
          ch.classList.toggle('active', on);
          ch.setAttribute('aria-selected', String(on));
        });
        renderItems();
      },
    }, f.label)));

  const stat = (label, value, kind = '') =>
    h('div', { class: `stat ${kind}` }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value' }, value));

  root.replaceChildren(
    topBar({
      large: true,
      title: h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, 'WR'), h('span', { class: 'brand-sub' }, 'Clients')),
      right: h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: () => navigate('/settings') }, icon('settings')),
    }),
    h('main', { class: 'page' },
      h('section', { class: 'stats', 'aria-label': 'Summary' },
        stat('Total', formatMoney(t.totalCents)),
        stat('Paid', formatMoney(t.paidCents), 'ok'),
        stat('Outstanding', formatMoney(t.outstandingCents), t.outstandingCents ? 'warn' : ''),
        stat('To deliver', String(t.toDeliver), t.toDeliver ? 'accent' : '')),
      clients.length > 0 && h('div', { class: 'search' },
        icon('search'),
        h('input', {
          type: 'search', placeholder: 'Search name, phone or email', value: state.query,
          'aria-label': 'Search clients', autocomplete: 'off',
          oninput: (e) => { state.query = e.target.value; renderItems(); },
        })),
      clients.length > 0 && chips,
      countEl,
      listEl),
    h('button', { class: 'fab', 'aria-label': 'Add client', onclick: () => navigate('/new') }, icon('plus')),
  );
  renderItems();
}
