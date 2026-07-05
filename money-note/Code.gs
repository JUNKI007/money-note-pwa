// ============================================================
// Code.gs - 클라이언트-서버 진입점 및 래퍼 함수 모음
// Phase 2: 모든 서비스 래퍼 통합
// google.script.run 으로 호출되는 함수들
// ============================================================

// ── HtmlService 진입점 ──

/**
 * 웹앱 진입점: index.html 서빙
 * @param {Object} e - 요청 객체
 * @returns {HtmlOutput}
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('우리집 머니노트')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1.0,maximum-scale=1.0');
}

/**
 * HTML 파일 include 헬퍼 (styles.html, script-*.html 등 동적 삽입용)
 * @param {string} filename
 * @returns {string} HTML 콘텐츠
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
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
  return getConfig(key);
}

/**
 * 앱 설정값 저장
 * @param {string} key - 설정 키
 * @param {*} value - 설정값
 * @returns {Object} {success, data: null}
 */
function setAppConfig(key, value) {
  setConfig(key, value);
  return successResponse(null);
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
