# 우리집 머니노트 Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 백엔드 위에 대출/적금 서비스, 캘린더 서비스, 전체 프론트엔드 UI를 완성하여 실제로 작동하는 SPA 웹앱을 만든다.

**Architecture:** Google Apps Script HtmlService SPA 패턴. `index.html`이 진입점이 되어 `include()`로 styles.html, 각 script-*.html을 조합한다. 프론트엔드는 `google.script.run`으로 백엔드 함수를 호출한다. 백엔드는 Phase 1 서비스 위에 LoanService, SavingService, CalendarService를 추가하고 Code.gs가 모든 서비스 함수를 래핑한다.

**Tech Stack:** Google Apps Script V8, Google Spreadsheet, CalendarApp (GAS 내장), HtmlService SPA, Chart.js CDN, Noto Sans KR (Google Fonts CDN)

## Global Constraints

- Google Apps Script V8 런타임 — `const`, `let`, arrow function, template literal 사용 가능
- 모든 날짜/시간은 KST (`TIMEZONE = 'Asia/Seoul'`) 기준
- 시트 접근은 반드시 헤더명 기반 — 열 번호 하드코딩 금지
- 삭제는 soft delete (`is_deleted = true`) — 행 실제 삭제 금지
- 금액은 항상 양수(절댓값) 저장
- 모든 `.gs` 파일 주석은 한국어
- 함수 반환: `{ success: true, data: ... }` 또는 `{ success: false, error: "..." }`
- ID 형식: 접두사 + YYYYMMDD + 랜덤 4자 (예: `L20260705A3F2`)
- `flow_type` UI 표시: 플러스 / 마이너스 / 이동·저축·상환
- `EXPENSE_TYPES = ['소비']` — 적금/대출상환/비상금저축은 ASSET_MOVE_TYPES
- `netSaving = income - expense` (assetMove 미차감)
- 컬러 테마: silver-blue (`#3F5F7F` 헤더, `#6F8FAF` 포인트, `#F0F4F8` 배경)
- 폰트: Noto Sans KR (Google Fonts CDN)
- 모바일 우선 반응형 (최대 너비 480px 기준)
- Phase 1 파일 (`Utils.gs`, `SheetService.gs`, `ConfigService.gs`, `TransactionService.gs`, `DashboardService.gs`) 수정 금지

---

## File Structure

| 파일 | 역할 |
|------|------|
| `Code.gs` | doGet, include, 모든 서비스 래퍼 함수 (수정) |
| `LoanService.gs` | 대출 CRUD, 잔액 업데이트 |
| `SavingService.gs` | 적금/저축 목표 CRUD, 금액 업데이트 |
| `CalendarService.gs` | 일정 CRUD + Google CalendarApp 연동 |
| `styles.html` | 전체 CSS (silver-blue 테마, 모바일 우선) |
| `index.html` | SPA 진입점 — include로 styles/scripts 조합, 탭 5개 HTML 구조 |
| `script-core.html` | 공통 JS: 인증 체크, 탭 전환, toast, modal, 날짜/금액 포맷 유틸 |
| `script-home.html` | 홈 탭: 대시보드 로드, Chart.js 도넛 차트, 주간 비교 |
| `script-input.html` | 입력 탭: flow_type 토글, 카테고리 선택, 폼 submit |
| `script-history.html` | 내역 탭: 거래 목록 렌더링, 월 필터, 삭제 |
| `script-calendar.html` | 캘린더 탭: 월간 달력 렌더링, 일정 추가/수정/삭제 |
| `script-settings.html` | 설정 탭: PIN 변경, 허용 이메일, 멤버 관리 |

---

## Task 1: LoanService.gs

**Files:**
- Create: `money-note/LoanService.gs`
- Modify: `money-note/Code.gs`

**Interfaces:**
- Consumes: `SheetService` (getAllRows, appendRow, updateRow, findRowBy), `Utils` (generateId, formatDate, formatDateTime, successResponse, errorResponse, validateRequired, parseAmount)
- Produces:
  - `addLoan(data): {success, data: loan}` — data: `{member, name, principal, interest_rate, start_date, end_date?, memo?}`
  - `getLoans(filters?): {success, data: loan[]}` — filters: `{member?, is_active?}`
  - `updateLoanBalance(loan_id, repaymentAmount): {success, data: loan}` — `balance -= repaymentAmount`
  - `updateLoan(loan_id, updates): {success, data: loan}`
  - `deactivateLoan(loan_id): {success, data: loan}` — `is_active = false`
- Code.gs 래퍼: `addLoan`, `listLoans`, `repayLoan`, `editLoan`, `closeLoan`

**LOANS 시트 헤더** (ConfigService.gs의 SHEET_HEADERS.LOANS 참고):
`loan_id, member, name, principal, balance, interest_rate, start_date, end_date, is_active, memo, created_at, updated_at, is_deleted`

- [ ] **Step 1: LoanService.gs 작성**

```javascript
// 대출 관리 서비스
const LOAN_PREFIX = 'L';

function addLoan(data) {
  try {
    const err = validateRequired(data, ['member', 'name', 'principal']);
    if (err) return errorResponse(err);
    const principal = parseAmount(data.principal);
    if (principal <= 0) return errorResponse('대출 원금은 0보다 커야 합니다');
    const loan = {
      loan_id: generateId(LOAN_PREFIX),
      member: data.member,
      name: data.name,
      principal: principal,
      balance: principal,
      interest_rate: data.interest_rate || 0,
      start_date: data.start_date || formatDate(),
      end_date: data.end_date || '',
      is_active: true,
      memo: data.memo || '',
      created_at: formatDateTime(),
      updated_at: formatDateTime(),
      is_deleted: false
    };
    SheetService.appendRow('LOANS', loan);
    return successResponse(loan);
  } catch (e) {
    return errorResponse(e.message);
  }
}

function getLoans(filters) {
  try {
    filters = filters || {};
    let rows = SheetService.getAllRows('LOANS');
    if (filters.member) rows = rows.filter(r => r.member === filters.member);
    if (filters.is_active !== undefined) rows = rows.filter(r => r.is_active === filters.is_active);
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return successResponse(rows);
  } catch (e) {
    return errorResponse(e.message);
  }
}

function updateLoanBalance(loan_id, repaymentAmount) {
  try {
    const amount = parseAmount(repaymentAmount);
    if (amount <= 0) return errorResponse('상환 금액은 0보다 커야 합니다');
    const row = SheetService.findRowBy('LOANS', 'loan_id', loan_id);
    if (!row) return errorResponse('대출을 찾을 수 없습니다: ' + loan_id);
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('삭제된 대출입니다');
    }
    const newBalance = Math.max(0, parseAmount(row.balance) - amount);
    SheetService.updateRow('LOANS', row._rowIndex, {
      balance: newBalance,
      updated_at: formatDateTime()
    });
    return successResponse({ ...row, balance: newBalance });
  } catch (e) {
    return errorResponse(e.message);
  }
}

function updateLoan(loan_id, updates) {
  try {
    const row = SheetService.findRowBy('LOANS', 'loan_id', loan_id);
    if (!row) return errorResponse('대출을 찾을 수 없습니다: ' + loan_id);
    const allowed = ['name', 'interest_rate', 'end_date', 'memo'];
    const patch = { updated_at: formatDateTime() };
    allowed.forEach(k => { if (updates[k] !== undefined) patch[k] = updates[k]; });
    SheetService.updateRow('LOANS', row._rowIndex, patch);
    return successResponse({ ...row, ...patch });
  } catch (e) {
    return errorResponse(e.message);
  }
}

function deactivateLoan(loan_id) {
  try {
    const row = SheetService.findRowBy('LOANS', 'loan_id', loan_id);
    if (!row) return errorResponse('대출을 찾을 수 없습니다: ' + loan_id);
    SheetService.updateRow('LOANS', row._rowIndex, {
      is_active: false,
      updated_at: formatDateTime()
    });
    return successResponse({ ...row, is_active: false });
  } catch (e) {
    return errorResponse(e.message);
  }
}
```

- [ ] **Step 2: Code.gs에 래퍼 추가**

