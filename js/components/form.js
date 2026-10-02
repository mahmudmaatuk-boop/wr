// Generic iOS-style form for any page in schema.js: inset grouped rows,
// native pickers for dropdowns, photos, live calculated fields.
import { h, icon, blobUrl, toast, openViewer, fitInput } from '../ui.js';
import { processImage } from '../images.js';
import { validate } from '../validate.js';
import { PAGE_UI, compute } from '../pages.js';
import { photoSrc } from '../rows.js';
import { parseMoney, centsToInput, parseNumber, formatMoney, formatNumber, formatDate, uid } from '../calc.js';

const PLACEHOLDERS = {
  name: 'Full name', phone: 'Phone number', email: 'name@example.com', items: 'What was bought',
  description: 'Description', item: 'Item', title: 'Title',
};

const showValue = (col, v) => {
  if (col.type === 'money') return Number.isFinite(v) ? formatMoney(v) : '—';
  if (col.type === 'number') return Number.isFinite(v) ? `${formatNumber(v, col.decimals || 2)}${col.key === 'volume' ? ' m³' : ''}` : '—';
  return v || '—';
};

export function renderForm({ page, record, isEdit = false, onSubmit, onDelete }) {
  const ui = PAGE_UI[page.key];
  const draft = { ...record };
  for (const col of page.columns) if (col.type === 'photos') draft[col.key] = [...(record[col.key] || [])];
  const errorEls = {};
  const computedEls = {};
  let busy = 0;

  const recompute = () => {
    const full = compute(page, draft);
    for (const col of page.columns) if (computedEls[col.key]) computedEls[col.key].textContent = showValue(col, full[col.key]);
  };

  const field = (col, control, { stacked = false } = {}) =>
    h('div', { class: `field ${stacked ? 'stacked' : ''}` },
      h('div', { class: 'row' },
        h('label', { class: 'row-label', for: `f-${col.key}` }, col.header.replace(/\s*\((USD|cm)\)$/, '')),
        control),
      (errorEls[col.key] = h('p', { class: 'field-error', id: `err-${col.key}`, 'aria-live': 'polite' })));

  const input = (col, props) => h('input', {
    id: `f-${col.key}`, class: 'row-input', 'data-key': col.key, autocomplete: 'off',
    'aria-describedby': `err-${col.key}`, ...props,
  });

  function control(col) {
    const v = draft[col.key];
    switch (col.type) {
      case 'text':
      case 'tel':
      case 'email':
      case 'url': {
        const types = { tel: { type: 'tel', inputmode: 'tel' }, email: { type: 'email', inputmode: 'email', autocapitalize: 'off', spellcheck: 'false' }, url: { type: 'url' } };
        return input(col, {
          ...(types[col.type] || { type: 'text', autocapitalize: col.key === 'name' ? 'words' : 'sentences' }),
          value: v || '', placeholder: PLACEHOLDERS[col.key] || (col.required ? 'Required' : ''),
          oninput: (e) => { draft[col.key] = e.target.value; },
        });
      }
      case 'money': {
        const el = input(col, {
          inputmode: 'decimal', placeholder: '0.00', value: centsToInput(v),
          oninput: (e) => { fitInput(e.target); draft[col.key] = parseMoney(e.target.value); recompute(); },
        });
        fitInput(el);
        return h('span', { class: 'money' }, h('span', { class: 'money-sign' }, '$'), el);
      }
      case 'number':
        return input(col, {
          inputmode: 'decimal', placeholder: '0', value: Number.isFinite(v) ? String(v) : '',
          oninput: (e) => { draft[col.key] = parseNumber(e.target.value); recompute(); },
        });
      case 'month':
        return input(col, { type: 'month', value: v || '', onchange: (e) => { draft[col.key] = e.target.value; } });
      case 'select': {
        const options = v && !col.options.includes(v) ? [...col.options, v] : col.options;
        return h('span', { class: 'select' },
          h('select', {
            id: `f-${col.key}`, class: 'row-select', 'data-key': col.key, 'aria-describedby': `err-${col.key}`,
            onchange: (e) => { draft[col.key] = e.target.value; },
          },
          h('option', { value: '', selected: !v }, 'Choose'),
          options.map(o => h('option', { value: o, selected: o === v }, o))),
          icon('selector', 'select-icon'));
      }
      case 'choice': {
        const wrap = h('span', { class: 'choice', role: 'radiogroup', 'aria-label': col.header });
        const draw = () => wrap.replaceChildren(...col.options.map((o, i) => h('button', {
          type: 'button', role: 'radio', class: `choice-btn ${draft[col.key] === o ? 'on' : ''}`,
          'aria-checked': String(draft[col.key] === o), 'data-key': i === 0 ? col.key : null,
          onclick: () => { draft[col.key] = o; draw(); },
        }, o)));
        draw();
        return wrap;
      }
      case 'dims': {
        const d = v || {};
        const part = (k, label) => h('input', {
          class: 'dim', inputmode: 'decimal', placeholder: label, 'aria-label': `${label} (cm)`, 'data-key': k === 'l' ? col.key : null,
          id: k === 'l' ? `f-${col.key}` : null, value: Number.isFinite(d[k]) ? String(d[k]) : '',
          oninput: () => {
            const vals = [...dims.querySelectorAll('input')].map(i => parseNumber(i.value));
            draft[col.key] = vals.every(x => x === null) ? null : { l: vals[0], w: vals[1], h: vals[2] };
            recompute();
          },
        });
        const dims = h('span', { class: 'dims' }, part('l', 'L'), '×', part('w', 'W'), '×', part('h', 'H'), h('span', { class: 'unit' }, 'cm'));
        return dims;
      }
      default:
        return h('span', { class: 'row-value' }, String(v ?? ''));
    }
  }

  function photosGroup(col) {
    const grid = h('div', { class: 'photo-grid' });
    const fileInput = h('input', {
      type: 'file', accept: 'image/*', multiple: true, class: 'visually-hidden', id: `f-${col.key}`,
      onchange: async (e) => {
        const files = [...e.target.files];
        e.target.value = '';
        busy += files.length;
        draw();
        for (const file of files) {
          try {
            const img = await processImage(file);
            const id = uid();
            draft[col.key].push({ local: id, blob: img.blob, thumb: img.thumb, name: `${id}.jpg`, type: 'image/jpeg' });
          } catch (err) {
            toast(err.message, 'error');
          } finally {
            busy--;
            draw();
          }
        }
      },
    });
    const src = (p, size) => (p.blob ? blobUrl(size < 800 && p.thumb ? p.thumb : p.blob) : photoSrc(p.url, size));
    function draw() {
      const photos = draft[col.key];
      grid.replaceChildren(
        ...photos.map((p, i) => h('div', { class: 'photo' },
          h('button', { type: 'button', class: 'photo-open', 'aria-label': `View photo ${i + 1}`, onclick: () => openViewer(photos.map(x => src(x, 1600)), i) },
            h('img', { src: src(p, 400), alt: '' })),
          h('button', {
            type: 'button', class: 'photo-remove', 'aria-label': `Remove photo ${i + 1}`,
            onclick: () => { photos.splice(i, 1); draw(); },
          }, icon('x')))),
        ...Array.from({ length: busy }, () => h('div', { class: 'photo loading' }, h('span', { class: 'spinner' }))),
        h('label', { class: 'photo-add', for: `f-${col.key}` }, icon('camera'), h('span', {}, 'Add photos')));
    }
    draw();
    return h('section', { class: 'group' }, h('h2', { class: 'group-title' }, col.header), fileInput, grid);
  }

  // Lay the fields out in groups: inputs, then photos, then calculated values.
  const sections = [];
  let current = null;
  const computedRows = [];
  for (const col of page.columns) {
    if (col.type === 'id' || (col.type === 'timestamp' && !(isEdit && draft[col.key]))) continue;
    if (col.type === 'photos') {
      sections.push(photosGroup(col));
      current = null;
    } else if (col.computed) {
      computedRows.push(h('div', { class: 'row computed' },
        h('span', { class: 'row-label' }, col.header),
        (computedEls[col.key] = h('span', { class: 'row-value strong' }))));
    } else {
      if (!current) {
        current = h('section', { class: 'group' });
        sections.push(current);
      }
      current.append(col.type === 'timestamp'
        ? h('div', { class: 'row' }, h('span', { class: 'row-label' }, col.header), h('span', { class: 'row-value muted' }, formatDate(draft[col.key], true)))
        : field(col, control(col)));
    }
  }
  if (computedRows.length) {
    sections.push(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, ui.computedTitle || 'Calculated'), ...computedRows));
  }

  const submitBtn = h('button', { type: 'submit', class: 'btn primary block big' }, isEdit ? 'Save changes' : ui.addLabel);
  const hasTimestamp = page.columns.some(c => c.type === 'timestamp' && !c.touch);
  const form = h('form', { class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } },
    ...sections,
    submitBtn,
    !isEdit && hasTimestamp && h('p', { class: 'form-note' }, 'The timestamp is added automatically.'),
    isEdit && onDelete && h('button', { type: 'button', class: 'btn block danger-plain', onclick: onDelete }, icon('trash'), 'Delete'));

  async function submit() {
    if (busy) { toast('Wait for the photos to finish'); return; }
    const full = compute(page, draft);
    const errs = validate(page, full);
    for (const [k, el] of Object.entries(errorEls)) {
      el.textContent = errs[k] || '';
      el.parentElement.classList.toggle('invalid', Boolean(errs[k]));
    }
    const first = Object.keys(errs)[0];
    if (first) {
      const target = form.querySelector(`[data-key="${first}"]`);
      target?.focus();
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    submitBtn.disabled = true;
    try {
      await onSubmit(full);
    } catch (err) {
      toast(`Couldn't save: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  recompute();
  return form;
}
