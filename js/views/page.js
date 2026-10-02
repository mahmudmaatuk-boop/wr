// A standard page (Client info, Client info monthly, VAT, Packing, Raw and
// Finished Stockage): New | Saved tabs, plus the edit screen.
import { h, icon, navBar, segmented, toast, confirmSheet } from '../ui.js';
import { pageByKey } from '../schema.js';
import { PAGE_UI, newRecord } from '../pages.js';
import { renderForm } from '../components/form.js';
import { renderRecords } from '../components/records.js';
import { records, refresh, save, remove } from '../repo.js';
import { subscribe } from '../sync.js';
import { navigate, replace, goBack } from '../router.js';

const queries = {}; // search text per page, kept while moving around the app

export function renderMissing(root, what = 'Page') {
  root.replaceChildren(
    navBar({ back: { label: 'Home', onClick: () => replace('/') } }),
    h('main', { class: 'page' }, h('div', { class: 'empty' },
      h('h2', {}, `${what} not found`),
      h('p', {}, 'It may have been deleted.'),
      h('button', { class: 'btn primary', onclick: () => replace('/') }, 'Back to home'))));
}

export async function renderPage(root, { page: key, tab = 'new' }) {
  const page = pageByKey(key);
  if (!page || !PAGE_UI[key]?.addLabel) return renderMissing(root);
  const ui = PAGE_UI[key];
  let list = await records(key);
  const tabs = h('div', { class: 'tabs' });
  const body = h('div', { class: 'page-body' });
  let saved = null;

  const drawTabs = () => tabs.replaceChildren(segmented(
    [{ value: 'new', label: 'New' }, { value: 'saved', label: `Saved (${list.length})` }],
    tab, (v) => replace(v === 'saved' ? `/p/${key}/saved` : `/p/${key}`), page.title));

  function drawBody() {
    if (tab === 'saved') {
      saved = renderRecords({
        page, records: list, query: queries[key] || '', onQuery: (q) => { queries[key] = q; },
        onOpen: (r) => navigate(`/p/${key}/e/${encodeURIComponent(r.id)}`),
      });
      body.replaceChildren(saved);
    } else {
      body.replaceChildren(renderForm({
        page, record: newRecord(page),
        onSubmit: async (rec) => {
          await save(key, rec, { isNew: true });
          toast(ui.added, 'success');
          list = await records(key);
          drawTabs();
          drawBody();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      }));
    }
  }

  const reload = async () => {
    list = await records(key);
    drawTabs();
    if (saved) saved.update(list);
  };

  const refreshBtn = h('button', {
    class: 'icon-btn', 'aria-label': 'Refresh from Google Sheets',
    onclick: () => refresh(key).then(reload).then(() => toast('Up to date')).catch(err => toast(err.message, 'error')),
  }, icon('refresh'));

  drawTabs();
  drawBody();
  root.replaceChildren(
    navBar({ back: { label: 'Home', onClick: () => goBack('/') }, title: page.title, right: refreshBtn }),
    h('main', { class: 'page' }, h('h1', { class: 'large-title' }, page.title), tabs, body));

  refresh(key).then(reload).catch(() => { /* offline: the saved copy is shown */ });
  let first = true;
  return subscribe(() => {
    if (first) { first = false; return; }
    reload();
  });
}

export async function renderEdit(root, { page: key, id }) {
  const page = pageByKey(key);
  const rec = page && (await records(key)).find(r => r.id === id);
  if (!page || !rec) return renderMissing(root, 'Entry');
  const ui = PAGE_UI[key];
  const back = () => goBack(`/p/${key}/saved`);
  root.replaceChildren(
    navBar({ back: { label: page.title, onClick: back }, title: 'Edit' }),
    h('main', { class: 'page' },
      h('h1', { class: 'large-title' }, ui.title(rec)),
      rec._pending && h('p', { class: 'pending-note' }, icon('cloud-up'), 'Waiting to upload to Google Sheets'),
      renderForm({
        page, record: rec, isEdit: true,
        onSubmit: async (r) => {
          await save(key, r);
          toast('Changes saved', 'success');
          back();
        },
        onDelete: async () => {
          const ok = await confirmSheet({
            title: `Delete ${ui.title(rec)}?`,
            message: 'This also removes it from the Google Sheet, with any photos.',
            confirmLabel: 'Delete', danger: true,
          });
          if (!ok) return;
          await remove(key, id);
          toast('Deleted');
          back();
        },
      })));
}
