# WR

A personal client tracker for iPhone. You can add clients with contact details, product photos, wood type, base type (wood, steel or hybrid), amount, payment status and delivery status. The app shows running totals and lets you search and filter clients.

It's an installable web app. All data stays **on your device** (in IndexedDB). There's no account and no server, and it works offline.

## Install on iPhone

1. Open the app's address in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Always open WR from the Home Screen icon. The Home Screen app keeps its own data, separate from Safari tabs.

## Back up your data

Your data lives only on your phone. If you remove WR from the Home Screen, its data is removed too. To back up:

- **Settings → Export backup → Save backup file**, then choose *Save to Files* (iCloud Drive is a good place).
- To restore, go to **Settings → Import backup** and pick the file. Clients in the backup replace their copies on the phone, and every other client is kept.

## Development

No build step and no dependencies. It's plain HTML, CSS and ES modules.

```bash
npm test                      # unit tests for model + backup logic (node --test)
python3 -m http.server 5180   # serve locally, then open http://localhost:5180
```

| Path | Purpose |
|---|---|
| `js/model.js` | Pure logic: validation, money parsing, totals, search/filter |
| `js/backup.js` | Backup file format (build/parse/validate) |
| `js/db.js` | IndexedDB storage (clients + photos stores) |
| `js/images.js` | Photo downscaling (1600px full, 400px thumbnail) |
| `js/views/*` | Screens: list, detail, form, settings |
| `sw.js` | Offline support (network-first, cache fallback) |

**Shipping an update:** bump `APP_VERSION` in `js/version.js` and `CACHE_VERSION` in `sw.js`. If you add a file, also add it to `SHELL` in `sw.js`.
