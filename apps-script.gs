/**
 * Google Apps Script template for interacting with a Google Sheet via Web App endpoints.
 *
 * Deploy as a Web App and set "Execute as" to "Me" and "Who has access" to "Anyone with the link"
 * (or a more restrictive choice that fits your use case).
 */
const CONFIG = {
  spreadsheetId: 'REPLACE_WITH_SPREADSHEET_ID',
  sheetName: 'Sheet1',
  allowOrigins: ['https://seu-dominio.com', 'http://localhost:3000'],
};

/**
 * Resolve the active sheet using the configuration above.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(CONFIG.sheetName);

  if (!sheet) {
    throw new Error('Sheet "' + CONFIG.sheetName + '" not found.');
  }

  return sheet;
}

/**
 * Common CORS handling for both GET and POST requests.
 * @param {GoogleAppsScript.Events.DoGet|GoogleAppsScript.Events.DoPost} e
 * @param {GoogleAppsScript.Content.TextOutput} output
 */
function applyCors(e, output) {
  const origin = (e && e.parameter && e.parameter.origin) || '';
  const allowed = CONFIG.allowOrigins;
  const allowOrigin = allowed.indexOf('*') !== -1
    ? '*'
    : (allowed.indexOf(origin) !== -1 ? origin : allowed[0] || '*');

  output.setHeader('Access-Control-Allow-Origin', allowOrigin);
  output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  output.setHeader('Access-Control-Max-Age', '3600');
}

/**
 * Handle preflight OPTIONS requests.
 * Apps Script treats unknown methods as errors, so we emulate OPTIONS via doPost with the
 * X-HTTP-Method-Override header.
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function maybeHandleOptions(e) {
  const headers = (e && e.postData && e.postData.type === 'application/json')
    ? JSON.parse(e.postData.contents || '{}').headers || {}
    : {};

  const methodOverride = headers['X-HTTP-Method-Override'] || headers['x-http-method-override'];

  if (methodOverride && methodOverride.toUpperCase() === 'OPTIONS') {
    const output = ContentService.createTextOutput('');
    applyCors(e, output);
    return output;
  }

  return null;
}

/**
 * GET endpoint: fetch rows from the sheet.
 * @param {GoogleAppsScript.Events.DoGet} e
 */
function doGet(e) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getDisplayValues();
  const [header, ...rows] = data;

  const json = rows.map(function(row) {
    return header.reduce(function(acc, key, index) {
      acc[key] = row[index];
      return acc;
    }, {});
  });

  const output = ContentService
    .createTextOutput(JSON.stringify({ data: json }))
    .setMimeType(ContentService.MimeType.JSON);

  applyCors(e, output);
  return output;
}

/**
 * POST endpoint: append a row to the sheet.
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  const maybeOptions = maybeHandleOptions(e);
  if (maybeOptions) {
    return maybeOptions;
  }

  if (!e || !e.postData || !e.postData.contents) {
    return buildErrorResponse(e, 400, 'Missing payload.');
  }

  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (error) {
    return buildErrorResponse(e, 400, 'Invalid JSON payload.');
  }

  const sheet = getSheet();
  const headers = sheet.getDataRange().getValues()[0];
  const row = headers.map(function(key) { return payload[key] || ''; });

  sheet.appendRow(row);

  const output = ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);

  applyCors(e, output);
  return output;
}

/**
 * Build a standardized error response with CORS headers applied.
 * @param {GoogleAppsScript.Events.DoGet|GoogleAppsScript.Events.DoPost} e
 * @param {number} status
 * @param {string} message
 */
function buildErrorResponse(e, status, message) {
  const output = ContentService
    .createTextOutput(JSON.stringify({ success: false, message: message }))
    .setMimeType(ContentService.MimeType.JSON);

  applyCors(e, output);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Status', status);
  return output;
}
