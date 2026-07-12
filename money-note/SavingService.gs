// ============================================================
// SavingService.gs - 저축 목표 관리 (v2)
// 시트: SAVINGS
// 컬럼: id, name, has_target, target_amount, target_date,
//        monthly_amount, current_amount, show_on_home,
//        is_active, memo, created_at, updated_at
// ============================================================

const SAVINGS_SHEET = 'SAVINGS';
const SAVINGS_COLS = [
  'id', 'name', 'has_target', 'target_amount', 'target_date',
  'monthly_amount', 'current_amount', 'show_on_home',
  'is_active', 'memo', 'created_at', 'updated_at'
];

function _ensureSavingsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SAVINGS_SHEET)) {
    var s = ss.insertSheet(SAVINGS_SHEET);
    s.getRange(1, 1, 1, SAVINGS_COLS.length).setValues([SAVINGS_COLS]);
    s.setFrozenRows(1);
  }
}

function _parseBool(v) {
  return v === true || v === 'true' || v === 'TRUE' || v === 1;
}

/** 저축 목록 조회 (활성만) */
function getSavingGoals() {
  try {
    _ensureSavingsSheet();
    var rows = getAllRows(SAVINGS_SHEET).filter(function(r) {
      return _parseBool(r.is_active);
    });
    var result = rows.map(function(r) {
      return {
        id:             String(r.id || ''),
        name:           String(r.name || ''),
        has_target:     _parseBool(r.has_target),
        target_amount:  Number(r.target_amount) || 0,
        target_date:    String(r.target_date || ''),
        monthly_amount: Number(r.monthly_amount) || 0,
        current_amount: Number(r.current_amount) || 0,
        show_on_home:   _parseBool(r.show_on_home),
        is_active:      true,
        memo:           String(r.memo || '')
      };
    });
    return successResponse(result);
  } catch (e) {
    return errorResponse('저축 조회 오류: ' + e.message);
  }
}

/** 저축 목표 추가 */
function addSavingGoal(data) {
  try {
    if (!data.name) return errorResponse('name이 필요합니다.');
    _ensureSavingsSheet();
    var now = formatDateTime(new Date());
    var id = 'SV' + new Date().getTime();
    var row = {
      id:             id,
      name:           data.name,
      has_target:     _parseBool(data.has_target),
      target_amount:  Number(data.target_amount) || 0,
      target_date:    data.target_date || '',
      monthly_amount: Number(data.monthly_amount) || 0,
      current_amount: 0,
      show_on_home:   false,   // 기본 OFF
      is_active:      true,
      memo:           data.memo || '',
      created_at:     now,
      updated_at:     now
    };
    appendRow(SAVINGS_SHEET, row);
    return successResponse(row);
  } catch (e) {
    return errorResponse('저축 추가 오류: ' + e.message);
  }
}

/** 저축 수정 (current_amount, show_on_home, monthly_amount 등) */
function updateSavingGoal(data) {
  try {
    _ensureSavingsSheet();
    var id = data.id;
    if (!id) return errorResponse('id가 필요합니다.');
    var row = findRowBy(SAVINGS_SHEET, 'id', id);
    if (!row) return errorResponse('저축 목표를 찾을 수 없습니다: ' + id);

    var patch = { updated_at: formatDateTime(new Date()) };
    var numFields = ['target_amount', 'monthly_amount', 'current_amount'];
    var strFields = ['name', 'target_date', 'memo'];
    var boolFields = ['has_target', 'show_on_home', 'is_active'];

    numFields.forEach(function(k) {
      if (data[k] !== undefined) patch[k] = Number(data[k]);
    });
    strFields.forEach(function(k) {
      if (data[k] !== undefined) patch[k] = data[k];
    });
    boolFields.forEach(function(k) {
      if (data[k] !== undefined) patch[k] = _parseBool(data[k]);
    });

    updateRow(SAVINGS_SHEET, row._rowIndex, patch);
    return successResponse(Object.assign({}, row, patch, { id: id }));
  } catch (e) {
    return errorResponse('저축 수정 오류: ' + e.message);
  }
}

/** 저축 비활성화 */
function deactivateSavingGoal(data) {
  try {
    _ensureSavingsSheet();
    var id = (typeof data === 'string') ? data : data.id;
    if (!id) return errorResponse('id가 필요합니다.');
    var row = findRowBy(SAVINGS_SHEET, 'id', id);
    if (!row) return errorResponse('저축 목표를 찾을 수 없습니다.');
    updateRow(SAVINGS_SHEET, row._rowIndex, {
      is_active: false,
      updated_at: formatDateTime(new Date())
    });
    return successResponse({ id: id });
  } catch (e) {
    return errorResponse('저축 비활성화 오류: ' + e.message);
  }
}

/**
 * 매월 1일 자동 차감
 * monthly_amount > 0 인 활성 목표 → TRANSACTIONS(이동·저축·상환) + current_amount 증가
 * 중복 방지: [저축:id:YYYY-MM] 태그
 */
function applySavings(yearMonth) {
  try {
    if (!yearMonth) return errorResponse('yearMonth가 필요합니다.');
    var currentYM = getCurrentYearMonth();
    if (yearMonth > currentYM) return successResponse({ applied: 0, skipped: 'future' });

    _ensureSavingsSheet();
    var goals = getAllRows(SAVINGS_SHEET).filter(function(r) {
      return _parseBool(r.is_active) && Number(r.monthly_amount) > 0;
    });

    var existingTx = getAllRows('TRANSACTIONS');
    var appliedSet = {};
    existingTx.forEach(function(r) {
      var m = String(r.memo || '').match(/\[저축:([^:]+):([^\]]+)\]/);
      if (m && m[2] === yearMonth) appliedSet[m[1]] = true;
    });

    var applied = 0;
    goals.forEach(function(goal) {
      var id = String(goal.id || '');
      if (!id || appliedSet[id]) return;

      var monthly = Number(goal.monthly_amount);
      var tag = '[저축:' + id + ':' + yearMonth + ']';

      addTransaction({
        date:      yearMonth + '-01',
        member:    '공동',
        flow_type: '이동·저축·상환',
        category:  '적금',
        detail:    String(goal.name),
        amount:    monthly,
        memo:      tag
      });

      var cur = Number(goal.current_amount) || 0;
      updateRow(SAVINGS_SHEET, goal._rowIndex, {
        current_amount: cur + monthly,
        updated_at: formatDateTime(new Date())
      });

      applied++;
    });

    Logger.log('저축 자동 적용: ' + yearMonth + ' → ' + applied + '건');
    return successResponse({ applied: applied });
  } catch (e) {
    return errorResponse('저축 자동 적용 오류: ' + e.message);
  }
}
