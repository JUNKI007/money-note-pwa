// ============================================================
// SetupValidation.gs - 스프레드시트 드롭다운 유효성 검사 설정
// Apps Script 편집기에서 setupSheetValidation() 을 한 번 실행하면 됩니다.
// ============================================================

function setupSheetValidation() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  _setupTransactionsValidation(ss);
  _setupCalendarValidation(ss);
  _setupLoansValidation(ss);
  _setupSavingGoalsValidation(ss);

  SpreadsheetApp.getUi().alert('드롭다운 설정 완료!\nTRANSACTIONS, CALENDAR_EVENTS, LOANS, SAVING_GOALS 시트에 적용되었습니다.');
}

/** TRANSACTIONS 시트 드롭다운 */
function _setupTransactionsValidation(ss) {
  var sheet = ss.getSheetByName('TRANSACTIONS');
  if (!sheet) return;

  var lastRow = Math.max(sheet.getLastRow(), 2);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var colMap = {};
  headers.forEach(function(h, i) { if (h) colMap[h] = i + 1; });

  // flow_type
  if (colMap['flow_type']) {
    var flowRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['플러스', '마이너스', '이동·저축·상환'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, colMap['flow_type'], lastRow - 1).setDataValidation(flowRule);
  }

  // category
  if (colMap['category']) {
    var allCategories = [
      '월급', '부수입', '용돈', '환급', '기타수입',
      '식비', '카페', '쇼핑', '교통', '의료', '문화', '교육', '공과금', 'OTT·구독', '기타소비',
      '적금', '비상금저축', '대출상환', '계좌이체',
      '급여', '보너스', '기타소득', '부모님지원', '국가지원금', '환급금', '이자수익', '환불'
    ];
    var catRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(allCategories, true)
      .setAllowInvalid(true) // 직접 입력도 허용
      .build();
    sheet.getRange(2, colMap['category'], lastRow - 1).setDataValidation(catRule);
  }

  // member
  if (colMap['member']) {
    var memberRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['남편', '아내', '공동'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, colMap['member'], lastRow - 1).setDataValidation(memberRule);
  }

  // transaction_type
  if (colMap['transaction_type']) {
    var typeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([
        '수입', '소비', '기타소득', '대출상환', '적금', '비상금저축', '계좌이동', '환불'
      ], true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(2, colMap['transaction_type'], lastRow - 1).setDataValidation(typeRule);
  }

  // is_deleted
  if (colMap['is_deleted']) {
    var boolRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE', 'FALSE'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, colMap['is_deleted'], lastRow - 1).setDataValidation(boolRule);
  }

  Logger.log('TRANSACTIONS 드롭다운 설정 완료');
}

/** CALENDAR_EVENTS 시트 드롭다운 */
function _setupCalendarValidation(ss) {
  var sheet = ss.getSheetByName('CALENDAR_EVENTS');
  if (!sheet) return;

  var lastRow = Math.max(sheet.getLastRow(), 2);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colMap = {};
  headers.forEach(function(h, i) { if (h) colMap[h] = i + 1; });

  // color
  if (colMap['color']) {
    var colorRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['#6F8FAF', '#2F9E73', '#D64545', '#F59E0B', '#8B5CF6', '#EC4899'], true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(2, colMap['color'], lastRow - 1).setDataValidation(colorRule);
  }

  Logger.log('CALENDAR_EVENTS 드롭다운 설정 완료');
}

/** LOANS 시트 드롭다운 */
function _setupLoansValidation(ss) {
  var sheet = ss.getSheetByName('LOANS');
  if (!sheet) return;

  var lastRow = Math.max(sheet.getLastRow(), 2);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colMap = {};
  headers.forEach(function(h, i) { if (h) colMap[h] = i + 1; });

  if (colMap['member']) {
    var memberRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['남편', '아내', '공동'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, colMap['member'], lastRow - 1).setDataValidation(memberRule);
  }

  if (colMap['is_active']) {
    var activeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE', 'FALSE'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, colMap['is_active'], lastRow - 1).setDataValidation(activeRule);
  }

  Logger.log('LOANS 드롭다운 설정 완료');
}

/** SAVING_GOALS 시트 드롭다운 */
function _setupSavingGoalsValidation(ss) {
  var sheet = ss.getSheetByName('SAVING_GOALS');
  if (!sheet) return;

  var lastRow = Math.max(sheet.getLastRow(), 2);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colMap = {};
  headers.forEach(function(h, i) { if (h) colMap[h] = i + 1; });

  if (colMap['owner']) {
    var ownerRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['남편', '아내', '공동'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, colMap['owner'], lastRow - 1).setDataValidation(ownerRule);
  }

  if (colMap['is_active']) {
    var activeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE', 'FALSE'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, colMap['is_active'], lastRow - 1).setDataValidation(activeRule);
  }

  Logger.log('SAVING_GOALS 드롭다운 설정 완료');
}
