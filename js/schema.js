// The data shape of every WR page. Plain data only: the app imports it, and
// scripts/build-gas.mjs bakes it into apps-script/Code.gs so the Google side
// creates exactly the same spreadsheets and columns.

export const WOOD_TYPES = [
  'African Walnut', 'African Mahogany', 'Teak', 'Albizia', 'Dahoma',
  'Denya', 'Sapele', 'Okoro', 'Black Ofram',
];

export const BASE_TYPES = ['Steel', 'Wood', 'Hybrid'];

export const PAYMENT_STATUSES = ['Paid', 'Not paid'];

export const EXPENSE_CATEGORIES = [
  'Telecommunication expenses and internet',
  'Salaries',
  'Office Equipment Maintenance & Repairs',
  'Forklift Maintenance, Repair & Oil Change',
  'Fire Extinguishers Maintenance & Recharging',
  'Generator maintenance and oil change',
  'Tools and supplies',
  'Steel and steel works',
  'Glass, mirror and plywood',
  'Abou Mahmoud',
  'Fuel',
  'Audit fees',
  'Showroom rent',
  'Land rent',
  'Glass cleaning and pest control expenses',
  'Showroom expenses',
  'Transportation fees',
  'Digital marketing expenses',
  'Domain and website annual renewal',
  'Foreign work permit renewal fees',
  'Annual Tax Clearance Certificate Fees',
  'Customs Clearance & Port Charges',
  'Municipal Fees & Expenses',
  'Ministry of Finance stamp duty',
];

// Column types: text, tel, email, url, money (stored in the app as cents),
// number, select / choice (with options), month (YYYY-MM), dims (L×W×H cm),
// photos (Drive links), timestamp (set by the server), id.
const ID = { key: 'id', header: 'ID', type: 'id' };
const timestamp = (header = 'Timestamp', extra = {}) => ({ key: 'timestamp', header, type: 'timestamp', ...extra });
const wood = (required = false) => ({ key: 'wood', header: 'Wood type', type: 'select', options: WOOD_TYPES, required });
const dims = { key: 'dims', header: 'Dimensions (cm)', type: 'dims' };

export const PAGES = [
  {
    key: 'clients', title: 'Client info', spreadsheet: 'Client info', kind: 'records',
    columns: [
      { key: 'name', header: 'Name', type: 'text', required: true },
      timestamp(),
      { key: 'phone', header: 'Phone', type: 'tel' },
      { key: 'email', header: 'E-mail', type: 'email' },
      { key: 'photos', header: 'Products photo', type: 'photos' },
      { key: 'wood', header: 'Wood type', type: 'select', options: WOOD_TYPES },
      { key: 'base', header: 'Base type', type: 'select', options: BASE_TYPES },
      { key: 'payment', header: 'Payment status', type: 'choice', options: PAYMENT_STATUSES, default: 'Not paid' },
      { key: 'paid', header: 'Paid amount (USD)', type: 'money' },
      ID,
    ],
  },
  {
    // One row per month; the month is also the row ID, so saving a month again updates it.
    key: 'expenses', title: 'Monthly expenses', spreadsheet: 'Monthly expenses', kind: 'month-row',
    columns: [
      { key: 'month', header: 'Month', type: 'month', required: true },
      ...EXPENSE_CATEGORIES.map((header, i) => ({ key: `e${String(i + 1).padStart(2, '0')}`, header, type: 'money' })),
      { key: 'total', header: 'Total (USD)', type: 'money', computed: true },
      timestamp('Last updated', { touch: true }),
      ID,
    ],
  },
  {
    // Rows live in one tab per month, e.g. "2026-10 October".
    key: 'monthly', title: 'Client info monthly', spreadsheet: 'Client info monthly', kind: 'month-tabs',
    columns: [
      { key: 'month', header: 'Month', type: 'month', required: true },
      { key: 'name', header: 'Name', type: 'text', required: true },
      { key: 'items', header: 'Items', type: 'text' },
      wood(),
      { key: 'amountPaid', header: 'Amount paid (USD)', type: 'money' },
      { key: 'total', header: 'Total (USD)', type: 'money' },
      ID,
    ],
  },
  {
    key: 'vat', title: 'VAT', spreadsheet: 'VAT', kind: 'records',
    columns: [
      { key: 'qty', header: 'QTY', type: 'number', required: true },
      { key: 'description', header: 'Description', type: 'text', required: true },
      { key: 'unit', header: 'Unit Price USD', type: 'money', required: true },
      { key: 'vat', header: 'VAT 11%', type: 'money', computed: true },
      { key: 'total', header: 'Total amount due', type: 'money', computed: true },
      timestamp(),
      ID,
    ],
  },
  {
    key: 'packing', title: 'Packing & Shipments', spreadsheet: 'Packing & Shipments', kind: 'records',
    columns: [
      { key: 'item', header: 'Item', type: 'text', required: true },
      dims,
      { key: 'qty', header: 'Qty', type: 'number' },
      wood(),
      { key: 'volume', header: 'Volume (m³)', type: 'number', decimals: 3, computed: true },
      { key: 'weight', header: 'Approx. weight (kg)', type: 'number' },
      ID,
    ],
  },
  {
    // Files live in Drive (WR/WR-Documents); this sheet is their index.
    key: 'documents', title: 'WR-Documents', spreadsheet: 'WR-Documents', kind: 'documents',
    columns: [
      { key: 'title', header: 'Title', type: 'text' },
      { key: 'fileName', header: 'File name', type: 'text' },
      { key: 'fileType', header: 'Type', type: 'text' },
      { key: 'size', header: 'Size', type: 'text' },
      timestamp('Uploaded'),
      { key: 'link', header: 'Link', type: 'url' },
      { key: 'fileId', header: 'File ID', type: 'text' },
      ID,
    ],
  },
  {
    key: 'raw', title: 'Raw Stockage', spreadsheet: 'Raw Stockage', kind: 'records',
    columns: [
      wood(true),
      { key: 'qty', header: 'Qty', type: 'number', required: true },
      dims,
      ID,
    ],
  },
  {
    key: 'finished', title: 'Finished Stockage', spreadsheet: 'Finished Stockage', kind: 'records',
    columns: [
      { key: 'photos', header: 'Product photo', type: 'photos' },
      wood(true),
      dims,
      { key: 'base', header: 'Base', type: 'select', options: BASE_TYPES },
      ID,
    ],
  },
  { key: 'backup', title: 'Backup', spreadsheet: 'WR Backup', kind: 'backup', columns: [] },
];

export const DATA_PAGES = PAGES.filter(p => p.kind !== 'backup');

export const pageByKey = (key) => PAGES.find(p => p.key === key);

export const column = (page, key) => page.columns.find(c => c.key === key);
