import { useState, useMemo } from 'react'
import { Trash2, TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
dayjs.locale('ko')
import { useAllowanceEntries, useAddAllowanceEntry, useDeleteAllowanceEntry } from '@/hooks/useAllowance'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AnimatePresence, motion } from 'framer-motion'

const MEMBER_DISPLAY: Record<string, string> = { '남편': '준기', '아내': '정민' }
const MEMBERS = ['남편', '아내'] as const

function fmt(n: number) {
  if (Math.abs(n) >= 10_000) return Math.round(n / 10_000) + '만원'
  return n.toLocaleString('ko-KR') + '원'
}
function fmtFull(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function AllowanceCalendar({
  yearMonth,
  dailyMap,
  selectedDay,
  onDayClick,
}: {
  yearMonth: string
  dailyMap: Record<string, { out: number; in: number }>
  selectedDay: string | null
  onDayClick: (d: string) => void
}) {
  const monthStart = dayjs(yearMonth + '-01')
  const daysInMonth = monthStart.daysInMonth()
  const startDow = monthStart.day()
  const today = dayjs().format('YYYY-MM-DD')

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const dateStr = monthStart.date(day).format('YYYY-MM-DD')
          const info = dailyMap[dateStr]
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDay
          const dow = (startDow + day - 1) % 7
          return (
            <button key={day} className="flex flex-col items-center py-0.5" onClick={() => onDayClick(dateStr)}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium ${
                isSelected ? 'bg-purple-500 text-white'
                : isToday ? 'bg-purple-200 text-purple-800'
                : info ? 'text-text-primary'
                : dow === 0 ? 'text-red-300'
                : dow === 6 ? 'text-blue-300'
                : 'text-gray-300'
              }`}>
                {day}
              </div>
              {info?.out ? (
                <span className="text-[8px] text-red-400 leading-tight mt-0.5">-{fmt(info.out)}</span>
              ) : info?.in ? (
                <span className="text-[8px] text-green-500 leading-tight mt-0.5">+{fmt(info.in)}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AllowanceScreen() {
  const [activeMember, setActiveMember] = useState<'남편' | '아내'>('남편')
  const [calendarMonth, setCalendarMonth] = useState(dayjs().format('YYYY-MM'))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [addSheet, setAddSheet] = useState(false)
  const [addType, setAddType] = useState<'지출' | '입금'>('지출')
  const [addForm, setAddForm] = useState({ date: dayjs().format('YYYY-MM-DD'), detail: '', amount: '', memo: '' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: entries } = useAllowanceEntries(activeMember)
  const addEntry = useAddAllowanceEntry()
  const deleteEntry = useDeleteAllowanceEntry()

  const allEntries = entries ?? []

  // 전체 누적 잔액
  const balance = useMemo(
    () => allEntries.reduce((s, e) => s + (e.type === '입금' ? e.amount : -e.amount), 0),
    [allEntries]
  )

  // 현재 캘린더 달 집계
  const thisMonthEntries = useMemo(
    () => allEntries.filter((e) => e.date?.slice(0, 7) === calendarMonth),
    [allEntries, calendarMonth]
  )
  const thisMonthIn = thisMonthEntries.filter((e) => e.type === '입금').reduce((s, e) => s + e.amount, 0)
  const thisMonthOut = thisMonthEntries.filter((e) => e.type === '지출').reduce((s, e) => s + e.amount, 0)

  // 일별 맵
  const dailyMap = useMemo(() => {
    const map: Record<string, { out: number; in: number }> = {}
    thisMonthEntries.forEach((e) => {
      if (!map[e.date]) map[e.date] = { out: 0, in: 0 }
      if (e.type === '지출') map[e.date].out += e.amount
      else map[e.date].in += e.amount
    })
    return map
  }, [thisMonthEntries])

  // 선택된 날 항목
  const selectedDayEntries = useMemo(
    () => (selectedDay ? allEntries.filter((e) => e.date === selectedDay) : []),
    [selectedDay, allEntries]
  )

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
  const isCurrentMonth = calendarMonth >= dayjs().format('YYYY-MM')

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <h1 className="text-xl font-bold text-text-primary">용돈 관리</h1>

      {/* 멤버 탭 */}
      <div className="flex gap-2">
        {MEMBERS.map((m) => (
          <button
            key={m}
            onClick={() => { setActiveMember(m); setSelectedDay(null) }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors
              ${activeMember === m ? 'bg-purple-600 text-white shadow-sm' : 'bg-card text-text-sub'}`}
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
            <p className="text-[10px] text-purple-300 mb-0.5">{dayjs(calendarMonth).format('M월')} 입금</p>
            <p className="text-sm font-bold text-green-300">+{fmtFull(thisMonthIn)}</p>
          </div>
          <div>
            <p className="text-[10px] text-purple-300 mb-0.5">{dayjs(calendarMonth).format('M월')} 지출</p>
            <p className="text-sm font-bold text-red-300">-{fmtFull(thisMonthOut)}</p>
          </div>
          <div>
            <p className="text-[10px] text-purple-300 mb-0.5">순변화</p>
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
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-green-50 text-green-600 font-semibold text-sm"
        >
          <TrendingUp size={16} />
          입금
        </button>
        <button
          onClick={() => openAdd('지출')}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-red-50 text-red-500 font-semibold text-sm"
        >
          <TrendingDown size={16} />
          지출
        </button>
      </div>

      {/* 캘린더 */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => { setCalendarMonth(dayjs(calendarMonth).subtract(1, 'month').format('YYYY-MM')); setSelectedDay(null) }}
            className="p-1.5 text-gray-400 active:text-text-primary"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold text-text-primary">{dayjs(calendarMonth).format('YYYY년 M월')}</span>
          <button
            onClick={() => {
              const next = dayjs(calendarMonth).add(1, 'month').format('YYYY-MM')
              if (next <= dayjs().format('YYYY-MM')) { setCalendarMonth(next); setSelectedDay(null) }
            }}
            className={`p-1.5 ${isCurrentMonth ? 'opacity-20' : 'text-gray-400 active:text-text-primary'}`}
            disabled={isCurrentMonth}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <AllowanceCalendar
          yearMonth={calendarMonth}
          dailyMap={dailyMap}
          selectedDay={selectedDay}
          onDayClick={(d) => setSelectedDay((prev) => (prev === d ? null : d))}
        />

        {/* 선택된 날 내역 */}
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-text-sub mb-2">
                  {dayjs(selectedDay).format('M월 D일 (ddd)')} 내역
                </p>
                {selectedDayEntries.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-3">내역이 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEntries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between py-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{e.detail || '-'}</p>
                          {e.memo && <p className="text-[10px] text-text-sub">{e.memo}</p>}
                        </div>
                        <span className={`text-xs font-semibold mx-3 shrink-0 ${e.type === '입금' ? 'text-green-600' : 'text-red-500'}`}>
                          {e.type === '입금' ? '+' : '-'}{fmtFull(e.amount)}
                        </span>
                        <button className="p-1 text-gray-300 active:text-red-400" onClick={() => setConfirmDeleteId(e.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {selectedDayEntries.some((e) => e.type === '지출') && (
                      <div className="flex justify-between pt-2 border-t border-gray-50">
                        <span className="text-[10px] text-gray-400">합계</span>
                        <span className="text-xs font-bold text-red-500">
                          -{fmtFull(selectedDayEntries.filter((e) => e.type === '지출').reduce((s, e) => s + e.amount, 0))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
                  ${addType === t ? (t === '지출' ? 'bg-red-500 text-white' : 'bg-green-500 text-white') : 'bg-bg-app text-text-sub'}`}
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
