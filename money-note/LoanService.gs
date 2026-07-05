// ============================================================
// LoanService.gs - 대출 관리 서비스
// Phase 2: 대출 추가, 조회, 상환, 수정, 비활성화
// ============================================================

const LOAN_PREFIX = 'L';

/**
 * 새 대출 추가
 * @param {Object} data - 대출 정보 {member, name, principal, interest_rate?, start_date?, end_date?, memo?}
 * @returns {Object} {success, data: 생성된 대출 객체}
 */
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

/**
 * 대출 목록 조회
 * @param {Object} filters - 필터 조건 {member?, is_active?}
 * @returns {Object} {success, data: 대출 배열 (최신순)}
 */
function getLoans(filters) {
  try {
    filters = filters || {};
    let rows = SheetService.getAllRows('LOANS');

    if (filters.member) {
      rows = rows.filter(r => r.member === filters.member);
    }
    if (filters.is_active !== undefined) {
      const want = filters.is_active === true || filters.is_active === 'true' || filters.is_active === 'TRUE';
      rows = rows.filter(r => {
        const val = r.is_active === true || r.is_active === 'true' || r.is_active === 'TRUE';
        return val === want;
      });
    }

    // 최신순 정렬 (created_at 기준)
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    return successResponse(rows);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 대출 잔액 감소 (상환)
 * @param {string} loan_id - 대출 ID
 * @param {number|string} repaymentAmount - 상환 금액
 * @returns {Object} {success, data: 업데이트된 대출 객체}
 */
function updateLoanBalance(loan_id, repaymentAmount) {
  try {
    const amount = parseAmount(repaymentAmount);
    if (amount <= 0) return errorResponse('상환 금액은 0보다 커야 합니다');

    const row = SheetService.findRowBy('LOANS', 'loan_id', loan_id);
    if (!row) return errorResponse('대출을 찾을 수 없습니다: ' + loan_id);

    // 삭제된 대출 확인
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('삭제된 대출입니다');
    }

    // 잔액 감소 (최소 0)
    const newBalance = Math.max(0, parseAmount(row.balance) - amount);
    const now = formatDateTime();

    SheetService.updateRow('LOANS', row._rowIndex, {
      balance: newBalance,
      updated_at: now
    });

    // 응답에는 최신 정보 포함
    return successResponse({ ...row, balance: newBalance, updated_at: now });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 대출 정보 수정 (name, interest_rate, end_date, memo만 수정 가능)
 * @param {string} loan_id - 대출 ID
 * @param {Object} updates - 수정할 필드 {name?, interest_rate?, end_date?, memo?}
 * @returns {Object} {success, data: 업데이트된 대출 객체}
 */
function updateLoan(loan_id, updates) {
  try {
    const row = SheetService.findRowBy('LOANS', 'loan_id', loan_id);
    if (!row) return errorResponse('대출을 찾을 수 없습니다: ' + loan_id);

    // 삭제된 대출 확인
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('삭제된 대출입니다');
    }

    // 허용된 필드만 업데이트
    const allowed = ['name', 'interest_rate', 'end_date', 'memo'];
    const patch = { updated_at: formatDateTime() };

    allowed.forEach(k => {
      if (updates[k] !== undefined) {
        patch[k] = updates[k];
      }
    });

    SheetService.updateRow('LOANS', row._rowIndex, patch);

    // 응답에는 최신 정보 포함
    return successResponse({ ...row, ...patch });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 대출 비활성화 (삭제 대신 is_active = false)
 * @param {string} loan_id - 대출 ID
 * @returns {Object} {success, data: 업데이트된 대출 객체}
 */
function deactivateLoan(loan_id) {
  try {
    const row = SheetService.findRowBy('LOANS', 'loan_id', loan_id);
    if (!row) return errorResponse('대출을 찾을 수 없습니다: ' + loan_id);

    // 삭제된 대출 확인
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('삭제된 대출입니다');
    }

    const now = formatDateTime();
    SheetService.updateRow('LOANS', row._rowIndex, {
      is_active: false,
      updated_at: now
    });

    // 응답에는 최신 정보 포함
    return successResponse({ ...row, is_active: false, updated_at: now });
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ──────────────────────────────────────────────
// 테스트 함수 (GAS 에디터에서 수동 실행)
// ──────────────────────────────────────────────

/**
 * LoanService 테스트 함수
 * GAS 에디터에서 test_LoanService() 실행 후 Logger 확인
 */
function test_LoanService() {
  Logger.log('=== LoanService 테스트 시작 ===');

  // 대출 추가
  const r1 = addLoan({
    member: 'M001',
    name: '주택담보대출',
    principal: 10000000,
    interest_rate: 3.5
  });
  Logger.log('1. 대출 추가: ' + JSON.stringify(r1));
  if (!r1.success) {
    Logger.log('실패: ' + r1.error);
    return;
  }

  const id = r1.data.loan_id;
  Logger.log('생성된 대출 ID: ' + id);

  // 조회
  const r2 = getLoans({ member: 'M001' });
  Logger.log('2. 조회: ' + r2.data.length + '건');

  // 상환 (500,000원)
  const r3 = updateLoanBalance(id, 500000);
  Logger.log('3. 상환 후 잔액: ' + r3.data.balance + ' (기대값: 9500000)');

  // 비활성화
  const r4 = deactivateLoan(id);
  Logger.log('4. 비활성화 후 is_active: ' + r4.data.is_active + ' (기대값: false)');

  Logger.log('=== LoanService 테스트 완료 ===');
}
