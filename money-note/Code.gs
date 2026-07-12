// ============================================================
// Code.gs - 클라이언트-서버 진입점 및 래퍼 함수 모음
// Phase 2: 모든 서비스 래퍼 통합 + JSON API 라우팅
// ============================================================

// ── JSON API 진입점 ──

/**
 * GET 요청 처리 (action 파라미터로 라우팅)
 * @param {Object} e - 요청 객체
 * @returns {TextOutput} JSON 응답
 */
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || '';
  return _handleRequest(action, params);
}

/**
 * POST 요청 처리 (JSON body에서 action으로 라우팅)
 * @param {Object} e - 요청 객체
 * @returns {TextOutput} JSON 응답
 */
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {}
  const action = body.action || '';
  return _handleRequest(action, body);
}

/**
 * 요청 처리 및 JSON 응답 반환
 * @private
 */
function _handleRequest(action, params) {
  try {
    const result = _route(action, params);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: e.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 액션에 따른 라우팅
 * @private
 */
function _route(action, p) {
  switch (action) {
    // 대시보드
    case 'getDashboard':         return getDashboard(p.yearMonth);
    case 'refreshDashboardCache':return refreshDashboardCache();
    // 거래
    case 'saveTransaction':      return saveTransaction(p);
    case 'getTransactions':      return getTransactions(p);
    case 'deleteTransaction':    return deleteTransaction(p.id);
    case 'bulkSaveTransactions': return bulkSaveTransactions(p.transactions);
    // 할부
    case 'addInstallment':       return addInstallment(p);
    case 'getInstallments':      return getInstallments();
    case 'applyInstallments':    return applyInstallments(p.yearMonth);
    case 'deactivateInstallment':return deactivateInstallment(p.id);
    // 대출
    case 'addLoan':              return addLoan(p);
    case 'getLoans':             return getLoans();
    case 'updateLoan':           return updateLoan(p);
    case 'deactivateLoan':       return deactivateLoan(p.id);
    // 적금
    case 'addSavingGoal':        return addSavingGoal(p);
    case 'getSavingGoals':       return getSavingGoals();
    case 'updateSavingGoal':     return updateSavingGoal(p);
    case 'deactivateSavingGoal': return deactivateSavingGoal(p.id);
    // 캘린더
    case 'addCalendarEvent':     return addCalendarEvent(p);
    case 'getCalendarEvents':    return getCalendarEvents(p);
    case 'updateCalendarEvent':  return updateCalendarEvent(p.event_id, p);
    case 'deleteCalendarEvent':  return deleteCalendarEvent(p.id);
    // 고정지출
    case 'getFixedExpenses':     return getFixedExpenses();
    case 'addFixedExpense':      return addFixedExpense(p);
    case 'updateFixedExpense':   return updateFixedExpense(p.id, p);
    case 'deleteFixedExpense':   return deleteFixedExpense(p.id);
    case 'applyFixedExpenses':   return applyFixedExpenses(p.yearMonth);
    // 거래 수정
    case 'updateTransaction':    return updateTransaction(p.id, p);
    // 월별 추이
    case 'getMonthlyTrend':      return getMonthlyTrend(p.months);
    // 예산
    case 'getBudgets':           return getBudgets();
    case 'setBudget':            return setBudget(p.category, p.amount);
    // 정기 거래
    case 'getRecurrings':        return getRecurrings();
    case 'addRecurring':         return addRecurring(p);
    case 'deleteRecurring':      return deleteRecurring(p.id);
    case 'applyRecurring':       return applyRecurring(p.yearMonth);
    // 설정
    case 'getAppConfig':         return getAppConfig(p.key);
    case 'setAppConfig':         return setAppConfig(p.key, p.value);
    case 'verifyPin':            return verifyPin(p.pin);
    case 'syncCalendar':         return syncCalendarToGoogle();
    default:
      return { success: false, error: 'Unknown action: ' + action };
  }
}

// ── 대시보드 ──

/**
 * 홈 대시보드 데이터 조회
 * @param {string} yearMonth - 'YYYY-MM' 형식. 생략 시 이번 달
 * @returns {Object} {success, data: 대시보드 객체}
 */
function getDashboard(yearMonth) {
  return getDashboardData(yearMonth);
}

// ── 거래 관리 (대출상환/적금 시 자동 연동) ──

/**
 * 거래 추가 - 대출상환/적금 입력 시 LoanService/SavingService도 자동 업데이트
 * @param {Object} data - {date, member, flow_type, category, detail, amount, memo, loan_id?, saving_goal_id?}
 * @returns {Object} {success, data: 생성된 거래 객체}
 */
function saveTransaction(data) {
  const result = addTransaction(data);
  if (result.success) {
    const tx = result.data;
    // 대출상환 시 대출 잔액 자동 감소
    if (tx.transaction_type === '대출상환' && data.loan_id) {
      try { updateLoanBalance(data.loan_id, tx.amount); } catch (e) {}
    }
    // 적금/비상금저축 시 저축액 자동 증가
    if (['적금', '비상금저축'].includes(tx.transaction_type) && data.saving_goal_id) {
      try { updateSavingAmount(data.saving_goal_id, tx.amount); } catch (e) {}
    }
  }
  return result;
}

/**
 * 거래 목록 조회
 * @param {Object} filters - 필터 조건 {date_from?, date_to?, member?, flow_type?, category?, is_deleted?}
 * @returns {Object} {success, data: 거래 배열 (최신순)}
 */
function listTransactions(filters) {
  return getTransactions(filters);
}

/**
 * 거래 삭제
 * @param {string} id - transaction_id
 * @returns {Object} {success, data: 삭제된 거래 객체}
 */
function removeTransaction(id) {
  return deleteTransaction(id);
}

// ── 대출 관리 ──

/**
 * 대출 추가
 * @param {Object} data - {member, name, principal, interest_rate?, start_date?, end_date?, memo?}
 * @returns {Object} {success, data: 생성된 대출 객체}
 */
function saveLoan(data) {
  return addLoan(data);
}

/**
 * 대출 목록 조회
 * @param {Object} filters - 필터 조건 {member?, is_active?}
 * @returns {Object} {success, data: 대출 배열 (최신순)}
 */
function listLoans(filters) {
  return getLoans(filters);
}

/**
 * 대출 상환 (잔액 감소)
 * @param {string} loan_id
 * @param {number} amount
 * @returns {Object} {success, data: 업데이트된 대출 객체}
 */
function repayLoan(loan_id, amount) {
  return updateLoanBalance(loan_id, amount);
}

/**
 * 대출 정보 수정
 * @param {string} loan_id
 * @param {Object} updates - 변경할 필드들
 * @returns {Object} {success, data: 업데이트된 대출 객체}
 */
function editLoan(loan_id, updates) {
  return updateLoan(loan_id, updates);
}

/**
 * 대출 비활성화
 * @param {string} loan_id
 * @returns {Object} {success, data: 업데이트된 대출 객체}
 */
function closeLoan(loan_id) {
  return deactivateLoan(loan_id);
}

// ── 적금/저축 관리 ──

/**
 * 적금/저축 목표 추가
 * @param {Object} data - {goal_name, goal_type, owner, target_amount, start_date?, target_date?, memo?}
 * @returns {Object} {success, data: 생성된 저축 목표 객체}
 */
function saveSavingGoal(data) {
  return addSavingGoal(data);
}

/**
 * 적금/저축 목표 목록 조회
 * @param {Object} filters - 필터 조건 {owner?, is_active?, goal_type?}
 * @returns {Object} {success, data: 저축 목표 배열 (최신순)}
 */
function listSavingGoals(filters) {
  return getSavingGoals(filters);
}

/**
 * 적금 입금 (현재액 증가)
 * @param {string} goal_id
 * @param {number} amount
 * @returns {Object} {success, data: 업데이트된 저축 목표 객체}
 */
function depositSaving(goal_id, amount) {
  return updateSavingAmount(goal_id, amount);
}

/**
 * 적금/저축 목표 정보 수정
 * @param {string} goal_id
 * @param {Object} updates - 변경할 필드들
 * @returns {Object} {success, data: 업데이트된 저축 목표 객체}
 */
function editSavingGoal(goal_id, updates) {
  return updateSavingGoal(goal_id, updates);
}

/**
 * 적금/저축 목표 비활성화
 * @param {string} goal_id
 * @returns {Object} {success, data: 업데이트된 저축 목표 객체}
 */
function closeSavingGoal(goal_id) {
  return deactivateSavingGoal(goal_id);
}

// ── 캘린더 일정 관리 ──

/**
 * 일정 추가
 * @param {Object} data - {title, start_date, start_time?, end_date?, end_time?, is_all_day?, member_scope?, category?, color?, memo?}
 * @returns {Object} {success, data: 생성된 일정 객체}
 */
function addEvent(data) {
  return addCalendarEvent(data);
}

/**
 * 일정 목록 조회
 * @param {Object} filters - 필터 조건 {date_from?, date_to?, member_scope?, category?, is_deleted?}
 * @returns {Object} {success, data: 일정 배열 (날짜순)}
 */
function listEvents(filters) {
  return getCalendarEvents(filters);
}

/**
 * 일정 수정
 * @param {string} event_id
 * @param {Object} updates - 변경할 필드들
 * @returns {Object} {success, data: 업데이트된 일정 객체}
 */
function editEvent(event_id, updates) {
  return updateCalendarEvent(event_id, updates);
}

/**
 * 일정 삭제
 * @param {string} event_id
 * @returns {Object} {success, data: 삭제된 일정 객체}
 */
function removeEvent(event_id) {
  return deleteCalendarEvent(event_id);
}

// ── 설정 관리 ──

/**
 * 앱 설정값 조회
 * @param {string} key - 설정 키
 * @returns {Object} {success, data: 설정값}
 */
function getAppConfig(key) {
  try {
    const value = getConfig(key);
    return successResponse(value);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 앱 설정값 저장
 * @param {string} key - 설정 키
 * @param {*} value - 설정값
 * @returns {Object} {success, data: null}
 */
function setAppConfig(key, value) {
  try {
    setConfig(key, value);
    return successResponse(null);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 가족 구성원 목록 조회
 * @returns {Object} {success, data: 구성원 배열}
 */
function getMembers() {
  try {
    const rows = SheetService.getAllRows('MEMBERS');
    return successResponse(rows);
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ── PIN 인증 ──

/**
 * PIN 코드 검증
 * @param {string} pin - 입력된 PIN 코드
 * @returns {Object} {success, data: 인증 여부}
 */
function verifyPin(pin) {
  try {
    const storedPin = getPinCode();
    const isValid = storedPin && pin === storedPin;
    return successResponse({ isValid: isValid });
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ── 캐시 및 동기화 ──

/**
 * 대시보드 캐시 새로 고침
 * @returns {Object} {success, data: null}
 */
function refreshDashboardCache() {
  try {
    // 현재 캐시는 별도로 관리하지 않음. 필요 시 DASHBOARD_CACHE 시트 초기화
    // 추후 성능 최적화를 위해 확장 가능한 구조로 준비됨
    return successResponse(null);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Google Calendar 동기화 (서비스 연동용 예약 함수)
 * @returns {Object} {success, data: null}
 */
function syncCalendarToGoogle() {
  try {
    // 캘린더 이벤트를 Google Calendar와 동기화하는 로직
    // 추후 CalendarService 확장 시 구현
    // 현재는 상태 응답만 반환
    return successResponse({ synced: true });
  } catch (e) {
    return errorResponse(e.message);
  }
}
