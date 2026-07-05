// ============================================================
// SavingService.gs - 적금/저축 목표 관리 서비스
// Phase 2: 적금/저축 목표 추가, 조회, 입금, 수정, 비활성화
// ============================================================

const SAVING_PREFIX = 'S';

/**
 * 새 적금/저축 목표 추가
 * @param {Object} data - 적금 정보 {member, name, target_amount, start_date?, end_date?, memo?}
 * @returns {Object} {success, data: 생성된 적금 객체}
 */
function addSavingGoal(data) {
  try {
    const err = validateRequired(data, ['member', 'name', 'target_amount']);
    if (err) return errorResponse(err);

    const target = parseAmount(data.target_amount);
    if (target <= 0) return errorResponse('목표 금액은 0보다 커야 합니다');

    const now = formatDateTime();
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
      created_at: now,
      updated_at: now,
      is_deleted: false
    };

    SheetService.appendRow('SAVING_GOALS', goal);
    return successResponse(goal);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 적금/저축 목표 목록 조회
 * @param {Object} filters - 필터 조건 {member?, is_active?}
 * @returns {Object} {success, data: 적금 배열 (최신순)}
 */
function getSavingGoals(filters) {
  try {
    filters = filters || {};
    let rows = SheetService.getAllRows('SAVING_GOALS');

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
 * 적금 입금 (저축 금액 증가)
 * @param {string} goal_id - 적금 ID
 * @param {number|string} depositAmount - 입금 금액
 * @returns {Object} {success, data: 업데이트된 적금 객체}
 */
function updateSavingAmount(goal_id, depositAmount) {
  try {
    const amount = parseAmount(depositAmount);
    if (amount <= 0) return errorResponse('입금 금액은 0보다 커야 합니다');

    const row = SheetService.findRowBy('SAVING_GOALS', 'goal_id', goal_id);
    if (!row) return errorResponse('저축 목표를 찾을 수 없습니다: ' + goal_id);

    // 삭제된 적금 확인
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('삭제된 저축 목표입니다');
    }

    const newSaved = parseAmount(row.saved_amount) + amount;
    const now = formatDateTime();

    SheetService.updateRow('SAVING_GOALS', row._rowIndex, {
      saved_amount: newSaved,
      updated_at: now
    });

    // 응답에는 최신 정보 포함
    return successResponse({ ...row, saved_amount: newSaved, updated_at: now });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 적금 목표 정보 수정 (name, target_amount, end_date, memo만 수정 가능)
 * @param {string} goal_id - 적금 ID
 * @param {Object} updates - 수정할 필드 {name?, target_amount?, end_date?, memo?}
 * @returns {Object} {success, data: 업데이트된 적금 객체}
 */
function updateSavingGoal(goal_id, updates) {
  try {
    const row = SheetService.findRowBy('SAVING_GOALS', 'goal_id', goal_id);
    if (!row) return errorResponse('저축 목표를 찾을 수 없습니다: ' + goal_id);

    // 삭제된 적금 확인
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('삭제된 저축 목표입니다');
    }

    // 허용된 필드만 업데이트
    const allowed = ['name', 'target_amount', 'end_date', 'memo'];
    const patch = { updated_at: formatDateTime() };

    allowed.forEach(k => {
      if (updates[k] !== undefined) {
        patch[k] = k === 'target_amount' ? parseAmount(updates[k]) : updates[k];
      }
    });

    SheetService.updateRow('SAVING_GOALS', row._rowIndex, patch);

    // 응답에는 최신 정보 포함
    return successResponse({ ...row, ...patch });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * 적금 목표 비활성화 (삭제 대신 is_active = false)
 * @param {string} goal_id - 적금 ID
 * @returns {Object} {success, data: 업데이트된 적금 객체}
 */
function deactivateSavingGoal(goal_id) {
  try {
    const row = SheetService.findRowBy('SAVING_GOALS', 'goal_id', goal_id);
    if (!row) return errorResponse('저축 목표를 찾을 수 없습니다: ' + goal_id);

    // 삭제된 적금 확인
    if (row.is_deleted === true || row.is_deleted === 'TRUE' || row.is_deleted === 'true') {
      return errorResponse('삭제된 저축 목표입니다');
    }

    const now = formatDateTime();
    SheetService.updateRow('SAVING_GOALS', row._rowIndex, {
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
 * SavingService 테스트 함수
 * GAS 에디터에서 test_SavingService() 실행 후 Logger 확인
 */
function test_SavingService() {
  Logger.log('=== SavingService 테스트 시작 ===');

  // 적금 추가
  const r1 = addSavingGoal({
    member: 'M001',
    name: '비상금',
    target_amount: 5000000
  });
  Logger.log('1. 적금 추가: ' + JSON.stringify(r1));
  if (!r1.success) {
    Logger.log('실패: ' + r1.error);
    return;
  }

  const id = r1.data.goal_id;
  Logger.log('생성된 적금 ID: ' + id);

  // 조회
  const r2 = getSavingGoals({ member: 'M001' });
  Logger.log('2. 조회: ' + r2.data.length + '건');

  // 입금 (300,000원)
  const r3 = updateSavingAmount(id, 300000);
  Logger.log('3. 입금 후 saved_amount: ' + r3.data.saved_amount + ' (기대값: 300000)');

  // 비활성화
  const r4 = deactivateSavingGoal(id);
  Logger.log('4. 비활성화 후 is_active: ' + r4.data.is_active + ' (기대값: false)');

  Logger.log('=== SavingService 테스트 완료 ===');
}