기존 Code.gs 하단에 추가:
```javascript
function addLoan(data) { return addLoan(data); }
function listLoans(filters) { return getLoans(filters); }
function repayLoan(loan_id, amount) { return updateLoanBalance(loan_id, amount); }
function editLoan(loan_id, updates) { return updateLoan(loan_id, updates); }
function closeLoan(loan_id) { return deactivateLoan(loan_id); }
```

> ⚠️ Code.gs 래퍼 함수 이름이 서비스 함수와 충돌하지 않도록 래퍼는 `client_` 접두사 대신 다른 이름을 사용한다. 실제 구현에서는 아래 Task 8의 완성된 Code.gs 참고.

- [ ] **Step 3: GAS 에디터에서 수동 테스트**

Apps Script 에디터에서 아래 함수 실행 → Logger 확인:
```javascript
function test_LoanService() {
  // 대출 추가
  const r1 = addLoan({ member: 'M001', name: '주택담보대출', principal: 10000000, interest_rate: 3.5 });
  Logger.log('add: ' + JSON.stringify(r1));
  const id = r1.data.loan_id;

  // 조회
  const r2 = getLoans({ member: 'M001' });
  Logger.log('list: ' + r2.data.length + '건');

  // 상환
  const r3 = updateLoanBalance(id, 500000);
  Logger.log('balance after repay: ' + r3.data.balance);

  // 비활성화
  const r4 = deactivateLoan(id);
  Logger.log('is_active: ' + r4.data.is_active);
}
```
기대값: add success, list 1건, balance = 9500000, is_active = false

- [ ] **Step 4: 커밋**

```bash
git add money-note/LoanService.gs money-note/Code.gs
git commit -m "feat(money-note): LoanService.gs 추가 — 대출 CRUD 및 잔액 상환"
```

---

## Task 2: SavingService.gs

**Files:**
- Create: `money-note/SavingService.gs`
- Modify: `money-note/Code.gs`

**Interfaces:**
- Consumes: `SheetService`, `Utils`
- Produces:
  - `addSavingGoal(data): {success, data}` — data: `{member, name, target_amount, start_date?, end_date?, memo?}`
  - `getSavingGoals(filters?): {success, data: goal[]}` — filters: `{member?, is_active?}`
  - `updateSavingAmount(goal_id, depositAmount): {success, data}` — `saved_amount += depositAmount`
  - `updateSavingGoal(goal_id, updates): {success, data}`
  - `deactivateSavingGoal(goal_id): {success, data}`
- Code.gs 래퍼: `addSavingGoal`, `listSavingGoals`, `depositSaving`, `editSavingGoal`, `closeSavingGoal`

**SAVING_GOALS 시트 헤더**:
`goal_id, member, name, target_amount, saved_amount, start_date, end_date, is_active, memo, created_at, updated_at, is_deleted`

- [ ] **Step 1: SavingService.gs 작성**

```javascript
// 적금/저축 목표 관리 서비스
const SAVING_PREFIX = 'S';

function addSavingGoal(data) {
  try {
    const err = validateRequired(data, ['member', 'name', 'target_amount']);
    if (err) return errorResponse(err);
    const target = parseAmount(data.target_amount);
    if (target <= 0) return errorResponse('목표 금액은 0보다 커야 합니다');
    const goal = {
      goal_id: generateId(SAVING_PREFIX),
      member: data.member,
      name: data.name,
      target_amount: target,
      saved_amount: 0,
      start_date: data.start_date || formatDate(),
      end_date: data.end_date || '',
      is_active: true,
      memo: data.memo || '',
      created_at: formatDateTime(),
      updated_at: formatDateTime(),
      is_deleted: false
    };
    SheetService.appendRow('SAVING_GOALS', goal);
    return successResponse(goal);
  } catch (e) {
    return errorResponse(e.message);
  }
}

function getSavingGoals(filters) {
  try {
    filters = filters || {};
    let rows = SheetService.getAllRows('SAVING_GOALS');
    if (filters.member) rows = rows.filter(r => r.member === filters.member);
    if (filters.is_active !== undefined) rows = rows.filter(r => r.is_active === filters.is_active);
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return successResponse(rows);
  } catch (e) {
    return errorResponse(e.message);
  }
}

function updateSavingAmount(goal_id, depositAmount) {
  try {
    const amount = parseAmount(depositAmount);
    if (amount <= 0) return errorResponse('입금 금액은 0보다 커야 합니다');
    const row = SheetService.findRowBy('SAVING_GOALS', 'goal_id', goal_id);
    if (!row) return errorResponse('저축 목표를 찾을 수 없습니다: ' + goal_id);
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('삭제된 저축 목표입니다');
    }
    const newSaved = parseAmount(row.saved_amount) + amount;
    SheetService.updateRow('SAVING_GOALS', row._rowIndex, {
      saved_amount: newSaved,
      updated_at: formatDateTime()
    });
    return successResponse({ ...row, saved_amount: newSaved });
  } catch (e) {
    return errorResponse(e.message);
  }
}

function updateSavingGoal(goal_id, updates) {
  try {
    const row = SheetService.findRowBy('SAVING_GOALS', 'goal_id', goal_id);
    if (!row) return errorResponse('저축 목표를 찾을 수 없습니다: ' + goal_id);
    const allowed = ['name', 'target_amount', 'end_date', 'memo'];
    const patch = { updated_at: formatDateTime() };
    allowed.forEach(k => {
      if (updates[k] !== undefined) {
        patch[k] = k === 'target_amount' ? parseAmount(updates[k]) : updates[k];
      }
    });
    SheetService.updateRow('SAVING_GOALS', row._rowIndex, patch);
    return successResponse({ ...row, ...patch });
  } catch (e) {
    return errorResponse(e.message);
  }
}

function deactivateSavingGoal(goal_id) {
  try {
    const row = SheetService.findRowBy('SAVING_GOALS', 'goal_id', goal_id);
    if (!row) return errorResponse('저축 목표를 찾을 수 없습니다: ' + goal_id);
    SheetService.updateRow('SAVING_GOALS', row._rowIndex, {
      is_active: false,
      updated_at: formatDateTime()
    });
    return successResponse({ ...row, is_active: false });
  } catch (e) {
    return errorResponse(e.message);
  }
}
```

- [ ] **Step 2: GAS 에디터에서 수동 테스트**

```javascript
function test_SavingService() {
  const r1 = addSavingGoal({ member: 'M001', name: '비상금', target_amount: 5000000 });
  Logger.log('add: ' + JSON.stringify(r1));
  const id = r1.data.goal_id;

  const r2 = updateSavingAmount(id, 300000);
  Logger.log('saved_amount: ' + r2.data.saved_amount); // 300000

  const r3 = getSavingGoals({ member: 'M001', is_active: true });
  Logger.log('active goals: ' + r3.data.length);
}
```

- [ ] **Step 3: 커밋**

```bash
git add money-note/SavingService.gs money-note/Code.gs
git commit -m "feat(money-note): SavingService.gs 추가 — 적금/저축 목표 CRUD"
```

---

## Task 3: CalendarService.gs

**Files:**
- Create: `money-note/CalendarService.gs`
- Modify: `money-note/Code.gs`

**Interfaces:**
- Consumes: `SheetService`, `Utils`, GAS 내장 `CalendarApp`
- Produces:
  - `addCalendarEvent(data): {success, data: event}` — data: `{title, start_date, start_time?, end_date?, end_time?, is_all_day?, member_scope?, category?, color?, reminder_minutes?, location?, memo?, linked_transaction_type?, linked_loan_id?, linked_saving_goal_id?, linked_amount?, created_by}`
  - `getCalendarEvents(filters?): {success, data: event[]}` — filters: `{yearMonth?, member_scope?}`
  - `updateCalendarEvent(event_id, updates): {success, data: event}`
  - `deleteCalendarEvent(event_id): {success, data: event}` — soft delete + Google Calendar 삭제
- Code.gs 래퍼: `addEvent`, `listEvents`, `editEvent`, `removeEvent`

**Google Calendar 연동:**
- `PropertiesService.getScriptProperties().getProperty('CALENDAR_ID')`로 캘린더 ID 조회
- CalendarApp 연동은 캘린더 ID가 설정된 경우에만 동작 (없으면 시트만 저장)
- Google Calendar 이벤트 ID는 `google_event_id`에 저장

