import { isMonthKey } from './calc.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isEmpty = (v) => v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

// "Paid amount (USD)" → "Paid amount"
const label = (col) => col.header.replace(/\s*\(.*\)$/, '');

/** Returns { fieldKey: message }; empty means valid. */
export function validate(page, record) {
  const errs = {};
  for (const col of page.columns) {
    if (col.computed || col.type === 'id' || col.type === 'timestamp') continue;
    const v = record[col.key];
    if (isEmpty(v)) {
      if (col.required) errs[col.key] = `${label(col)} is required`;
      continue;
    }
    switch (col.type) {
      case 'email':
        if (!EMAIL.test(String(v).trim())) errs[col.key] = 'Enter a valid e-mail';
        break;
      case 'money':
        if (!Number.isInteger(v) || v < 0) errs[col.key] = 'Enter a valid amount';
        break;
      case 'number':
        if (!Number.isFinite(v) || v < 0) errs[col.key] = 'Enter a valid number';
        break;
      case 'month':
        if (!isMonthKey(v)) errs[col.key] = 'Choose a month';
        break;
      case 'dims':
        if (![v.l, v.w, v.h].every(n => Number.isFinite(n) && n > 0)) errs[col.key] = 'Enter length, width and height';
        break;
    }
  }
  return errs;
}
