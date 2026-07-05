// ============================================================
// Code.gs - 진입점 및 웹앱 라우터
// Phase 1: 백엔드 초기화 확인용 stub
// ============================================================

/** 웹앱 진입점: HTML 서빙 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('우리집 머니노트')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
}

/** HTML 파일 include 헬퍼 (styles.html, script.html 등 포함용) */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ──────────────────────────────────────────────
// 프론트엔드 → google.script.run 으로 호출하는 함수들
// Phase 2에서 실제 UI와 연결
// ──────────────────────────────────────────────

/** 대시보드 데이터 반환 */
function getDashboard(yearMonth) {
  return getDashboardData(yearMonth);
}

/** 거래 추가 */
function saveTransaction(data) {
  return addTransaction(data);
}

/** 거래 목록 조회 */
function listTransactions(filters) {
  return getTransactions(filters);
}

/** 거래 삭제 */
function removeTransaction(transactionId) {
  return deleteTransaction(transactionId);
}

// ──────────────────────────────────────────────
// 대출 관리 함수 (LoanService 래퍼)
// ──────────────────────────────────────────────

/** 대출 추가 */
function saveLoan(data) {
  return addLoan(data);
}

/** 대출 목록 조회 */
function listLoans(filters) {
  return getLoans(filters);
}

/** 대출 상환 */
function repayLoan(loan_id, amount) {
  return updateLoanBalance(loan_id, amount);
}

/** 대출 정보 수정 */
function editLoan(loan_id, updates) {
  return updateLoan(loan_id, updates);
}

/** 대출 비활성화 */
function closeLoan(loan_id) {
  return deactivateLoan(loan_id);
}

// ──────────────────────────────────────────────
// 적금/저축 관리 함수 (SavingService 래퍼)
// ──────────────────────────────────────────────

/** 적금/저축 목표 추가 */
function saveSavingGoal(data) {
  return addSavingGoal(data);
}

/** 적금/저축 목표 목록 조회 */
function listSavingGoals(filters) {
  return getSavingGoals(filters);
}

/** 적금 입금 */
function depositSaving(goal_id, amount) {
  return updateSavingAmount(goal_id, amount);
}

/** 적금/저축 목표 정보 수정 */
function editSavingGoal(goal_id, updates) {
  return updateSavingGoal(goal_id, updates);
}

/** 적금/저축 목표 비활성화 */
function closeSavingGoal(goal_id) {
  return deactivateSavingGoal(goal_id);
}

// ──────────────────────────────────────────────
// 캘린더 일정 관리 함수 (CalendarService 래퍼)
// ──────────────────────────────────────────────

/** 일정 추가 */
function addEvent(data) { return addCalendarEvent(data); }

/** 일정 목록 조회 */
function listEvents(filters) { return getCalendarEvents(filters); }

/** 일정 수정 */
function editEvent(event_id, updates) { return updateCalendarEvent(event_id, updates); }

/** 일정 삭제 */
function removeEvent(event_id) { return deleteCalendarEvent(event_id); }
