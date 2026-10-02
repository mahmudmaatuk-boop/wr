// Settings: connect WR to the Google Apps Script web app, sync, about.
import { h, icon, navBar, toast, confirmSheet, spinner } from '../ui.js';
import { call, connection } from '../api.js';
import { setMeta } from '../store.js';
import { subscribe, flush, describe } from '../sync.js';
import { replace, goBack } from '../router.js';
import { WEBSITE } from '../pages.js';
import { APP_VERSION } from '../version.js';

const GUIDE = 'https://github.com/mahmudmaatuk-boop/wr/blob/main/docs/SETUP-GOOGLE.md';

export async function renderSettings(root) {
  const conn = await connection();
  const urlInput = h('input', {
    id: 's-url', class: 'row-input', type: 'url', value: conn.url, placeholder: 'https://script.google.com/…/exec',
    autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false',
  });
  const keyInput = h('input', {
    id: 's-key', class: 'row-input', type: 'password', value: conn.key, placeholder: 'wr-…',
    autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false',
  });
  const eye = h('button', {
    type: 'button', class: 'icon-btn small', 'aria-label': 'Show key',
    onclick: () => {
      const show = keyInput.type === 'password';
      keyInput.type = show ? 'text' : 'password';
      eye.replaceChildren(icon(show ? 'eye-off' : 'eye'));
      eye.setAttribute('aria-label', show ? 'Hide key' : 'Show key');
    },
  }, icon('eye'));
  const result = h('p', { class: 'form-note', 'aria-live': 'polite' }, conn.url ? '' : 'Paste the two values from the Google setup.');
  const testBtn = h('button', { type: 'submit', class: 'btn primary block' }, 'Save and test');

  async function onSubmit(e) {
    e.preventDefault();
    const next = { url: urlInput.value.trim(), key: keyInput.value.trim() };
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(next.url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(next.url)) {
      result.textContent = 'The script URL starts with https://script.google.com/';
      result.className = 'form-note tone-danger';
      return;
    }
    if (!next.key) {
      result.textContent = 'Enter the access key.';
      result.className = 'form-note tone-danger';
      return;
    }
    testBtn.disabled = true;
    testBtn.replaceChildren(spinner(), 'Testing…');
    try {
      const res = await call('ping', {}, { conn: next });
      await setMeta('scriptUrl', next.url);
      await setMeta('accessKey', next.key);
      result.textContent = `Connected to Google Sheets · server ${res.version}`;
      result.className = 'form-note tone-ok';
      toast('Connected', 'success');
      flush();
    } catch (err) {
      result.textContent = err.message;
      result.className = 'form-note tone-danger';
    } finally {
      testBtn.disabled = false;
      testBtn.replaceChildren('Save and test');
    }
  }

  async function disconnect() {
    const ok = await confirmSheet({
      title: 'Disconnect from Google Sheets?',
      message: 'Your sheets stay as they are. New entries are kept on this phone until you connect again.',
      confirmLabel: 'Disconnect', danger: true,
    });
    if (!ok) return;
    await setMeta('scriptUrl', '');
    await setMeta('accessKey', '');
    toast('Disconnected');
    replace('/settings');
  }

  const syncValue = h('span', { class: 'row-value' });

  root.replaceChildren(
    navBar({ back: { label: 'Home', onClick: () => goBack('/') }, title: 'Settings' }),
    h('main', { class: 'page' },
      h('h1', { class: 'large-title' }, 'Settings'),
      h('h2', { class: 'group-title outside' }, 'Google Sheets connection'),
      h('form', { class: 'form', novalidate: true, onsubmit: onSubmit },
        h('section', { class: 'group' },
          h('div', { class: 'row stacked' }, h('label', { class: 'row-label', for: 's-url' }, 'Script URL'), urlInput),
          h('div', { class: 'row stacked' }, h('label', { class: 'row-label', for: 's-key' }, 'Access key'),
            h('span', { class: 'key-wrap' }, keyInput, eye))),
        testBtn,
        result),
      h('a', { class: 'link-row', href: GUIDE, target: '_blank', rel: 'noopener' }, icon('key'), 'How to set up Google Sheets', icon('external')),
      h('h2', { class: 'group-title outside' }, 'Sync'),
      h('section', { class: 'group' },
        h('div', { class: 'row' }, h('span', { class: 'row-label' }, 'Status'), syncValue,
          h('button', { class: 'chip-btn', onclick: () => flush() }, icon('refresh'), 'Sync now'))),
      h('h2', { class: 'group-title outside' }, 'About'),
      h('section', { class: 'group' },
        h('div', { class: 'row' }, h('span', { class: 'row-label' }, 'Version'), h('span', { class: 'row-value muted' }, APP_VERSION)),
        h('a', { class: 'row link', href: WEBSITE, target: '_blank', rel: 'noopener' },
          h('span', { class: 'row-label' }, 'Website'), h('span', { class: 'row-value muted' }, 'woodforlife-wr.com'), icon('external', 'row-trail'))),
      conn.url && h('button', { class: 'btn block danger-plain', onclick: disconnect }, 'Disconnect')));

  return subscribe((s) => {
    const d = describe(s);
    syncValue.className = `row-value tone-${d.tone}`;
    syncValue.textContent = d.text;
  });
}
