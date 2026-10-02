# Connect WR to Google Sheets

WR saves everything into Google Sheets and Google Drive in the **Woodforlife2019@gmail.com** account. A small script, the "WR server", runs inside that account. You set it up once; it takes about 10 minutes. A computer is easiest.

## 1. Create the script

1. Sign in to Google as **Woodforlife2019@gmail.com**. A private or incognito window keeps your other accounts out of the way.
2. Open **https://script.google.com** and click **New project**.
3. Click **Untitled project** at the top and rename it **WR server**.
4. Open [`apps-script/Code.gs`](../apps-script/Code.gs) and click **Raw**. Select all of it (⌘A), copy it (⌘C), and replace everything in the editor's `Code.gs` with it.
5. Click **Save** (the disk icon).

## 2. Run setup once

1. In the toolbar's function menu, choose **setup**, then click **Run**.
2. Google asks for permission. Click **Review permissions** and choose the Woodforlife account.
3. You'll see "Google hasn't verified this app". That's expected, because this is your own script. Click **Advanced**, then **Go to WR server (unsafe)**, then **Allow**.
4. When it finishes, the **Execution log** shows:
   - the **access key**: a line like `Access key (type it into WR → Settings): wr-…`. Copy that key.
   - the link to the new **WR** folder in Google Drive.

Setup creates, in Google Drive → **WR**:

| What | Notes |
|---|---|
| Client info, Monthly expenses, Client info monthly, VAT, Packing & Shipments, WR-Documents, Raw Stockage, Finished Stockage | One Google Sheet per page, with headers, number formats and dropdowns |
| WR Backup | Filled by the Backup page, and automatically on the 1st of every month |
| Photos, WR-Documents folders | Product photos (viewable by link) and private documents |

## 3. Publish it as a web app

1. Click **Deploy** → **New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me (Woodforlife2019@gmail.com)** and **Who has access: Anyone**.
4. Click **Deploy** and copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).

"Anyone" lets the app reach the script without a Google sign-in on every phone. Nobody can read or change anything without the access key.

## 4. Connect the app

On your iPhone, open WR from the Home Screen, tap **⚙** (Settings), paste the **Script URL** and the **Access key**, then tap **Save and test**. It should say **Connected**. Anything you saved before connecting uploads straight away.

Do this on every phone that uses WR. They all share the same sheets.

## Later

- **Updating the script** (when WR gets a new version): paste the new `Code.gs`, save, then **Deploy** → **Manage deployments** → ✏️ → **Version: New version** → **Deploy**. The URL stays the same, so phones need no changes.
- **New access key** (if the key was shared by mistake): run **resetKey** from the function menu, copy the new key from the log, and update it in Settings on each phone.
- **Restoring an older backup:** open **WR Backup** → **File** → **Version history**. Every backup is kept there.
- **Editing in Google Sheets** is fine: fix typos, sort, or add rows. Keep the header row as it is. Rows you add by hand get an ID automatically.
