// ============================================================
// ConfigService.gs - 앱 설정 및 스프레드시트 초기화
// ============================================================

// 시트별 헤더 정의 (전역 상수)
const SHEET_HEADERS = {
  CONFIG: ['key', 'value', 'description'],
  MEMBERS: ['member_id', 'name', 'role', 'color', 'is_active', 'created_at'],
  ACCOUNTS: [
    'account_id', 'account_name', 'owner', 'account_type',
    'initial_balance', 'include_in_total_asset', 'include_in_dashboard',
    'memo', 'created_at', 'updated_at'
  ],
  TRANSACTIONS: [
    'transaction_id', 'date', 'member', 'flow_type', 'transaction_type',
    'category', 'detail', 'amount', 'memo', 'created_at', 'updated_at', 'is_deleted'
  ],
  FIXED_EXPENSES: [
    'fixed_expense_id', 'name', 'amount', 'due_day', 'category',
    'payer', 'payment_method', 'is_active', 'memo', 'created_at', 'updated_at'
  ],
  LOANS: [
    'loan_id', 'loan_name', 'lender', 'borrower', 'original_principal',
    'current_balance', 'interest_rate', 'monthly_payment', 'payment_day',
    'start_date', 'maturity_date', 'is_active', 'memo', 'created_at', 'updated_at'
  ],
  SAVING_GOALS: [
    'goal_id', 'goal_name', 'goal_type', 'owner', 'target_amount',
    'current_amount', 'monthly_target', 'start_date', 'target_date',
    'is_active', 'memo', 'created_at', 'updated_at'
  ],
  BUDGETS: [
    'budget_id', 'year_month', 'member', 'category',
    'budget_amount', 'memo', 'created_at', 'updated_at'
  ],
  CALENDAR_EVENTS: [
    'event_id', 'google_event_id', 'title', 'start_date', 'start_time',
    'end_date', 'end_time', 'is_all_day', 'member_scope', 'category',
    'color', 'reminder_minutes', 'location', 'memo',
    'linked_transaction_type', 'linked_loan_id', 'linked_saving_goal_id',
    'linked_amount', 'created_by', 'created_at', 'updated_at', 'is_deleted'
  ],
  DASHBOARD_CACHE: ['metric_key', 'metric_name', 'metric_value', 'period', 'calculated_at', 'memo']
};

// 기본 CONFIG 행 정의
const DEFAULT_CONFIG_ROWS = [
  { key: 'APP_NAME',       value: '우리집 머니노트', description: '앱 이름' },
  { key: 'CURRENCY',       value: 'KRW',             description: '기본 통화' },
  { key: 'TIMEZONE',       value: 'Asia/Seoul',       description: '시간대' },
  { key: 'VERSION',        value: '1.0.0',            description: '버전' },
  { key: 'ALLOWED_EMAILS', value: '',                 description: '허용 이메일 목록 (쉼표 구분)' },
  { key: 'PIN_CODE',       value: '',                 description: '앱 PIN 코드 (6자리 숫자)' },
];

// 기본 MEMBERS 행 정의
const DEFAULT_MEMBER_ROWS = [
  { member_id: 'M001', name: '정준기', role: '본인',   color: '#6F8FAF' },
  { member_id: 'M002', name: '박정민', role: '배우자', color: '#C7B9FF' },
];

/**
 * 스프레드시트 초기화 메인 함수
 * Apps Script 에디터 상단 드롭다운에서 initializeSpreadsheet 선택 후 ▶ 실행
 * 이미 존재하는 시트/데이터는 건드리지 않음 (멱등성 보장)
 */
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Script Properties에 스프레드시트 ID 저장
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('스프레드시트 ID 저장: ' + ss.getId());

  // 시트 생성 및 헤더 설정
  Object.keys(SHEET_HEADERS).forEach(sheetName => {
    _ensureSheet(ss, sheetName, SHEET_HEADERS[sheetName]);
  });

  // 기본 데이터 삽입 (시트가 헤더만 있을 때)
  _insertDefaultConfig();
  _insertDefaultMembers();

  Logger.log('=== 초기화 완료 ===');

  // 완료 알림 (에디터에서 실행 시)
  try {
    SpreadsheetApp.getUi().alert('✅ 우리집 머니노트 초기화 완료!\n\n시트 ' + Object.keys(SHEET_HEADERS).length + '개가 준비되었습니다.');
  } catch(e) {
    // 웹앱 컨텍스트에서는 UI 사용 불가 — 무시
  }
}

/** 시트 생성 + 헤더 설정 (이미 헤더 있으면 건너뜀) */
function _ensureSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    Logger.log('  시트 생성: ' + sheetName);
  }

  // 1행 1열이 비어있으면 헤더 설정
  if (sheet.getRange(1, 1).getValue() === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // 헤더 스타일 (딥블루 배경, 흰 글씨, 굵게)
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#3F5F7F');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);

    // 열 너비 자동 조정
    sheet.autoResizeColumns(1, headers.length);
    Logger.log('  헤더 설정: ' + sheetName + ' (' + headers.length + '열)');
  } else {
    Logger.log('  이미 존재 (스킵): ' + sheetName);
  }
}

/** CONFIG 시트에 기본 데이터 삽입 */
function _insertDefaultConfig() {
  const sheet = getSheet('CONFIG');
  if (sheet.getLastRow() > 1) {
    Logger.log('  CONFIG 이미 데이터 있음 (스킵)');
    return;
  }
  DEFAULT_CONFIG_ROWS.forEach(row => {
    sheet.appendRow([row.key, row.value, row.description]);
  });

  // START_MONTH는 실행 시점의 현재 월로 설정
  sheet.appendRow(['START_MONTH', getCurrentYearMonth(), '앱 시작 월 (YYYY-MM)']);
  Logger.log('  CONFIG 기본 데이터 삽입 완료');
}

/** MEMBERS 시트에 기본 사용자 데이터 삽입 */
function _insertDefaultMembers() {
  const sheet = getSheet('MEMBERS');
  if (sheet.getLastRow() > 1) {
    Logger.log('  MEMBERS 이미 데이터 있음 (스킵)');
    return;
  }
  const now = formatDateTime(new Date());
  DEFAULT_MEMBER_ROWS.forEach(row => {
    sheet.appendRow([row.member_id, row.name, row.role, row.color, true, now]);
  });
  Logger.log('  MEMBERS 기본 데이터 삽입 완료');
}

/**
 * CONFIG 값 읽기
 * @param {string} key
 * @returns {string|null}
 */
function getConfig(key) {
  const row = findRowBy('CONFIG', 'key', key);
  return row ? String(row['value']) : null;
}

/**
 * CONFIG 값 쓰기 (없으면 새 행 추가, 있으면 업데이트)
 * @param {string} key
 * @param {string} value
 */
function setConfig(key, value) {
  const row = findRowBy('CONFIG', 'key', key);
  if (row) {
    updateCell('CONFIG', row._rowIndex, 'value', value);
  } else {
    appendRow('CONFIG', { key: key, value: value, description: '' });
  }
}

/** 앱 허용 이메일 목록 반환 */
function getAllowedEmails() {
  const val = getConfig('ALLOWED_EMAILS');
  if (!val) return [];
  return val.split(',').map(e => e.trim()).filter(e => e.length > 0);
}

/** PIN 코드 반환 */
function getPinCode() {
  return getConfig('PIN_CODE') || '';
}
