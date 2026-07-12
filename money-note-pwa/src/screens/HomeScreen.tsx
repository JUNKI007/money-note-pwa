import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { Cell, Tooltip, PieChart, Pie } from 'recharts'
import { useDashboard } from '@/hooks/useDashboard'
import { useLifeBudget } from '@/hooks/useLifeBudget'
import { useTransactions } from '@/hooks/useTransactions'
import { useSavingGoals } from '@/hooks/useSavings'
import { useInstallments } from '@/hooks/useInstallments'
import { useLoans } from '@/hooks/useLoans'
import { useAppStore } from '@/store/appStore'

const CAT_COLORS = ['#6F8FAF', '#2F9E73', '#F59E0B', '#8B5CF6', '#EC4899', '#D64545', '#14B8A6', '#F97316']

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-2xl ${className}`} />
}

function fmt(n: number) {
  if (Math.abs(n) >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억원'
  if (Math.abs(n) >= 10_000) return Math.round(n / 10_000) + '만원'
  return n.toLocaleString('ko-KR') + '원'
}

function fmtFull(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

// ── 일별 미니 캘린더 ──
function MiniCalendar({
  yearMonth,
  dailyMap,
  selectedDay,
  onDayClick,
}: {
  yearMonth: string
  dailyMap: Record<string, { out: number; in: number }>
  selectedDay: string | null
  onDayClick: (date: string) => void
}) {
  const monthStart = dayjs(yearMonth + '-01')
  const daysInMonth = monthStart.daysInMonth()
  const startDow = monthStart.day()

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const today = dayjs().format('YYYY-MM-DD')
  const DOW = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-medium py-1 ${i === 0 ? 'text-expense' : i === 6 ? 'text-blue-main' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const dateStr = monthStart.date(day).format('YYYY-MM-DD')
          const info = dailyMap[dateStr]
          const hasData = info && (info.out > 0 || info.in > 0)
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDay
          const dow = (startDow + day - 1) % 7
          return (
            <button key={day} className="flex flex-col items-center py-0.5" onClick={() => onDayClick(dateStr)}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium ${
                  isSelected
                    ? 'bg-orange-400 text-white'
                    : isToday
                    ? 'bg-blue-deep text-white'
                    : hasData
                    ? 'text-text-primary'
                    : dow === 0
                    ? 'text-expense/60'
                    : dow === 6
                    ? 'text-blue-main/60'
                    : 'text-gray-300'
                }`}
              >
                {day}
              </div>
              {info?.out ? (
                <span className="text-[8px] text-expense leading-tight mt-0.5">-{fmt(info.out)}</span>
              ) : info?.in ? (
                <span className="text-[8px] text-income leading-tight mt-0.5">+{fmt(info.in)}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function HomeScreen() {
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const { data, isLoading } = useDashboard(selectedMonth)
  const { data: lifeBudget } = useLifeBudget()
  const { data: transactions } = useTransactions({ yearMonth: selectedMonth })
  const { data: savingGoals } = useSavingGoals()
  const { data: installments } = useInstallments()
  const { data: loans } = useLoans()
  const isCurrentMonth = selectedMonth >= dayjs().format('YYYY-MM')

  const categoryData = data?.categoryExpense
    ? Object.entries(data.categoryExpense as Record<string, number>)
        .map(([name, amount], i) => ({ name, amount, color: CAT_COLORS[i % CAT_COLORS.length] }))
        .filter((d) => d.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    : []

  const totalExpense = categoryData.reduce((s, d) => s + d.amount, 0)

  // 생활비 예산 계산 (선택된 카테고리 지출 합산)
  const livingBudgetLimit = lifeBudget?.limit ?? 0
  const livingSpent = useMemo(() => {
    if (!lifeBudget?.categories?.length) return 0
    const catExp = data?.categoryExpense as Record<string, number> | undefined
    if (!catExp) return 0
    return lifeBudget.categories.reduce((s, c) => s + (catExp[c] ?? 0), 0)
  }, [lifeBudget, data?.categoryExpense])
  const livingRemain = livingBudgetLimit > 0 ? livingBudgetLimit - livingSpent : null

  // 일별 수입/지출 집계
  const dailyMap = useMemo(() => {
    const map: Record<string, { out: number; in: number }> = {}
    for (const tx of transactions ?? []) {
      if (!tx) continue
      if (!map[tx.date]) map[tx.date] = { out: 0, in: 0 }
      if (tx.flow_type === '마이너스') map[tx.date].out += tx.amount
      else if (tx.flow_type === '플러스') map[tx.date].in += tx.amount
    }
    return map
  }, [transactions])

  // 활성 적금 목표
  const activeGoals = (savingGoals ?? []).filter((g) => g.is_active && g.show_on_home)

  // 선택된 날의 거래 목록
  const selectedDayTxs = useMemo(() => {
    if (!selectedDay) return []
    return (transactions ?? []).filter((tx) => tx.date === selectedDay)
  }, [selectedDay, transactions])

  // 할부 요약
  const activeInstallments = (installments ?? []).filter((i) => i.is_active && i.remaining_months > 0)
  const thisMonthInstallmentAmt = activeInstallments.reduce((s, i) => s + i.monthly_amount, 0)
  const totalInstallmentRemain = activeInstallments.reduce((s, i) => s + i.remaining_amount, 0)

  // 대출 요약
  const activeLoans = (loans ?? []).filter((l) => l.is_active)

  // 이달 저축 납입 체크 (이달 이동·저축·상환 거래 기반)
  const thisMonthSavingTxMemos = useMemo(() => {
    const ym = selectedMonth
    return new Set(
      (transactions ?? [])
        .filter((tx) => tx.flow_type === '이동·저축·상환' && tx.date?.slice(0, 7) === ym)
        .map((tx) => tx.memo ?? '')
    )
  }, [transactions, selectedMonth])


  return (
    <div className="px-4 pt-4 pb-4 space-y-3">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedMonth(dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM'))}
          className="p-2 text-text-sub active:text-text-primary"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-bold text-text-primary">
          {dayjs(selectedMonth).format('YYYY년 M월')}
        </span>
        <button
          onClick={() => {
            const next = dayjs(selectedMonth).add(1, 'month').format('YYYY-MM')
            if (next <= dayjs().format('YYYY-MM')) setSelectedMonth(next)
          }}
          className={`p-2 ${isCurrentMonth ? 'opacity-20' : 'text-text-sub active:text-text-primary'}`}
          disabled={isCurrentMonth}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Summary card */}
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : data ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
        >
          <p className="text-xs text-gray-400 mb-1">이번 달 순저축</p>
          <p
            className={`text-4xl font-bold tracking-tight mb-4 ${
              data.netSaving >= 0 ? 'text-text-primary' : 'text-expense'
            }`}
          >
            {data.netSaving >= 0 ? '+' : ''}
            {fmtFull(data.netSaving)}
          </p>
          <div className="flex items-center gap-0 divide-x divide-gray-100">
            <div className="pr-4">
              <p className="text-[11px] text-gray-400 mb-0.5">수입</p>
              <p className="text-sm font-bold text-income">{fmtFull(data.income)}</p>
            </div>
            <div className="px-4">
              <p className="text-[11px] text-gray-400 mb-0.5">지출</p>
              <p className="text-sm font-bold text-expense">{fmtFull(data.expense)}</p>
            </div>
            {data.assetMove > 0 && (
              <div className="pl-4">
                <p className="text-[11px] text-gray-400 mb-0.5">저축이동</p>
                <p className="text-sm font-bold text-blue-main">{fmtFull(data.assetMove)}</p>
              </div>
            )}
          </div>
        </motion.div>
      ) : null}

      {/* 총 저축 + 생활비/대출잔액 */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <p className="text-[11px] text-gray-400 mb-1">총 저축액</p>
            <p className="text-base font-bold text-income">{fmt(data.totalSaved ?? 0)}</p>
            <p className="text-[9px] text-gray-300 mt-1">저축 목표 합산</p>
          </motion.div>
          {livingBudgetLimit > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            >
              <p className="text-[11px] text-gray-400 mb-1">생활비 잔여</p>
              <p className={`text-base font-bold ${(livingRemain ?? 0) >= 0 ? 'text-income' : 'text-expense'}`}>
                {fmt(livingRemain ?? 0)}
              </p>
              <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (livingSpent / livingBudgetLimit) * 100)}%`,
                    backgroundColor: livingSpent / livingBudgetLimit > 0.9 ? '#D64545' : '#2F9E73',
                  }}
                />
              </div>
              <p className="text-[9px] text-gray-300 mt-1">{fmt(livingSpent)} / {fmt(livingBudgetLimit)}</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            >
              <p className="text-[11px] text-gray-400 mb-1">총 대출잔액</p>
              <p className="text-base font-bold text-expense">{fmt(data.totalLoanBalance)}</p>
              <p className="text-[9px] text-gray-300 mt-1">대출 {activeLoans.length}건</p>
            </motion.div>
          )}
        </div>
      )}

      {/* 4. 지출 카테고리 */}
      {isLoading ? (
        <Skeleton className="h-80" />
      ) : categoryData.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.035 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
        >
          <p className="text-sm font-bold text-text-primary mb-4">지출 카테고리</p>

          <div className="flex justify-center mb-5">
            <PieChart width={240} height={240}>
              {/* 3D 그림자 레이어 */}
              <Pie
                data={categoryData}
                dataKey="amount"
                cx={120} cy={126}
                innerRadius={46} outerRadius={76}
                paddingAngle={2}
                startAngle={90} endAngle={-270}
                isAnimationActive={false}
              >
                {categoryData.map((d, i) => (
                  <Cell key={i} fill={d.color} opacity={0.25} />
                ))}
              </Pie>
              {/* 메인 레이어 */}
              <Pie
                data={categoryData}
                dataKey="amount"
                cx={120} cy={120}
                innerRadius={46} outerRadius={76}
                paddingAngle={2}
                startAngle={90} endAngle={-270}
                label={({ cx, cy, midAngle, outerRadius, name, percent }) => {
                  const RADIAN = Math.PI / 180
                  const r = (outerRadius as number) + 22
                  const x = (cx as number) + r * Math.cos(-midAngle * RADIAN)
                  const y = (cy as number) + r * Math.sin(-midAngle * RADIAN)
                  if ((percent as number) < 0.04) return null
                  return (
                    <text x={x} y={y} textAnchor={x > (cx as number) ? 'start' : 'end'} dominantBaseline="central" fontSize={9} fill="#64748b">
                      <tspan x={x} dy="-0.5em">{name}</tspan>
                      <tspan x={x} dy="1.2em" fontWeight="600">{((percent as number) * 100).toFixed(0)}%</tspan>
                    </text>
                  )
                }}
                labelLine={false}
              >
                {categoryData.map((d, i) => (
                  <Cell key={i} fill={d.color} style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.18))' }} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [fmtFull(v)]}
                contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }}
              />
            </PieChart>
          </div>

          <div className="space-y-3">
            {categoryData.map((d) => {
              const pct = totalExpense > 0 ? d.amount / totalExpense : 0
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs font-medium text-text-primary">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">{(pct * 100).toFixed(0)}%</span>
                      <span className="text-xs font-semibold text-text-primary">{fmtFull(d.amount)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, pct * 100)}%`, backgroundColor: d.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      ) : null}

      {/* 5. 일별 지출 캘린더 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
      >
        <p className="text-sm font-bold text-text-primary mb-3">일별 지출</p>
        <MiniCalendar
          yearMonth={selectedMonth}
          dailyMap={dailyMap}
          selectedDay={selectedDay}
          onDayClick={(d) => setSelectedDay((prev) => (prev === d ? null : d))}
        />

        {/* 선택된 날 거래 목록 */}
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
                  {dayjs(selectedDay).format('M월 D일 (ddd)')} 거래내역
                </p>
                {selectedDayTxs.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-3">거래 내역이 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayTxs.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{tx.detail || tx.category}</p>
                          <p className="text-[10px] text-text-sub">{tx.category} · {tx.member}</p>
                        </div>
                        <span className={`text-xs font-semibold ml-2 shrink-0 ${tx.flow_type === '마이너스' ? 'text-expense' : tx.flow_type === '플러스' ? 'text-income' : 'text-blue-main'}`}>
                          {tx.flow_type === '마이너스' ? '-' : tx.flow_type === '플러스' ? '+' : ''}{fmtFull(tx.amount)}
                        </span>
                      </div>
                    ))}
                    {selectedDayTxs.some((tx) => tx.flow_type === '마이너스') && (
                      <div className="flex justify-between pt-2 border-t border-gray-50">
                        <span className="text-[10px] text-gray-400">일 지출 합계</span>
                        <span className="text-xs font-bold text-expense">
                          -{fmtFull(selectedDayTxs.filter((tx) => tx.flow_type === '마이너스').reduce((s, tx) => s + tx.amount, 0))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 6. 진행 중인 할부 */}
      {activeInstallments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.045 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-text-primary">진행 중인 할부</p>
            <div className="text-right">
              <p className="text-xs text-gray-400">이달 부담액</p>
              <p className="text-sm font-bold text-expense">{fmt(thisMonthInstallmentAmt)}</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {activeInstallments.map((inst) => {
              const pct = ((inst.paid_months / inst.total_months) * 100)
              return (
                <div key={inst.installment_id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-text-primary truncate block">{inst.detail}</span>
                      <span className="text-[10px] text-gray-400">
                        {inst.paid_months}/{inst.total_months}회 완료 · 잔여 {inst.remaining_months}회
                      </span>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="text-xs font-semibold text-expense">{fmt(inst.monthly_amount)}/월</p>
                      <p className="text-[10px] text-gray-400">잔액 {fmt(inst.remaining_amount)}</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {totalInstallmentRemain > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between text-xs">
              <span className="text-gray-400">총 잔여 할부액</span>
              <span className="font-bold text-expense">{fmt(totalInstallmentRemain)}</span>
            </div>
          )}
        </motion.div>
      )}

      {/* 7. 저축현황 */}
      {activeGoals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
        >
          <p className="text-sm font-bold text-text-primary mb-3">저축현황</p>
          <div className="space-y-3">
            {activeGoals.map((g) => {
              const pct = g.has_target && g.target_amount > 0
                ? Math.min(100, (g.current_amount / g.target_amount) * 100)
                : null
              // 이달 납입 여부: [저축:id:YYYY-MM] 태그 또는 단순 [저축:id] 태그 확인
              const paidThisMonth = g.monthly_amount > 0 && Array.from(thisMonthSavingTxMemos).some(
                (m) => m.includes(`[저축:${g.id}`)
              )
              const needsPay = g.monthly_amount > 0 && !paidThisMonth && selectedMonth === dayjs().format('YYYY-MM')
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-text-primary">{g.name}</span>
                      {g.monthly_amount > 0 && (
                        <span className="text-[10px] text-blue-main">월 {fmt(g.monthly_amount)}</span>
                      )}
                      {needsPay && (
                        <span className="text-[9px] bg-red-50 text-expense px-1.5 py-0.5 rounded-full font-medium">미납입</span>
                      )}
                      {paidThisMonth && (
                        <span className="text-[9px] bg-green-50 text-income px-1.5 py-0.5 rounded-full font-medium">납입완료</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-blue-deep shrink-0 ml-1">{fmt(g.current_amount)}</span>
                  </div>
                  {pct !== null ? (
                    <>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-main transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-blue-main font-semibold">{Math.round(pct)}% 달성</span>
                        <div className="flex items-center gap-2">
                          {g.target_amount - g.current_amount > 0 && (
                            <span className="text-[10px] text-gray-300">잔여 {fmt(g.target_amount - g.current_amount)}</span>
                          )}
                          {g.target_date && (
                            <span className="text-[10px] text-gray-300">{dayjs(g.target_date).format('YYYY.MM')} 목표</span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-1.5 bg-blue-50 rounded-full" />
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* 8. 대출 현황 */}
      {activeLoans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.055 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
        >
          <p className="text-sm font-bold text-text-primary mb-3">대출현황</p>
          <div className="space-y-3">
            {activeLoans.map((l) => {
              const id = l.loan_id ?? l.id
              const balance = l.balance ?? l.principal
              const repaidPct = l.principal > 0
                ? Math.min(100, ((l.principal - balance) / l.principal) * 100)
                : 0
              return (
                <div key={id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-xs font-medium text-text-primary">{l.name}</span>
                      <span className="ml-1.5 text-[10px] text-gray-400">{l.member}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-expense">{fmt(balance)}</span>
                      {l.interest_rate > 0 && (
                        <p className="text-[9px] text-gray-300">{l.interest_rate}%</p>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-income transition-all"
                      style={{ width: `${repaidPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-income font-semibold">{Math.round(repaidPct)}% 상환</span>
                    <span className="text-[10px] text-gray-300">원금 {fmt(l.principal)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      <AnimatePresence>
        {!isLoading && data && data.income === 0 && data.expense === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-4xl mb-3">📊</p>
            <p className="text-sm font-medium text-text-sub">이번 달 거래 내역이 없어요</p>
            <p className="text-xs text-gray-300 mt-1">입력 탭에서 거래를 추가해보세요</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
