// Pure rules for the offline outbox: one pending operation per record.

/**
 * Merge a new operation into the pending one for the same record.
 * Returns the operation to store, or null when both cancel out.
 */
export function coalesce(existing, next, { inFlight = false } = {}) {
  if (!existing) return next;
  const merged = { ...next, seq: existing.seq, version: (existing.version || 1) + 1, error: null, attempts: 0 };
  if (next.type === 'delete') {
    // Added and deleted before it ever reached the sheet: nothing to send.
    if (existing.type === 'save' && existing.created && !inFlight) return null;
    return { ...merged, created: false };
  }
  return { ...merged, created: existing.type === 'save' && existing.created && !inFlight };
}

/** Downloaded rows with pending changes applied on top, newest first. */
export function mergeView(rows, ops) {
  const out = new Map();
  rows.forEach((r, i) => out.set(r.id, { ...r, _order: i }));
  let next = rows.length;
  for (const op of [...ops].sort((a, b) => a.seq - b.seq)) {
    if (op.type === 'delete') {
      out.delete(op.id);
      continue;
    }
    const prev = out.get(op.id);
    out.set(op.id, { ...op.record, id: op.id, _order: prev ? prev._order : next++, _pending: true, _error: op.error || null });
  }
  return [...out.values()].sort((a, b) => b._order - a._order);
}