- [ ] **Step 1: CalendarService.gs 작성**

```javascript
// 캘린더 일정 관리 서비스 — 시트 저장 + Google Calendar 연동
const EVENT_PREFIX = 'E';

function _getCalendarApp() {
  // Google Calendar ID가 설정된 경우에만 CalendarApp 반환
  const calId = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
  if (!calId) return null;
  try {
    return CalendarApp.getCalendarById(calId);
  } catch (e) {
    return null;
  }
}

function addCalendarEvent(data) {
  try {
    const err = validateRequired(data, ['title', 'start_date', 'created_by']);
    if (err) return errorResponse(err);

    let googleEventId = '';
    const cal = _getCalendarApp();
    if (cal) {
      try {
        const startDt = new Date(data.start_date + (data.start_time ? 'T' + data.start_time : 'T00:00:00'));
        if (data.is_all_day) {
          const gcEvent = cal.createAllDayEvent(data.title, startDt);
          googleEventId = gcEvent.getId();
          if (data.reminder_minutes) gcEvent.addPopupReminder(parseInt(data.reminder_minutes));
          if (data.location) gcEvent.setLocation(data.location);
          if (data.memo) gcEvent.setDescription(data.memo);
        } else {
          const endDt = data.end_date
            ? new Date(data.end_date + (data.end_time ? 'T' + data.end_time : 'T23:59:59'))
            : new Date(startDt.getTime() + 60 * 60 * 1000);
          const gcEvent = cal.createEvent(data.title, startDt, endDt);
          googleEventId = gcEvent.getId();
          if (data.reminder_minutes) gcEvent.addPopupReminder(parseInt(data.reminder_minutes));
          if (data.location) gcEvent.setLocation(data.location);
          if (data.memo) gcEvent.setDescription(data.memo);
        }
      } catch (e) {
        // Google Calendar 실패해도 시트 저장은 진행
      }
    }

    const event = {
      event_id: generateId(EVENT_PREFIX),
      google_event_id: googleEventId,
      title: data.title,
      start_date: data.start_date,
      start_time: data.start_time || '',
      end_date: data.end_date || data.start_date,
      end_time: data.end_time || '',
      is_all_day: data.is_all_day !== false,
      member_scope: data.member_scope || '전체',
      category: data.category || '기타',
      color: data.color || '',
      reminder_minutes: data.reminder_minutes || '',
      location: data.location || '',
      memo: data.memo || '',
      linked_transaction_type: data.linked_transaction_type || '',
      linked_loan_id: data.linked_loan_id || '',
      linked_saving_goal_id: data.linked_saving_goal_id || '',
      linked_amount: data.linked_amount || '',
      created_by: data.created_by,
      created_at: formatDateTime(),
      updated_at: formatDateTime(),
      is_deleted: false
    };
    SheetService.appendRow('CALENDAR_EVENTS', event);
    return successResponse(event);
  } catch (e) {
    return errorResponse(e.message);
  }
}

function getCalendarEvents(filters) {
  try {
    filters = filters || {};
    let rows = SheetService.getAllRows('CALENDAR_EVENTS');
    if (filters.yearMonth) {
      rows = rows.filter(r => r.start_date && r.start_date.startsWith(filters.yearMonth));
    }
    if (filters.member_scope && filters.member_scope !== '전체') {
      rows = rows.filter(r => r.member_scope === '전체' || r.member_scope === filters.member_scope);
    }
    rows.sort((a, b) => (a.start_date + (a.start_time || '')).localeCompare(b.start_date + (b.start_time || '')));
    return successResponse(rows);
  } catch (e) {
    return errorResponse(e.message);
  }
}

function updateCalendarEvent(event_id, updates) {
  try {
    const row = SheetService.findRowBy('CALENDAR_EVENTS', 'event_id', event_id);
    if (!row) return errorResponse('일정을 찾을 수 없습니다: ' + event_id);
    const allowed = ['title', 'start_date', 'start_time', 'end_date', 'end_time',
                     'is_all_day', 'member_scope', 'category', 'color',
                     'reminder_minutes', 'location', 'memo', 'linked_amount'];
    const patch = { updated_at: formatDateTime() };
    allowed.forEach(k => { if (updates[k] !== undefined) patch[k] = updates[k]; });

    // Google Calendar 업데이트
    if (row.google_event_id) {
      const cal = _getCalendarApp();
      if (cal) {
        try {
          const gcEvent = cal.getEventById(row.google_event_id);
          if (gcEvent) {
            if (patch.title) gcEvent.setTitle(patch.title);
            if (patch.memo) gcEvent.setDescription(patch.memo);
            if (patch.location) gcEvent.setLocation(patch.location);
          }
        } catch (e) {}
      }
    }

    SheetService.updateRow('CALENDAR_EVENTS', row._rowIndex, patch);
    return successResponse({ ...row, ...patch });
  } catch (e) {
    return errorResponse(e.message);
  }
}

function deleteCalendarEvent(event_id) {
  try {
    const row = SheetService.findRowBy('CALENDAR_EVENTS', 'event_id', event_id);
    if (!row) return errorResponse('일정을 찾을 수 없습니다: ' + event_id);
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('이미 삭제된 일정입니다');
    }

    // Google Calendar 삭제
    if (row.google_event_id) {
      const cal = _getCalendarApp();
      if (cal) {
        try {
          const gcEvent = cal.getEventById(row.google_event_id);
          if (gcEvent) gcEvent.deleteEvent();
        } catch (e) {}
      }
    }

    SheetService.updateRow('CALENDAR_EVENTS', row._rowIndex, {
      is_deleted: true,
      updated_at: formatDateTime()
    });
    return successResponse({ ...row, is_deleted: true });
  } catch (e) {
    return errorResponse(e.message);
  }
}
```

- [ ] **Step 2: Code.gs 래퍼 추가**

```javascript
function addEvent(data) { return addCalendarEvent(data); }
function listEvents(filters) { return getCalendarEvents(filters); }
function editEvent(event_id, updates) { return updateCalendarEvent(event_id, updates); }
function removeEvent(event_id) { return deleteCalendarEvent(event_id); }
```

- [ ] **Step 3: GAS 에디터에서 수동 테스트**

```javascript
function test_CalendarService() {
  const r1 = addCalendarEvent({
    title: '월급날',
    start_date: '2026-07-25',
    is_all_day: true,
    member_scope: '전체',
    category: '수입',
    created_by: 'M001'
  });
  Logger.log('add: ' + JSON.stringify(r1));
  const id = r1.data.event_id;

  const r2 = getCalendarEvents({ yearMonth: '2026-07' });
  Logger.log('events this month: ' + r2.data.length);

  const r3 = deleteCalendarEvent(id);
  Logger.log('deleted: ' + r3.success);
}
```

- [ ] **Step 4: 커밋**

```bash
git add money-note/CalendarService.gs money-note/Code.gs
git commit -m "feat(money-note): CalendarService.gs 추가 — 일정 CRUD + Google Calendar 연동"
```

---

## Task 4: Code.gs 완성 — 모든 서비스 래퍼 통합

**Files:**
- Modify: `money-note/Code.gs`

**Interfaces:**
- 클라이언트에서 `google.script.run.함수명(args)` 형태로 호출
- saveTransaction은 대출상환/적금 입력 시 자동으로 LoanService/SavingService도 업데이트

- [ ] **Step 1: Code.gs 전체 재작성**

