// ============================================================
// DashboardService.gs - 대시보드 데이터 계산
// ============================================================

// 수입으로 집계하는 transaction_type 목록
const INCOME_TYPES = ['수입', '기타소득'];

// 소비로 집계하는 transaction_type 목록
// 적금/대출상환/비상금저축/계좌이동은 여기 포함하지 않음 (자산이동으로 분리)
const EXPENSE_TYPES = ['소비'];

// 자산이동/부채감소로 집계하는 transaction_type 목록
const ASSET_MOVE_TYPES = ['대출상환', '적금', '비상금저축', '계좌이동', '환불'];

/**
 * 홈 대시보드 전체 데이터 반환
 *
 * @param {string} yearMonth - 'YYYY-MM' 형식. 생략 시 이번 달.
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function getDashboardData(yearMonth) {
  try {
    const ym = yearMonth || getCurrentYearMonth();

    // TRANSACTIONS 시트 전체 로드 (삭제 제외)
    const allTransactions = getAllRows('TRANSACTIONS');
    const thisMonthTx = allTransactions.filter(r => _dateToYM(r.date) === ym);

    // 이번 달 수입/소비/자산이동
    const income    = _sumByTypes(thisMonthTx, INCOME_TYPES);
    const expense   = _sumByTypes(thisMonthTx, EXPENSE_TYPES);
    const assetMove = _sumByTypes(thisMonthTx, ASSET_MOVE_TYPES);
    const netSaving = income - expense;

    // 주간 소비 비교
    const weekRange     = getCurrentWeekRange();
    const lastWeekRange = getLastWeekRange();
    const thisWeekExpense = _sumByTypesInRange(allTransactions, EXPENSE_TYPES, weekRange.start, weekRange.end);
    const lastWeekExpense = _sumByTypesInRange(allTransactions, EXPENSE_TYPES, lastWeekRange.start, lastWeekRange.end);

    // 대출 잔액 합계
    const totalLoanBalance = _getTotalLoanBalance();

    // 저축 목표 현재 금액 합계
    const totalSaved = _getTotalSaved();

    // 카테고리별 소비 (이번 달)
    const categoryExpense = _getCategoryExpense(thisMonthTx);

    return successResponse({
      yearMonth:        ym,
      income:           income,
      expense:          expense,
      assetMove:        assetMove,
      netSaving:        netSaving,
      thisWeekExpense:  thisWeekExpense,
      lastWeekExpense:  lastWeekExpense,
      weeklyDiff:       thisWeekExpense - lastWeekExpense,
      totalLoanBalance: totalLoanBalance,
      totalSaved:       totalSaved,
      categoryExpense:  categoryExpense
    });
  } catch (e) {
    return errorResponse('대시보드 계산 오류: ' + e.message);
  }
}

/**
 * 지정된 transaction_type 목록으로 rows에서 amount 합산
 * @private
 */
function _sumByTypes(rows, types) {
  return rows
    .filter(r => types.includes(r.transaction_type))
    .reduce((sum, r) => sum + (parseAmount(r.amount) || 0), 0);
}

/**
 * 날짜 범위 + transaction_type 목록으로 amount 합산
 * startDate, endDate: 'YYYY-MM-DD' 형식 문자열
 * @private
 */
function _sumByTypesInRange(rows, types, startDate, endDate) {
  return rows
    .filter(r => {
      const d = _dateToStr(r.date);
      return types.includes(r.transaction_type) && d >= startDate && d <= endDate;
    })
    .reduce((sum, r) => sum + (parseAmount(r.amount) || 0), 0);
}

/**
 * LOANS 시트에서 is_active = true 인 대출 잔액 합산
 * 시트가 없거나 비어있으면 0 반환
 * @private
 */
function _getTotalLoanBalance() {
  try {
    const loans = getAllRows('LOANS');
    return loans
      .filter(r => r.is_active === true || String(r.is_active).toUpperCase() === 'TRUE')
      .reduce((sum, r) => sum + (parseAmount(r.current_balance) || 0), 0);
  } catch (e) {
    Logger.log('대출잔액 계산 스킵 (데이터 없음): ' + e.message);
    return 0;
  }
}

/**
 * SAVING_GOALS 시트에서 is_active = true 인 저축목표 current_amount 합산
 * 시트가 없거나 비어있으면 0 반환
 * @private
 */
function _getTotalSaved() {
  try {
    const goals = getAllRows('SAVING_GOALS');
    return goals
      .filter(r => r.is_active === true || String(r.is_active).toUpperCase() === 'TRUE')
      .reduce((sum, r) => sum + (parseAmount(r.current_amount) || 0), 0);
  } catch (e) {
    Logger.log('저축합계 계산 스킵 (데이터 없음): ' + e.message);
    return 0;
  }
}

/**
 * 이번 달 rows에서 소비 카테고리별 합계 반환
 * @returns {{ [category: string]: number }}
 * @private
 */
function _getCategoryExpense(rows) {
  const result = {};
  rows
    .filter(r => EXPENSE_TYPES.includes(r.transaction_type))
    .forEach(r => {
      const cat = r.category || '기타';
      result[cat] = (result[cat] || 0) + (parseAmount(r.amount) || 0);
    });
  return result;
}
