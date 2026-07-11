// ============================================================
// BudgetService.gs - 카테고리별 월 예산 관리 (CONFIG 시트 사용)
// ============================================================

const BUDGETS_KEY = 'MONTHLY_BUDGETS';

/**
 * 카테고리별 월 예산 목록 반환
 * @returns {{ success: boolean, data?: Object }}  { category: amount, ... }
 */
function getBudgets() {
  try {
    var raw = getConfig(BUDGETS_KEY);
    var budgets = {};
    if (raw) {
      try { budgets = JSON.parse(raw); } catch (_) {}
    }
    return successResponse(budgets);
  } catch (e) {
    return errorResponse('예산 조회 오류: ' + e.message);
  }
}

/**
 * 특정 카테고리의 월 예산 설정 (0이면 삭제)
 * @param {string} category
 * @param {number} amount
 * @returns {{ success: boolean, data?: Object }}
 */
function setBudget(category, amount) {
  try {
    if (!category) return errorResponse('category가 필요합니다.');

    var raw = getConfig(BUDGETS_KEY);
    var budgets = {};
    if (raw) {
      try { budgets = JSON.parse(raw); } catch (_) {}
    }

    if (!amount || amount <= 0) {
      delete budgets[category];
    } else {
      budgets[category] = Number(amount);
    }

    setConfig(BUDGETS_KEY, JSON.stringify(budgets));
    return successResponse(budgets);
  } catch (e) {
    return errorResponse('예산 설정 오류: ' + e.message);
  }
}
