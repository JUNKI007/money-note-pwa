// ============================================================
// TransactionService.gs - 거래 입력/조회/수정/삭제
// ============================================================

// Date 객체 또는 문자열을 'YYYY-MM' 형식으로 변환
function _dateToYM(d) {
  if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');
  return String(d).slice(0, 7);
}

// Date 객체 또는 문자열을 'YYYY-MM-DD' 문자열로 변환 (정렬용)
function _dateToStr(d) {
  if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(d).slice(0, 10);
}

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
      rows = rows.filter(r => _dateToYM(r.date) === f.yearMonth);
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
      const dateDiff = _dateToStr(b.date).localeCompare(_dateToStr(a.date));
      if (dateDiff !== 0) return dateDiff;
      return _dateToStr(b.created_at).localeCompare(_dateToStr(a.created_at));
    });

    return successResponse(rows);
  } catch (e) {
    return errorResponse('거래 조회 오류: ' + e.message);
  }
}

/**
 * 거래 수정 (변경 필드만 업데이트)
 *
 * @param {string} transactionId
 * @param {Object} updates - 변경할 필드들
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function updateTransaction(transactionId, updates) {
  try {
    if (!transactionId) return errorResponse('transaction_id가 필요합니다.');

    const row = findRowBy('TRANSACTIONS', 'transaction_id', transactionId);
    if (!row) return errorResponse('거래를 찾을 수 없습니다: ' + transactionId);

    const allowed = ['date', 'member', 'flow_type', 'category', 'detail', 'amount', 'memo'];
    const patch = {};
    allowed.forEach(function(k) {
      if (updates[k] !== undefined) patch[k] = updates[k];
    });

    // flow_type 또는 category 변경 시 transaction_type 재결정
    if (patch.flow_type || patch.category) {
      const newFlowType = patch.flow_type || row.flow_type;
      const newCategory = patch.category || row.category;
      patch.transaction_type = resolveTransactionType(newFlowType, newCategory);
    }

    patch.updated_at = formatDateTime(new Date());
    updateRow('TRANSACTIONS', row._rowIndex, patch);

    Logger.log('거래 수정: ' + transactionId);
    return successResponse(Object.assign({}, row, patch));
  } catch (e) {
    return errorResponse('거래 수정 오류: ' + e.message);
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

/**
 * 거래 일괄 추가 (카드 이용내역 가져오기 등)
 * category 빈 값 허용 — 사용자가 나중에 내역 탭에서 수정
 *
 * @param {Object[]} transactions - 거래 배열
 * @returns {{ success: boolean, data: { saved: number, errors: number } }}
 */
function bulkSaveTransactions(transactions) {
  try {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return errorResponse('거래 목록이 비어있습니다');
    }

    var saved = 0;
    var errors = 0;
    var now = formatDateTime(new Date());

    var rows = transactions.map(function(data) {
      try {
        var amount = parseAmount(data.amount);
        if (amount <= 0) { errors++; return null; }

        var flowType = data.flow_type || '마이너스';
        var category = data.category || '';
        var transactionType = category
          ? resolveTransactionType(flowType, category)
          : (flowType === '마이너스' ? '소비' : '수입');

        saved++;
        return {
          transaction_id:   generateId('T'),
          date:             data.date || formatDate(new Date()),
          member:           data.member || '공동',
          flow_type:        flowType,
          transaction_type: transactionType,
          category:         category,
          detail:           data.detail  || '',
          amount:           amount,
          memo:             data.memo    || '',
          created_at:       now,
          updated_at:       now,
          is_deleted:       false
        };
      } catch (_) {
        errors++;
        return null;
      }
    }).filter(function(r) { return r !== null; });

    // 시트에 일괄 추가
    rows.forEach(function(row) { appendRow('TRANSACTIONS', row); });

    Logger.log('일괄 거래 추가: ' + saved + '건 성공, ' + errors + '건 실패');
    return successResponse({ saved: saved, errors: errors });
  } catch (e) {
    return errorResponse('일괄 거래 저장 오류: ' + e.message);
  }
}
