// ============================================================
// AllowanceService.gs - 개인 용돈 관리 (집안 재정과 완전 분리)
// - ALLOWANCE 시트에 입금/지출 기록
// - 잔액은 누적 합산 (이월 자동 처리)
// - 고정지출 용돈 적용 시 자동으로 입금 생성됨
// ============================================================

const ALLOWANCE_SHEET = 'ALLOWANCE';
const ALLOWANCE_COLUMNS = [
  'id', 'date', 'member', 'type', 'amount', 'detail', 'memo', 'is_deleted', 'created_at'
];

function _ensureAllowanceSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ALLOWANCE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ALLOWANCE_SHEET);
    sheet.getRange(1, 1, 1, ALLOWANCE_COLUMNS.length).setValues([ALLOWANCE_COLUMNS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * 용돈 내역 조회
 * @param {Object} p - { member?, yearMonth? }
 */
function getAllowanceEntries(p) {
  try {
    _ensureAllowanceSheet();
    var rows = getAllRows(ALLOWANCE_SHEET).filter(function(r) {
      return r.id && r.is_deleted !== true && String(r.is_deleted).toUpperCase() !== 'TRUE';
    });
    if (p && p.member) {
      rows = rows.filter(function(r) { return r.member === p.member; });
    }
    if (p && p.yearMonth) {
      rows = rows.filter(function(r) { return formatDate(r.date).slice(0, 7) === p.yearMonth; });
    }
    // date 정규화 + amount 숫자 변환 (Date 객체 → 'YYYY-MM-DD' 문자열)
    rows = rows.map(function(r) {
      return Object.assign({}, r, { date: formatDate(r.date), amount: Number(r.amount) || 0 });
    });
    return successResponse(rows);
  } catch (e) {
    return errorResponse('용돈 조회 오류: ' + e.message);
  }
}

/**
 * 용돈 내역 추가 (입금 또는 지출)
 * @param {Object} data - { date, member, type('입금'|'지출'), amount, detail?, memo? }
 */
function addAllowanceEntry(data) {
  try {
    if (!data.member || !data.amount || !data.type) {
      return errorResponse('member, amount, type이 필요합니다.');
    }
    if (data.type !== '입금' && data.type !== '지출') {
      return errorResponse("type은 '입금' 또는 '지출'이어야 합니다.");
    }

    _ensureAllowanceSheet();
    var id = 'AW' + new Date().getTime();
    var row = {
      id:         id,
      date:       data.date || formatDate(new Date()),
      member:     data.member,
      type:       data.type,
      amount:     Number(data.amount),
      detail:     data.detail || '',
      memo:       data.memo || '',
      is_deleted: false,
      created_at: formatDateTime(new Date())
    };
    appendRow(ALLOWANCE_SHEET, row);
    return successResponse(row);
  } catch (e) {
    return errorResponse('용돈 저장 오류: ' + e.message);
  }
}

/**
 * 용돈 내역 삭제 (soft delete)
 * @param {string} id
 */
function deleteAllowanceEntry(id) {
  try {
    if (!id) return errorResponse('id가 필요합니다.');
    _ensureAllowanceSheet();
    var row = findRowBy(ALLOWANCE_SHEET, 'id', id);
    if (!row) return errorResponse('항목을 찾을 수 없습니다: ' + id);
    updateRow(ALLOWANCE_SHEET, row._rowIndex, { is_deleted: true });
    return successResponse({ id: id });
  } catch (e) {
    return errorResponse('용돈 삭제 오류: ' + e.message);
  }
}

/**
 * 고정지출 용돈 적용 시 ALLOWANCE 입금 생성 (중복 방지)
 * FixedExpenseService._applyOneFixedExpense에서 category='용돈'일 때 호출
 * @param {Object} fx - 고정지출 항목
 * @param {string} yearMonth - 'YYYY-MM'
 */
function _applyAllowanceDeposit(fx, yearMonth) {
  try {
    _ensureAllowanceSheet();
    var tag = '[고정:' + fx.fixed_id + ':' + yearMonth + ']';

    // 중복 체크
    var existing = getAllRows(ALLOWANCE_SHEET).some(function(r) {
      return String(r.memo || '').indexOf(tag) !== -1 &&
             r.is_deleted !== true && String(r.is_deleted).toUpperCase() !== 'TRUE';
    });
    if (existing) return;

    appendRow(ALLOWANCE_SHEET, {
      id:         'AW' + new Date().getTime(),
      date:       yearMonth + '-01',
      member:     fx.member,
      type:       '입금',
      amount:     Number(fx.amount),
      detail:     fx.name || '용돈',
      memo:       tag,
      is_deleted: false,
      created_at: formatDateTime(new Date())
    });
  } catch (e) {
    Logger.log('ALLOWANCE 입금 생성 오류: ' + e.message);
  }
}
