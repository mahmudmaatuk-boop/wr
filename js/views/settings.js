import { h, icon, topBar, toast, confirmSheet } from '../ui.js';
import { getAllClients, getAllPhotos, importAll } from '../db.js';
import { buildBackup, parseBackup, blobToBase64, base64ToBlob } from '../backup.js';
import { goBack } from '../router.js';
import { APP_VERSION } from '../version.js';

const fmtBytes = (n) => {
  if (!n) return '0 MB';
  const mb = n / (1024 * 1024);
  return mb < 1 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${mb.toFixed(1)} MB`;
};

async function makeBackupFile() {
  const [clients, photos] = await Promise.all([getAllClients(), getAllPhotos()]);
  const serialized = [];
  for (const p of photos) {
    serialized.push({
      id: p.id, clientId: p.clientId, type: p.blob.type || 'image/jpeg',
      width: p.width, height: p.height, createdAt: p.createdAt,
      data: await blobToBase64(p.blob),
      thumb: p.thumb ? await blobToBase64(p.thumb) : null,
    });
  }
  const json = JSON.stringify(buildBackup(clients, serialized));
  const name = `WR-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return { file: new File([json], name, { type: 'application/json' }), clients: clients.length, photos: photos.length };
}

function saveFile(file) {
  // Share sheet on iOS lets the user "Save to Files"; desktop falls back to a download.
  if (navigator.canShare?.({ files: [file] })) {
    return navigator.share({ files: [file], title: 'WR backup' }).catch((err) => {
      if (err.name !== 'AbortError') throw err;
    });
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return Promise.resolve();
}

export async function renderSettings(root) {
  const storageEl = h('span', { class: 'info-value' }, '…');
  const exportArea = h('div', { class: 'export-area' });

  const prepareBtn = h('button', {
    class: 'btn primary block',
    onclick: async () => {
      prepareBtn.disabled = true;
      prepareBtn.textContent = 'Preparing backup…';
      try {
        const { file, clients, photos } = await makeBackupFile();
        // Sharing must start from a fresh tap, so we hand the user a second button.
        exportArea.replaceChildren(
          h('p', { class: 'note' }, `Backup ready: ${clients} client${clients === 1 ? '' : 's'}, ${photos} photo${photos === 1 ? '' : 's'} (${fmtBytes(file.size)}).`),
          h('button', {
            class: 'btn primary block',
            onclick: () => saveFile(file).catch(err => toast(`Couldn't save: ${err.message}`, 'error')),
          }, icon('download'), 'Save backup file'));
      } catch (err) {
        toast(`Backup failed: ${err.message}`, 'error');
        prepareBtn.disabled = false;
        prepareBtn.replaceChildren(icon('download'), 'Export backup');
      }
    },
  }, icon('download'), 'Export backup');
  exportArea.append(prepareBtn);

  const importInput = h('input', {
    type: 'file', accept: '.json,application/json', class: 'visually-hidden', id: 'import-file',
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const { clients, photos } = parseBackup(await file.text());
        const ok = await confirmSheet({
          title: `Import ${clients.length} client${clients.length === 1 ? '' : 's'}?`,
          message: `${photos.length} photo${photos.length === 1 ? '' : 's'} included. Clients from this backup that are already on this phone will be replaced with the backup version. Everyone else is kept.`,
          confirmLabel: 'Import',
        });
        if (!ok) return;
        const records = photos.map(p => ({
          id: p.id, clientId: p.clientId, width: p.width, height: p.height, createdAt: p.createdAt,
          blob: base64ToBlob(p.data, p.type || 'image/jpeg'),
          thumb: p.thumb ? base64ToBlob(p.thumb, 'image/jpeg') : null,
        }));
        await importAll(clients, records);
        toast(`Imported ${clients.length} client${clients.length === 1 ? '' : 's'}`, 'success');
        updateStorage();
      } catch (err) {
        toast(err.message, 'error');
      }
    },
  });

  async function updateStorage() {
    try {
      const est = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      storageEl.textContent = est ? `${fmtBytes(est.usage)}${persisted ? ' · protected' : ''}` : 'Unknown';
    } catch {
      storageEl.textContent = 'Unknown';
    }
  }

  root.replaceChildren(
    topBar({
      left: h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => goBack('/') }, icon('back')),
      title: 'Settings',
    }),
    h('main', { class: 'page' },
      h('section', { class: 'group' },
        h('h2', { class: 'group-title' }, 'Backup'),
        h('p', { class: 'note' },
          'Your clients and photos are stored only on this device. Export a backup regularly and keep it in Files or iCloud Drive — if WR is removed from your Home Screen, its data is removed too.'),
        exportArea,
        importInput,
        h('label', { class: 'btn secondary block', for: 'import-file' }, icon('upload'), 'Import backup')),
      h('section', { class: 'group' },
        h('h2', { class: 'group-title' }, 'About'),
        h('div', { class: 'info-row' }, h('span', { class: 'info-label' }, 'Storage used'), storageEl),
        h('div', { class: 'info-row' }, h('span', { class: 'info-label' }, 'Version'), h('span', { class: 'info-value' }, APP_VERSION))),
      h('p', { class: 'footnote' }, 'WR · Client tracker')),
  );
  updateStorage();
}