```javascript
// 클라이언트-서버 진입점 — google.script.run 래퍼 모음

function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('우리집 머니노트')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1.0,maximum-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── 대시보드 ──
function getDashboard(yearMonth) {
  return getDashboardData(yearMonth);
}

// ── 거래 — loan_id/saving_goal_id 연동 포함 ──
function saveTransaction(data) {
  const result = addTransaction(data);
  if (result.success) {
    const tx = result.data;
    if (tx.transaction_type === '대출상환' && data.loan_id) {
      try { updateLoanBalance(data.loan_id, tx.amount); } catch (e) {}
    }
    if (['적금', '비상금저축'].includes(tx.transaction_type) && data.saving_goal_id) {
      try { updateSavingAmount(data.saving_goal_id, tx.amount); } catch (e) {}
    }
  }
  return result;
}

function listTransactions(filters) {
  return getTransactions(filters);
}

function removeTransaction(id) {
  return deleteTransaction(id);
}

// ── 대출 ──
function saveLoan(data) { return addLoan(data); }
function listLoans(filters) { return getLoans(filters); }
function repayLoan(loan_id, amount) { return updateLoanBalance(loan_id, amount); }
function editLoan(loan_id, updates) { return updateLoan(loan_id, updates); }
function closeLoan(loan_id) { return deactivateLoan(loan_id); }

// ── 적금/저축 ──
function saveSavingGoal(data) { return addSavingGoal(data); }
function listSavingGoals(filters) { return getSavingGoals(filters); }
function depositSaving(goal_id, amount) { return updateSavingAmount(goal_id, amount); }
function editSavingGoal(goal_id, updates) { return updateSavingGoal(goal_id, updates); }
function closeSavingGoal(goal_id) { return deactivateSavingGoal(goal_id); }

// ── 캘린더 ──
function addEvent(data) { return addCalendarEvent(data); }
function listEvents(filters) { return getCalendarEvents(filters); }
function editEvent(event_id, updates) { return updateCalendarEvent(event_id, updates); }
function removeEvent(event_id) { return deleteCalendarEvent(event_id); }

// ── 설정 ──
function getAppConfig(key) { return getConfig(key); }
function setAppConfig(key, value) { setConfig(key, value); return successResponse(null); }
function getMembers() {
  try {
    const rows = SheetService.getAllRows('MEMBERS');
    return successResponse(rows);
  } catch (e) {
    return errorResponse(e.message);
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add money-note/Code.gs
git commit -m "refactor(money-note): Code.gs 완성 — 모든 서비스 래퍼 통합"
```

---

## Task 5: styles.html — 전체 CSS

**Files:**
- Create: `money-note/styles.html`

**디자인 토큰:**
- 배경: `#F0F4F8`
- 카드 배경: `#FFFFFF`
- 헤더/탭바: `#3F5F7F`
- 포인트: `#6F8FAF`
- 플러스(수입) 색: `#4A90A4`
- 마이너스(소비) 색: `#E57373`
- 이동·저축·상환 색: `#81B29A`
- 텍스트 기본: `#2D3748`
- 텍스트 보조: `#718096`
- 보더: `#E2E8F0`
- 폰트: Noto Sans KR

- [ ] **Step 1: styles.html 작성**

```html
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #F0F4F8;
    --card: #FFFFFF;
    --header: #3F5F7F;
    --accent: #6F8FAF;
    --plus: #4A90A4;
    --minus: #E57373;
    --move: #81B29A;
    --text: #2D3748;
    --text-sub: #718096;
    --border: #E2E8F0;
    --radius: 12px;
    --shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  body {
    font-family: 'Noto Sans KR', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    max-width: 480px;
    margin: 0 auto;
    position: relative;
  }

  /* ── 인증 화면 ── */
  #auth-screen {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px; background: var(--header);
  }
  #auth-screen h1 { color: #fff; font-size: 24px; font-weight: 700; margin-bottom: 8px; }
  #auth-screen p { color: rgba(255,255,255,0.7); font-size: 14px; margin-bottom: 32px; }
  .pin-dots { display: flex; gap: 16px; margin-bottom: 32px; }
  .pin-dot {
    width: 16px; height: 16px; border-radius: 50%;
    background: rgba(255,255,255,0.3); transition: background 0.2s;
  }
  .pin-dot.filled { background: #fff; }
  .pin-pad { display: grid; grid-template-columns: repeat(3, 72px); gap: 12px; }
  .pin-key {
    width: 72px; height: 72px; border-radius: 50%; border: none;
    background: rgba(255,255,255,0.15); color: #fff; font-size: 20px;
    font-family: inherit; cursor: pointer; transition: background 0.15s;
  }
  .pin-key:active { background: rgba(255,255,255,0.35); }
  .pin-key.del { font-size: 16px; }

  /* ── 앱 레이아웃 ── */
  #app { display: none; flex-direction: column; min-height: 100vh; }
  #app.visible { display: flex; }

  .app-header {
    background: var(--header); color: #fff; padding: 16px 20px;
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 100;
  }
  .app-header h1 { font-size: 18px; font-weight: 700; }
  .app-header .month-nav { display: flex; align-items: center; gap: 8px; }
  .app-header .month-nav button {
    background: none; border: none; color: #fff; font-size: 20px; cursor: pointer; padding: 4px;
  }
  .app-header .month-label { font-size: 15px; font-weight: 500; min-width: 80px; text-align: center; }

  .tab-content { flex: 1; overflow-y: auto; padding-bottom: 80px; }
  .tab-pane { display: none; padding: 16px; }
  .tab-pane.active { display: block; }

  .bottom-nav {
    position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 480px; background: var(--card);
    border-top: 1px solid var(--border); display: flex;
    z-index: 100;
  }
  .nav-btn {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    padding: 10px 0; border: none; background: none; color: var(--text-sub);
    font-size: 10px; font-family: inherit; cursor: pointer; gap: 4px;
  }
  .nav-btn .icon { font-size: 22px; }
  .nav-btn.active { color: var(--accent); }
  .nav-btn.active .icon { transform: scale(1.1); }

  /* ── 카드 ── */
  .card {
    background: var(--card); border-radius: var(--radius);
    box-shadow: var(--shadow); padding: 16px; margin-bottom: 12px;
  }
  .card-title { font-size: 13px; color: var(--text-sub); margin-bottom: 8px; }
  .card-value { font-size: 22px; font-weight: 700; color: var(--text); }
  .card-sub { font-size: 12px; color: var(--text-sub); margin-top: 4px; }

  /* ── 홈 탭 ── */
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .summary-card { background: var(--card); border-radius: var(--radius); padding: 14px; box-shadow: var(--shadow); }
  .summary-card .label { font-size: 12px; color: var(--text-sub); }
  .summary-card .amount { font-size: 18px; font-weight: 700; margin-top: 4px; }
  .summary-card .amount.plus { color: var(--plus); }
  .summary-card .amount.minus { color: var(--minus); }
  .summary-card .amount.net { color: var(--header); }
  .chart-wrap { height: 200px; position: relative; }
  .weekly-bar { display: flex; gap: 8px; align-items: flex-end; height: 80px; margin-top: 8px; }
  .weekly-bar .bar { flex: 1; border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.3s; }
  .weekly-bar .bar.this { background: var(--accent); }
  .weekly-bar .bar.last { background: var(--border); }

  /* ── 입력 탭 ── */
  .flow-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
  .flow-btn {
    flex: 1; padding: 10px; border: 2px solid var(--border); border-radius: 8px;
    background: none; font-family: inherit; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.2s; color: var(--text-sub);
  }
  .flow-btn.active-plus { border-color: var(--plus); background: var(--plus); color: #fff; }
  .flow-btn.active-minus { border-color: var(--minus); background: var(--minus); color: #fff; }
  .flow-btn.active-move { border-color: var(--move); background: var(--move); color: #fff; }

  .form-group { margin-bottom: 14px; }
  .form-label { font-size: 13px; color: var(--text-sub); margin-bottom: 6px; display: block; }
  .form-control {
    width: 100%; padding: 12px 14px; border: 1px solid var(--border);
    border-radius: 8px; font-size: 15px; font-family: inherit;
    background: var(--card); color: var(--text); outline: none;
    transition: border-color 0.2s;
  }
  .form-control:focus { border-color: var(--accent); }
  select.form-control { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M0 0l6 8 6-8z' fill='%23718096'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; }

  .category-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cat-btn {
    padding: 10px 4px; border: 1px solid var(--border); border-radius: 8px;
    background: var(--card); font-family: inherit; font-size: 12px;
    cursor: pointer; text-align: center; transition: all 0.2s; color: var(--text);
  }
  .cat-btn.selected { border-color: var(--accent); background: var(--accent); color: #fff; }

  .btn-primary {
    width: 100%; padding: 14px; background: var(--header); color: #fff;
    border: none; border-radius: var(--radius); font-size: 16px;
    font-family: inherit; font-weight: 700; cursor: pointer; margin-top: 8px;
    transition: background 0.2s;
  }
  .btn-primary:active { background: var(--accent); }

  /* ── 내역 탭 ── */
  .tx-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 0; border-bottom: 1px solid var(--border);
  }
  .tx-item:last-child { border-bottom: none; }
  .tx-left { display: flex; align-items: center; gap: 12px; }
  .tx-icon {
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; font-size: 18px;
  }
  .tx-icon.plus { background: rgba(74,144,164,0.12); }
  .tx-icon.minus { background: rgba(229,115,115,0.12); }
  .tx-icon.move { background: rgba(129,178,154,0.12); }
  .tx-cat { font-size: 14px; font-weight: 500; }
  .tx-detail { font-size: 12px; color: var(--text-sub); margin-top: 2px; }
  .tx-amount { font-size: 16px; font-weight: 700; }
  .tx-amount.plus { color: var(--plus); }
  .tx-amount.minus { color: var(--minus); }
  .tx-amount.move { color: var(--move); }
  .tx-date { font-size: 11px; color: var(--text-sub); text-align: right; margin-top: 2px; }

  /* ── 캘린더 탭 ── */
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .cal-header-cell { text-align: center; font-size: 11px; color: var(--text-sub); padding: 4px 0; font-weight: 500; }
  .cal-header-cell:first-child { color: #E57373; }
  .cal-header-cell:last-child { color: var(--accent); }
  .cal-day {
    aspect-ratio: 1; display: flex; flex-direction: column; align-items: center;
    padding: 2px; border-radius: 6px; cursor: pointer; transition: background 0.15s; position: relative;
  }
  .cal-day:hover { background: var(--bg); }
  .cal-day.today { background: var(--accent); }
  .cal-day.today .cal-day-num { color: #fff; font-weight: 700; }
  .cal-day.other-month .cal-day-num { color: var(--border); }
  .cal-day-num { font-size: 13px; line-height: 1.4; }
  .cal-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--minus); margin-top: 1px; }

  /* ── 모달 ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    z-index: 200; display: none; align-items: flex-end;
  }
  .modal-overlay.open { display: flex; }
  .modal-sheet {
    background: var(--card); width: 100%; max-width: 480px; margin: 0 auto;
    border-radius: var(--radius) var(--radius) 0 0; padding: 20px;
    max-height: 90vh; overflow-y: auto;
    animation: slideUp 0.25s ease;
  }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .modal-title { font-size: 17px; font-weight: 700; margin-bottom: 16px; }
  .modal-close {
    position: absolute; top: 16px; right: 16px; background: none;
    border: none; font-size: 22px; cursor: pointer; color: var(--text-sub);
  }

  /* ── Toast ── */
  #toast {
    position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
    background: #2D3748; color: #fff; padding: 10px 20px; border-radius: 20px;
    font-size: 14px; opacity: 0; transition: opacity 0.3s; z-index: 300;
    white-space: nowrap;
  }
  #toast.show { opacity: 1; }

  /* ── 설정 탭 ── */
  .setting-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 0; border-bottom: 1px solid var(--border);
  }
  .setting-label { font-size: 15px; }
  .setting-value { font-size: 14px; color: var(--text-sub); }
  .btn-outline {
    padding: 8px 16px; border: 1px solid var(--accent); border-radius: 8px;
    background: none; color: var(--accent); font-family: inherit; font-size: 13px; cursor: pointer;
  }

  /* ── 유틸 ── */
  .loading { text-align: center; padding: 40px; color: var(--text-sub); font-size: 14px; }
  .empty { text-align: center; padding: 40px; color: var(--text-sub); font-size: 14px; }
  .text-right { text-align: right; }
  .mt-8 { margin-top: 8px; }
  .mb-8 { margin-bottom: 8px; }
  .flex-between { display: flex; justify-content: space-between; align-items: center; }
</style>
```

