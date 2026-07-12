// ============================================================
// InstallmentService.gs - 할부 관리 서비스
// 할부 추가 → 첫 회차 즉시 등록 → 이후 매달 1일 자동 적용
// ============================================================

const INST_SHEET = 'INSTALLMENTS';
const INST_PREFIX = 'I';

/**
 * 할부 추가 + 현재 달 1회차 TRANSACTIONS 자동 등록
 * @param {Object} data - {member, detail, category, total_amount, monthly_amount,
 *                         total_months, purchase_date?, memo?}
 */
function addInstallment(data) {
  try {
    var err = validateRequired(data, ['member', 'detail', 'total_amount', 'total_months']);
    if (err) return errorResponse(err);

    var totalAmount   = parseAmount(data.total_amount);
    var totalMonths   = parseInt(data.total_months, 10);
    if (totalAmount <= 0) return errorResponse('금액은 0보다 커야 합니다');
    if (totalMonths < 2)  return errorResponse('할부 개월수는 2 이상이어야 합니다');

    var monthlyAmount = data.monthly_amount
      ? parseAmount(data.monthly_amount)
      : Math.round(totalAmount / totalMonths);

    var now = formatDateTime(new Date());
    var id  = generateId(INST_PREFIX);
    var purchaseDate = data.purchase_date || formatDate(new Date());
    var currentYM    = purchaseDate.slice(0, 7); // YYYY-MM

    var inst = {
      installment_id: id,
      purchase_date:  purchaseDate,
      member:         data.member,
      detail:         data.detail,
      category:       data.category || '',
      total_amount:   totalAmount,
      monthly_amount: monthlyAmount,
      total_months:   totalMonths,
      paid_months:    0,         // applyInstallments 에서 1로 업데이트
      memo:           data.memo || '',
      is_active:      true,
      created_at:     now,
      updated_at:     now
    };

    _ensureInstSheet();
    SheetService.appendRow(INST_SHEET, inst);

    // 현재 달 1회차 즉시 적용
    _applyOneInstallment(inst, currentYM, 1);

    // paid_months = 1 로 업데이트
    _updatePaidMonths(id, 1);

    Logger.log('할부 추가: ' + id + ' | ' + data.detail + ' | ' + totalAmount + '원/' + totalMonths + '개월');
    return successResponse(inst);
  } catch (e) {
    return errorResponse('할부 저장 오류: ' + e.message);
  }
}

/**
 * 진행 중인 할부 목록 조회 (잔여 개월/금액 포함)
 */
function getInstallments() {
  try {
    _ensureInstSheet();
    var rows = SheetService.getAllRows(INST_SHEET);
    var result = rows
      .filter(function(r) { return r.is_active === true || r.is_active === 'TRUE'; })
      .map(function(r) {
        var paid   = parseInt(r.paid_months,  10) || 0;
        var total  = parseInt(r.total_months, 10) || 1;
        var monthly = parseAmount(r.monthly_amount);
        return {
          installment_id: r.installment_id,
          purchase_date:  r.purchase_date,
          member:         r.member,
          detail:         r.detail,
          category:       r.category || '',
          total_amount:   parseAmount(r.total_amount),
          monthly_amount: monthly,
          total_months:   total,
          paid_months:    paid,
          remaining_months: Math.max(0, total - paid),
          remaining_amount: Math.max(0, (total - paid) * monthly),
          memo:           r.memo || '',
          is_active:      true
        };
      });
    return successResponse(result);
  } catch (e) {
    return errorResponse('할부 조회 오류: ' + e.message);
  }
}

/**
 * 해당 달 미적용 할부 회차 TRANSACTIONS 에 등록
 * Prefetcher 마운트 시 또는 월 1일 트리거에서 호출
 */
