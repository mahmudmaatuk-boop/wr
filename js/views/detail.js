import { h, icon, topBar, blobUrl, toggle, toast, confirmSheet, openViewer, initials } from '../ui.js';
import { getClient, getPhoto, putClient, deleteClient } from '../db.js';
import { formatMoney, BASE_TYPES, labelOf } from '../model.js';
import { navigate, goBack } from '../router.js';
import { notFound } from './form.js';

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export async function renderDetail(root, { id }) {
  const client = await getClient(id);
  if (!client) {
    root.replaceChildren(notFound());
    return;
  }

  const urls = [];
  for (const pid of client.photoIds) {
    const p = await getPhoto(pid);
    if (p) urls.push(blobUrl(p.blob));
  }

  const paidBadge = h('span', { class: 'badge' });
  const statusBadge = h('span', { class: 'badge' });
  function syncBadges() {
    paidBadge.className = `badge ${client.paid ? 'ok' : 'warn'}`;
    paidBadge.textContent = client.paid ? 'Paid' : 'Unpaid';
    statusBadge.className = `badge ${client.status === 'delivered' ? 'ok' : 'muted'}`;
    statusBadge.textContent = client.status === 'delivered' ? 'Delivered' : 'Not delivered';
  }
  syncBadges();

  async function quickUpdate(changes, message) {
    Object.assign(client, changes, { updatedAt: Date.now() });
    syncBadges();
    try {
      await putClient(client);
      toast(message, 'success');
    } catch (err) {
      toast(`Couldn't save: ${err.message}`, 'error');
    }
  }

  async function onDelete() {
    const ok = await confirmSheet({
      title: `Delete ${client.name}?`,
      message: 'This removes the client and all of their photos. This can’t be undone.',
      confirmLabel: 'Delete client', danger: true,
    });
    if (!ok) return;
    await deleteClient(client.id);
    toast('Client deleted');
    goBack('/');
  }

  const gallery = urls.length
    ? (() => {
        const dots = h('div', { class: 'dots' }, urls.length > 1 && urls.map((_, i) => h('span', { class: i === 0 ? 'on' : '' })));
        const track = h('div', { class: 'gallery-track' },
          urls.map((u, i) => h('button', { class: 'gallery-slide', 'aria-label': `Open photo ${i + 1}`, onclick: () => openViewer(urls, i) },
            h('img', { src: u, alt: `Product photo ${i + 1}` }))));
        track.addEventListener('scroll', () => {
          const idx = Math.round(track.scrollLeft / track.clientWidth);
          [...dots.children].forEach((d, i) => d.classList.toggle('on', i === idx));
        }, { passive: true });
        return h('div', { class: 'gallery' }, track, dots);
      })()
    : h('div', { class: 'gallery empty-gallery' }, h('span', { class: 'initials big' }, initials(client.name)));

  const infoRow = (label, value, action) => h('div', { class: 'info-row' },
    h('span', { class: 'info-label' }, label),
    h('span', { class: 'info-value' }, value || h('span', { class: 'muted' }, '—')),
    action);

  const contactBtn = (href, iconName, label) =>
    h('a', { class: 'contact-btn', href, 'aria-label': label }, icon(iconName), h('span', {}, label));

  root.replaceChildren(
    topBar({
      left: h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => goBack('/') }, icon('back')),
      title: '',
      right: h('button', { class: 'text-btn strong', onclick: () => navigate(`/c/${encodeURIComponent(client.id)}/edit`) }, 'Edit'),
    }),
    h('main', { class: 'page detail' },
      gallery,
      h('section', { class: 'detail-head' },
        h('h1', {}, client.name),
        h('p', { class: 'detail-amount' }, formatMoney(client.amountCents)),
        h('div', { class: 'badges' }, paidBadge, statusBadge)),

      (client.phone || client.email) && h('div', { class: 'contact-row' },
        client.phone && contactBtn(`tel:${client.phone.replace(/[^\d+]/g, '')}`, 'phone', 'Call'),
        client.email && contactBtn(`mailto:${client.email}`, 'mail', 'Email')),

      h('section', { class: 'group' },
        h('div', { class: 'row-toggle' },
          h('span', {}, 'Paid'),
          toggle(client.paid, (v) => quickUpdate({ paid: v }, v ? 'Marked as paid' : 'Marked as unpaid'), 'Paid')),
        h('div', { class: 'row-toggle' },
          h('span', {}, 'Delivered'),
          toggle(client.status === 'delivered',
            (v) => quickUpdate({ status: v ? 'delivered' : 'not_delivered' }, v ? 'Marked as delivered' : 'Marked as not delivered'),
            'Delivered'))),

      h('section', { class: 'group' },
        infoRow('Phone', client.phone && h('a', { href: `tel:${client.phone.replace(/[^\d+]/g, '')}` }, client.phone)),
        infoRow('Email', client.email && h('a', { href: `mailto:${client.email}` }, client.email)),
        infoRow('Wood type', client.woodType),
        infoRow('Base type', labelOf(BASE_TYPES, client.baseType)),
        infoRow('Added', dateFmt.format(client.createdAt))),

      h('button', { class: 'btn danger-ghost block', onclick: onDelete }, icon('trash'), 'Delete client')),
  );
}
