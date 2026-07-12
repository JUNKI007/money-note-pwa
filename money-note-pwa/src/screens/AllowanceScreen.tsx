import { useState, useMemo } from 'react'
import { Trash2, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
dayjs.locale('ko')
import { useAllowanceEntries, useAddAllowanceEntry, useDeleteAllowanceEntry } from '@/hooks/useAllowance'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

// 표시 이름 매핑 (member값 → 표시이름)
const MEMBER_DISPLAY: Record<string, string> = { '남편': '준기', '아내': '정민' }
const MEMBERS = ['남편', '아내'] as const

function fmt(n: number) {
  if (Math.abs(n) >= 10_000) return Math.round(n / 10_000) + '만원'
  return n.toLocaleString('ko-KR') + '원'
}
function fmtFull(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export function AllowanceScreen() {
  const [activeMember, setActiveMember] = useState<'남편' | '아내'>('남편')
  const [addSheet, setAddSheet] = useState(false)
  const [addType, setAddType] = useState<'지출' | '입금'>('지출')
  const [addForm, setAddForm] = useState({ date: dayjs().format('YYYY-MM-DD'), detail: '', amount: '', memo: '' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: entries } = useAllowanceEntries(activeMember)
  const addEntry = useAddAllowanceEntry()
  const deleteEntry = useDeleteAllowanceEntry()

  const thisMonth = dayjs().format('YYYY-MM')

  const allEntries = entries ?? []

  // 전체 누적 잔액
  const balance = useMemo(
    () => allEntries.reduce((s, e) => s + (e.type === '입금' ? e.amount : -e.amount), 0),
    [allEntries]
  )

  // 이달 집계
  const thisMonthEntries = useMemo(
    () => allEntries.filter((e) => e.date?.slice(0, 7) === thisMonth),
    [allEntries, thisMonth]
  )
  const thisMonthIn = thisMonthEntries.filter((e) => e.type === '입금').reduce((s, e) => s + e.amount, 0)
  const thisMonthOut = thisMonthEntries.filter((e) => e.type === '지출').reduce((s, e) => s + e.amount, 0)

  // 이달 지출 내역별 집계
  const categoryMap = useMemo(() => {
    const map: Record<string, number> = {}
    thisMonthEntries.filter((e) => e.type === '지출').forEach((e) => {
      const key = e.detail || '기타'
      map[key] = (map[key] ?? 0) + e.amount
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [thisMonthEntries])

  // 최근 거래 (최신순)
  const recentEntries = [...allEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20)

  const openAdd = (type: '지출' | '입금') => {
    setAddType(type)
    setAddForm({ date: dayjs().format('YYYY-MM-DD'), detail: '', amount: '', memo: '' })
    setAddSheet(true)
  }

  const handleAdd = async () => {
    if (!addForm.amount) return
    await addEntry.mutateAsync({
      date: addForm.date,
      member: activeMember,
      type: addType,
      amount: Number(addForm.amount),
      detail: addForm.detail || (addType === '지출' ? '용돈 사용' : '용돈 입금'),
      memo: addForm.memo,
    })
    setAddSheet(false)
  }

  const displayName = MEMBER_DISPLAY[activeMember] ?? activeMember

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <h1 className="text-xl font-bold text-text-primary">용돈 관리</h1>

      {/* 멤버 탭 */}
      <div className="flex gap-2">
        {MEMBERS.map((m) => (
          <button
            key={m}
            onClick={() => setActiveMember(m)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors
              ${activeMember === m ? 'bg-blue-deep text-white shadow-sm' : 'bg-card text-text-sub'}`}
          >
            {MEMBER_DISPLAY[m]}
          </button>
        ))}
      </div>

      {/* 잔액 카드 */}
      <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-3xl p-5 shadow-md">
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={14} className="text-purple-200" />
          <p className="text-xs text-purple-200">{displayName} 잔액</p>
        </div>
        <p className={`text-3xl font-bold tracking-tight mb-4 ${balance >= 0 ? 'text-white' : 'text-red-300'}`}>
          {balance >= 0 ? '' : '-'}{fmtFull(Math.abs(balance))}
        </p>
        <div className="flex gap-4">
          <div>
            <p className="text-[10px] text-purple-300 mb-0.5">이달 입금</p>
            <p className="text-sm font-bold text-green-300">+{fmtFull(thisMonthIn)}</p>
          </div>
          <div>
            <p className="text-[10px] text-purple-300 mb-0.5">이달 지출</p>
            <p className="text-sm font-bold text-red-300">-{fmtFull(thisMonthOut)}</p>
          </div>
          <div>
            <p className="text-[10px] text-purple-300 mb-0.5">이달 순변화</p>
            <p className={`text-sm font-bold ${thisMonthIn - thisMonthOut >= 0 ? 'text-white' : 'text-red-300'}`}>
              {thisMonthIn - thisMonthOut >= 0 ? '+' : ''}{fmt(thisMonthIn - thisMonthOut)}
            </p>
          </div>
        </div>
      </div>

      {/* 입금 / 지출 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={() => openAdd('입금')}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-income/10 text-income font-semibold text-sm"
        >
          <TrendingUp size={16} />
          입금
        </button>
        <button
          onClick={() => openAdd('지출')}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-expense/10 text-expense font-semibold text-sm"
        >
          <TrendingDown size={16} />
          지출
        </button>
      </div>

      {/* 이달 지출 TOP */}
      {categoryMap.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-text-primary mb-3">이달 지출 TOP</p>
          <div className="space-y-2">
            {categoryMap.map(([label, amt]) => {
              const pct = thisMonthOut > 0 ? (amt / thisMonthOut) * 100 : 0
              return (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-text-primary">{label}</span>
                    <span className="text-xs font-semibold text-expense">{fmtFull(amt)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-purple-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          {thisMonthOut > 0 && (
            <p className="text-[10px] text-gray-300 mt-2 text-right">총 {fmtFull(thisMonthOut)} 지출</p>
          )}
        </div>
      )}

      {/* 최근 거래 내역 */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <p className="text-sm font-bold text-text-primary px-4 pt-4 pb-2">최근 내역</p>
        {recentEntries.length === 0 ? (
          <p className="text-xs text-text-sub text-center py-6">내역이 없습니다</p>
        ) : (
          <div>
            {recentEntries.map((e, i) => (
              <div
                key={e.id}
                className={`flex items-center px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{e.detail || '-'}</p>
                  <p className="text-[11px] text-text-sub">{dayjs(e.date).format('M월 D일 (ddd)')}</p>
                </div>
                <span className={`text-sm font-semibold mr-3 ${e.type === '입금' ? 'text-income' : 'text-expense'}`}>
                  {e.type === '입금' ? '+' : '-'}{fmtFull(e.amount)}
                </span>
                <button
                  className="p-1.5 text-gray-300 active:text-expense"
                  onClick={() => setConfirmDeleteId(e.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 입금/지출 추가 시트 */}
      <BottomSheet
        isOpen={addSheet}
        onClose={() => setAddSheet(false)}
        title={`${displayName} 용돈 ${addType}`}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['지출', '입금'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAddType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors
                  ${addType === t ? (t === '지출' ? 'bg-expense text-white' : 'bg-income text-white') : 'bg-bg-app text-text-sub'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">날짜</label>
            <input
              type="date"
              value={addForm.date}
              onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">{addType === '지출' ? '사용 내역' : '입금 내역'}</label>
            <input
              type="text"
              value={addForm.detail}
              onChange={(e) => setAddForm((f) => ({ ...f, detail: e.target.value }))}
              placeholder={addType === '지출' ? '예: 점심, 카페, 쇼핑' : '예: 월 용돈, 선물'}
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">금액 (원)</label>
            <input
              type="number"
              inputMode="numeric"
              value={addForm.amount}
              onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0"
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
            {addForm.amount && !isNaN(Number(addForm.amount)) && (
              <p className="text-xs text-text-sub mt-1">{Number(addForm.amount).toLocaleString('ko-KR')}원</p>
            )}
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">메모 (선택)</label>
            <input
              type="text"
              value={addForm.memo}
              onChange={(e) => setAddForm((f) => ({ ...f, memo: e.target.value }))}
              placeholder="메모"
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
          </div>
          <Button fullWidth onClick={handleAdd} disabled={!addForm.amount || addEntry.isPending}>
            {addEntry.isPending ? '저장 중...' : `${addType} 저장`}
          </Button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        message="이 내역을 삭제하시겠습니까?"
        onConfirm={() => {
          if (confirmDeleteId) deleteEntry.mutate(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
