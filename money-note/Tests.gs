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
