// ============================================================
// SavingService.gs - 적금/저축 목표 관리
// - SAVING_GOALS 시트: id, name, target_amount, monthly_amount,
//   current_amount, target_date, is_active, memo, created_at, updated_at
// - monthly_amount > 0 이면 매월 1일 자동 차감 (applySavings)
// ============================================================

const SAVING_SHEET = 'SAVING_GOALS';
const SAVING_COLUMNS = [
  'id', 'name', 'target_amount', 'monthly_amount', 'current_amount',
  'target_date', 'is_active', 'memo', 'created_at', 'updated_at'
];

function _ensureSavingSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SAVING_SHEET)) {
    var s = ss.insertSheet(SAVING_SHEET);
    s.getRange(1, 1, 1, SAVING_COLUMNS.length).setValues([SAVING_COLUMNS]);
    s.setFrozenRows(1);
  }
}

/** 저축 목표 목록 조회 - 프론트 필드명으로 정규화 */
function getSavingGoals() {
  try {
    _ensureSavingSheet();
    var rows = getAllRows(SAVING_SHEET).filter(function(r) {
      return r.is_active === true || String(r.is_active).toUpperCase() === 'TRUE';
    });
    // 이전 스키마(goal_id/saved_amount) 호환 + 정규화
    var result = rows.map(function(r) {
      return {
        id:             r.id || r.goal_id || '',
        name:           r.name || '',
        target_amount:  Number(r.target_amount) || 0,
        monthly_amount: Number(r.monthly_amount) || 0,
        current_amount: Number(r.current_amount ?? r.saved_amount) || 0,
        target_date:    r.target_date || r.end_date || '',
        is_active:      true,
        memo:           r.memo || ''
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
    _ensureSavingSheet();
    var id = 'SG' + new Date().getTime();
    var now = formatDateTime(new Date());
    var row = {
      id:             id,
      name:           data.name,
      target_amount:  Number(data.target_amount) || 0,
      monthly_amount: Number(data.monthly_amount) || 0,
      current_amount: 0,
      target_date:    data.target_date || '',
      is_active:      true,
      memo:           data.memo || '',
      created_at:     now,
      updated_at:     now
    };
    appendRow(SAVING_SHEET, row);
    return successResponse(row);
  } catch (e) {
    return errorResponse('저축 추가 오류: ' + e.message);
  }
}

/** 저축 목표 수정 (current_amount 직접 지정 포함) */
function updateSavingGoal(data) {
  try {
    _ensureSavingSheet();
    var id = data.id || data.goal_id;
    var row = id ? findRowBy(SAVING_SHEET, 'id', id) : null;
    if (!row) row = id ? findRowBy(SAVING_SHEET, 'goal_id', id) : null;
    if (!row) return errorResponse('저축 목표를 찾을 수 없습니다.');

    var patch = { updated_at: formatDateTime(new Date()) };
    ['name', 'target_amount', 'monthly_amount', 'current_amount', 'target_date', 'memo'].forEach(function(k) {
      if (data[k] !== undefined) patch[k] = (k.indexOf('amount') !== -1) ? Number(data[k]) : data[k];
    });
    // 이전 스키마 saved_amount 호환
    if (data.saved_amount !== undefined) patch.current_amount = Number(data.saved_amount);

    updateRow(SAVING_SHEET, row._rowIndex, patch);
    return successResponse(Object.assign({}, row, patch));
  } catch (e) {
    return errorResponse('저축 수정 오류: ' + e.message);
  }
}

/** 저축 목표 비활성화 */
function deactivateSavingGoal(data) {
  try {
    _ensureSavingSheet();
    var id = (typeof data === 'string') ? data : (data.id || data.goal_id);
    var row = findRowBy(SAVING_SHEET, 'id', id) || findRowBy(SAVING_SHEET, 'goal_id', id);
    if (!row) return errorResponse('저축 목표를 찾을 수 없습니다.');
    updateRow(SAVING_SHEET, row._rowIndex, { is_active: false, updated_at: formatDateTime(new Date()) });
    return successResponse({ id: id });
  } catch (e) {
    return errorResponse('저축 비활성화 오류: ' + e.message);
  }
}

/**
 * 매월 1일 저축 자동 차감
 * - monthly_amount > 0 인 활성 목표에 대해
 *   TRANSACTIONS에 이동·저축·상환 거래 생성 + current_amount 업데이트
 * - 중복 방지: memo에 [저축:id:YYYY-MM] 태그
 */
function applySavings(yearMonth) {
  try {
    if (!yearMonth) return errorResponse('yearMonth가 필요합니다.');
    var currentYM = getCurrentYearMonth();
    if (yearMonth > currentYM) return successResponse({ applied: 0, skipped: 'future' });

    _ensureSavingSheet();
    var goals = getAllRows(SAVING_SHEET).filter(function(r) {
      return (r.is_active === true || String(r.is_active).toUpperCase() === 'TRUE')
        && Number(r.monthly_amount || 0) > 0;
    });

    // 이미 적용된 태그 확인
    var existingTx = getAllRows('TRANSACTIONS');
    var appliedSet = {};
    existingTx.forEach(function(r) {
      var m = String(r.memo || '').match(/\[저축:([^:]+):([^\]]+)\]/);
      if (m && m[2] === yearMonth) appliedSet[m[1]] = true;
    });

    var applied = 0;
    goals.forEach(function(goal) {
      var id = goal.id || goal.goal_id;
      if (appliedSet[id]) return;

      var monthly = Number(goal.monthly_amount);
      var tag = '[저축:' + id + ':' + yearMonth + ']';

      addTransaction({
        date:      yearMonth + '-01',
        member:    '공동',
        flow_type: '이동·저축·상환',
        category:  '적금',
        detail:    goal.name,
        amount:    monthly,
        memo:      tag
      });

      // current_amount 업데이트
      var curAmount = Number(goal.current_amount ?? goal.saved_amount) || 0;
      updateRow(SAVING_SHEET, goal._rowIndex, {
        current_amount: curAmount + monthly,
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
