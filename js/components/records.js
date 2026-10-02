// Generic "Saved" list: search, totals, optional grouping, tap to edit.
import { h, icon, blobUrl, initials } from '../ui.js';
import { PAGE_UI } from '../pages.js';
import { photoSrc } from '../rows.js';

export function renderRecords({ page, records, query = '', onQuery, onOpen }) {
  const ui = PAGE_UI[page.key];
  const wrap = h('div', { class: 'records' });
  const summaryEl = h('div', { class: 'summary' });
  const listEl = h('div', { class: 'record-groups' });
  let items = records;
  let q = query;

  const search = h('label', { class: 'search' }, icon('search'),
    h('input', {
      type: 'search', placeholder: 'Search', value: q, 'aria-label': `Search ${page.title}`, autocomplete: 'off',
      oninput: (e) => { q = e.target.value; onQuery?.(q); drawList(); },
    }));

  function thumb(r) {
    if (!ui.thumb) return null;
    const p = ui.thumb(r);
    return h('div', { class: 'rec-thumb' }, p
      ? h('img', { src: p.blob ? blobUrl(p.thumb || p.blob) : photoSrc(p.url, 200), alt: '', loading: 'lazy' })
      : h('span', { class: 'rec-initials' }, initials(ui.initials ? ui.initials(r) : ui.title(r))));
  }

  function row(r) {
    const badge = ui.badge?.(r);
    return h('button', { class: 'rec', onclick: () => onOpen(r) },
      thumb(r),
      h('div', { class: 'rec-main' },
        h('div', { class: 'rec-title' }, h('span', {}, ui.title(r)),
          r._pending && h('span', { class: 'rec-pending', title: 'Waiting to upload' }, icon('cloud-up'), h('span', { class: 'visually-hidden' }, 'Waiting to upload'))),
        ui.sub?.(r) && h('div', { class: 'rec-sub' }, ui.sub(r)),
        r._error && h('div', { class: 'rec-error' }, icon('alert'), r._error)),
      h('div', { class: 'rec-side' },
        ui.right?.(r) && h('div', { class: 'rec-right' }, ui.right(r)),
        ui.rightSub?.(r) && h('div', { class: 'rec-right-sub' }, ui.rightSub(r)),
        badge && h('span', { class: `badge ${badge.tone}` }, badge.text)),
      icon('chevron', 'rec-chevron'));
  }

  function drawList() {
    const needle = q.trim().toLowerCase();
    let shown = needle && ui.search ? items.filter(r => String(ui.search(r) || '').toLowerCase().includes(needle)) : items;
    if (ui.sort) shown = [...shown].sort(ui.sort);
    if (!shown.length) {
      listEl.replaceChildren(h('p', { class: 'empty-note' }, needle ? 'Nothing matches your search.' : 'Nothing saved yet.'));
      return;
    }
    if (!ui.groupBy) {
      listEl.replaceChildren(h('div', { class: 'group list' }, shown.map(row)));
      return;
    }
    const groups = new Map();
    for (const r of shown) {
      const key = ui.groupBy(r);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    listEl.replaceChildren(...[...groups].map(([key, rs]) => h('section', {},
      h('div', { class: 'group-head' },
        h('h2', { class: 'group-title' }, ui.groupLabel ? ui.groupLabel(key) : key),
        ui.groupTotal && h('span', { class: 'group-total' }, ui.groupTotal(rs))),
      h('div', { class: 'group list' }, rs.map(row)))));
  }

  function draw() {
    if (!items.length) {
      wrap.replaceChildren(h('div', { class: 'empty' },
        h('div', { class: 'empty-icon' }, icon(ui.icon)),
        h('h2', {}, 'Nothing saved yet'),
        h('p', {}, 'Entries you add on the New tab show up here.')));
      return;
    }
    summaryEl.replaceChildren(...(ui.summary ? ui.summary(items) : []).map(s =>
      h('div', { class: 'summary-item' }, h('span', { class: 'summary-label' }, s.label), h('span', { class: 'summary-value' }, s.value))));
    wrap.replaceChildren(...[ui.summary && summaryEl, items.length > 4 && search, listEl].filter(Boolean));
    drawList();
  }

  /** Swap in fresh records without touching the search box (keeps focus while typing). */
  wrap.update = (next) => {
    const hadItems = items.length > 0;
    items = next;
    if (hadItems && items.length && wrap.contains(listEl) && (items.length > 4) === wrap.contains(search)) {
      if (ui.summary) summaryEl.replaceChildren(...ui.summary(items).map(s =>
        h('div', { class: 'summary-item' }, h('span', { class: 'summary-label' }, s.label), h('span', { class: 'summary-value' }, s.value))));
      drawList();
    } else {
      draw();
    }
  };

  draw();
  return wrap;
}
