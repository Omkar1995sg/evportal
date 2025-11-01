# College Event Portal (Google Sheets)

A single-page website that reads **Events** and **Registrations** from Google Sheets (via *Publish to CSV*) and lets students **register** for events. Registrations are appended to the Google Sheet via a **Google Apps Script Web App**.

## Files
- `index.html`
- `styles.css`
- `script.js`
- `styles.css` – Frontend (HTML/CSS/JS). Update three placeholders at the top of the script block.
- `apps_script.gs` – Google Apps Script that appends a row to the `Registrations` sheet.
- `README.md` – This guide.

---

## 1) Create your Google Sheet
Use a single spreadsheet with two tabs (sheets):

### Sheet: `Events`
Required columns (row 1 as headers):
```
Event Name | Date | Location | Time | Speaker
```

### Sheet: `Registrations`
Required columns (row 1 as headers):
```
Event Name | Event Date | Student Name | Email | Contact | Class | Year
```

> **Date format**: Any standard format is ok (e.g., `2025-11-10` or `10/11/2025`). The site will display the **actual date** nicely.

---

## 2) Publish each sheet as CSV
In Google Sheets:
1. Open your spreadsheet.
2. Go to **File → Share → Publish to web**.
3. In the dialog:
   - Choose **Link**.
   - Set **Sheet** = `Events`, **Format** = **CSV** → Click **Publish**.
   - Copy the URL (this is your `EVENTS_CSV_URL`).
4. Repeat for **Sheet** = `Registrations` → copy the CSV link (this is your `REGISTRATIONS_CSV_URL`).

> If you prefer not to publish the Registrations sheet publicly, you can skip publishing it and leave `REGISTRATIONS_CSV_URL` blank. Charts that depend on registrations will then show empty data until you publish, or you can restrict access using Google Sheets API (not covered here).

---

## 3) Create the Apps Script (backend)
1. In Google Sheets, click **Extensions → Apps Script**.
2. Create a script with the code from `apps_script.gs` (replace the placeholders at the top).
3. Click **Deploy → New deployment**.
   - **Type**: Web app
   - **Who has access**: *Anyone* (or *Anyone with the link*)
   - **Execute as**: *Me*
4. Copy the **Web app URL** and paste it in `index.html` as `REGISTER_ENDPOINT`.

> You can restrict access by domain or use a token if needed. The simple version here is open for demo/testing.

---

## 4) Configure the frontend
Open `index.html` and replace the remaining placeholder (REGISTER_ENDPOINT); CSV URLs already filled:
```js
const EVENTS_CSV_URL = "PASTE_EVENTS_PUBLISHED_CSV_URL_HERE";
const REGISTRATIONS_CSV_URL = "PASTE_REGISTRATIONS_PUBLISHED_CSV_URL_HERE";
const REGISTER_ENDPOINT = "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE";
```

---

## 5) Test locally
1. Just open `index.html` in a modern browser.
2. You should see event cards. Click **Register** on an upcoming event, fill the form, and submit.
3. Check the `Registrations` Google Sheet – a new row should be appended.
4. Refresh the page; charts will update (CSV publish may take a short moment to reflect changes).

> If CORS errors occur, confirm your Apps Script Web App is deployed with **Who has access: Anyone** and it returns CORS headers (already included).

---

## 6) Deploy on GitHub Pages (optional)
1. Create a GitHub repo and commit `index.html`.
2. In repo settings → **Pages** → set **Branch: main** and **/ (root)**.
3. Visit the Pages URL to see your site online.

---

## 7) Columns & Validations
- **Events sheet** must have exact headers: `Event Name`, `Date`, `Location`, `Time`, `Speaker`.
- **Registrations sheet** headers: `Event Name`, `Event Date`, `Student Name`, `Email`, `Contact`, `Class`, `Year`.
- The form enforces email format and a 10-digit phone pattern. Adjust as needed.

---

## 8) Notes / Options
- For private data, avoid publishing CSV and instead use **Google Sheets API** on a small server (Node/Cloud Run). The current approach is pure-static + Apps Script write.
- If you rename sheets, update `apps_script.gs` constants.
- If you want to prevent duplicate registrations, add your logic in Apps Script before `appendRow`.

---

## Done!
Open `index.html`, replace the three placeholders, deploy your Apps Script, and you’re live 🎉