- [ ] **Step 2: 커밋**

```bash
git add money-note/styles.html
git commit -m "feat(money-note): styles.html 추가 — silver-blue 테마 전체 CSS"
```

---

## Task 6: index.html — SPA 구조

**Files:**
- Modify: `money-note/index.html` (Phase 1 placeholder 교체)

- [ ] **Step 1: index.html 전체 재작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
  <title>우리집 머니노트</title>
  <?!= include('styles'); ?>
</head>
<body>

<!-- 인증 화면 -->
<div id="auth-screen">
  <h1>🏠 우리집 머니노트</h1>
  <p>PIN 4자리를 입력해주세요</p>
  <div class="pin-dots" id="pin-dots">
    <div class="pin-dot" id="dot-0"></div>
    <div class="pin-dot" id="dot-1"></div>
    <div class="pin-dot" id="dot-2"></div>
    <div class="pin-dot" id="dot-3"></div>
  </div>
  <div class="pin-pad">
    <button class="pin-key" onclick="pinInput('1')">1</button>
    <button class="pin-key" onclick="pinInput('2')">2</button>
    <button class="pin-key" onclick="pinInput('3')">3</button>
    <button class="pin-key" onclick="pinInput('4')">4</button>
    <button class="pin-key" onclick="pinInput('5')">5</button>
    <button class="pin-key" onclick="pinInput('6')">6</button>
    <button class="pin-key" onclick="pinInput('7')">7</button>
    <button class="pin-key" onclick="pinInput('8')">8</button>
    <button class="pin-key" onclick="pinInput('9')">9</button>
    <button class="pin-key" onclick="pinInput('0')">0</button>
    <button class="pin-key del" onclick="pinDelete()">⌫</button>
  </div>
</div>

<!-- 앱 본체 -->
<div id="app">
  <header class="app-header">
    <h1 id="header-title">머니노트</h1>
    <div class="month-nav" id="month-nav">
      <button onclick="changeMonth(-1)">‹</button>
      <span class="month-label" id="month-label"></span>
      <button onclick="changeMonth(1)">›</button>
    </div>
  </header>

  <main class="tab-content">
    <!-- 홈 탭 -->
    <div class="tab-pane active" id="tab-home">
      <div class="summary-grid" id="summary-grid">
        <div class="summary-card">
          <div class="label">수입</div>
          <div class="amount plus" id="dash-income">-</div>
        </div>
        <div class="summary-card">
          <div class="label">소비</div>
          <div class="amount minus" id="dash-expense">-</div>
        </div>
        <div class="summary-card">
          <div class="label">순저축</div>
          <div class="amount net" id="dash-net">-</div>
        </div>
        <div class="summary-card">
          <div class="label">자산이동</div>
          <div class="amount" id="dash-asset">-</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">카테고리별 소비</div>
        <div class="chart-wrap"><canvas id="expense-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">주간 소비 비교</div>
        <div id="weekly-compare"></div>
      </div>
    </div>

    <!-- 입력 탭 -->
    <div class="tab-pane" id="tab-input">
      <div class="card">
        <div class="flow-toggle">
          <button class="flow-btn" id="btn-plus" onclick="setFlow('플러스')">＋ 플러스</button>
          <button class="flow-btn" id="btn-minus" onclick="setFlow('마이너스')">－ 마이너스</button>
          <button class="flow-btn" id="btn-move" onclick="setFlow('이동·저축·상환')">⇄ 이동</button>
        </div>
        <div class="form-group">
          <label class="form-label">금액</label>
          <input type="number" class="form-control" id="input-amount" placeholder="0" inputmode="numeric">
        </div>
        <div class="form-group">
          <label class="form-label">카테고리</label>
          <div class="category-grid" id="category-grid"></div>
        </div>
        <div class="form-group">
          <label class="form-label">날짜</label>
          <input type="date" class="form-control" id="input-date">
        </div>
        <div class="form-group">
          <label class="form-label">멤버</label>
          <select class="form-control" id="input-member">
            <option value="M001">정준기</option>
            <option value="M002">박정민</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">메모 (선택)</label>
          <input type="text" class="form-control" id="input-memo" placeholder="메모">
        </div>
        <!-- 대출 연동 (대출상환 카테고리 선택 시 표시) -->
        <div class="form-group" id="loan-group" style="display:none">
          <label class="form-label">연결 대출</label>
          <select class="form-control" id="input-loan-id">
            <option value="">선택 안 함</option>
          </select>
        </div>
        <!-- 적금 연동 (적금/비상금 카테고리 선택 시 표시) -->
        <div class="form-group" id="saving-group" style="display:none">
          <label class="form-label">연결 저축 목표</label>
          <select class="form-control" id="input-saving-id">
            <option value="">선택 안 함</option>
          </select>
        </div>
        <button class="btn-primary" onclick="submitTransaction()">저장</button>
      </div>
    </div>

    <!-- 내역 탭 -->
    <div class="tab-pane" id="tab-history">
      <div class="card" style="padding:12px">
        <select class="form-control" id="history-member-filter" onchange="loadHistory()">
          <option value="">전체 멤버</option>
          <option value="M001">정준기</option>
          <option value="M002">박정민</option>
        </select>
      </div>
      <div class="card" id="history-list">
        <div class="loading">불러오는 중...</div>
      </div>
    </div>

    <!-- 캘린더 탭 -->
    <div class="tab-pane" id="tab-calendar">
      <div class="card" id="calendar-grid-wrap">
        <div class="loading">불러오는 중...</div>
      </div>
      <div class="card" id="calendar-events-list">
        <div class="empty">날짜를 선택하세요</div>
      </div>
    </div>

    <!-- 설정 탭 -->
    <div class="tab-pane" id="tab-settings">
      <div class="card">
        <div class="setting-row">
          <span class="setting-label">PIN 변경</span>
          <button class="btn-outline" onclick="showChangePinModal()">변경</button>
        </div>
        <div class="setting-row">
          <span class="setting-label">현재 월</span>
          <span class="setting-value" id="setting-month"></span>
        </div>
      </div>
    </div>
  </main>

  <!-- 하단 탭바 -->
  <nav class="bottom-nav">
    <button class="nav-btn active" id="nav-home" onclick="switchTab('home')">
      <span class="icon">🏠</span>홈
    </button>
    <button class="nav-btn" id="nav-input" onclick="switchTab('input')">
      <span class="icon">✏️</span>입력
    </button>
    <button class="nav-btn" id="nav-history" onclick="switchTab('history')">
      <span class="icon">📋</span>내역
    </button>
    <button class="nav-btn" id="nav-calendar" onclick="switchTab('calendar')">
      <span class="icon">📅</span>캘린더
    </button>
    <button class="nav-btn" id="nav-settings" onclick="switchTab('settings')">
      <span class="icon">⚙️</span>설정
    </button>
  </nav>
