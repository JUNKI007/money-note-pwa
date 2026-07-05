# 우리집 머니노트 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Apps Script 프로젝트의 백엔드 기반을 구축한다 — 스프레드시트 10개 시트 자동 초기화, 거래 입력/조회/삭제, 홈 대시보드 계산 함수까지.

**Architecture:** Apps Script 프로젝트 안에 6개 .gs 파일을 계층적으로 구성한다. Utils.gs가 최하단 공통 함수, SheetService.gs가 헤더 기반 시트 접근 레이어, 각 Service.gs가 비즈니스 로직을 담당한다. 모든 시트 접근은 열 번호가 아닌 헤더명 기반으로 처리하여 컬럼 순서 변경에 유연하게 대응한다.

**Tech Stack:** Google Apps Script (V8 runtime), Google Spreadsheet, PropertiesService (설정 저장)

## Global Constraints

- Google Apps Script V8 런타임 사용
- 모든 날짜/시간은 Asia/Seoul(KST) 기준
- 시트 접근은 반드시 헤더명 기반 — 열 번호 하드코딩 금지
- 삭제는 soft delete (`is_deleted = true`) — 행 실제 삭제 금지
- 금액은 항상 양수(절댓값)로 저장, 방향은 `flow_type`으로 구분
- 모든 주석은 한국어
- 함수 반환 형식: `{ success: true, data: ... }` 또는 `{ success: false, error: "..." }`
- ID 형식: 접두사 + YYYYMMDD + 랜덤 4자 (예: `T20260705A3F2`)
- 이 Phase에서는 프론트엔드 없음 — 백엔드 함수만 구현

---

## File Structure

| 파일 | 역할 |
|------|------|
| `Utils.gs` | ID 생성, 날짜 포맷, 금액 파싱/포맷, 검증, 표준 응답 생성 |
| `SheetService.gs` | 헤더 기반 시트 CRUD 공통 레이어 (getAllRows, appendRow, updateRow 등) |
| `ConfigService.gs` | SHEET_HEADERS 상수 정의, `initializeSpreadsheet()`, CONFIG CRUD |
| `TransactionService.gs` | 거래 추가/조회/삭제, flow_type→transaction_type 결정 로직 |
| `DashboardService.gs` | 월별 수입/소비/순저축, 주간 비교, 대출잔액/저축합계 계산 |
| `Tests.gs` | 각 서비스의 수동 실행 테스트 함수 모음 |
| `Code.gs` | `doGet()` stub — Phase 2 프론트엔드 연결 준비 |
| `index.html` | Phase 1 확인용 placeholder HTML |

---

## Task 1: Utils.gs — 공통 유틸리티

**Files:**
- Create: `[GAS Project]/Utils.gs`

**Interfaces:**
- Produces:
  - `generateId(prefix: string): string`
  - `formatDate(date?: Date): string` — `'YYYY-MM-DD'`
  - `formatDateTime(date?: Date): string` — `'YYYY-MM-DD HH:mm:ss'`
  - `getCurrentYearMonth(): string` — `'YYYY-MM'`
  - `getCurrentWeekRange(): { start: string, end: string }`
  - `getLastWeekRange(): { start: string, end: string }`
  - `formatAmount(amount: number): string` — `'1,234,567'`
  - `parseAmount(str: string|number): number`
  - `validateRequired(data: Object, keys: string[]): string|null`
  - `successResponse(data: any): { success: true, data: any }`
  - `errorResponse(message: string): { success: false, error: string }`
  - `TIMEZONE: string` — `'Asia/Seoul'`

