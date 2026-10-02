// Backup: copy every page into the "WR Backup" Google Sheet, see sync status,
// and import clients from WR 1 once.
import { h, icon, navBar, toast, confirmSheet, spinner } from '../ui.js';
import { DATA_PAGES } from '../schema.js';
import { call, isConfigured } from '../api.js';
import { getMeta, setMeta } from '../store.js';
import { subscribe, flush, describe } from '../sync.js';
import { legacyCount, importLegacy } from '../legacy.js';
import { navigate, goBack } from '../router.js';
import { formatDate } from '../calc.js';

export async function renderBackup(root) {
  const configured = await isConfigured();
  const lastEl = h('p', { class: 'hero-note' });
  const resultEl = h('div', { class: 'backup-result' });
  const openRow = h('div');
  const autoValue = h('span', { class: 'row-value muted' }, '1st of each month');
  const syncValue = h('span', { class: 'row-value' });
  const legacyRow = h('div');

  async function showLast() {
    const at = await getMeta('lastBackup', '');
    lastEl.textContent = at ? `Last backup: ${formatDate(at, true)}` : 'No backup yet';
    const url = await getMeta('backupUrl', '');
    openRow.replaceChildren(url
      ? h('a', { class: 'row link', href: url, target: '_blank', rel: 'noopener' },
        h('span', { class: 'row-label with-icon' }, icon('table'), 'Open backup sheet'), icon('external', 'row-trail'))
      : h('div', { class: 'row' }, h('span', { class: 'row-label with-icon muted' }, icon('table'), 'Open backup sheet'), h('span', { class: 'row-value muted' }, 'After first backup')));
  }

  const backupBtn = h('button', { class: 'btn primary block big', onclick: runBackup }, icon('cloud-up'), 'Back up now');

  async function runBackup() {
    if (!(await isConfigured())) {
      toast('Connect to Google Sheets first');
      navigate('/settings');
      return;
    }
    backupBtn.disabled = true;
    backupBtn.replaceChildren(spinner(), 'Backing up…');
    try {
      await flush();
      const res = await call('backup', {}, { timeout: 300000 });
      await setMeta('lastBackup', res.at);
      await setMeta('backupUrl', res.url);
      await showLast();
      const total = Object.values(res.counts).reduce((s, n) => s + n, 0);
      resultEl.replaceChildren(h('p', { class: 'ok-note' }, icon('check'), `Backed up ${total} rows from ${Object.keys(res.counts).length} pages.`));
      toast('Backup complete', 'success');
    } catch (err) {
      toast(err.code === 'network' ? 'No connection. Try again when you are online.' : err.message, 'error');
    } finally {
      backupBtn.disabled = false;
      backupBtn.replaceChildren(icon('cloud-up'), 'Back up now');
    }
  }

  async function showLegacy() {
    const count = await legacyCount();
    legacyRow.replaceChildren(count
      ? h('button', { class: 'row link', onclick: runImport },
        h('span', { class: 'row-label with-icon' }, icon('download'), 'Import old clients'),
        h('span', { class: 'row-value muted' }, `${count} found`), icon('chevron', 'row-trail'))
      : '');
    async function runImport() {
      const ok = await confirmSheet({
        title: `Import ${count} client${count === 1 ? '' : 's'}?`,
        message: 'Clients saved in the previous version of WR are added to Client info, with their photos. Delivery status is not part of the new form.',
        confirmLabel: 'Import',
      });
      if (!ok) return;
      const n = await importLegacy();
      toast(`${n} client${n === 1 ? '' : 's'} added to Client info`, 'success');
      showLegacy();
    }
  }

  const syncNow = h('button', { class: 'chip-btn', onclick: () => flush() }, icon('refresh'), 'Sync now');

  root.replaceChildren(
    navBar({ back: { label: 'Home', onClick: () => goBack('/') }, title: 'Backup' }),
    h('main', { class: 'page' },
      h('h1', { class: 'large-title' }, 'Backup'),
      h('section', { class: 'group hero' },
        h('div', { class: 'hero-icon' }, icon('cloud-up')),
        h('p', { class: 'hero-text' }, 'Saves every page into the “WR Backup” Google Sheet, one tab per page, with a Summary tab.'),
        backupBtn,
        lastEl,
        resultEl),
      !configured && h('button', { class: 'banner', onclick: () => navigate('/settings') },
        icon('link'), h('span', { class: 'banner-text' }, h('strong', {}, 'Not connected yet'), h('span', {}, 'Connect WR to Google Sheets in Settings.')), icon('chevron')),
      h('section', { class: 'group' },
        openRow,
        h('div', { class: 'row' }, h('span', { class: 'row-label with-icon' }, icon('calendar'), 'Automatic backup'), autoValue),
        h('div', { class: 'row' }, h('span', { class: 'row-label with-icon' }, icon('cloud-check'), 'Sync'), syncValue, syncNow),
        legacyRow),
      h('h2', { class: 'group-title outside' }, 'Tabs in WR Backup'),
      h('div', { class: 'chips' }, ['Summary', ...DATA_PAGES.map(p => p.title)].map(t => h('span', { class: 'chip' }, t)))));

  await showLast();
  showLegacy();
  if (configured) {
    call('status').then(async (s) => {
      if (s.lastBackup) await setMeta('lastBackup', s.lastBackup);
      if (s.backupUrl) await setMeta('backupUrl', s.backupUrl);
      autoValue.textContent = s.autoBackup ? '1st of each month' : 'Off: run setup() again';
      showLast();
    }).catch(() => {});
  }
  return subscribe((s) => {
    const d = describe(s);
    syncValue.className = `row-value tone-${d.tone}`;
    syncValue.textContent = d.text;
  });
}
