// Small DOM helpers. All user text goes through text nodes, never innerHTML.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// Static, trusted SVG icon paths (24×24, stroke-based).
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  selector: '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  share: '<path d="M12 3v13M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  external: '<path d="M14 4h6v6M10 14L20 4"/><path d="M19 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4.5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h9A1.5 1.5 0 0 1 19 4.5V6"/><circle cx="16.5" cy="15" r="1.2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18M8 14h2M14 14h2M8 17.5h2"/>',
  receipt: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21V4a1 1 0 0 1 1-1z"/><path d="M9 14.5l6-6"/><circle cx="9.5" cy="9" r="1"/><circle cx="14.5" cy="14" r="1"/>',
  package: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7L12 12l8.7-5M12 22V12M7.5 4.5l9 5"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  logs: '<circle cx="7" cy="16.5" r="3.6"/><circle cx="17" cy="16.5" r="3.6"/><circle cx="12" cy="8" r="3.6"/><circle cx="7" cy="16.5" r="1"/><circle cx="17" cy="16.5" r="1"/><circle cx="12" cy="8" r="1"/>',
  chair: '<path d="M7 11V5.5A2.5 2.5 0 0 1 9.5 3h5A2.5 2.5 0 0 1 17 5.5V11"/><path d="M5 11h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"/><path d="M6 15v6M18 15v6"/>',
  'cloud-up': '<path d="M7 18.5a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.3 3.8 3.8 0 0 1-.7 7.7"/><path d="M12 12.5v8M9 15.5l3-3 3 3"/>',
  'cloud-check': '<path d="M7 19a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.3A3.8 3.8 0 0 1 17.5 19z"/><path d="M9.5 14.5l2 2 3.5-3.5"/>',
  'cloud-off': '<path d="M7 19a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 2-3.5M12.5 5a6 6 0 0 1 5.7 6.3A3.8 3.8 0 0 1 19.5 18"/><path d="M3 3l18 18"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 15h18M9 9.5V20"/>',
  key: '<circle cx="7.5" cy="15.5" r="4"/><path d="M10.5 12.5L20 3M16 7l2.5 2.5M14 9l2 2"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.8 3.6M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `icon ${cls}`.trim();
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return span;
}

// Object URLs belong to the current screen and are revoked once the next one shows.
let liveUrls = [];
export function blobUrl(blob) {
  const url = URL.createObjectURL(blob);
  liveUrls.push(url);
  return url;
}
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

/** Bottom sheet shell. `build(close)` returns the sheet's content. */
function sheet(build, onDismiss) {
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    overlay.classList.remove('show');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 250);
  };
  const dismiss = () => { close(); onDismiss?.(); };
  const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
  const overlay = h('div', { class: 'sheet-overlay', onclick: (e) => { if (e.target === overlay) dismiss(); } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, build(close)));
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => overlay.classList.add('show'));
  return close;
}

export function confirmSheet({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    sheet((close) => [
      h('h2', { class: 'sheet-title' }, title),
      message && h('p', { class: 'sheet-text' }, message),
      h('button', { class: `btn block ${danger ? 'danger' : 'primary'}`, onclick: () => { close(); resolve(true); } }, confirmLabel),
      h('button', { class: 'btn block plain', onclick: () => { close(); resolve(false); } }, 'Cancel'),
    ], () => resolve(false));
  });
}

/** iOS-style action sheet: a list of choices plus Cancel. */
export function actionSheet({ title, actions }) {
  sheet((close) => [
    title && h('h2', { class: 'sheet-title small' }, title),
    h('div', { class: 'action-list' }, actions.filter(Boolean).map(a =>
      h('button', { class: `action ${a.danger ? 'danger' : ''}`, onclick: () => { close(); a.onSelect(); } },
        a.icon && icon(a.icon), h('span', {}, a.label)))),
    h('button', { class: 'btn block plain', onclick: close }, 'Cancel'),
  ]);
}