</div>

<!-- 이벤트 추가 모달 -->
<div class="modal-overlay" id="event-modal">
  <div class="modal-sheet" style="position:relative">
    <button class="modal-close" onclick="closeModal('event-modal')">✕</button>
    <div class="modal-title" id="event-modal-title">일정 추가</div>
    <div class="form-group">
      <label class="form-label">제목</label>
      <input type="text" class="form-control" id="event-title">
    </div>
    <div class="form-group">
      <label class="form-label">날짜</label>
      <input type="date" class="form-control" id="event-date">
    </div>
    <div class="form-group">
      <label class="form-label">카테고리</label>
      <select class="form-control" id="event-category">
        <option>급여일</option><option>공과금</option><option>기념일</option>
        <option>약속</option><option>여행</option><option>기타</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">메모</label>
      <input type="text" class="form-control" id="event-memo" placeholder="메모 (선택)">
    </div>
    <button class="btn-primary" onclick="submitEvent()">저장</button>
  </div>
</div>

<!-- PIN 변경 모달 -->
<div class="modal-overlay" id="pin-modal">
  <div class="modal-sheet" style="position:relative">
    <button class="modal-close" onclick="closeModal('pin-modal')">✕</button>
    <div class="modal-title">PIN 변경</div>
    <div class="form-group">
      <label class="form-label">새 PIN (4자리)</label>
      <input type="password" class="form-control" id="new-pin" maxlength="4" inputmode="numeric" placeholder="••••">
    </div>
    <button class="btn-primary" onclick="saveNewPin()">저장</button>
  </div>
</div>

<!-- Toast -->
<div id="toast"></div>

<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

<?!= include('script-core'); ?>
<?!= include('script-home'); ?>
<?!= include('script-input'); ?>
<?!= include('script-history'); ?>
<?!= include('script-calendar'); ?>
<?!= include('script-settings'); ?>
</body>
</html>
```

- [ ] **Step 2: 커밋**

```bash
git add money-note/index.html
git commit -m "feat(money-note): index.html SPA 구조 완성 — 5탭, 모달, 인증 화면"
```

---

## Task 7: script-core.html + script-home.html

**Files:**
- Create: `money-note/script-core.html`
- Create: `money-note/script-home.html`

- [ ] **Step 1: script-core.html 작성**

```html
<script>
// ── 전역 상태 ──
const STATE = {
  currentTab: 'home',
  currentYearMonth: '',  // 'YYYY-MM'
  pin: '',
  loans: [],
  savingGoals: []
};

// ── PIN 인증 ──
let _pinBuffer = '';

function pinInput(digit) {
  if (_pinBuffer.length >= 4) return;
  _pinBuffer += digit;
  document.getElementById('dot-' + (_pinBuffer.length - 1)).classList.add('filled');
  if (_pinBuffer.length === 4) {
    setTimeout(() => verifyPin(_pinBuffer), 100);
  }
}

function pinDelete() {
  if (_pinBuffer.length === 0) return;
  _pinBuffer = _pinBuffer.slice(0, -1);
  document.getElementById('dot-' + _pinBuffer.length).classList.remove('filled');
}

function verifyPin(pin) {
  google.script.run
    .withSuccessHandler(result => {
      if (result && result.success && result.data === pin) {
        STATE.pin = pin;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app').classList.add('visible');
        initApp();
      } else {
        showToast('PIN이 틀렸습니다');
        _pinBuffer = '';
        document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
      }
    })
    .withFailureHandler(() => showToast('오류가 발생했습니다'))
    .getAppConfig('PIN_CODE');
}

// ── 앱 초기화 ──
function initApp() {
  const now = new Date();
  STATE.currentYearMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  updateMonthLabel();
  loadLoansAndGoals();
  switchTab('home');
}

function loadLoansAndGoals() {
  google.script.run
    .withSuccessHandler(r => { if (r.success) STATE.loans = r.data; })
    .listLoans({ is_active: true });
  google.script.run
    .withSuccessHandler(r => { if (r.success) STATE.savingGoals = r.data; })
    .listSavingGoals({ is_active: true });
}

// ── 월 이동 ──
function changeMonth(delta) {
  const [y, m] = STATE.currentYearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  STATE.currentYearMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  updateMonthLabel();
  refreshCurrentTab();
}

function updateMonthLabel() {
  const [y, m] = STATE.currentYearMonth.split('-');
  document.getElementById('month-label').textContent = y + '년 ' + parseInt(m) + '월';
  const el = document.getElementById('setting-month');
  if (el) el.textContent = y + '년 ' + parseInt(m) + '월';
}

function refreshCurrentTab() {
  if (STATE.currentTab === 'home') loadDashboard();
  else if (STATE.currentTab === 'history') loadHistory();
  else if (STATE.currentTab === 'calendar') loadCalendar();
}

// ── 탭 전환 ──
function switchTab(tab) {
  STATE.currentTab = tab;
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('nav-' + tab).classList.add('active');

  // 월 네비게이션은 홈/내역/캘린더에서만 표시
  const showMonth = ['home', 'history', 'calendar'].includes(tab);
  document.getElementById('month-nav').style.display = showMonth ? 'flex' : 'none';
  document.getElementById('header-title').textContent =
    tab === 'home' ? '머니노트' :
    tab === 'input' ? '거래 입력' :
    tab === 'history' ? '거래 내역' :
    tab === 'calendar' ? '캘린더' : '설정';

  if (tab === 'home') loadDashboard();
  else if (tab === 'history') loadHistory();
  else if (tab === 'calendar') loadCalendar();
  else if (tab === 'input') initInputTab();
}

// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Modal ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── 포맷 유틸 ──
function fmtAmount(n) {
  if (n === undefined || n === null || n === '') return '-';
  return Number(n).toLocaleString('ko-KR') + '원';
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
</script>
```

- [ ] **Step 2: script-home.html 작성**

```html
<script>
let _expenseChart = null;

function loadDashboard() {
  document.getElementById('dash-income').textContent = '...';
  google.script.run
    .withSuccessHandler(renderDashboard)
    .withFailureHandler(() => showToast('대시보드 로드 실패'))
    .getDashboard(STATE.currentYearMonth);
}

function renderDashboard(result) {
  if (!result || !result.success) { showToast('대시보드 오류'); return; }
  const d = result.data;

  document.getElementById('dash-income').textContent = fmtAmount(d.income);
  document.getElementById('dash-expense').textContent = fmtAmount(d.expense);
  document.getElementById('dash-net').textContent = fmtAmount(d.netSaving);
  document.getElementById('dash-asset').textContent = fmtAmount(d.assetMove);

  _renderExpenseChart(d.categoryExpense || {});
  _renderWeeklyCompare(d.thisWeekExpense || 0, d.lastWeekExpense || 0, d.weeklyDiff || 0);
}

function _renderExpenseChart(categoryExpense) {
  const entries = Object.entries(categoryExpense).filter(([,v]) => v > 0);
  const ctx = document.getElementById('expense-chart');
  if (!ctx) return;

  if (_expenseChart) { _expenseChart.destroy(); _expenseChart = null; }

  if (entries.length === 0) {
    ctx.style.display = 'none';
    ctx.parentElement.innerHTML = '<div class="empty">이번 달 소비 내역이 없습니다</div>';
    return;
  }

  ctx.style.display = '';
  _expenseChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([,v]) => v),
        backgroundColor: ['#6F8FAF','#E57373','#81B29A','#F6BD60','#A8C5DA','#C7B9FF','#FFAD8F']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Noto Sans KR', size: 12 } } },
        tooltip: { callbacks: { label: ctx => ' ' + fmtAmount(ctx.raw) } }
      }
    }
  });
}

function _renderWeeklyCompare(thisWeek, lastWeek, diff) {
  const max = Math.max(thisWeek, lastWeek, 1);
  const thisH = Math.round((thisWeek / max) * 80);
  const lastH = Math.round((lastWeek / max) * 80);
  const sign = diff >= 0 ? '+' : '';
  const color = diff > 0 ? '#E57373' : '#81B29A';
  document.getElementById('weekly-compare').innerHTML = `
    <div style="display:flex;gap:16px;align-items:flex-end;height:80px">
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="flex:1;width:100%;display:flex;align-items:flex-end">
          <div style="width:100%;height:${lastH}px;background:#E2E8F0;border-radius:4px 4px 0 0"></div>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="flex:1;width:100%;display:flex;align-items:flex-end">
          <div style="width:100%;height:${thisH}px;background:#6F8FAF;border-radius:4px 4px 0 0"></div>
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#718096;margin-top:8px">
      <span>지난주 ${fmtAmount(lastWeek)}</span>
      <span style="color:${color};font-weight:600">${sign}${fmtAmount(diff)}</span>
      <span>이번주 ${fmtAmount(thisWeek)}</span>
    </div>`;
}
</script>
```

- [ ] **Step 3: 커밋**

```bash
git add money-note/script-core.html money-note/script-home.html
git commit -m "feat(money-note): script-core + script-home — PIN 인증, 탭 전환, 대시보드"
```

---

## Task 8: script-input.html + script-history.html

**Files:**
- Create: `money-note/script-input.html`
- Create: `money-note/script-history.html`

**카테고리 맵 (flow_type별):**
- 플러스: 급여, 보너스, 기타소득, 부모님지원, 국가지원금, 환급금, 이자수익
- 마이너스: 식비, 카페/간식, 쇼핑, 교통, 주거/통신, 의료/건강, 문화/여가, 교육, 기타지출
- 이동·저축·상환: 대출상환, 적금, 예금, 비상금, 계좌이동

> ⚠️ TransactionService의 CATEGORY_TYPE_MAP에 없는 카테고리(식비, 카페/간식 등)는 flow_type fallback으로 `소비`로 처리됨. 이는 의도된 동작.

- [ ] **Step 1: script-input.html 작성**

```html
<script>
const CATEGORIES = {
  '플러스': ['급여','보너스','기타소득','부모님지원','국가지원금','환급금','이자수익'],
  '마이너스': ['식비','카페/간식','쇼핑','교통','주거/통신','의료/건강','문화/여가','교육','기타지출'],
  '이동·저축·상환': ['대출상환','적금','예금','비상금','계좌이동']
};
const LOAN_LINK_CATS = ['대출상환'];
const SAVING_LINK_CATS = ['적금','예금','비상금'];

let _currentFlow = '마이너스';
let _selectedCat = '';

function initInputTab() {
  setFlow('마이너스');
  document.getElementById('input-date').value = todayStr();
  document.getElementById('input-amount').value = '';
  document.getElementById('input-memo').value = '';
  _selectedCat = '';
  _populateLoanSelect();
  _populateSavingSelect();
}

function setFlow(flow) {
  _currentFlow = flow;
  _selectedCat = '';

  // 버튼 스타일
  ['plus','minus','move'].forEach(id => document.getElementById('btn-' + id).className = 'flow-btn');
  if (flow === '플러스') document.getElementById('btn-plus').classList.add('active-plus');
  else if (flow === '마이너스') document.getElementById('btn-minus').classList.add('active-minus');
  else document.getElementById('btn-move').classList.add('active-move');

  // 카테고리 그리드 재렌더
  const grid = document.getElementById('category-grid');
  grid.innerHTML = CATEGORIES[flow].map(cat =>
    `<button class="cat-btn" onclick="selectCat('${cat}')" id="cat-${cat.replace(/[^가-힣a-z0-9]/gi,'_')}">${cat}</button>`
  ).join('');

  // 연동 필드 숨김
  document.getElementById('loan-group').style.display = 'none';
  document.getElementById('saving-group').style.display = 'none';
}

function selectCat(cat) {
  _selectedCat = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  const safeId = 'cat-' + cat.replace(/[^가-힣a-z0-9]/gi,'_');
  const el = document.getElementById(safeId);
  if (el) el.classList.add('selected');

  // 연동 필드 표시
  document.getElementById('loan-group').style.display = LOAN_LINK_CATS.includes(cat) ? 'block' : 'none';
  document.getElementById('saving-group').style.display = SAVING_LINK_CATS.includes(cat) ? 'block' : 'none';
}

function _populateLoanSelect() {
  const sel = document.getElementById('input-loan-id');
  sel.innerHTML = '<option value="">선택 안 함</option>' +
    STATE.loans.map(l => `<option value="${l.loan_id}">${l.name} (잔액 ${fmtAmount(l.balance)})</option>`).join('');
}

function _populateSavingSelect() {
  const sel = document.getElementById('input-saving-id');
  sel.innerHTML = '<option value="">선택 안 함</option>' +
    STATE.savingGoals.map(g => `<option value="${g.goal_id}">${g.name} (${fmtAmount(g.saved_amount)} / ${fmtAmount(g.target_amount)})</option>`).join('');
}

function submitTransaction() {
  const amount = parseInt(document.getElementById('input-amount').value, 10);
  if (!amount || amount <= 0) { showToast('금액을 입력해주세요'); return; }
  if (!_selectedCat) { showToast('카테고리를 선택해주세요'); return; }

  const data = {
    member: document.getElementById('input-member').value,
    flow_type: _currentFlow,
    category: _selectedCat,
    amount: amount,
    date: document.getElementById('input-date').value,
    memo: document.getElementById('input-memo').value,
    loan_id: document.getElementById('input-loan-id').value,
    saving_goal_id: document.getElementById('input-saving-id').value
  };

  const btn = document.querySelector('#tab-input .btn-primary');
  btn.disabled = true;
  btn.textContent = '저장 중...';

  google.script.run
    .withSuccessHandler(result => {
      btn.disabled = false;
      btn.textContent = '저장';
      if (result && result.success) {
        showToast('저장했습니다');
        initInputTab();
        loadLoansAndGoals();
      } else {
        showToast((result && result.error) || '저장 실패');
      }
    })
    .withFailureHandler(() => {
      btn.disabled = false;
      btn.textContent = '저장';
      showToast('오류가 발생했습니다');
    })
    .saveTransaction(data);
}
</script>
```

- [ ] **Step 2: script-history.html 작성**

```html
<script>
const FLOW_ICONS = { '플러스': '💰', '마이너스': '💳', '이동·저축·상환': '🔄' };
const FLOW_CLASS = { '플러스': 'plus', '마이너스': 'minus', '이동·저축·상환': 'move' };
const FLOW_SIGN = { '플러스': '+', '마이너스': '-', '이동·저축·상환': '' };

