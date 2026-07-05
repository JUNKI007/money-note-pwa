// ============================================================
// Utils.gs - 공통 유틸리티 함수
// ============================================================

const TIMEZONE = 'Asia/Seoul';

/** KST 기준 'YYYY-MM-DD' 문자열 반환 */
function formatDate(date) {
  if (!date) date = new Date();
  return Utilities.formatDate(new Date(date), TIMEZONE, 'yyyy-MM-dd');
}

/** KST 기준 'YYYY-MM-DD HH:mm:ss' 문자열 반환 */
function formatDateTime(date) {
  if (!date) date = new Date();
  return Utilities.formatDate(new Date(date), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

/** 현재 월 'YYYY-MM' 반환 (KST) */
function getCurrentYearMonth() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM');
}

/** 이번 주 월~일 날짜 범위 반환 (KST, 월요일 시작) */
function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=일, 1=월, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
}

/** 지난 주 월~일 날짜 범위 반환 (KST, 월요일 시작) */
function getLastWeekRange() {
  const current = getCurrentWeekRange();
  const monday = new Date(current.start);
  monday.setDate(monday.getDate() - 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
}

/** 숫자 → '1,234,567' 형식 문자열 */
function formatAmount(amount) {
  const num = parseInt(amount) || 0;
  return num.toLocaleString('ko-KR');
}

/** 금액 문자열 → 절댓값 숫자 (콤마, '원' 등 제거) */
function parseAmount(str) {
  if (typeof str === 'number') return Math.abs(Math.round(str));
  const num = parseInt(String(str).replace(/[^0-9]/g, '')) || 0;
  return num;
}

/** 고유 ID 생성: PREFIX + YYYYMMDD + 랜덤 4자 (예: T20260705A3F2) */
function generateId(prefix) {
  const datePart = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return (prefix || 'X') + datePart + rand;
}

/**
 * 필수값 검증
 * @returns {string|null} 에러 메시지 또는 null
 */
function validateRequired(data, requiredKeys) {
  for (const key of requiredKeys) {
    const val = data[key];
    if (val === undefined || val === null || val === '') {
      return '필수 항목 누락: ' + key;
    }
  }
  return null;
}

/** 표준 성공 응답 */
function successResponse(data) {
  return { success: true, data: data };
}

/** 표준 실패 응답 (Logger에도 기록) */
function errorResponse(message) {
  Logger.log('[ERROR] ' + message);
  return { success: false, error: message };
}