function applyInstallments(yearMonth) {
  try {
    var currentYM = yearMonth || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');

    // 미래 달 적용 금지
    var todayYM = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
    if (currentYM > todayYM) return errorResponse('미래 달 할부 적용 불가');

    _ensureInstSheet();
    var rows = SheetService.getAllRows(INST_SHEET);
    var applied = 0;

    rows.forEach(function(r) {
      if (r.is_active !== true && r.is_active !== 'TRUE') return;

      var paid  = parseInt(r.paid_months,  10) || 0;
      var total = parseInt(r.total_months, 10) || 1;
      if (paid >= total) {
        // 완납 — 비활성화
        _deactivateInstallment(r.installment_id);
        return;
      }

      // 구매월 기준으로 몇 회차가 해당 yearMonth인지 계산
      var purchaseYM  = String(r.purchase_date).slice(0, 7);
      var monthOffset = _monthDiff(purchaseYM, currentYM); // 0=구매월, 1=다음달...
      if (monthOffset < 0) return; // 아직 안 된 달
      var seq = monthOffset + 1;    // 1-based 회차
      if (seq > total) return;      // 이미 완납 달

      // 중복 체크: 이미 이 회차가 TRANSACTIONS 에 있으면 스킵
      var tag = '[할부:' + r.installment_id + ':' + seq + '/' + total + ']';
      if (_installmentAlreadyApplied(tag)) return;

      _applyOneInstallment(r, currentYM, seq);
      _updatePaidMonths(r.installment_id, seq);
      applied++;
    });

    Logger.log('할부 적용 (' + currentYM + '): ' + applied + '건');
    return successResponse({ applied: applied, yearMonth: currentYM });
  } catch (e) {
    return errorResponse('할부 적용 오류: ' + e.message);
  }
}

/**
 * 할부 수동 비활성화 (중도 완납 등)
 */
function deactivateInstallment(id) {
  try {
    _deactivateInstallment(id);
    return successResponse({ installment_id: id });
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ── private ──

function _ensureInstSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(INST_SHEET)) {
    var s = ss.insertSheet(INST_SHEET);
    s.appendRow([
      'installment_id', 'purchase_date', 'member', 'detail', 'category',
      'total_amount', 'monthly_amount', 'total_months', 'paid_months',
      'memo', 'is_active', 'created_at', 'updated_at'
    ]);
  }
}

function _applyOneInstallment(inst, yearMonth, seq) {
  var total    = parseInt(inst.total_months, 10);
  var monthly  = parseAmount(inst.monthly_amount);
  var tag      = '[할부:' + inst.installment_id + ':' + seq + '/' + total + ']';
  var memo     = (inst.memo ? inst.memo + ' ' : '') + tag;

  addTransaction({
    date:     yearMonth + '-01',
    member:   inst.member,
    flow_type: '마이너스',
    category:  inst.category || '기타소비',
    detail:    inst.detail + ' (' + seq + '/' + total + '회)',
    amount:    monthly,
    memo:      memo
  });
}

function _installmentAlreadyApplied(tag) {
  var rows = SheetService.getAllRows('TRANSACTIONS');
  return rows.some(function(r) {
    return !r.is_deleted && String(r.memo || '').indexOf(tag) !== -1;
  });
}

function _monthDiff(fromYM, toYM) {
  var f = fromYM.split('-');
  var t = toYM.split('-');
  return (parseInt(t[0]) - parseInt(f[0])) * 12 + (parseInt(t[1]) - parseInt(f[1]));
}

function _updatePaidMonths(id, seq) {
  try {
    var row = findRowBy(INST_SHEET, 'installment_id', id);
    if (!row) return;
    var currentPaid = parseInt(row.paid_months, 10) || 0;
    if (seq > currentPaid) {
      updateRow(INST_SHEET, row._rowIndex, {
        paid_months: seq,
        updated_at: formatDateTime(new Date())
      });
    }
  } catch (_) {}
}

function _deactivateInstallment(id) {
  var row = findRowBy(INST_SHEET, 'installment_id', id);
  if (!row) return;
  updateRow(INST_SHEET, row._rowIndex, {
    is_active: false,
    updated_at: formatDateTime(new Date())
  });
}
