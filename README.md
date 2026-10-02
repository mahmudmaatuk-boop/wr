# WR

The Wood for Life business app for iPhone. The Welcome page leads to nine pages:

| Page | What it keeps |
|---|---|
| Client info | Name, phone, e-mail, product photos, wood type, base type, payment status, paid amount |
| Monthly expenses | 24 expense categories per month, with a live total |
| Client info monthly | Monthly client entries (name, items, wood type, amount paid, total), one sheet tab per month |
| VAT | QTY × unit price, with VAT 11% and the total due calculated for you |
| Packing & Shipments | Items with dimensions, quantity, wood type, volume (calculated) and weight |
| WR-Documents | PDFs, photos, Word, Excel… stored privately in Google Drive |
| Raw Stockage | Raw wood: type, quantity, dimensions |
| Finished Stockage | Finished products: photos, wood type, dimensions, base |
| Backup | Copies every page into the "WR Backup" Google Sheet (also automatic on the 1st of each month) |

Data lives in **Google Sheets and Drive** in the Woodforlife2019@gmail.com account. Entries made without internet are kept on the phone and upload automatically later.

## Install on iPhone

1. Open https://mahmudmaatuk-boop.github.io/wr/ in **Safari**.
2. **Share** → **Add to Home Screen**.
3. Open WR from the icon, tap **⚙**, and connect it to Google Sheets ([setup guide](docs/SETUP-GOOGLE.md)).

## How it's built

There's no build step for the app: it's plain HTML, CSS and ES modules served by GitHub Pages. The Google side is one Apps Script file.

| Path | Purpose |
|---|---|
| `js/schema.js` | Every page's fields: the single source for both the app and the Google side |
| `js/pages.js` | Per-page look: icons, button text, calculations, list layout |
| `js/components/` | Generic form and saved-entries list |
| `js/views/` | Screens: welcome, page, expenses, documents, backup, settings |
| `js/sync.js`, `js/outbox.js`, `js/store.js` | Offline outbox and on-phone copy (IndexedDB `wr2`) |
| `js/api.js` | Talks to the Apps Script web app |
| `apps-script/src/server.js` | The Google Apps Script server |
| `apps-script/Code.gs` | Generated: schema + server in one file to paste into script.google.com |
| `dev/` | Fake Google services and a local server for testing |

```bash
npm test        # unit tests, plus the real server code run against fake Sheets and Drive
npm run build   # regenerate apps-script/Code.gs after changing schema.js or server.js
npm run dev     # http://localhost:5180 with a fake Google backend (script URL …/api, key "dev-key")
```

**Shipping a change:** bump the version in `js/version.js`, `sw.js` (`CACHE_VERSION`) and `apps-script/src/server.js` (`WR_VERSION`), then run `npm run build`. The tests check that these match and that every app file is in the offline list. If the server changed, paste the new `Code.gs` and deploy a new version (see the setup guide).
