// In-memory stand-ins for the Google Apps Script services that Code.gs uses,
// so the real server code runs in Node: in the tests and in the mock server.
// They mimic the behaviour that matters to WR, including Sheets turning text
// like "0096170..." into numbers unless the column is formatted as plain text.
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

const isDate = (v) => Object.prototype.toString.call(v) === '[object Date]';

function formatDate(date, timeZone, pattern) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  return pattern.replace('yyyy', parts.year).replace('MM', parts.month).replace('dd', parts.day)
    .replace('HH', parts.hour).replace('mm', parts.minute);
}

// What Sheets stores when a value is written into a cell with the given number format.
function coerce(value, format) {
  if (isDate(value)) return new Date(value.getTime());
  if (typeof value !== 'string') return value;
  if (value.startsWith("'")) return value.slice(1);
  if (value.startsWith('=')) return { formula: value };
  if (format === '@') return value;
  const t = value.trim();
  if (/^[+-]?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(t)) return new Date(`${t.length === 7 ? `${t}-01` : t}T00:00:00Z`);
  return value;
}

function readCell(v) {
  if (v && typeof v === 'object' && 'formula' in v) return '#ERROR!';
  if (isDate(v)) return new Date(v.getTime());
  return v ?? '';
}

export function createGas({ fileUrlBase = 'https://drive.google.com/file/d/', timeZone = 'Asia/Beirut' } = {}) {
  let seq = 0;
  const newId = () => `${(++seq).toString(36).padStart(4, '0')}${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const files = new Map();
  const folders = new Map();
  const spreadsheets = new Map();
  const triggers = [];
  const logs = [];
  const propsMap = new Map();

  class Iterator {
    constructor(items) { this.items = items; this.i = 0; }
    hasNext() { return this.i < this.items.length; }
    next() { return this.items[this.i++]; }
  }

  class Blob {
    constructor(bytes, type, name) {
      this.bytes = Uint8Array.from(bytes, b => b & 255);
      this.type = type || 'application/octet-stream';
      this.name = name || 'file';
    }
    getBytes() { return Array.from(this.bytes); }
    getContentType() { return this.type; }
    getName() { return this.name; }
    setName(name) { this.name = name; return this; }
    getDataAsString() { return Buffer.from(this.bytes).toString('utf8'); }
  }

  class Folder {
    constructor(name, parentId) {
      Object.assign(this, { id: newId(), name, parentId, trashed: false });
      folders.set(this.id, this);
    }
    getId() { return this.id; }
    getName() { return this.name; }
    getUrl() { return `https://drive.google.com/drive/folders/${this.id}`; }
    isTrashed() { return this.trashed; }
    setTrashed(t) { this.trashed = t; return this; }
    createFolder(name) { return new Folder(name, this.id); }
    createFile(blob) {
      const file = new File(blob.getName(), blob.getContentType(), blob.bytes);
      file.parents = [this.id];
      return file;
    }
    getParents() { return new Iterator(this.parentId ? [folders.get(this.parentId)] : []); }
  }

  class File {
    constructor(name, mime, bytes = new Uint8Array()) {
      Object.assign(this, { id: newId(), name, mime, bytes, trashed: false, sharing: 'PRIVATE', parents: [] });
      files.set(this.id, this);
    }
    getId() { return this.id; }
    getName() { return this.name; }
    getMimeType() { return this.mime; }
    getSize() { return this.bytes.length; }
    getUrl() { return `${fileUrlBase}${this.id}/view?usp=drivesdk`; }
    getBlob() { return new Blob(this.bytes, this.mime, this.name); }
    setSharing(access, permission) { this.sharing = access; this.permission = permission; return this; }
    isTrashed() { return this.trashed; }
    setTrashed(t) { this.trashed = t; return this; }
    moveTo(folder) { this.parents = [folder.getId()]; return this; }
    getParents() { return new Iterator(this.parents.map(id => folders.get(id))); }
  }

  class Range {
    constructor(sheet, row, col, numRows, numCols) { Object.assign(this, { sheet, row, col, numRows, numCols }); }
    getValues() {
      const out = [];
      for (let r = 0; r < this.numRows; r++) {
        const line = [];
        for (let c = 0; c < this.numCols; c++) line.push(readCell(this.sheet.cell(this.row + r, this.col + c)));
        out.push(line);
      }
      return out;
    }
    getValue() { return this.getValues()[0][0]; }
    setValues(values) {
      if (values.length !== this.numRows || values.some(l => l.length !== this.numCols)) {
        throw new Error('The number of rows or columns in the data does not match the range.');
      }
      values.forEach((line, r) => line.forEach((v, c) => this.sheet.write(this.row + r, this.col + c, v)));
      return this;
    }
    setValue(v) { this.sheet.write(this.row, this.col, v); return this; }
    setNumberFormat(fmt) {
      for (let c = 0; c < this.numCols; c++) this.sheet.formats.set(this.col + c, { fmt, from: this.row });
      return this;
    }
    setDataValidation(rule) {
      for (let c = 0; c < this.numCols; c++) this.sheet.validations.set(this.col + c, rule);
      return this;
    }
    setFontWeight() { return this; }
    setFontSize() { return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
    setHorizontalAlignment() { return this; }
    setWrap() { return this; }
  }

  class Sheet {
    constructor(ss, name) {
      Object.assign(this, { ss, name, rows: [], maxRows: 1000, maxCols: 26, frozen: 0 });
      this.formats = new Map();
      this.validations = new Map();
      this.widths = new Map();
    }
    getName() { return this.name; }
    setName(name) {
      if (this.ss.sheets.some(s => s !== this && s.name === name)) throw new Error(`A sheet with the name "${name}" already exists.`);
      this.name = name;
      return this;
    }
    cell(r, c) { return (this.rows[r - 1] || [])[c - 1]; }
    write(r, c, v) {
      const f = this.formats.get(c);
      (this.rows[r - 1] ||= [])[c - 1] = coerce(v, f && r >= f.from ? f.fmt : null);
    }
    getLastRow() {
      for (let r = this.rows.length; r >= 1; r--) if ((this.rows[r - 1] || []).some(v => v !== '' && v != null)) return r;
      return 0;
    }
    getLastColumn() {
      let max = 0;
      for (const line of this.rows) {
        if (!line) continue;
        for (let c = line.length; c > max; c--) if (line[c - 1] !== '' && line[c - 1] != null) { max = c; break; }
      }
      return max;
    }
    getMaxRows() { return this.maxRows; }
    getMaxColumns() { return this.maxCols; }
    insertRowsAfter(after, n) { this.maxRows += n; return this; }
    insertColumnsAfter(after, n) { this.maxCols += n; return this; }
    getRange(row, col, numRows = 1, numCols = 1) {
      if (row < 1 || col < 1 || numRows < 1 || numCols < 1 || row + numRows - 1 > this.maxRows || col + numCols - 1 > this.maxCols) {
        throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
      }
      return new Range(this, row, col, numRows, numCols);
    }
    appendRow(values) {
      const r = this.getLastRow() + 1;
      this.maxRows = Math.max(this.maxRows, r);
      this.maxCols = Math.max(this.maxCols, values.length);
      values.forEach((v, c) => this.write(r, c + 1, v));
      return this;
    }
    deleteRow(r) {
      if (r < 1 || r > this.maxRows) throw new Error('Those rows are out of bounds.');
      this.rows.splice(r - 1, 1);
      this.maxRows -= 1;
      return this;
    }
    clear() { this.rows = []; this.formats.clear(); this.validations.clear(); return this; }
    setFrozenRows(n) { this.frozen = n; return this; }
    setColumnWidth(c, w) { this.widths.set(c, w); return this; }
    /** Test helper: every row as read through getValues. */
    values() { return this.rows.map(line => (line || []).map(readCell)); }
  }

  class Spreadsheet {
    constructor(name) {
      this.file = new File(name, 'application/vnd.google-apps.spreadsheet');
      Object.assign(this, { id: this.file.id, name, sheets: [], timeZone: 'Etc/GMT' });
      this.sheets.push(new Sheet(this, 'Sheet1'));
      spreadsheets.set(this.id, this);
    }
    getId() { return this.id; }
    getName() { return this.name; }
    getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}/edit`; }
    getSheets() { return [...this.sheets]; }
    getSheetByName(name) { return this.sheets.find(s => s.name === name) || null; }
    insertSheet(name, index) {
      if (this.getSheetByName(name)) throw new Error(`A sheet with the name "${name}" already exists.`);
      const sheet = new Sheet(this, name);
      if (index === undefined || index >= this.sheets.length) this.sheets.push(sheet);
      else this.sheets.splice(index, 0, sheet);
      return sheet;
    }
    deleteSheet(sheet) {
      if (this.sheets.length === 1) throw new Error("You can't remove all the sheets in a document.");
      this.sheets = this.sheets.filter(s => s !== sheet);
    }
    setSpreadsheetTimeZone(tz) { this.timeZone = tz; return this; }
    getSpreadsheetTimeZone() { return this.timeZone; }
  }

  const properties = {
    getProperty: (k) => (propsMap.has(k) ? propsMap.get(k) : null),
    setProperty: (k, v) => { propsMap.set(k, String(v)); return properties; },
    deleteProperty: (k) => { propsMap.delete(k); return properties; },
    getProperties: () => Object.fromEntries(propsMap),
  };

  const globals = {
    SpreadsheetApp: {
      create: (name) => new Spreadsheet(name),
      openById: (id) => {
        const ss = spreadsheets.get(id);
        if (!ss) throw new Error('Unexpected error while getting the method or property openById on object SpreadsheetApp.');
        return ss;
      },
      newDataValidation: () => {
        const rule = {};
        const builder = {
          requireValueInList: (list, dropdown) => { rule.list = [...list]; rule.dropdown = dropdown; return builder; },
          setAllowInvalid: (allow) => { rule.allowInvalid = allow; return builder; },
          build: () => ({ ...rule }),
        };
        return builder;
      },
    },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', PRIVATE: 'PRIVATE' },
      Permission: { VIEW: 'VIEW', EDIT: 'EDIT' },
      createFolder: (name) => new Folder(name, null),
      getFolderById: (id) => {
        const f = folders.get(id);
        if (!f) throw new Error('No item with the given ID could be found.');
        return f;
      },
      getFileById: (id) => {
        const f = files.get(id);
        if (!f) throw new Error('No item with the given ID could be found.');
        return f;
      },
    },
    Utilities: {
      getUuid: () => randomUUID(),
      base64Decode: (s) => Array.from(Buffer.from(String(s), 'base64')),
      base64Encode: (bytes) => Buffer.from(Uint8Array.from(bytes, b => b & 255)).toString('base64'),
      newBlob: (data, type, name) => new Blob(typeof data === 'string' ? Buffer.from(data) : data, type, name),
      formatDate,
    },
    PropertiesService: { getScriptProperties: () => properties },
    ContentService: {
      MimeType: { JSON: 'JSON', TEXT: 'TEXT' },
      createTextOutput: (content) => {
        const out = {
          content, mime: 'TEXT',
          setMimeType: (m) => { out.mime = m; return out; },
          getContent: () => out.content,
          getMimeType: () => out.mime,
        };
        return out;
      },
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {}, hasLock: () => true }),
    },
    ScriptApp: {
      getProjectTriggers: () => triggers.map(t => ({ getHandlerFunction: () => t.fn, getUniqueId: () => t.id })),
      newTrigger: (fn) => {
        const t = { id: newId(), fn };
        const clock = {
          onMonthDay: (d) => { t.day = d; return clock; },
          atHour: (h) => { t.hour = h; return clock; },
          inTimezone: (tz) => { t.timeZone = tz; return clock; },
          create: () => { triggers.push(t); return { getHandlerFunction: () => fn }; },
        };
        return { timeBased: () => clock };
      },
    },
    Session: { getScriptTimeZone: () => timeZone },
    Logger: { log: (...args) => { logs.push(args.map(String).join(' ')); } },
  };

  return {
    globals, files, folders, spreadsheets, triggers, logs,
    props: properties,
    spreadsheetByName: (name) => [...spreadsheets.values()].find(s => s.name === name && !s.file.trashed),
    file: (id) => files.get(id),
  };
}

/** Run Code.gs inside a sandbox wired to the fakes; returns its globals (setup, doPost, …). */
export function loadServer(gas, code) {
  const context = vm.createContext({ ...gas.globals, console });
  vm.runInContext(code, context, { filename: 'Code.gs' });
  return context;
}
