import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { Cell, Tooltip, PieChart, Pie } from 'recharts'
import { useDashboard } from '@/hooks/useDashboard'
import { useLifeBudget } from '@/hooks/useLifeBudget'
import { useTransactions } from '@/hooks/useTransactions'
import { useSavingGoals } from '@/hooks/useSavings'
import { useInstallments } from '@/hooks/useInstallments'
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
  dailyExpense,
}: {
  yearMonth: string
  dailyExpense: Record<string, number>
}) {
  const monthStart = dayjs(yearMonth + '-01')
  const daysInMonth = monthStart.daysInMonth()
  const startDow = monthStart.day() // 0=일

  const maxExpense = Math.max(...Object.values(dailyExpense), 1)

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const today = dayjs().format('YYYY-MM-DD')
  const DOW = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div>
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[10px] font-medium py-1 ${
              i === 0 ? 'text-expense' : i === 6 ? 'text-blue-main' : 'text-gray-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      {/* 날짜 셀 */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const dateStr = monthStart.date(day).format('YYYY-MM-DD')
          const expense = dailyExpense[dateStr] ?? 0
          const isToday = dateStr === today
          const intensity = expense > 0 ? Math.min(1, expense / maxExpense) : 0
          const dow = (startDow + day - 1) % 7
          return (
            <div key={day} className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium relative ${
                  isToday
                    ? 'bg-blue-deep text-white'
                    : expense > 0
                    ? 'text-text-primary'
                    : dow === 0
                    ? 'text-expense/60'
                    : dow === 6
                    ? 'text-blue-main/60'
                    : 'text-gray-300'
                }`}
                style={
                  expense > 0 && !isToday
                    ? { backgroundColor: `rgba(214,69,69,${intensity * 0.18})` }
                    : {}
                }
              >
                {day}
              </div>
              {expense > 0 && (
                <span className="text-[8px] text-expense leading-tight mt-0.5">{fmt(expense)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function HomeScreen() {
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const { data, isLoading } = useDashboard(selectedMonth)
  const { data: lifeBudget } = useLifeBudget()
  const { data: transactions } = useTransactions({ yearMonth: selectedMonth })
  const { data: savingGoals } = useSavingGoals()
  const { data: installments } = useInstallments()
  const isCurrentMonth = selectedMonth >= dayjs().format('YYYY-MM')

  const categoryData = data?.categoryExpense
    ? Object.entries(data.categoryExpense as Record<string, number>)
        .map(([name, amount], i) => ({ name, amount, color: CAT_COLORS[i % CAT_COLORS.length] }))
        .filter((d) => d.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    : []

  const totalExpense = categoryData.reduce((s, d) => s + d.amount, 0)

  // 순자산 계산
  const netAsset = (data?.totalSaved ?? 0) - (data?.totalLoanBalance ?? 0)

  // 생활비 예산 계산 (선택된 카테고리 지출 합산)
  const livingBudgetLimit = lifeBudget?.limit ?? 0
  const livingSpent = useMemo(() => {
    if (!lifeBudget?.categories?.length) return 0
    const catExp = data?.categoryExpense as Record<string, number> | undefined
    if (!catExp) return 0
    return lifeBudget.categories.reduce((s, c) => s + (catExp[c] ?? 0), 0)
  }, [lifeBudget, data?.categoryExpense])
  const livingRemain = livingBudgetLimit > 0 ? livingBudgetLimit - livingSpent : null

  // 일별 지출 집계
  const dailyExpense = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tx of transactions ?? []) {
      if (!tx || tx.flow_type !== '마이너스') continue
      if (!map[tx.date]) map[tx.date] = 0
      map[tx.date] += tx.amount
    }
    return map
  }, [transactions])

  // 활성 적금 목표
  const activeGoals = (savingGoals ?? []).filter((g) => g.is_active)

  // 할부 요약
  const activeInstallments = (installments ?? []).filter((i) => i.is_active && i.remaining_months > 0)
  const thisMonthInstallmentAmt = activeInstallments.reduce((s, i) => s + i.monthly_amount, 0)
  const totalInstallmentRemain = activeInstallments.reduce((s, i) => s + i.remaining_amount, 0)


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

      {/* 순자산 + 생활비 잔여 */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <p className="text-[11px] text-gray-400 mb-1">순자산</p>
            <p className={`text-base font-bold ${netAsset >= 0 ? 'text-income' : 'text-expense'}`}>
              {netAsset >= 0 ? '+' : ''}{fmt(netAsset)}
            </p>
            <p className="text-[9px] text-gray-300 mt-1">저축 - 대출잔액</p>
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
              <p className="text-[9px] text-gray-300 mt-1">총 저축 {fmt(data.totalSaved)}</p>
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
        <MiniCalendar yearMonth={selectedMonth} dailyExpense={dailyExpense} />
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

      {/* 7. 적금 목표 진행률 */}
      {activeGoals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
        >
          <p className="text-sm font-bold text-text-primary mb-3">적금 목표</p>
          <div className="space-y-3">
            {activeGoals.map((g) => {
              const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0
              const remain = g.target_amount - g.current_amount
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-text-primary">{g.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-blue-deep">{fmt(g.current_amount)}</span>
                      <span className="text-[10px] text-gray-300">/ {fmt(g.target_amount)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-main transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-400">{Math.round(pct)}% 달성</span>
                    {remain > 0 && (
                      <span className="text-[10px] text-gray-300">잔여 {fmt(remain)}</span>
                    )}
                    {g.target_date && (
                      <span className="text-[10px] text-gray-300">
                        {dayjs(g.target_date).format('YYYY.MM')} 목표
                      </span>
                    )}
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
