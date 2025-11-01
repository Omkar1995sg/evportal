/**
 * Google Apps Script: Append registration rows to the 'Registrations' sheet.
 * Deploy as Web App (Execute as: Me; Who has access: Anyone).
 *
 * Replace these constants before deploying.
 */
const SPREADSHEET_ID = "PASTE_YOUR_SPREADSHEET_ID_HERE"; // e.g., 1AbC... from the sheet URL
const REGISTRATIONS_SHEET_NAME = "Registrations";

function doOptions(e) {
  return ContentService.createTextOutput("ok")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function doPost(e) {
  try {
    const input = JSON.parse(e.postData.contents || "{}");

    const required = ["eventName","eventDate","studentName","email","contact","class","year"];
    for (const k of required) {
      if (!input[k]) return _json({ ok:false, error:`Missing field: ${k}` }, 400);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(REGISTRATIONS_SHEET_NAME) || ss.insertSheet(REGISTRATIONS_SHEET_NAME);

    // Ensure header row exists
    const header = ["Event Name","Event Date","Student Name","Email","Contact","Class","Year"];
    const firstRow = sheet.getRange(1,1,1,header.length).getValues()[0];
    const hasHeader = firstRow.join("") !== "";
    if (!hasHeader) sheet.getRange(1,1,1,header.length).setValues([header]);

    // Append row
    const row = [
      input.eventName,
      input.eventDate,     // keep as ISO string; Sheets will render as date
      input.studentName,
      input.email,
      input.contact,
      input.class,
      input.year
    ];
    sheet.appendRow(row);

    return _json({ ok:true });
  } catch (err) {
    return _json({ ok:false, error:String(err) }, 500);
  }
}

function _json(obj, code) {
  const out = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  const resp = out;
  resp.setHeader("Access-Control-Allow-Origin", "*");
  resp.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  resp.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (code) {
    // Apps Script doesn't allow setting status code directly in ContentService.
    // Returning body with an 'ok:false' is sufficient for the frontend to detect errors.
  }
  return resp;
}