function loadHistory() {
  const el = document.getElementById('history-list');
  el.innerHTML = '<div class="loading">불러오는 중...</div>';
  const member = document.getElementById('history-member-filter').value;
  const filters = { yearMonth: STATE.currentYearMonth };
  if (member) filters.member = member;

  google.script.run
    .withSuccessHandler(renderHistory)
    .withFailureHandler(() => { el.innerHTML = '<div class="empty">불러오기 실패</div>'; })
    .listTransactions(filters);
}

function renderHistory(result) {
  const el = document.getElementById('history-list');
  if (!result || !result.success || result.data.length === 0) {
    el.innerHTML = '<div class="empty">거래 내역이 없습니다</div>';
    return;
  }
  el.innerHTML = result.data.map(tx => {
    const flow = tx.flow_type || '마이너스';
    const cls = FLOW_CLASS[flow] || 'minus';
    const sign = FLOW_SIGN[flow] || '';
    const icon = FLOW_ICONS[flow] || '💳';
    const dateStr = (tx.date || '').substring(5); // MM-DD
    return `<div class="tx-item">
      <div class="tx-left">
        <div class="tx-icon ${cls}">${icon}</div>
        <div>
          <div class="tx-cat">${tx.category || ''}</div>
          <div class="tx-detail">${tx.memo || tx.detail || ''}</div>
        </div>
      </div>
      <div class="text-right">
        <div class="tx-amount ${cls}">${sign}${fmtAmount(tx.amount)}</div>
        <div class="tx-date">${dateStr} · ${tx.member === 'M001' ? '정준기' : '박정민'}</div>
      </div>
    </div>`;
  }).join('');
}
</script>
```

- [ ] **Step 3: 커밋**

```bash
git add money-note/script-input.html money-note/script-history.html
git commit -m "feat(money-note): script-input + script-history — 거래 입력 및 내역 조회"
```

---

## Task 9: script-calendar.html + script-settings.html

**Files:**
- Create: `money-note/script-calendar.html`
- Create: `money-note/script-settings.html`

- [ ] **Step 1: script-calendar.html 작성**

```html
<script>
let _calEvents = [];
let _selectedCalDate = '';
let _editingEventId = null;

function loadCalendar() {
  google.script.run
    .withSuccessHandler(result => {
      _calEvents = (result && result.success) ? result.data : [];
      _renderCalendarGrid();
    })
    .withFailureHandler(() => showToast('캘린더 로드 실패'))
    .listEvents({ yearMonth: STATE.currentYearMonth });
}

function _renderCalendarGrid() {
  const [y, m] = STATE.currentYearMonth.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1).getDay(); // 0=일
  const lastDate = new Date(y, m, 0).getDate();
  const today = todayStr();

  // 이벤트 날짜 집합
  const eventDates = new Set(_calEvents.map(e => e.start_date));

  let html = '<div class="cal-grid">';
  ['일','월','화','수','목','금','토'].forEach(d => {
    html += `<div class="cal-header-cell">${d}</div>`;
  });

  // 앞 공백
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day other-month"><div class="cal-day-num"></div></div>';

  for (let d = 1; d <= lastDate; d++) {
    const dateStr = y + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isToday = dateStr === today;
    const hasEvent = eventDates.has(dateStr);
    html += `<div class="cal-day${isToday ? ' today' : ''}" onclick="selectCalDate('${dateStr}')">
      <div class="cal-day-num">${d}</div>
      ${hasEvent ? '<div class="cal-dot"></div>' : ''}
    </div>`;
  }
  html += '</div>';

  document.getElementById('calendar-grid-wrap').innerHTML = html +
    `<button class="btn-primary mt-8" onclick="openAddEventModal()">+ 일정 추가</button>`;

  if (_selectedCalDate) _renderCalendarEvents(_selectedCalDate);
}

function selectCalDate(dateStr) {
  _selectedCalDate = dateStr;
  _renderCalendarEvents(dateStr);
}

function _renderCalendarEvents(dateStr) {
  const events = _calEvents.filter(e => e.start_date === dateStr);
  const el = document.getElementById('calendar-events-list');
  if (events.length === 0) {
    el.innerHTML = `<div class="empty">${dateStr} 일정 없음</div>`;
    return;
  }
  el.innerHTML = events.map(ev => `
    <div class="tx-item">
      <div class="tx-left">
        <div class="tx-icon move">📌</div>
        <div>
          <div class="tx-cat">${ev.title}</div>
          <div class="tx-detail">${ev.category || ''} ${ev.memo ? '· ' + ev.memo : ''}</div>
        </div>
      </div>
      <div class="text-right">
        <button class="btn-outline" style="font-size:11px;padding:4px 8px" onclick="deleteEvent('${ev.event_id}')">삭제</button>
      </div>
    </div>`).join('');
}

function openAddEventModal() {
  _editingEventId = null;
  document.getElementById('event-modal-title').textContent = '일정 추가';
  document.getElementById('event-title').value = '';
  document.getElementById('event-date').value = _selectedCalDate || todayStr();
  document.getElementById('event-memo').value = '';
  openModal('event-modal');
}

function submitEvent() {
  const title = document.getElementById('event-title').value.trim();
  if (!title) { showToast('제목을 입력해주세요'); return; }
  const data = {
    title,
    start_date: document.getElementById('event-date').value,
    category: document.getElementById('event-category').value,
    memo: document.getElementById('event-memo').value,
    is_all_day: true,
    member_scope: '전체',
    created_by: 'M001'
  };
  google.script.run
    .withSuccessHandler(result => {
      if (result && result.success) {
        closeModal('event-modal');
        showToast('일정이 추가되었습니다');
        loadCalendar();
      } else {
        showToast((result && result.error) || '저장 실패');
      }
    })
    .withFailureHandler(() => showToast('오류가 발생했습니다'))
    .addEvent(data);
}

function deleteEvent(event_id) {
  if (!confirm('일정을 삭제하시겠습니까?')) return;
  google.script.run
    .withSuccessHandler(result => {
      if (result && result.success) {
        showToast('삭제했습니다');
        loadCalendar();
      } else {
        showToast((result && result.error) || '삭제 실패');
      }
    })
    .withFailureHandler(() => showToast('오류가 발생했습니다'))
    .removeEvent(event_id);
}
</script>
```

- [ ] **Step 2: script-settings.html 작성**

```html
<script>
function showChangePinModal() {
  document.getElementById('new-pin').value = '';
  openModal('pin-modal');
}

function saveNewPin() {
  const pin = document.getElementById('new-pin').value;
  if (!/^\d{4}$/.test(pin)) { showToast('PIN은 숫자 4자리여야 합니다'); return; }
  google.script.run
    .withSuccessHandler(result => {
      if (result && result.success) {
        closeModal('pin-modal');
        showToast('PIN이 변경되었습니다');
      } else {
        showToast((result && result.error) || '변경 실패');
      }
    })
    .withFailureHandler(() => showToast('오류가 발생했습니다'))
    .setAppConfig('PIN_CODE', pin);
}
</script>
```

- [ ] **Step 3: 커밋**

```bash
git add money-note/script-calendar.html money-note/script-settings.html
git commit -m "feat(money-note): script-calendar + script-settings — 캘린더 및 설정"
```

---

## 최종 확인 체크리스트

모든 Task 완료 후 GAS 에디터에서 확인:

- [ ] `initializeSpreadsheet()` 실행 → 모든 시트 생성 확인
- [ ] 웹앱 배포 (`배포 > 새 배포 > 웹 앱`) → URL 접속
- [ ] PIN 입력 (`0000` 기본값) → 앱 진입
- [ ] 거래 입력 → 홈 대시보드 반영
- [ ] 캘린더 일정 추가
- [ ] 내역 월 필터 동작
