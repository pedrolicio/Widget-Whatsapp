/**
 * Google Apps Script minimal webhook for the WhatsApp Lead Widget.
 *
 * Preencha o objeto CONFIG com as informações da sua planilha e publique o
 * script como um App da Web. O widget envia todos os dados através de
 * `e.parameter`, portanto não há necessidade de lidar com JSON ou CORS aqui.
 */
const CONFIG = {
  /**
   * ID da planilha (encontrado na URL do Google Sheets).
   * @type {string}
   */
  spreadsheetId: 'REPLACE_WITH_SPREADSHEET_ID',

  /**
   * Nome da aba onde os leads serão registrados.
   * @type {string}
   */
  sheetName: 'Leads',

  /**
   * Ordem esperada das colunas na planilha.
   * Ajuste conforme o cabeçalho configurado no Sheets.
   * @type {Array<{ key?: string, value?: (params: GoogleAppsScript.Events.DoPost['parameter']) => any, transform?: (value: any, params: GoogleAppsScript.Events.DoPost['parameter']) => any }>} */
  columns: [
    { key: 'nome' },
    { key: 'email' },
    { key: 'telefone' },
    {
      key: 'consent',
      transform: function (value) {
        if (value === 'Sim' || value === 'true' || value === true) {
          return true;
        }
        if (value === 'Não' || value === 'false' || value === false) {
          return false;
        }
        return value;
      },
    },
    { key: 'timestamp' },
    { key: 'userAgent' },
    { key: 'gclid' },
    { key: 'fbclid' },
    { key: 'gbraid' },
    { key: 'wbraid' },
    { key: 'utm_source' },
    { key: 'utm_medium' },
    { key: 'utm_campaign' },
    { key: 'referrer' },
    { key: 'page_url' },
    { key: 'userIP' },
  ],
};

/**
 * Obtém a planilha configurada acima, disparando erro quando não encontrada.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet() {
  var spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = spreadsheet.getSheetByName(CONFIG.sheetName);

  if (!sheet) {
    throw new Error('Aba "' + CONFIG.sheetName + '" não encontrada.');
  }

  return sheet;
}

/**
 * Retorna a lista esperada de cabeçalhos com base na configuração das colunas.
 * @returns {string[]}
 */
function getExpectedHeaders() {
  return CONFIG.columns.map(function (column) {
    if (column.header) {
      return column.header;
    }

    if (column.key) {
      return column.key;
    }

    return '';
  });
}

/**
 * Garante que a primeira linha da planilha contenha os cabeçalhos esperados.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function ensureHeader(sheet) {
  var expectedHeaders = getExpectedHeaders();

  if (!expectedHeaders.length) {
    return;
  }

  var range = sheet.getRange(1, 1, 1, expectedHeaders.length);
  var currentValues = range.getValues()[0];
  var isBlank = true;

  for (var i = 0; i < currentValues.length; i++) {
    if (currentValues[i] !== '' && currentValues[i] !== null) {
      isBlank = false;
      break;
    }
  }

  var needsUpdate = isBlank;

  if (!needsUpdate) {
    for (var j = 0; j < expectedHeaders.length; j++) {
      var existingValue = currentValues[j] != null ? String(currentValues[j]) : '';
      var expectedValue = expectedHeaders[j] != null ? String(expectedHeaders[j]) : '';

      if (existingValue !== expectedValue) {
        needsUpdate = true;
        break;
      }
    }
  }

  if (needsUpdate) {
    range.setValues([expectedHeaders]);
  }
}

/**
 * Manipula requisições POST vindas do widget.
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  try {
    if (!e || !e.parameter) {
      throw new Error('Requisição inválida: parâmetros ausentes.');
    }

    var params = e.parameter;
    var sheet = getSheet();
    ensureHeader(sheet);
    var row = CONFIG.columns.map(function (column) {
      if (typeof column.value === 'function') {
        return column.value(params);
      }

      var rawValue = column.key ? params[column.key] : '';
      if (typeof column.transform === 'function') {
        return column.transform(rawValue, params);
      }

      return rawValue !== undefined ? rawValue : '';
    });

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