/** Sheet with one text field. Resolves with the text, or null on cancel. */
export function promptSheet({ title, message, label, value = '', placeholder = '', confirmLabel = 'OK' }) {
  return new Promise((resolve) => {
    const input = h('input', { class: 'sheet-input', value, placeholder, 'aria-label': label, autocomplete: 'off' });
    sheet((close) => [
      h('h2', { class: 'sheet-title' }, title),
      message && h('p', { class: 'sheet-text' }, message),
      input,
      h('button', { class: 'btn block primary', onclick: () => { close(); resolve(input.value.trim()); } }, confirmLabel),
      h('button', { class: 'btn block plain', onclick: () => { close(); resolve(null); } }, 'Cancel'),
    ], () => resolve(null));
    setTimeout(() => input.focus(), 300);
  });
}

function overlayViewer(content, { name, file } = {}) {
  const close = () => {
    overlay.classList.remove('show');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 200);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const overlay = h('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': name || 'Viewer' },
    h('div', { class: 'viewer-bar' },
      h('button', { class: 'viewer-btn', 'aria-label': 'Close', onclick: close }, icon('x')),
      h('span', { class: 'viewer-name' }, name || ''),
      file ? h('button', { class: 'viewer-btn', 'aria-label': 'Share or save', onclick: () => shareFile(file) }, icon('share')) : h('span')),
    content);
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => overlay.classList.add('show'));
  return overlay;
}

/** Full-screen swipeable photo viewer. */
export function openViewer(urls, start = 0) {
  const track = h('div', { class: 'viewer-track' }, urls.map(u => h('div', { class: 'viewer-slide' }, h('img', { src: u, alt: '' }))));
  overlayViewer(track, { name: urls.length > 1 ? `${start + 1} of ${urls.length}` : '' });
  track.scrollLeft = start * track.clientWidth;
}

/** Show a downloaded file: images and PDFs inside the app, anything else via Share. */
export function openFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  const url = blobUrl(blob);
  if (blob.type.startsWith('image/')) {
    overlayViewer(h('div', { class: 'viewer-slide single' }, h('img', { src: url, alt: name })), { name, file });
  } else if (blob.type === 'application/pdf') {
    overlayViewer(h('iframe', { class: 'viewer-frame', src: url, title: name }), { name, file });
  } else {
    // iPhone only opens the Share sheet from a fresh tap, so offer a button.
    overlayViewer(h('div', { class: 'viewer-empty' },
      icon('file'),
      h('p', {}, "This file type can't be previewed here."),
      h('button', { class: 'btn primary', onclick: () => shareFile(file) }, icon('share'), 'Share or save')), { name, file });
  }
}

/** Share sheet on iPhone ("Save to Files", Mail…), download elsewhere. */
export async function shareFile(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
    } catch (err) {
      if (err.name !== 'AbortError') toast(`Couldn't share: ${err.message}`, 'error');
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** iOS navigation bar: back button, optional centred title, right-side actions. */
export function navBar({ back, title = '', right } = {}) {
  return h('header', { class: 'navbar' },
    h('div', { class: 'navbar-side' }, back && h('button', { class: 'nav-back', onclick: back.onClick }, icon('back'), h('span', {}, back.label))),
    h('div', { class: 'navbar-title' }, title),
    h('div', { class: 'navbar-side right' }, right));
}

/** Segmented control made of buttons. */
export function segmented(options, value, onChange, label = '') {
  return h('div', { class: 'segmented', role: 'tablist', 'aria-label': label },
    options.map(o => h('button', {
      type: 'button', role: 'tab', class: `seg ${o.value === value ? 'on' : ''}`, 'aria-selected': String(o.value === value),
      onclick: () => { if (o.value !== value) onChange(o.value); },
    }, o.label)));
}

export const initials = (name) =>
  String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

/** Size a text input to its content (keeps a "$" right next to the amount). */
export function fitInput(input) {
  input.size = Math.max(4, (input.value || input.placeholder || '').length + 1);
}

export const spinner = () => h('span', { class: 'spinner', 'aria-hidden': 'true' });