- [ ] **Step 1: Apps Script 새 프로젝트 만들기**

  1. [script.google.com](https://script.google.com) 접속 → 새 프로젝트 만들기
  2. 프로젝트 이름: `우리집 머니노트`
  3. 기본 `Code.gs` 파일이 생성됨 — 그대로 두고 다음 단계로

- [ ] **Step 2: Utils.gs 파일 생성**

  Apps Script 에디터 왼쪽 "파일" 패널 → "+" → "스크립트" → 이름: `Utils`

  아래 코드를 전체 붙여넣기:

  ```javascript
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
  ```

- [ ] **Step 3: Tests.gs 파일 생성 및 Utils 테스트 작성**

  Apps Script 에디터 → "+" → "스크립트" → 이름: `Tests`

  ```javascript
  // ============================================================
  // Tests.gs - 수동 실행 테스트 함수 모음
  // 각 test_ 함수를 Apps Script 에디터 상단 드롭다운에서 선택 후 ▶ 실행
  // ============================================================

  function test_Utils() {
    Logger.log('=== Utils 테스트 시작 ===');

    // generateId
    const id = generateId('T');
    Logger.log('생성된 ID: ' + id);
    if (id.length !== 13) throw new Error('ID 길이 오류: ' + id.length + ' (예상: 13)');
    if (!id.startsWith('T')) throw new Error('ID 접두사 오류');

    // formatDate
    const today = formatDate(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('날짜 포맷 오류: ' + today);

    // formatAmount
    const fmt = formatAmount(1234567);
    if (fmt !== '1,234,567') throw new Error('금액 포맷 오류: ' + fmt);

    // parseAmount
    const p1 = parseAmount('1,234,567원');
    if (p1 !== 1234567) throw new Error('금액 파싱 오류(문자열): ' + p1);
    const p2 = parseAmount(12000);
    if (p2 !== 12000) throw new Error('금액 파싱 오류(숫자): ' + p2);
    const p3 = parseAmount(-5000);
    if (p3 !== 5000) throw new Error('금액 음수 절댓값 오류: ' + p3);

    // validateRequired
    const err1 = validateRequired({ a: 1, b: '' }, ['a', 'b']);
    if (!err1 || !err1.includes('b')) throw new Error('필수값 검증 오류: ' + err1);
    const err2 = validateRequired({ a: 1, b: 2 }, ['a', 'b']);
    if (err2 !== null) throw new Error('필수값 정상 케이스 오류: ' + err2);

    // successResponse / errorResponse
    const ok = successResponse({ id: 1 });
    if (!ok.success || ok.data.id !== 1) throw new Error('successResponse 오류');
    const fail = errorResponse('테스트 에러');
    if (fail.success || fail.error !== '테스트 에러') throw new Error('errorResponse 오류');

    // weekRange
    const week = getCurrentWeekRange();
    if (week.start > week.end) throw new Error('주간 범위 오류');
    const lastWeek = getLastWeekRange();
    if (lastWeek.end >= week.start) throw new Error('지난주 범위 오류');

    Logger.log('✅ Utils 테스트 전체 PASS');
  }
  ```

- [ ] **Step 4: Utils 테스트 실행**

  에디터 상단 드롭다운에서 `test_Utils` 선택 → ▶ 실행 → 하단 실행 로그 확인

  예상 출력:
  ```
  === Utils 테스트 시작 ===
  생성된 ID: T20260705XXXX
  ✅ Utils 테스트 전체 PASS
  ```

  오류 없이 `PASS` 로그가 나오면 완료.

---

## Task 2: SheetService.gs — 헤더 기반 시트 CRUD 레이어

**Files:**
- Create: `[GAS Project]/SheetService.gs`

**Interfaces:**
- Consumes: `Utils.gs` (없음, 독립적)
- Produces:
  - `getSpreadsheet(): Spreadsheet`
  - `getSheet(sheetName: string): Sheet`
  - `getHeaderMap(sheet: Sheet): { [colName: string]: number }` — 0-based index
  - `getAllRows(sheetName: string, includeDeleted?: boolean): Object[]` — 각 row에 `_rowIndex` 포함
  - `appendRow(sheetName: string, data: Object): void`
  - `updateCell(sheetName: string, rowIndex: number, colName: string, value: any): void`
  - `updateRow(sheetName: string, rowIndex: number, data: Object): void`
  - `findRowBy(sheetName: string, colName: string, value: string): Object|null`

- [ ] **Step 1: SheetService.gs 파일 생성**

  Apps Script 에디터 → "+" → "스크립트" → 이름: `SheetService`

  ```javascript
  // ============================================================
  // SheetService.gs - 헤더 기반 시트 읽기/쓰기 공통 레이어
  // 열 번호에 의존하지 않고 헤더명으로 열을 찾아 처리
  // ============================================================

  /** 스프레드시트 객체 반환 (Script Properties에 저장된 ID 사용) */
  function getSpreadsheet() {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!id) {
      throw new Error('SPREADSHEET_ID 미설정. initializeSpreadsheet()를 먼저 실행하세요.');
    }
    return SpreadsheetApp.openById(id);
  }

  /** 시트 이름으로 시트 객체 반환. 없으면 에러. */
  function getSheet(sheetName) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
    return sheet;
  }

  /**
   * 시트의 1행(헤더)을 읽어 { 컬럼명: 0-based인덱스 } 맵 반환
   * 빈 헤더 셀은 무시
   */
  function getHeaderMap(sheet) {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return {};
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = {};
    headers.forEach((h, i) => {
      if (h) map[String(h).trim()] = i;
    });
    return map;
  }

  /**
   * 시트의 모든 데이터를 { 헤더: 값 } 객체 배열로 반환
   * - is_deleted = true 인 행은 기본 제외
   * - includeDeleted = true 이면 포함
   * - 각 객체에 _rowIndex (1-based 실제 행 번호) 포함
   */
  function getAllRows(sheetName, includeDeleted) {
    const sheet = getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    return data
      .map((row, i) => {
        const obj = { _rowIndex: i + 2 }; // 실제 시트 행 번호 (헤더=1, 첫데이터=2)
        headers.forEach((h, j) => {
          if (h) obj[String(h).trim()] = row[j];
        });
        return obj;
      })
      .filter(row => {
        if (includeDeleted) return true;
        // is_deleted가 TRUE / true / 'TRUE' 이면 제외
        const d = row['is_deleted'];
        return d !== true && d !== 'TRUE' && d !== 'true';
      });
  }

  /**
   * 시트에 객체 1행 추가
   * 헤더 순서에 맞게 값을 배열로 변환하여 appendRow
   * 헤더에 없는 키는 무시, 헤더에 있지만 data에 없는 값은 빈 문자열
   */
  function appendRow(sheetName, data) {
    const sheet = getSheet(sheetName);
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const row = headers.map(h => {
      if (!h) return '';
      const val = data[String(h).trim()];
      return (val !== undefined && val !== null) ? val : '';
    });
    sheet.appendRow(row);
  }

  /**
   * 특정 행(rowIndex)의 특정 컬럼(colName) 값 업데이트
   * rowIndex는 1-based 실제 시트 행 번호
   */
  function updateCell(sheetName, rowIndex, colName, value) {
    const sheet = getSheet(sheetName);
    const headerMap = getHeaderMap(sheet);
    if (!(colName in headerMap)) {
      throw new Error('컬럼을 찾을 수 없습니다: ' + colName + ' (시트: ' + sheetName + ')');
    }
    const colIdx = headerMap[colName] + 1; // 1-based
    sheet.getRange(rowIndex, colIdx).setValue(value);
  }

  /**
   * 특정 행(rowIndex)을 객체로 부분 업데이트 (헤더 기반)
   * rowIndex는 1-based 실제 시트 행 번호
   */
  function updateRow(sheetName, rowIndex, data) {
    const sheet = getSheet(sheetName);
    const headerMap = getHeaderMap(sheet);
    Object.keys(data).forEach(key => {
      if (key in headerMap) {
        const colIdx = headerMap[key] + 1;
        sheet.getRange(rowIndex, colIdx).setValue(data[key]);
      }
    });
  }

  /**
   * 단일 컬럼 값으로 첫 번째 매칭 행 반환 (삭제된 행 포함 검색)
   * @returns {Object|null}
   */
  function findRowBy(sheetName, colName, value) {
    const rows = getAllRows(sheetName, true); // 삭제된 행 포함
    return rows.find(row => String(row[colName]) === String(value)) || null;
  }
  ```

- [ ] **Step 2: Tests.gs에 SheetService 테스트 추가**

  `Tests.gs` 파일 열고 아래 함수 추가 (기존 코드 아래에):

  ```javascript
  function test_SheetService() {
    Logger.log('=== SheetService 테스트 시작 ===');

    // getSpreadsheet: SPREADSHEET_ID가 없으면 에러여야 함
    // (initializeSpreadsheet 전이므로 PropertiesService에 ID가 없을 수 있음)
    // 현재 스프레드시트 ID를 직접 임시 설정하고 테스트
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

    // getSheet: 없는 시트는 에러
    let threw = false;
    try { getSheet('존재하지않는시트_테스트용'); } catch(e) { threw = true; }
    if (!threw) throw new Error('없는 시트에서 에러 미발생');

    // 테스트용 임시 시트 만들어서 appendRow / getAllRows / updateCell 테스트
    const TEST_SHEET = '_TEST_TEMP';
    let testSheet = ss.getSheetByName(TEST_SHEET);
    if (testSheet) ss.deleteSheet(testSheet); // 이전 잔존 시트 정리
    testSheet = ss.insertSheet(TEST_SHEET);
    testSheet.getRange(1, 1, 1, 3).setValues([['id', 'name', 'is_deleted']]);

    // appendRow
    appendRow(TEST_SHEET, { id: 'R001', name: '테스트', is_deleted: false });
    appendRow(TEST_SHEET, { id: 'R002', name: '삭제됨', is_deleted: true });

    // getAllRows (기본: 삭제 제외)
    const rows = getAllRows(TEST_SHEET);
    if (rows.length !== 1) throw new Error('getAllRows 삭제 제외 오류: ' + rows.length);
    if (rows[0].name !== '테스트') throw new Error('getAllRows 값 오류');

    // getAllRows (삭제 포함)
    const allRows = getAllRows(TEST_SHEET, true);
    if (allRows.length !== 2) throw new Error('getAllRows 삭제 포함 오류: ' + allRows.length);

    // updateCell
    updateCell(TEST_SHEET, rows[0]._rowIndex, 'name', '수정됨');
    const updated = getAllRows(TEST_SHEET);
    if (updated[0].name !== '수정됨') throw new Error('updateCell 오류');

    // findRowBy
    const found = findRowBy(TEST_SHEET, 'id', 'R001');
    if (!found || found.name !== '수정됨') throw new Error('findRowBy 오류');
    const notFound = findRowBy(TEST_SHEET, 'id', 'XXXX');
    if (notFound !== null) throw new Error('findRowBy 미존재 오류');

    // 정리: 임시 시트 삭제
    ss.deleteSheet(ss.getSheetByName(TEST_SHEET));

    Logger.log('✅ SheetService 테스트 전체 PASS');
  }
  ```

- [ ] **Step 3: SheetService 테스트 실행**

  에디터 드롭다운 → `test_SheetService` → ▶ 실행

  예상 출력:
  ```
  === SheetService 테스트 시작 ===
  ✅ SheetService 테스트 전체 PASS
  ```

---

## Task 3: ConfigService.gs + 스프레드시트 초기화

**Files:**
- Create: `[GAS Project]/ConfigService.gs`
- Create: `[GAS Project]/Code.gs` (기존 파일 교체)
- Create: `[GAS Project]/index.html`

**Interfaces:**
- Consumes: `Utils.gs` (formatDateTime, getCurrentYearMonth), `SheetService.gs` (getSheet, appendRow, findRowBy, updateCell)
- Produces:
  - `SHEET_HEADERS: { [sheetName: string]: string[] }` — 전역 상수
  - `initializeSpreadsheet(): void` — Apps Script 에디터에서 직접 실행
  - `getConfig(key: string): string|null`
  - `setConfig(key: string, value: string): void`
  - `doGet(e): HtmlOutput` — Code.gs에서 정의

- [ ] **Step 1: ConfigService.gs 파일 생성**

  Apps Script 에디터 → "+" → "스크립트" → 이름: `ConfigService`

  ```javascript
  // ============================================================
  // ConfigService.gs - 앱 설정 및 스프레드시트 초기화
  // ============================================================

  // 시트별 헤더 정의 (전역 상수)
  const SHEET_HEADERS = {
    CONFIG: ['key', 'value', 'description'],
    MEMBERS: ['member_id', 'name', 'role', 'color', 'is_active', 'created_at'],
    ACCOUNTS: [
      'account_id', 'account_name', 'owner', 'account_type',
      'initial_balance', 'include_in_total_asset', 'include_in_dashboard',
      'memo', 'created_at', 'updated_at'
    ],
    TRANSACTIONS: [
      'transaction_id', 'date', 'member', 'flow_type', 'transaction_type',
      'category', 'detail', 'amount', 'memo', 'created_at', 'updated_at', 'is_deleted'
    ],
    FIXED_EXPENSES: [
      'fixed_expense_id', 'name', 'amount', 'due_day', 'category',
      'payer', 'payment_method', 'is_active', 'memo', 'created_at', 'updated_at'
    ],
    LOANS: [
      'loan_id', 'loan_name', 'lender', 'borrower', 'original_principal',
      'current_balance', 'interest_rate', 'monthly_payment', 'payment_day',
      'start_date', 'maturity_date', 'is_active', 'memo', 'created_at', 'updated_at'
    ],
    SAVING_GOALS: [
      'goal_id', 'goal_name', 'goal_type', 'owner', 'target_amount',
      'current_amount', 'monthly_target', 'start_date', 'target_date',
      'is_active', 'memo', 'created_at', 'updated_at'
    ],
    BUDGETS: [
      'budget_id', 'year_month', 'member', 'category',
      'budget_amount', 'memo', 'created_at', 'updated_at'
    ],
    CALENDAR_EVENTS: [
      'event_id', 'google_event_id', 'title', 'start_date', 'start_time',
      'end_date', 'end_time', 'is_all_day', 'member_scope', 'category',
      'color', 'reminder_minutes', 'location', 'memo',
      'linked_transaction_type', 'linked_loan_id', 'linked_saving_goal_id',
      'linked_amount', 'created_by', 'created_at', 'updated_at', 'is_deleted'
    ],
    DASHBOARD_CACHE: ['metric_key', 'metric_name', 'metric_value', 'period', 'calculated_at', 'memo']
  };

  // 기본 CONFIG 행 정의
  const DEFAULT_CONFIG_ROWS = [
    { key: 'APP_NAME',       value: '우리집 머니노트', description: '앱 이름' },
    { key: 'CURRENCY',       value: 'KRW',             description: '기본 통화' },
    { key: 'TIMEZONE',       value: 'Asia/Seoul',       description: '시간대' },
    { key: 'VERSION',        value: '1.0.0',            description: '버전' },
    { key: 'ALLOWED_EMAILS', value: '',                 description: '허용 이메일 목록 (쉼표 구분)' },
    { key: 'PIN_CODE',       value: '',                 description: '앱 PIN 코드 (6자리 숫자)' },
  ];

  // 기본 MEMBERS 행 정의
  const DEFAULT_MEMBER_ROWS = [
    { member_id: 'M001', name: '정준기', role: '본인',   color: '#6F8FAF' },
    { member_id: 'M002', name: '박정민', role: '배우자', color: '#C7B9FF' },
  ];

  /**
   * 스프레드시트 초기화 메인 함수
   * Apps Script 에디터 상단 드롭다운에서 initializeSpreadsheet 선택 후 ▶ 실행
   * 이미 존재하는 시트/데이터는 건드리지 않음 (멱등성 보장)
   */
  function initializeSpreadsheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Script Properties에 스프레드시트 ID 저장
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
    Logger.log('스프레드시트 ID 저장: ' + ss.getId());

    // 시트 생성 및 헤더 설정
    Object.keys(SHEET_HEADERS).forEach(sheetName => {
      _ensureSheet(ss, sheetName, SHEET_HEADERS[sheetName]);
    });

    // 기본 데이터 삽입 (시트가 헤더만 있을 때)
    _insertDefaultConfig();
    _insertDefaultMembers();

    Logger.log('=== 초기화 완료 ===');

    // 완료 알림 (에디터에서 실행 시)
    try {
      SpreadsheetApp.getUi().alert('✅ 우리집 머니노트 초기화 완료!\n\n시트 ' + Object.keys(SHEET_HEADERS).length + '개가 준비되었습니다.');
    } catch(e) {
      // 웹앱 컨텍스트에서는 UI 사용 불가 — 무시
    }
  }

  /** 시트 생성 + 헤더 설정 (이미 헤더 있으면 건너뜀) */
  function _ensureSheet(ss, sheetName, headers) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log('  시트 생성: ' + sheetName);
    }

    // 1행 1열이 비어있으면 헤더 설정
    if (sheet.getRange(1, 1).getValue() === '') {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // 헤더 스타일 (딥블루 배경, 흰 글씨, 굵게)
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#3F5F7F');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);

      // 열 너비 자동 조정
      sheet.autoResizeColumns(1, headers.length);
      Logger.log('  헤더 설정: ' + sheetName + ' (' + headers.length + '열)');
    } else {
      Logger.log('  이미 존재 (스킵): ' + sheetName);
    }
  }

  /** CONFIG 시트에 기본 데이터 삽입 */
  function _insertDefaultConfig() {
    const sheet = getSheet('CONFIG');
    if (sheet.getLastRow() > 1) {
      Logger.log('  CONFIG 이미 데이터 있음 (스킵)');
      return;
    }
    DEFAULT_CONFIG_ROWS.forEach(row => {
      sheet.appendRow([row.key, row.value, row.description]);
    });

    // START_MONTH는 실행 시점의 현재 월로 설정
    sheet.appendRow(['START_MONTH', getCurrentYearMonth(), '앱 시작 월 (YYYY-MM)']);
    Logger.log('  CONFIG 기본 데이터 삽입 완료');
  }

  /** MEMBERS 시트에 기본 사용자 데이터 삽입 */
  function _insertDefaultMembers() {
    const sheet = getSheet('MEMBERS');
    if (sheet.getLastRow() > 1) {
      Logger.log('  MEMBERS 이미 데이터 있음 (스킵)');
      return;
    }
    const now = formatDateTime(new Date());
    DEFAULT_MEMBER_ROWS.forEach(row => {
      sheet.appendRow([row.member_id, row.name, row.role, row.color, true, now]);
    });
    Logger.log('  MEMBERS 기본 데이터 삽입 완료');
  }

  /**
   * CONFIG 값 읽기
   * @param {string} key
   * @returns {string|null}
   */
  function getConfig(key) {
    const row = findRowBy('CONFIG', 'key', key);
    return row ? String(row['value']) : null;
  }

  /**
   * CONFIG 값 쓰기 (없으면 새 행 추가, 있으면 업데이트)
   * @param {string} key
   * @param {string} value
   */
  function setConfig(key, value) {
    const row = findRowBy('CONFIG', 'key', key);
    if (row) {
      updateCell('CONFIG', row._rowIndex, 'value', value);
    } else {
      appendRow('CONFIG', { key: key, value: value, description: '' });
    }
  }

  /** 앱 허용 이메일 목록 반환 */
  function getAllowedEmails() {
    const val = getConfig('ALLOWED_EMAILS');
    if (!val) return [];
    return val.split(',').map(e => e.trim()).filter(e => e.length > 0);
  }

  /** PIN 코드 반환 */
  function getPinCode() {
    return getConfig('PIN_CODE') || '';
  }
  ```

- [ ] **Step 2: Code.gs 교체 (Phase 1 stub)**

  기존 `Code.gs` 파일 내용을 전체 교체:

  ```javascript
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
  ```

- [ ] **Step 3: index.html 생성 (Phase 1 확인용 placeholder)**

  Apps Script 에디터 → "+" → "HTML" → 이름: `index`

  ```html
  <!DOCTYPE html>
  <html lang="ko">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>우리집 머니노트</title>
    <style>
      body { font-family: sans-serif; max-width: 400px; margin: 40px auto; padding: 16px; color: #1F2933; }
      h1 { color: #3F5F7F; }
      .status { background: #F5F7FA; border: 1px solid #D9E1E8; border-radius: 8px; padding: 16px; }
      .ok { color: #2F9E73; font-weight: bold; }
    </style>
  </head>
  <body>
    <h1>우리집 머니노트</h1>
    <div class="status">
      <p class="ok">✅ Phase 1 백엔드 준비 완료</p>
      <p>initializeSpreadsheet()를 실행한 뒤 이 페이지가 보이면 정상입니다.</p>
      <p>Phase 2에서 실제 UI로 교체됩니다.</p>
    </div>
  </body>
  </html>
  ```

- [ ] **Step 4: initializeSpreadsheet 실행**

  에디터 드롭다운 → `initializeSpreadsheet` → ▶ 실행 → 권한 승인(첫 실행 시)

  예상 Logger 출력:
  ```
  스프레드시트 ID 저장: 1xxxxxxxxxxxxxxx
    시트 생성: CONFIG
    헤더 설정: CONFIG (3열)
    시트 생성: MEMBERS
    헤더 설정: MEMBERS (6열)
    ... (나머지 8개 시트)
    CONFIG 기본 데이터 삽입 완료
    MEMBERS 기본 데이터 삽입 완료
  === 초기화 완료 ===
  ```

  구글 스프레드시트에서 10개 시트가 생성되고 각 시트에 헤더(딥블루 배경)가 보이면 완료.

- [ ] **Step 5: Tests.gs에 초기화 테스트 추가**

  `Tests.gs` 파일에 아래 함수 추가:

  ```javascript
  function test_initializeSpreadsheet() {
    Logger.log('=== 초기화 테스트 시작 ===');

    // 모든 시트 존재 여부 확인
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const requiredSheets = Object.keys(SHEET_HEADERS);
    requiredSheets.forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (!sheet) throw new Error('시트 없음: ' + name);

      const firstCell = sheet.getRange(1, 1).getValue();
      if (!firstCell) throw new Error('헤더 없음: ' + name);

      const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const expectedHeaders = SHEET_HEADERS[name];
      expectedHeaders.forEach((h, i) => {
        if (actualHeaders[i] !== h) {
          throw new Error(name + ' 헤더 불일치 - 예상: ' + h + ', 실제: ' + actualHeaders[i]);
        }
      });
    });

    // CONFIG 기본 데이터 확인
    const appName = getConfig('APP_NAME');
    if (appName !== '우리집 머니노트') throw new Error('CONFIG APP_NAME 오류: ' + appName);

    const currency = getConfig('CURRENCY');
    if (currency !== 'KRW') throw new Error('CONFIG CURRENCY 오류: ' + currency);

    // MEMBERS 데이터 확인
    const members = getAllRows('MEMBERS');
    if (members.length !== 2) throw new Error('MEMBERS 행 수 오류: ' + members.length);
    if (members[0].name !== '정준기') throw new Error('첫 번째 멤버 이름 오류: ' + members[0].name);
    if (members[1].name !== '박정민') throw new Error('두 번째 멤버 이름 오류: ' + members[1].name);

    // setConfig / getConfig 라운드트립
    setConfig('_TEST_KEY', 'test_value_123');
    const val = getConfig('_TEST_KEY');
    if (val !== 'test_value_123') throw new Error('setConfig/getConfig 오류: ' + val);
    // 테스트 키 정리 (옵션)
    const row = findRowBy('CONFIG', 'key', '_TEST_KEY');
    if (row) updateCell('CONFIG', row._rowIndex, 'value', '');

    Logger.log('✅ 초기화 테스트 전체 PASS');
  }
  ```

- [ ] **Step 6: 초기화 테스트 실행**

  에디터 드롭다운 → `test_initializeSpreadsheet` → ▶ 실행

  예상 출력:
  ```
  === 초기화 테스트 시작 ===
  ✅ 초기화 테스트 전체 PASS
  ```

---

## Task 4: TransactionService.gs — 거래 CRUD

**Files:**
- Create: `[GAS Project]/TransactionService.gs`

**Interfaces:**
- Consumes:
  - `Utils.gs`: `generateId`, `formatDate`, `formatDateTime`, `parseAmount`, `validateRequired`, `successResponse`, `errorResponse`
  - `SheetService.gs`: `getAllRows`, `appendRow`, `updateRow`, `findRowBy`
- Produces:
  - `addTransaction(data: TransactionInput): Response`
  - `getTransactions(filters?: TransactionFilters): Response`
  - `deleteTransaction(transactionId: string): Response`
  - `resolveTransactionType(flowType: string, category: string): string`

  ```typescript
  // 타입 참고용 (실제 GAS에는 타입 불필요)
  type TransactionInput = {
    date: string;           // 'YYYY-MM-DD'
    member: string;         // '정준기' | '박정민'
    flow_type: string;      // '플러스' | '마이너스' | '이동·저축·상환'
    category: string;
    detail?: string;
    amount: string | number;
    memo?: string;
  };
  type TransactionFilters = {
    yearMonth?: string;     // 'YYYY-MM'
    member?: string;
    flow_type?: string;
    category?: string;
  };
  type Response = { success: true, data: any } | { success: false, error: string };
  ```

- [ ] **Step 1: TransactionService.gs 파일 생성**

  Apps Script 에디터 → "+" → "스크립트" → 이름: `TransactionService`

  ```javascript
  // ============================================================
  // TransactionService.gs - 거래 입력/조회/삭제
  // ============================================================

  // flow_type → 기본 transaction_type 매핑
  const FLOW_TYPE_DEFAULTS = {
    '플러스':        '수입',
    '마이너스':      '소비',
    '이동·저축·상환': '계좌이동'
  };

  // category → transaction_type 정밀 매핑
  // (여기 없는 카테고리는 flow_type 기본값 사용)
  const CATEGORY_TYPE_MAP = {
    '급여':       '수입',
    '보너스':     '수입',
    '기타소득':   '기타소득',
    '부모님지원': '수입',
    '국가지원금': '수입',
    '환급금':     '수입',
    '이자수익':   '수입',
    '대출상환':   '대출상환',
    '적금':       '적금',
    '예금':       '적금',
    '비상금':     '비상금저축',
    '계좌이동':   '계좌이동',
    '환불':       '환불',
  };

  /**
   * flow_type과 category를 보고 내부 transaction_type 결정
   * 대시보드 계산에서 소비/수입/자산이동 구분에 사용
   */
  function resolveTransactionType(flowType, category) {
    if (CATEGORY_TYPE_MAP[category]) {
      return CATEGORY_TYPE_MAP[category];
    }
    return FLOW_TYPE_DEFAULTS[flowType] || '소비';
  }

  /**
   * 거래 추가
   *
   * @param {Object} data
   *   date        {string}         'YYYY-MM-DD' — 생략 시 오늘
   *   member      {string}         '정준기' 또는 '박정민'
   *   flow_type   {string}         '플러스' | '마이너스' | '이동·저축·상환'
   *   category    {string}         대분류
   *   detail      {string}         세부내용 (선택)
   *   amount      {string|number}  금액 (양수)
   *   memo        {string}         메모 (선택)
   * @returns {{ success: boolean, data?: Object, error?: string }}
   */
  function addTransaction(data) {
    try {
      // 필수값 검증
      const validationError = validateRequired(data, ['member', 'flow_type', 'category', 'amount']);
      if (validationError) return errorResponse(validationError);

      const amount = parseAmount(data.amount);
      if (amount <= 0) return errorResponse('금액은 0보다 커야 합니다.');

      const validFlowTypes = ['플러스', '마이너스', '이동·저축·상환'];
      if (!validFlowTypes.includes(data.flow_type)) {
        return errorResponse('유효하지 않은 flow_type: ' + data.flow_type);
      }

      const now = formatDateTime(new Date());
      const id = generateId('T');
      const transactionType = resolveTransactionType(data.flow_type, data.category);
      const date = data.date || formatDate(new Date());

      const row = {
        transaction_id:   id,
        date:             date,
        member:           data.member,
        flow_type:        data.flow_type,
        transaction_type: transactionType,
        category:         data.category,
        detail:           data.detail  || '',
        amount:           amount,
        memo:             data.memo    || '',
        created_at:       now,
        updated_at:       now,
        is_deleted:       false
      };

      appendRow('TRANSACTIONS', row);
      Logger.log('거래 추가: ' + id + ' | ' + data.flow_type + ' | ' + data.category + ' | ' + formatAmount(amount) + '원');
      return successResponse(row);
    } catch (e) {
      return errorResponse('거래 저장 오류: ' + e.message);
    }
  }

  /**
   * 거래 목록 조회
   *
   * @param {Object} filters (선택)
   *   yearMonth  {string}  'YYYY-MM' — 해당 월 필터
   *   member     {string}  멤버 이름 필터
   *   flow_type  {string}  플러스/마이너스/이동·저축·상환 필터
   *   category   {string}  카테고리 필터
   * @returns {{ success: boolean, data?: Object[], error?: string }}
   */
  function getTransactions(filters) {
    try {
      let rows = getAllRows('TRANSACTIONS');
      const f = filters || {};

      if (f.yearMonth) {
        rows = rows.filter(r => String(r.date).startsWith(f.yearMonth));
      }
      if (f.member) {
        rows = rows.filter(r => r.member === f.member);
      }
      if (f.flow_type) {
        rows = rows.filter(r => r.flow_type === f.flow_type);
      }
      if (f.category) {
        rows = rows.filter(r => r.category === f.category);
      }

      // 날짜 내림차순, 같은 날이면 created_at 내림차순
      rows.sort((a, b) => {
        const dateDiff = String(b.date).localeCompare(String(a.date));
        if (dateDiff !== 0) return dateDiff;
        return String(b.created_at).localeCompare(String(a.created_at));
      });

      return successResponse(rows);
    } catch (e) {
      return errorResponse('거래 조회 오류: ' + e.message);
    }
  }

  /**
   * 거래 soft delete (is_deleted = true, updated_at 갱신)
   *
   * @param {string} transactionId
   * @returns {{ success: boolean, data?: Object, error?: string }}
   */
  function deleteTransaction(transactionId) {
    try {
      if (!transactionId) return errorResponse('transaction_id가 필요합니다.');

      const row = findRowBy('TRANSACTIONS', 'transaction_id', transactionId);
      if (!row) return errorResponse('거래를 찾을 수 없습니다: ' + transactionId);

      if (row.is_deleted === true || row.is_deleted === 'TRUE') {
        return errorResponse('이미 삭제된 거래입니다: ' + transactionId);
      }

      updateRow('TRANSACTIONS', row._rowIndex, {
        is_deleted: true,
        updated_at: formatDateTime(new Date())
      });

      Logger.log('거래 삭제(soft): ' + transactionId);
      return successResponse({ transaction_id: transactionId });
    } catch (e) {
      return errorResponse('거래 삭제 오류: ' + e.message);
    }
  }
  ```

- [ ] **Step 2: Tests.gs에 TransactionService 테스트 추가**

  `Tests.gs`에 아래 함수 추가:

  ```javascript
  function test_TransactionService() {
    Logger.log('=== TransactionService 테스트 시작 ===');

    const today = formatDate(new Date());
    const ym = getCurrentYearMonth();

    // resolveTransactionType 테스트
    if (resolveTransactionType('마이너스', '식비') !== '소비') throw new Error('식비는 소비여야 함');
    if (resolveTransactionType('플러스', '급여') !== '수입') throw new Error('급여는 수입이어야 함');
    if (resolveTransactionType('이동·저축·상환', '대출상환') !== '대출상환') throw new Error('대출상환 매핑 오류');
    if (resolveTransactionType('이동·저축·상환', '적금') !== '적금') throw new Error('적금 매핑 오류');
    if (resolveTransactionType('이동·저축·상환', '비상금') !== '비상금저축') throw new Error('비상금 매핑 오류');
    // 미정의 카테고리는 flow_type 기본값
    if (resolveTransactionType('마이너스', '알수없는카테고리') !== '소비') throw new Error('기본값 오류');
    Logger.log('  resolveTransactionType PASS');

    // addTransaction 정상 케이스
    const result1 = addTransaction({
      date: today, member: '정준기', flow_type: '마이너스',
      category: '식비', detail: '테스트 점심', amount: '12,000원', memo: '테스트'
    });
    if (!result1.success) throw new Error('addTransaction 실패: ' + result1.error);
    if (result1.data.transaction_type !== '소비') throw new Error('transaction_type 오류: ' + result1.data.transaction_type);
    if (result1.data.amount !== 12000) throw new Error('amount 파싱 오류: ' + result1.data.amount);
    const tid1 = result1.data.transaction_id;
    Logger.log('  addTransaction(소비) PASS: ' + tid1);

    // addTransaction 필수값 누락
    const result2 = addTransaction({ member: '정준기', amount: 5000 });
    if (result2.success) throw new Error('필수값 누락인데 성공 반환');
    Logger.log('  addTransaction(필수값 누락) PASS');

    // addTransaction 금액 0
    const result3 = addTransaction({ date: today, member: '박정민', flow_type: '플러스', category: '급여', amount: 0 });
    if (result3.success) throw new Error('금액 0인데 성공 반환');
    Logger.log('  addTransaction(금액 0) PASS');

    // getTransactions - 이번 달 조회
    const listResult = getTransactions({ yearMonth: ym });
    if (!listResult.success) throw new Error('getTransactions 실패: ' + listResult.error);
    const found = listResult.data.find(r => r.transaction_id === tid1);
    if (!found) throw new Error('추가한 거래가 조회되지 않음');
    Logger.log('  getTransactions PASS');

    // 정준기 필터
    const jungiResult = getTransactions({ yearMonth: ym, member: '정준기' });
    if (jungiResult.data.find(r => r.member !== '정준기')) throw new Error('멤버 필터 오류');
    Logger.log('  getTransactions(member 필터) PASS');

    // deleteTransaction
    const delResult = deleteTransaction(tid1);
    if (!delResult.success) throw new Error('deleteTransaction 실패: ' + delResult.error);

    // 삭제 후 조회 시 제외되어야 함
    const afterDel = getTransactions({ yearMonth: ym });
    if (afterDel.data.find(r => r.transaction_id === tid1)) throw new Error('삭제 후에도 조회됨');
    Logger.log('  deleteTransaction PASS');

    // 이미 삭제된 거래 재삭제 시도
    const redelResult = deleteTransaction(tid1);
    if (redelResult.success) throw new Error('이미 삭제된 거래 재삭제 성공 반환');
    Logger.log('  이중 삭제 방지 PASS');

    Logger.log('✅ TransactionService 테스트 전체 PASS');
  }
  ```

- [ ] **Step 3: TransactionService 테스트 실행**

  에디터 드롭다운 → `test_TransactionService` → ▶ 실행

  예상 출력:
  ```
  === TransactionService 테스트 시작 ===
    resolveTransactionType PASS
    addTransaction(소비) PASS: T2026XXXXXXXX
    addTransaction(필수값 누락) PASS
    addTransaction(금액 0) PASS
    getTransactions PASS
    getTransactions(member 필터) PASS
    deleteTransaction PASS
    이중 삭제 방지 PASS
  ✅ TransactionService 테스트 전체 PASS
  ```

---

## Task 5: DashboardService.gs — 대시보드 계산

**Files:**
- Create: `[GAS Project]/DashboardService.gs`

**Interfaces:**
- Consumes:
  - `Utils.gs`: `getCurrentYearMonth`, `getCurrentWeekRange`, `getLastWeekRange`, `parseAmount`, `formatAmount`, `successResponse`, `errorResponse`
  - `SheetService.gs`: `getAllRows`
- Produces:
  - `getDashboardData(yearMonth?: string): Response`

  반환 data 구조:
  ```javascript
  {
    yearMonth:        string,   // 'YYYY-MM'
    income:           number,   // 이번 달 수입 합계
    expense:          number,   // 이번 달 소비 합계
    assetMove:        number,   // 이번 달 자산이동 합계 (적금+대출상환+비상금 등)
    netSaving:        number,   // income - expense
    thisWeekExpense:  number,   // 이번 주 소비
    lastWeekExpense:  number,   // 지난 주 소비
    weeklyDiff:       number,   // thisWeek - lastWeek (양수=증가, 음수=감소)
    totalLoanBalance: number,   // 총 대출잔액
    totalSaved:       number,   // 총 저축 모은 돈
    categoryExpense:  Object    // { '식비': 30000, '교통': 15000, ... }
  }
  ```

- [ ] **Step 1: DashboardService.gs 파일 생성**

  Apps Script 에디터 → "+" → "스크립트" → 이름: `DashboardService`

  ```javascript
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
      const thisMonthTx = allTransactions.filter(r => String(r.date).startsWith(ym));

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
        const d = String(r.date).substring(0, 10); // 'YYYY-MM-DD'만 비교
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
  ```

- [ ] **Step 2: Tests.gs에 DashboardService 테스트 추가**

  `Tests.gs`에 아래 함수 추가:

  ```javascript
  function test_DashboardService() {
    Logger.log('=== DashboardService 테스트 시작 ===');

    const today = formatDate(new Date());
    const ym = getCurrentYearMonth();

    // 테스트용 거래 데이터 삽입
    const t1 = addTransaction({ date: today, member: '정준기',  flow_type: '플러스',        category: '급여',     detail: '월급', amount: 3000000 });
    const t2 = addTransaction({ date: today, member: '박정민',  flow_type: '마이너스',       category: '식비',     detail: '저녁', amount: 50000 });
    const t3 = addTransaction({ date: today, member: '정준기',  flow_type: '마이너스',       category: '카페/간식',detail: '커피', amount: 4500 });
    const t4 = addTransaction({ date: today, member: '정준기',  flow_type: '이동·저축·상환', category: '적금',     detail: '월납', amount: 300000 });
    const t5 = addTransaction({ date: today, member: '박정민',  flow_type: '이동·저축·상환', category: '대출상환', detail: '상환', amount: 500000 });
    const t6 = addTransaction({ date: today, member: '박정민',  flow_type: '플러스',         category: '기타소득', detail: '용돈', amount: 100000 });

    const ids = [t1.data.transaction_id, t2.data.transaction_id, t3.data.transaction_id,
                 t4.data.transaction_id, t5.data.transaction_id, t6.data.transaction_id];

    const result = getDashboardData(ym);
    if (!result.success) throw new Error('getDashboardData 실패: ' + result.error);

    const d = result.data;
    Logger.log('  수입: ' + formatAmount(d.income));
    Logger.log('  소비: ' + formatAmount(d.expense));
    Logger.log('  자산이동: ' + formatAmount(d.assetMove));
    Logger.log('  순저축: ' + formatAmount(d.netSaving));
    Logger.log('  카테고리별: ' + JSON.stringify(d.categoryExpense));

    // 수입 = 3,000,000 + 100,000 = 3,100,000 (급여+기타소득)
    if (d.income < 3100000) throw new Error('수입 합산 오류: ' + d.income);

    // 소비 = 50,000 + 4,500 = 54,500 (적금/대출상환은 소비 아님)
    if (d.expense < 54500) throw new Error('소비 합산 오류: ' + d.expense);

    // 자산이동 = 300,000 + 500,000 = 800,000
    if (d.assetMove < 800000) throw new Error('자산이동 합산 오류: ' + d.assetMove);

    // 순저축 = 수입 - 소비 (적금/대출상환 포함 안함)
    if (d.netSaving !== d.income - d.expense) throw new Error('순저축 계산 오류');

    // 카테고리별 소비 확인
    if (!d.categoryExpense['식비']) throw new Error('식비 카테고리 없음');
    if (d.categoryExpense['적금']) throw new Error('적금이 소비로 잡힘 (버그)');

    // 정리: 테스트 거래 삭제
    ids.forEach(id => deleteTransaction(id));

    Logger.log('✅ DashboardService 테스트 전체 PASS');
  }
  ```

- [ ] **Step 3: DashboardService 테스트 실행**

  에디터 드롭다운 → `test_DashboardService` → ▶ 실행

  예상 출력:
  ```
  === DashboardService 테스트 시작 ===
    수입: 3,100,000
    소비: 54,500
    자산이동: 800,000
    순저축: 3,045,500
    카테고리별: {"식비":50000,"카페/간식":4500}
  ✅ DashboardService 테스트 전체 PASS
  ```

---

## Task 6: 전체 테스트 + 샘플 데이터

**Files:**
- Modify: `[GAS Project]/Tests.gs` (runAllTests + 샘플 데이터 함수 추가)

**Interfaces:**
- Consumes: 앞 Task에서 정의한 모든 함수
- Produces:
  - `runAllTests(): void` — 전체 테스트 일괄 실행
  - `insertSampleData(): void` — 테스트용 샘플 거래 삽입

- [ ] **Step 1: Tests.gs에 runAllTests 및 샘플 데이터 함수 추가**

  `Tests.gs`에 아래 두 함수 추가:

  ```javascript
  /** 모든 테스트를 순서대로 실행 */
  function runAllTests() {
    Logger.log('========================================');
    Logger.log('우리집 머니노트 Phase 1 전체 테스트 시작');
    Logger.log('========================================');
    test_Utils();
    test_SheetService();
    test_initializeSpreadsheet();
    test_TransactionService();
    test_DashboardService();
    Logger.log('========================================');
    Logger.log('✅ 전체 테스트 PASS');
    Logger.log('========================================');
  }

  /**
   * 대시보드 확인용 샘플 거래 데이터 삽입
   * 이번 달 기준 현실적인 가계부 데이터
   * 주의: 실제 스프레드시트에 데이터가 쌓임. 초기화 직후에만 사용.
   */
  function insertSampleData() {
    Logger.log('샘플 데이터 삽입 시작...');
    const today = formatDate(new Date());
    const ym = getCurrentYearMonth();
    const year = ym.split('-')[0];
    const month = ym.split('-')[1];

    const samples = [
      // 수입
      { date: year+'-'+month+'-05', member: '정준기', flow_type: '플러스', category: '급여', detail: '정준기 월급', amount: 3200000 },
      { date: year+'-'+month+'-10', member: '박정민', flow_type: '플러스', category: '급여', detail: '박정민 월급', amount: 2800000 },
      { date: year+'-'+month+'-15', member: '박정민', flow_type: '플러스', category: '기타소득', detail: '부모님 용돈', amount: 100000 },

      // 소비
      { date: year+'-'+month+'-01', member: '정준기', flow_type: '마이너스', category: '식비', detail: '마트 장보기', amount: 85000 },
      { date: year+'-'+month+'-02', member: '박정민', flow_type: '마이너스', category: '카페/간식', detail: '스타벅스', amount: 12000 },
      { date: year+'-'+month+'-03', member: '정준기', flow_type: '마이너스', category: '교통', detail: '교통카드 충전', amount: 50000 },
      { date: year+'-'+month+'-04', member: '박정민', flow_type: '마이너스', category: '병원/약국', detail: '내과 진료', amount: 15000 },
      { date: year+'-'+month+'-05', member: '정준기', flow_type: '마이너스', category: '식비', detail: '회사 점심', amount: 12000 },
      { date: year+'-'+month+'-06', member: '박정민', flow_type: '마이너스', category: '쇼핑', detail: '의류 구입', amount: 79000 },
      { date: year+'-'+month+'-07', member: '정준기', flow_type: '마이너스', category: '반려동물', detail: '동물병원', amount: 45000 },
      { date: today,                member: '정준기', flow_type: '마이너스', category: '식비', detail: '편의점', amount: 8500 },
      { date: today,                member: '박정민', flow_type: '마이너스', category: '카페/간식', detail: '메가커피', amount: 4500 },

      // 자산이동
      { date: year+'-'+month+'-05', member: '정준기', flow_type: '이동·저축·상환', category: '적금', detail: '청약저축', amount: 200000 },
      { date: year+'-'+month+'-05', member: '박정민', flow_type: '이동·저축·상환', category: '대출상환', detail: '신용대출 상환', amount: 500000 },
      { date: year+'-'+month+'-05', member: '박정민', flow_type: '이동·저축·상환', category: '비상금', detail: '비상금 저축', amount: 100000 },
    ];

    samples.forEach(s => {
      const result = addTransaction(s);
      if (!result.success) Logger.log('  [WARN] 샘플 삽입 실패: ' + result.error);
    });

    Logger.log('샘플 데이터 삽입 완료. 총 ' + samples.length + '건');
    Logger.log('대시보드 확인: getDashboardData() 실행');

    // 즉시 대시보드 계산 결과 출력
    const dash = getDashboardData();
    if (dash.success) {
      const d = dash.data;
      Logger.log('--- 이번 달 요약 ---');
      Logger.log('수입:    ' + formatAmount(d.income) + '원');
      Logger.log('소비:    ' + formatAmount(d.expense) + '원');
      Logger.log('자산이동: ' + formatAmount(d.assetMove) + '원');
      Logger.log('순저축:  ' + formatAmount(d.netSaving) + '원');
    }
  }
  ```

- [ ] **Step 2: 전체 테스트 실행**

  에디터 드롭다운 → `runAllTests` → ▶ 실행

  예상 출력:
  ```
  ========================================
  우리집 머니노트 Phase 1 전체 테스트 시작
  ========================================
  ✅ Utils 테스트 전체 PASS
  ✅ SheetService 테스트 전체 PASS
  ✅ 초기화 테스트 전체 PASS
  ✅ TransactionService 테스트 전체 PASS
  ✅ DashboardService 테스트 전체 PASS
  ========================================
  ✅ 전체 테스트 PASS
  ========================================
  ```

- [ ] **Step 3: 샘플 데이터 삽입 (선택)**

  전체 테스트가 통과된 이후에만 실행:

  에디터 드롭다운 → `insertSampleData` → ▶ 실행

  예상 Logger 출력:
  ```
  샘플 데이터 삽입 시작...
  샘플 데이터 삽입 완료. 총 15건
  --- 이번 달 요약 ---
  수입:    6,100,000원
  소비:    311,000원
  자산이동: 800,000원
  순저축:  5,789,000원
  ```

  구글 스프레드시트 TRANSACTIONS 시트에서 15개 행이 추가된 것 확인.

- [ ] **Step 4: Phase 1 완료 확인 체크리스트**

  - [ ] 10개 시트 모두 생성됨 (CONFIG, MEMBERS, ACCOUNTS, TRANSACTIONS, FIXED_EXPENSES, LOANS, SAVING_GOALS, BUDGETS, CALENDAR_EVENTS, DASHBOARD_CACHE)
  - [ ] 각 시트 헤더 딥블루 배경, 1행 고정됨
  - [ ] CONFIG에 기본값 7개 존재
  - [ ] MEMBERS에 정준기, 박정민 2명 존재
  - [ ] `runAllTests()` 전체 PASS
  - [ ] `insertSampleData()` 실행 후 대시보드 수치 정상 출력
  - [ ] 적금/대출상환이 소비로 집계되지 않음 (DashboardService 테스트에서 확인)

---

## Self-Review

**스펙 커버리지 확인:**
- ✅ 스프레드시트 10개 시트 초기화 (Task 3)
- ✅ 거래 입력 — 플러스/마이너스/이동·저축·상환 (Task 4)
- ✅ 거래 조회 — 월별/멤버별/카테고리별 필터 (Task 4)
- ✅ 거래 삭제 — soft delete (Task 4)
- ✅ flow_type vs transaction_type 분리 (Task 4, `resolveTransactionType`)
- ✅ 대시보드: 수입/소비/자산이동/순저축 (Task 5)
- ✅ 대시보드: 이번 주 vs 지난 주 소비 비교 (Task 5)
- ✅ 대시보드: 총 대출잔액 (Task 5, `_getTotalLoanBalance`)
- ✅ 대시보드: 총 저축 합계 (Task 5, `_getTotalSaved`)
- ✅ 대시보드: 카테고리별 소비 (Task 5, `_getCategoryExpense`)
- ✅ 헤더 기반 시트 접근 (Task 2)
- ✅ KST 날짜 처리 (Task 1, `TIMEZONE = 'Asia/Seoul'`)
- ✅ 금액 항상 양수 저장 (Task 4, `parseAmount` 절댓값)
- ✅ 멱등성 초기화 — 이미 있는 시트 건드리지 않음 (Task 3, `_ensureSheet`)
- ✅ 샘플 데이터 (Task 6, `insertSampleData`)
- ✅ 적금/대출상환/비상금이 소비에 포함되지 않음 (Task 5 EXPENSE_TYPES 분리)

**타입 일관성:**
- `parseAmount` 반환값: `number` — DashboardService `_sumByTypes`에서 number 덧셈으로 사용 ✅
- `getAllRows` 반환 `_rowIndex`: 1-based — `updateRow`, `updateCell` rowIndex 파라미터와 일치 ✅
- `findRowBy` 반환: `Object|null` — `deleteTransaction`에서 null 체크 후 사용 ✅

**플레이스홀더 없음:** 모든 코드 블록은 실제 실행 가능한 GAS 코드.
