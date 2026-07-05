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
