// ============================================================
// SheetService.gs - 헤더 기반 시트 읽기/쓰기 공통 레이어
// 열 번호에 의존하지 않고 헤더명으로 열을 찾아 처리
// ============================================================

/** 스프레드시트 객체 반환 (Script Properties에 저장된 ID 사용) */
function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('SPREADSHEET_ID 미설정. initializeSpreadsheet()를 먼저 실행하세요.');
  }
  return SpreadsheetApp.openById(id);
}

/** 시트 이름으로 시트 객체 반환. 없으면 에러. */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
  return sheet;
}

/**
 * 시트의 1행(헤더)을 읽어 { 컬럼명: 0-based인덱스 } 맵 반환
 * 빈 헤더 셀은 무시
 */
function getHeaderMap(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return {};
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  headers.forEach((h, i) => {
    if (h) map[String(h).trim()] = i;
  });
  return map;
}

/**
 * 시트의 모든 데이터를 { 헤더: 값 } 객체 배열로 반환
 * - is_deleted = true 인 행은 기본 제외
 * - includeDeleted = true 이면 포함
 * - 각 객체에 _rowIndex (1-based 실제 행 번호) 포함
 */
function getAllRows(sheetName, includeDeleted) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return data
    .map((row, i) => {
      const obj = { _rowIndex: i + 2 }; // 실제 시트 행 번호 (헤더=1, 첫데이터=2)
      headers.forEach((h, j) => {
        if (h) obj[String(h).trim()] = row[j];
      });
      return obj;
    })
    .filter(row => {
      if (includeDeleted) return true;
      // is_deleted가 TRUE / true / 'TRUE' / 'true' 이면 제외
      const d = row['is_deleted'];
      return d !== true && d !== 'TRUE' && d !== 'true';
    });
}

/**
 * 시트에 객체 1행 추가
 * 헤더 순서에 맞게 값을 배열로 변환하여 appendRow
 * 헤더에 없는 키는 무시, 헤더에 있지만 data에 없는 값은 빈 문자열
 */
function appendRow(sheetName, data) {
  const sheet = getSheet(sheetName);
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const row = headers.map(h => {
    if (!h) return '';
    const val = data[String(h).trim()];
    return (val !== undefined && val !== null) ? val : '';
  });
  sheet.appendRow(row);
}

/**
 * 특정 행(rowIndex)의 특정 컬럼(colName) 값 업데이트
 * rowIndex는 1-based 실제 시트 행 번호
 */
function updateCell(sheetName, rowIndex, colName, value) {
  const sheet = getSheet(sheetName);
  const headerMap = getHeaderMap(sheet);
  if (!(colName in headerMap)) {
    throw new Error('컬럼을 찾을 수 없습니다: ' + colName + ' (시트: ' + sheetName + ')');
  }
  const colIdx = headerMap[colName] + 1; // 1-based
  sheet.getRange(rowIndex, colIdx).setValue(value);
}

/**
 * 특정 행(rowIndex)을 객체로 부분 업데이트 (헤더 기반)
 * rowIndex는 1-based 실제 시트 행 번호
 */
function updateRow(sheetName, rowIndex, data) {
  const sheet = getSheet(sheetName);
  const headerMap = getHeaderMap(sheet);
  Object.keys(data).forEach(key => {
    if (key in headerMap) {
      const colIdx = headerMap[key] + 1;
      sheet.getRange(rowIndex, colIdx).setValue(data[key]);
    }
  });
}

/**
 * 단일 컬럼 값으로 첫 번째 매칭 행 반환 (삭제된 행 포함 검색)
 * @returns {Object|null}
 */
function findRowBy(sheetName, colName, value) {
  const rows = getAllRows(sheetName, true); // 삭제된 행 포함
  return rows.find(row => String(row[colName]) === String(value)) || null;
}
