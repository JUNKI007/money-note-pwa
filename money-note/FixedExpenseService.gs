// ============================================================
// FixedExpenseService.gs - 고정지출 관리
// - 추가 시 해당 월 즉시 적용
// - 앱 로드 시 현재 월 자동 적용 (미래 달 적용 금지)
// - 중복 적용 방지: 메모에 [고정:fixed_id] 태그 사용
// ============================================================

const FIXED_COLUMNS = [
  'fixed_id', 'name', 'flow_type', 'category', 'member',
  'amount', 'memo', 'start_yearMonth', 'is_active', 'created_at', 'updated_at'
];

function _ensureFixedSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('FIXED_EXPENSES');
  if (!sheet) {
    sheet = ss.insertSheet('FIXED_EXPENSES');
    sheet.getRange(1, 1, 1, FIXED_COLUMNS.length).setValues([FIXED_COLUMNS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** 고정지출 목록 조회 (is_active = true) */
function getFixedExpenses() {
  try {
    _ensureFixedSheet();
    var rows = getAllRows('FIXED_EXPENSES');
    var active = rows.filter(function(r) {
      return r.is_active === true || String(r.is_active).toUpperCase() === 'TRUE';
    });
    return successResponse(active);
  } catch (e) {
    return errorResponse('고정지출 조회 오류: ' + e.message);
  }
}

/** 고정지출 추가 + 추가한 달 즉시 적용 */
function addFixedExpense(data) {
  try {
    if (!data.category || !data.amount) return errorResponse('category, amount가 필요합니다.');

    _ensureFixedSheet();
    var id = 'FX' + new Date().getTime();
    var currentYM = getCurrentYearMonth();
    var startYM = data.start_yearMonth || currentYM;

    var row = {
      fixed_id:       id,
      name:           data.name || data.category,
      flow_type:      data.flow_type || '마이너스',
      category:       data.category,
      member:         data.member || '공동',
      amount:         Number(data.amount),
      memo:           data.memo || '',
      start_yearMonth: startYM,
      is_active:      true,
      created_at:     formatDateTime(new Date()),
      updated_at:     formatDateTime(new Date())
    };
    appendRow('FIXED_EXPENSES', row);

    // 추가한 달 즉시 적용 (오늘이 해당 달이므로 미래 아님)
    _applyOneFixedExpense(row, startYM);

    Logger.log('고정지출 추가: ' + id);
    return successResponse(row);
  } catch (e) {
    return errorResponse('고정지출 추가 오류: ' + e.message);
  }
}

/** 고정지출 수정 */
function updateFixedExpense(id, updates) {
  try {
    if (!id) return errorResponse('fixed_id가 필요합니다.');
    _ensureFixedSheet();
    var row = findRowBy('FIXED_EXPENSES', 'fixed_id', id);
    if (!row) return errorResponse('고정지출을 찾을 수 없습니다: ' + id);

    var allowed = ['name', 'flow_type', 'category', 'member', 'amount', 'memo'];
    var patch = {};
    allowed.forEach(function(k) {
      if (updates[k] !== undefined) patch[k] = updates[k];
    });
    patch.updated_at = formatDateTime(new Date());

    updateRow('FIXED_EXPENSES', row._rowIndex, patch);
    Logger.log('고정지출 수정: ' + id);
    return successResponse(Object.assign({}, row, patch));
  } catch (e) {
    return errorResponse('고정지출 수정 오류: ' + e.message);
  }
}

/** 고정지출 비활성화 (soft delete) */
function deleteFixedExpense(id) {
  try {
    if (!id) return errorResponse('fixed_id가 필요합니다.');
    _ensureFixedSheet();
    var row = findRowBy('FIXED_EXPENSES', 'fixed_id', id);
    if (!row) return errorResponse('고정지출을 찾을 수 없습니다: ' + id);
    updateRow('FIXED_EXPENSES', row._rowIndex, {
      is_active: false,
      updated_at: formatDateTime(new Date())
    });
    return successResponse({ fixed_id: id });
  } catch (e) {
    return errorResponse('고정지출 삭제 오류: ' + e.message);
  }
}

/**
 * 특정 달에 활성 고정지출 일괄 적용
 * - yearMonth <= 오늘 달 이어야 함 (미래 달 적용 금지)
 * - 이미 적용된 항목은 스킵
 * @param {string} yearMonth 'YYYY-MM'
 */
function applyFixedExpenses(yearMonth) {
  try {
    if (!yearMonth) return errorResponse('yearMonth가 필요합니다.');

    var currentYM = getCurrentYearMonth();
    // 미래 달 적용 금지
    if (yearMonth > currentYM) {
      return successResponse({ applied: 0, skipped: 'future month' });
    }

    _ensureFixedSheet();
    var fixedList = getAllRows('FIXED_EXPENSES').filter(function(r) {
      return (r.is_active === true || String(r.is_active).toUpperCase() === 'TRUE')
        && r.start_yearMonth <= yearMonth;
    });

    // 이미 적용된 fixed_id 목록 (해당 월 거래의 메모 태그 확인)
    var existingTx = getAllRows('TRANSACTIONS');
    var appliedSet = {};
    existingTx
      .filter(function(r) { return _dateToYM(r.date) === yearMonth; })
      .forEach(function(r) {
        var m = String(r.memo || '').match(/\[고정:([^\]]+)\]/);
        if (m) appliedSet[m[1]] = true;
      });

    var applied = 0;
    fixedList.forEach(function(fx) {
      if (appliedSet[fx.fixed_id]) return; // 중복 스킵
      _applyOneFixedExpense(fx, yearMonth);
      applied++;
    });

    Logger.log('고정지출 적용: ' + yearMonth + ' → ' + applied + '건');
    return successResponse({ applied: applied });
  } catch (e) {
    return errorResponse('고정지출 적용 오류: ' + e.message);
  }
}

/** 단일 고정지출을 특정 달 1일에 TRANSACTIONS에 삽입 @private */
function _applyOneFixedExpense(fx, yearMonth) {
  var memo = (fx.memo || '') + '[고정:' + fx.fixed_id + ']';
  addTransaction({
    date:      yearMonth + '-01',
    member:    fx.member || '공동',
    flow_type: fx.flow_type,
    category:  fx.category,
    detail:    fx.name || fx.category,
    amount:    Number(fx.amount),
    memo:      memo
  });
  // 용돈 카테고리일 때 ALLOWANCE 입금 자동 생성
  if (fx.category === '용돈' && fx.member && fx.member !== '공동') {
    _applyAllowanceDeposit(fx, yearMonth);
  }
}

/**
 * GAS 시간 기반 트리거용 - 매월 1일 자동 실행
 * Apps Script > 트리거에서 월 단위 트리거로 등록하면 완전 자동화 가능
 */
function applyFixedExpensesForCurrentMonth() {
  return applyFixedExpenses(getCurrentYearMonth());
}
