// Small DOM helpers. All user text goes through text nodes, never innerHTML.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// Static, trusted SVG icon paths (24×24, stroke-based).
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `icon ${cls}`.trim();
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return span;
}

// Object URLs for photo blobs belong to the current screen and are revoked
// once the next screen is showing.
let liveUrls = [];
export function blobUrl(blob) {
  const url = URL.createObjectURL(blob);
  liveUrls.push(url);
  return url;
}
/** Detach the current screen's URLs; returns them for later revocation. */
export function takeUrls() {
  const urls = liveUrls;
  liveUrls = [];
  return urls;
}

export function toast(message, kind = '') {
  const el = h('div', { class: `toast ${kind}`, role: 'status' }, message);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

/** Bottom action sheet. Resolves true when the confirm button is tapped. */
export function confirmSheet({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const close = (result) => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 250);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    const overlay = h('div', { class: 'sheet-overlay', onclick: (e) => { if (e.target === overlay) close(false); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
        h('h2', { id: 'sheet-title' }, title),
        message && h('p', {}, message),
        h('button', { class: `btn block ${danger ? 'danger' : 'primary'}`, onclick: () => close(true) }, confirmLabel),
        h('button', { class: 'btn block ghost', onclick: () => close(false) }, 'Cancel'),
      ));
    document.body.append(overlay);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => overlay.classList.add('show'));
  });
}

/** Full-screen swipeable photo viewer. */
export function openViewer(urls, start = 0) {
  const track = h('div', { class: 'viewer-track' },
    urls.map(u => h('div', { class: 'viewer-slide' }, h('img', { src: u, alt: '' }))));
  const counter = h('div', { class: 'viewer-count' }, urls.length > 1 ? `${start + 1} / ${urls.length}` : '');
  const close = () => {
    overlay.classList.remove('show');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 200);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const overlay = h('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Photo viewer' },
    h('button', { class: 'viewer-close', 'aria-label': 'Close', onclick: close }, icon('x')),
    counter, track);
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (urls.length > 1) counter.textContent = `${i + 1} / ${urls.length}`;
  }, { passive: true });
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  track.scrollLeft = start * track.clientWidth;
  requestAnimationFrame(() => overlay.classList.add('show'));
}

/** iOS-style header bar. */
export function topBar({ left, title, right, large = false }) {
  return h('header', { class: `topbar ${large ? 'large' : ''}` },
    h('div', { class: 'topbar-side left' }, left),
    h('div', { class: 'topbar-title' }, title),
    h('div', { class: 'topbar-side right' }, right));
}

export function segmented(name, options, value, onChange) {
  return h('div', { class: 'segmented', role: 'radiogroup' },
    options.map(o => h('label', { class: 'seg' },
      h('input', { type: 'radio', name, value: o.value, checked: o.value === value, onchange: () => onChange(o.value) }),
      h('span', {}, o.label))));
}

export function toggle(checked, onChange, label) {
  return h('label', { class: 'switch' },
    h('input', { type: 'checkbox', role: 'switch', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) }),
    h('span', { class: 'track' }, h('span', { class: 'thumb' })));
}

export const initials = (name) =>
  String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
