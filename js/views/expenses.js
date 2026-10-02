// Monthly expenses: one month at a time, 24 categories, live total.
import { h, icon, navBar, segmented, toast, confirmSheet, fitInput } from '../ui.js';
import { pageByKey } from '../schema.js';
import { compute } from '../pages.js';
import { validate } from '../validate.js';
import { records, refresh, save, remove } from '../repo.js';
import { subscribe } from '../sync.js';
import { navigate, replace, goBack } from '../router.js';
import { parseMoney, centsToInput, formatMoney, monthKey, monthLabel, isMonthKey } from '../calc.js';

export async function renderExpenses(root, { tab = 'month', month } = {}) {
  const page = pageByKey('expenses');
  const categories = page.columns.filter(c => /^e\d\d$/.test(c.key));
  let list = await records('expenses');
  month = isMonthKey(month) ? month : monthKey();

  const tabs = h('div', { class: 'tabs' });
  const body = h('div', { class: 'page-body' });
  const drawTabs = () => tabs.replaceChildren(segmented(
    [{ value: 'month', label: 'Month' }, { value: 'saved', label: `Saved (${list.length})` }],
    tab, (v) => replace(v === 'saved' ? '/p/expenses/saved' : `/p/expenses/m/${month}`), 'Monthly expenses'));

  let dirty = false;

  function drawMonth() {
    const existing = list.find(r => r.id === month);
    const draft = existing ? { ...existing } : { id: month, month };
    const totalEl = h('span', { class: 'total-value' });
    const updateTotal = () => { totalEl.textContent = formatMoney(compute(page, draft).total); };

    const monthInput = h('input', {
      type: 'month', class: 'row-input', id: 'f-month', value: month, 'aria-label': 'Month',
      onchange: async (e) => {
        const next = e.target.value;
        if (!isMonthKey(next)) { e.target.value = month; return; }
        if (dirty && !(await confirmSheet({ title: 'Discard changes?', message: `Your changes to ${monthLabel(month)} aren't saved.`, confirmLabel: 'Discard', danger: true }))) {
          e.target.value = month;
          return;
        }
        dirty = false;
        replace(`/p/expenses/m/${next}`);
      },
    });

    const rows = categories.map(col => h('label', { class: 'row expense' },
      h('span', { class: 'row-label' }, col.header),
      h('span', { class: 'money' }, h('span', { class: 'money-sign' }, '$'),
        h('input', {
          class: 'row-input', inputmode: 'decimal', placeholder: '0.00', 'data-key': col.key,
          value: centsToInput(draft[col.key]), 'aria-label': col.header,
          size: 5,
          oninput: (e) => {
            fitInput(e.target);
            draft[col.key] = parseMoney(e.target.value);
            dirty = true;
            e.target.closest('.row').classList.toggle('invalid', Number.isNaN(draft[col.key]));
            updateTotal();
          },
        }))));

    const saveBtn = h('button', { class: 'btn primary', type: 'button', onclick: onSave }, 'Save month');

    async function onSave() {
      const rec = compute(page, { ...draft, id: month, month });
      const errs = validate(page, rec);
      const bad = Object.keys(errs)[0];
      if (bad) {
        toast(errs[bad], 'error');
        body.querySelector(`[data-key="${bad}"]`)?.focus();
        return;
      }
      saveBtn.disabled = true;
      try {
        await save('expenses', rec, { isNew: !existing });
        dirty = false;
        toast(`${monthLabel(month)} saved`, 'success');
        list = await records('expenses');
        drawTabs();
        drawMonth();
      } finally {
        saveBtn.disabled = false;
      }
    }

    async function onDelete() {
      const ok = await confirmSheet({
        title: `Delete ${monthLabel(month)}?`,
        message: 'All expenses for this month are removed from the Google Sheet.',
        confirmLabel: 'Delete month', danger: true,
      });
      if (!ok) return;
      await remove('expenses', month);
      toast(`${monthLabel(month)} deleted`);
      list = await records('expenses');
      drawTabs();
      drawMonth();
    }

    body.replaceChildren(...[
      h('section', { class: 'group' }, h('div', { class: 'row' }, h('label', { class: 'row-label', for: 'f-month' }, 'Month'), monthInput)),
      existing?._pending && h('p', { class: 'pending-note' }, icon('cloud-up'), 'Waiting to upload to Google Sheets'),
      h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Expenses in USD'), ...rows),
      existing && h('button', { class: 'btn block danger-plain', type: 'button', onclick: onDelete }, icon('trash'), 'Delete month'),
      h('div', { class: 'total-bar' },
        h('div', {}, h('span', { class: 'total-label' }, `Total · ${monthLabel(month)}`), totalEl),
        saveBtn),
    ].filter(Boolean));
    body.querySelectorAll('.money input').forEach(fitInput);
    updateTotal();
  }

  function drawSaved() {
    const months = [...list].sort((a, b) => b.month.localeCompare(a.month));
    if (!months.length) {
      body.replaceChildren(h('div', { class: 'empty' },
        h('div', { class: 'empty-icon' }, icon('wallet')),
        h('h2', {}, 'No months saved yet'),
        h('p', {}, 'Fill in a month on the Month tab and tap Save month.')));
      return;
    }
    const year = String(new Date().getFullYear());
    const yearTotal = months.filter(r => r.month.startsWith(year)).reduce((s, r) => s + (r.total || 0), 0);
    body.replaceChildren(
      h('div', { class: 'summary' },
        h('div', { class: 'summary-item' }, h('span', { class: 'summary-label' }, `Total ${year}`), h('span', { class: 'summary-value' }, formatMoney(yearTotal))),
        h('div', { class: 'summary-item' }, h('span', { class: 'summary-label' }, 'Months saved'), h('span', { class: 'summary-value' }, String(months.length)))),
      h('div', { class: 'group list' }, months.map(r => h('button', { class: 'rec', onclick: () => navigate(`/p/expenses/m/${r.month}`) },
        h('div', { class: 'rec-main' },
          h('div', { class: 'rec-title' }, h('span', {}, monthLabel(r.month)),
            r._pending && h('span', { class: 'rec-pending', title: 'Waiting to upload' }, icon('cloud-up'))),
          r._error && h('div', { class: 'rec-error' }, icon('alert'), r._error)),
        h('div', { class: 'rec-side' }, h('div', { class: 'rec-right' }, formatMoney(r.total || 0))),
        icon('chevron', 'rec-chevron')))));
  }

  const draw = () => (tab === 'saved' ? drawSaved() : drawMonth());
  drawTabs();
  draw();
  root.replaceChildren(
    navBar({ back: { label: 'Home', onClick: () => goBack('/') }, title: page.title }),
    h('main', { class: `page ${tab === 'saved' ? '' : 'with-bar'}` }, h('h1', { class: 'large-title' }, page.title), tabs, body));

  const reload = async () => {
    list = await records('expenses');
    drawTabs();
    if (tab === 'saved' || !dirty) draw();
  };
  refresh('expenses').then(reload).catch(() => {});
  let first = true;
  return subscribe(() => { if (first) { first = false; return; } reload(); });
}
