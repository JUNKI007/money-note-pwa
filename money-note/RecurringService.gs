// ============================================================
// RecurringService.gs - 정기 거래 관리
// ============================================================

const RECURRING_COLUMNS = [
  'recurring_id', 'flow_type', 'category', 'member', 'detail',
  'amount', 'memo', 'day_of_month', 'is_active', 'created_at'
];

/**
 * RECURRING_TRANSACTIONS 시트가 없으면 생성
 * @private
 */
function _ensureRecurringSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('RECURRING_TRANSACTIONS');
  if (!sheet) {
    sheet = ss.insertSheet('RECURRING_TRANSACTIONS');
    sheet.getRange(1, 1, 1, RECURRING_COLUMNS.length).setValues([RECURRING_COLUMNS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * 정기 거래 목록 반환 (is_active = true만)
 * @returns {{ success: boolean, data?: Array }}
 */
function getRecurrings() {
  try {
    _ensureRecurringSheet();
    var rows = getAllRows('RECURRING_TRANSACTIONS');
    var active = rows.filter(function(r) {
      return r.is_active === true || String(r.is_active).toUpperCase() === 'TRUE';
    });
    return successResponse(active);
  } catch (e) {
    return errorResponse('정기거래 조회 오류: ' + e.message);
  }
}

/**
 * 정기 거래 추가
 * @param {Object} data - { flow_type, category, member, detail, amount, memo, day_of_month }
 * @returns {{ success: boolean, data?: Object }}
 */
function addRecurring(data) {
  try {
    if (!data.category || !data.amount) return errorResponse('category, amount가 필요합니다.');

    _ensureRecurringSheet();
    var id = 'R' + new Date().getTime();
    var row = {
      recurring_id: id,
      flow_type:    data.flow_type || '마이너스',
      category:     data.category,
      member:       data.member || '공동',
      detail:       data.detail || '',
      amount:       Number(data.amount),
      memo:         data.memo || '',
      day_of_month: Number(data.day_of_month) || 1,
      is_active:    true,
      created_at:   formatDateTime(new Date())
    };
    addRow('RECURRING_TRANSACTIONS', row);
    return successResponse(row);
  } catch (e) {
    return errorResponse('정기거래 추가 오류: ' + e.message);
  }
}

/**
 * 정기 거래 비활성화 (soft delete)
 * @param {string} id
 * @returns {{ success: boolean, data?: Object }}
 */
function deleteRecurring(id) {
  try {
    if (!id) return errorResponse('id가 필요합니다.');
    _ensureRecurringSheet();
    var row = findRowBy('RECURRING_TRANSACTIONS', 'recurring_id', id);
    if (!row) return errorResponse('정기거래를 찾을 수 없습니다: ' + id);
    updateRow('RECURRING_TRANSACTIONS', row._rowIndex, { is_active: false });
    return successResponse({ recurring_id: id });
  } catch (e) {
    return errorResponse('정기거래 삭제 오류: ' + e.message);
  }
}

/**
 * 특정 년월에 정기 거래 일괄 적용 (TRANSACTIONS에 삽입)
 * 이미 적용된 경우 중복 방지 (memo에 [정기:id] 태그 사용)
 * @param {string} yearMonth - 'YYYY-MM'
 * @returns {{ success: boolean, data?: { applied: number } }}
 */
function applyRecurring(yearMonth) {
  try {
    if (!yearMonth) return errorResponse('yearMonth가 필요합니다.');

    _ensureRecurringSheet();
    var recurrings = getAllRows('RECURRING_TRANSACTIONS').filter(function(r) {
      return r.is_active === true || String(r.is_active).toUpperCase() === 'TRUE';
    });

    // 이미 적용된 정기거래 태그 확인
    var existingTx = getAllRows('TRANSACTIONS');
    var appliedIds = new Set(
      existingTx
        .filter(function(r) { return _dateToYM(r.date) === yearMonth; })
        .map(function(r) { return r.memo || ''; })
        .filter(function(m) { return m.indexOf('[정기:') >= 0; })
        .map(function(m) {
          var match = m.match(/\[정기:([^\]]+)\]/);
          return match ? match[1] : '';
        })
    );

    var applied = 0;
    recurrings.forEach(function(rec) {
      if (appliedIds.has(rec.recurring_id)) return;

      var day = Math.min(Number(rec.day_of_month) || 1, 28);
      var dateStr = yearMonth + '-' + (day < 10 ? '0' : '') + day;
      var memo = (rec.memo || '') + '[정기:' + rec.recurring_id + ']';

      addTransaction({
        date:      dateStr,
        member:    rec.member || '공동',
        flow_type: rec.flow_type,
        category:  rec.category,
        detail:    rec.detail || '',
        amount:    Number(rec.amount),
        memo:      memo
      });
      applied++;
    });

    return successResponse({ applied: applied });
  } catch (e) {
    return errorResponse('정기거래 적용 오류: ' + e.message);
  }
}
