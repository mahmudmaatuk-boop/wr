// WR-Documents: upload any file to Drive (private) and open it again.
import { h, icon, navBar, toast, confirmSheet, actionSheet, promptSheet, openFile, spinner } from '../ui.js';
import { pageByKey } from '../schema.js';
import { records, refresh, save, remove } from '../repo.js';
import { subscribe } from '../sync.js';
import { call, base64ToBlob } from '../api.js';
import { goBack } from '../router.js';
import { formatBytes, formatDate, fileKind, uid } from '../calc.js';

const MAX_BYTES = 25 * 1024 * 1024;

const kindIcon = (kind) => (['JPEG', 'PNG', 'HEIC', 'Image'].includes(kind) ? 'image' : 'file');

async function fileBlob(rec) {
  if (rec.file?.blob) return rec.file.blob;
  const res = await call('getFile', { id: rec.id }, { timeout: 120000 });
  return base64ToBlob(res.data, res.type);
}

export async function renderDocuments(root) {
  const page = pageByKey('documents');
  let list = await records('documents');
  const listEl = h('div', { class: 'docs' });

  const fileInput = h('input', {
    type: 'file', class: 'visually-hidden', id: 'doc-file',
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > MAX_BYTES) {
        toast('Files must be 25 MB or smaller', 'error');
        return;
      }
      const title = await promptSheet({
        title: 'Upload document', message: file.name, label: 'Title',
        value: file.name.replace(/\.[^.]+$/, ''), placeholder: 'Title (optional)', confirmLabel: 'Upload',
      });
      if (title === null) return;
      const type = file.type || 'application/octet-stream';
      await save('documents', {
        id: uid(), title: title || file.name, fileName: file.name, fileType: type, size: formatBytes(file.size),
        timestamp: new Date().toISOString(), link: '', fileId: '',
        file: { blob: file, name: file.name, type },
      }, { isNew: true });
      toast('Uploading to Google Drive…');
      await reload();
    },
  });

  async function open(rec) {
    const busy = toastBusy('Opening…');
    try {
      const blob = await fileBlob(rec);
      openFile(blob, rec.fileName || rec.title);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      busy();
    }
  }

  function menu(rec) {
    actionSheet({
      title: rec.title || rec.fileName,
      actions: [
        { label: 'Open', icon: 'eye', onSelect: () => open(rec) },
        rec.link && { label: 'Open in Google Drive', icon: 'external', onSelect: () => window.open(rec.link, '_blank', 'noopener') },
        { label: 'Rename', icon: 'file', onSelect: () => rename(rec) },
        { label: 'Delete', icon: 'trash', danger: true, onSelect: () => del(rec) },
      ],
    });
  }

  async function rename(rec) {
    const title = await promptSheet({ title: 'Rename', label: 'Title', value: rec.title, confirmLabel: 'Save' });
    if (!title) return;
    await save('documents', { ...rec, title });
    await reload();
  }

  async function del(rec) {
    const ok = await confirmSheet({
      title: `Delete ${rec.title || rec.fileName}?`,
      message: 'The file is moved to the Google Drive trash.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    await remove('documents', rec.id);
    toast('Deleted');
    await reload();
  }

  function draw() {
    if (!list.length) {
      listEl.replaceChildren(h('div', { class: 'empty' },
        h('div', { class: 'empty-icon' }, icon('folder')),
        h('h2', {}, 'No documents yet'),
        h('p', {}, 'Upload PDFs, photos, Word or Excel files. They are kept in Google Drive.')));
      return;
    }
    listEl.replaceChildren(h('div', { class: 'group list' }, list.map(rec => {
      const kind = fileKind(rec.fileType, rec.fileName);
      return h('button', { class: 'rec', onclick: () => menu(rec) },
        h('div', { class: `doc-icon ${kind === 'PDF' ? 'pdf' : ''}` }, icon(kindIcon(kind)), h('span', {}, kind)),
        h('div', { class: 'rec-main' },
          h('div', { class: 'rec-title' }, h('span', {}, rec.title || rec.fileName),
            rec._pending && h('span', { class: 'rec-pending', title: 'Waiting to upload' }, icon('cloud-up'))),
          h('div', { class: 'rec-sub' }, [kind, rec.size, formatDate(rec.timestamp)].filter(Boolean).join(' · ')),
          rec._error && h('div', { class: 'rec-error' }, icon('alert'), rec._error)),
        icon('chevron', 'rec-chevron'));
    })));
  }

  async function reload() {
    list = await records('documents');
    draw();
  }

  draw();
  root.replaceChildren(
    navBar({ back: { label: 'Home', onClick: () => goBack('/') }, title: page.title }),
    h('main', { class: 'page' },
      h('h1', { class: 'large-title' }, page.title),
      fileInput,
      h('label', { class: 'btn primary block big', for: 'doc-file' }, icon('upload'), 'Upload document'),
      h('p', { class: 'form-note' }, 'PDF, photos, Word, Excel and more · up to 25 MB each'),
      listEl));

  refresh('documents').then(reload).catch(() => {});
  let first = true;
  return subscribe(() => { if (first) { first = false; return; } reload(); });
}

function toastBusy(text) {
  const el = h('div', { class: 'toast show busy', role: 'status' }, spinner(), text);
  document.body.append(el);
  return () => el.remove();
}
