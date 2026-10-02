// Map clients from WR 1 (on-phone database "wr") to Client info records.
import { WOOD_TYPES } from './schema.js';

const BASES = { wood: 'Wood', steel: 'Steel', hybrid: 'Hybrid' };

export function mapOldClient(old, photosById = new Map()) {
  const typed = String(old.woodType || '').trim();
  const wood = WOOD_TYPES.find(w => w.toLowerCase() === typed.toLowerCase()) || typed;
  return {
    id: old.id,
    name: String(old.name || '').trim(),
    timestamp: old.createdAt ? new Date(old.createdAt).toISOString() : '',
    phone: old.phone || '',
    email: old.email || '',
    photos: (old.photoIds || [])
      .map(pid => photosById.get(pid))
      .filter(Boolean)
      .map(p => ({ local: p.id, blob: p.blob, name: `${p.id}.jpg`, type: p.blob?.type || 'image/jpeg' })),
    wood,
    base: BASES[old.baseType] || '',
    payment: old.paid ? 'Paid' : 'Not paid',
    paid: Number.isInteger(old.amountCents) ? old.amountCents : null,
  };
}
