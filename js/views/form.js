import { h, icon, topBar, blobUrl, segmented, toggle, toast, confirmSheet } from '../ui.js';
import { getAllClients, getClient, getPhoto, saveClient } from '../db.js';
import {
  newClient, validate, normalize, parseMoney, centsToInput, woodSuggestions, uid, BASE_TYPES, STATUSES,
} from '../model.js';
import { processImage } from '../images.js';
import { goBack, replace } from '../router.js';

export async function renderForm(root, { id } = {}) {
  const isEdit = Boolean(id);
  const [existing, all] = await Promise.all([isEdit ? getClient(id) : null, getAllClients()]);
  if (isEdit && !existing) {
    root.replaceChildren(notFound());
    return;
  }

  const draft = isEdit ? { ...existing } : newClient();
  let amountText = centsToInput(draft.amountCents);
  let dirty = false;
  let busy = 0; // photos still being processed
  const touch = () => { dirty = true; };

  // Photo tiles: existing photos (by id) + newly added records.
  const photos = []; // { id, url, added?: record }
  const removed = [];
  for (const pid of draft.photoIds) {
    const p = await getPhoto(pid);
    if (p) photos.push({ id: pid, url: blobUrl(p.thumb || p.blob) });
  }

  const errorEls = {};
  const errorFor = (key) => (errorEls[key] = h('p', { class: 'field-error', id: `err-${key}`, 'aria-live': 'polite' }));

  const field = (label, control, key, hint) =>
    h('div', { class: 'field' },
      h('label', { class: 'field-label', for: control.id }, label),
      control,
      hint && h('p', { class: 'field-hint' }, hint),
      key && errorFor(key));

  const input = (key, props) => h('input', {
    id: `f-${key}`, value: draft[key] || '', autocomplete: 'off',
    oninput: (e) => { draft[key] = e.target.value; touch(); },
    ...props,
  });

  // --- photos ---
  const photoGrid = h('div', { class: 'photo-grid' });
  const fileInput = h('input', {
    type: 'file', accept: 'image/*', multiple: true, class: 'visually-hidden', id: 'f-photos',
    onchange: async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      busy += files.length;
      renderPhotos();
      for (const file of files) {
        try {
          const img = await processImage(file);
          const record = { id: uid(), clientId: draft.id, createdAt: Date.now(), ...img };
          photos.push({ id: record.id, url: blobUrl(img.thumb), added: record });
          touch();
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          busy--;
          renderPhotos();
        }
      }
    },
  });

  function renderPhotos() {
    photoGrid.replaceChildren(
      ...photos.map((p, i) => h('div', { class: 'photo-tile' },
        h('img', { src: p.url, alt: `Photo ${i + 1}` }),
        h('button', {
          type: 'button', class: 'photo-remove', 'aria-label': `Remove photo ${i + 1}`,
          onclick: () => {
            photos.splice(i, 1);
            if (!p.added) removed.push(p.id);
            touch();
            renderPhotos();
          },
        }, icon('x')))),
      ...Array.from({ length: busy }, () => h('div', { class: 'photo-tile loading' }, h('span', { class: 'spinner' }))),
      h('label', { class: 'photo-add', for: 'f-photos' }, icon('camera'), h('span', {}, 'Add photos')),
    );
  }
  renderPhotos();

  // --- amount ---
  const amountInput = h('input', {
    id: 'f-amount', inputmode: 'decimal', placeholder: '0.00', value: amountText, autocomplete: 'off',
    'aria-describedby': 'err-amount',
    oninput: (e) => { amountText = e.target.value; touch(); },
  });

  const datalist = h('datalist', { id: 'wood-options' }, woodSuggestions(all).map(w => h('option', { value: w })));

  async function onSave() {
    if (busy) { toast('Wait for photos to finish processing'); return; }
    const client = normalize({
      ...draft,
      amountCents: parseMoney(amountText),
      photoIds: photos.map(p => p.id),
      updatedAt: Date.now(),
    });
    const errs = validate(client);
    for (const [k, el] of Object.entries(errorEls)) {
      el.textContent = errs[k] || '';
      root.querySelector(`#f-${k}`)?.setAttribute('aria-invalid', String(Boolean(errs[k])));
    }
    const firstBad = Object.keys(errs)[0];
    if (firstBad) {
      const target = root.querySelector(`#f-${firstBad}`);
      target?.focus();
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    saveBtn.disabled = true;
    try {
      await saveClient(client, photos.filter(p => p.added).map(p => p.added), removed);
      dirty = false;
      toast(isEdit ? 'Changes saved' : 'Client added', 'success');
      if (isEdit) goBack(`/c/${encodeURIComponent(client.id)}`);
      else replace(`/c/${encodeURIComponent(client.id)}`);
    } catch (err) {
      saveBtn.disabled = false;
      toast(`Couldn't save: ${err.message}`, 'error');
    }
  }

  async function onCancel() {
    if (dirty && !(await confirmSheet({
      title: 'Discard changes?', message: 'Your changes to this client will be lost.',
      confirmLabel: 'Discard', danger: true,
    }))) return;
    goBack(isEdit ? `/c/${encodeURIComponent(draft.id)}` : '/');
  }

  const saveBtn = h('button', { class: 'text-btn strong', onclick: onSave }, 'Save');

  root.replaceChildren(
    topBar({
      left: h('button', { class: 'text-btn', onclick: onCancel }, 'Cancel'),
      title: isEdit ? 'Edit client' : 'New client',
      right: saveBtn,
    }),
    h('main', { class: 'page form' },
      h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); onSave(); } },
        h('section', { class: 'group' },
          h('h2', { class: 'group-title' }, 'Contact'),
          field('Name', input('name', { placeholder: 'Client name', autocapitalize: 'words', required: true, 'aria-describedby': 'err-name', enterkeyhint: 'next' }), 'name'),
          field('Phone', input('phone', { type: 'tel', placeholder: '(555) 123-4567', inputmode: 'tel', autocomplete: 'tel' })),
          field('Email', input('email', { type: 'email', placeholder: 'name@example.com', inputmode: 'email', autocapitalize: 'off', 'aria-describedby': 'err-email' }), 'email')),

        h('section', { class: 'group' },
          h('h2', { class: 'group-title' }, 'Product photos'),
          fileInput, photoGrid),

        h('section', { class: 'group' },
          h('h2', { class: 'group-title' }, 'Product'),
          field('Wood type', input('woodType', { placeholder: 'e.g. Walnut, Oak', list: 'wood-options', autocapitalize: 'words' })),
          datalist,
          h('div', { class: 'field' },
            h('span', { class: 'field-label' }, 'Base type'),
            segmented('baseType', BASE_TYPES, draft.baseType, (v) => { draft.baseType = v; touch(); }),
            errorFor('baseType'))),

        h('section', { class: 'group' },
          h('h2', { class: 'group-title' }, 'Payment & delivery'),
          field('Amount (USD)', h('div', { class: 'money' }, h('span', { class: 'money-prefix' }, '$'), amountInput), 'amount'),
          h('div', { class: 'row-toggle' },
            h('span', {}, 'Paid'),
            toggle(draft.paid, (v) => { draft.paid = v; touch(); }, 'Paid')),
          h('div', { class: 'field' },
            h('span', { class: 'field-label' }, 'Status'),
            segmented('status', STATUSES, draft.status, (v) => { draft.status = v; touch(); }),
            errorFor('status'))),

        h('button', { type: 'submit', class: 'btn primary block' }, isEdit ? 'Save changes' : 'Add client'),
      )),
  );
  if (!isEdit) setTimeout(() => root.querySelector('#f-name')?.focus({ preventScroll: true }), 50);
}

export function notFound() {
  return h('div', {},
    topBar({ left: h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => goBack('/') }, icon('back')), title: '' }),
    h('main', { class: 'page' }, h('div', { class: 'empty' },
      h('h2', {}, 'Client not found'),
      h('p', {}, 'It may have been deleted.'),
      h('button', { class: 'btn primary', onclick: () => replace('/') }, 'Back to clients'))));
}
