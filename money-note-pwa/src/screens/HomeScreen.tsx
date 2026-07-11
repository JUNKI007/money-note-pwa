import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell, Tooltip, PieChart, Pie } from 'recharts'
import { useDashboard, useMonthlyTrend } from '@/hooks/useDashboard'
import { useBudgets } from '@/hooks/useBudget'
import { useAppStore } from '@/store/appStore'
import { AmountText } from '@/components/ui/AmountText'

const CAT_COLORS = ['#6F8FAF', '#2F9E73', '#F59E0B', '#8B5CF6', '#EC4899', '#D64545', '#14B8A6', '#F97316']

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-2xl ${className}`} />
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export function HomeScreen() {
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const { data, isLoading } = useDashboard(selectedMonth)
  const prevMonthStr = dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM')
  const { data: prevData } = useDashboard(prevMonthStr)
  const { data: trend } = useMonthlyTrend(6)
  const { data: budgets } = useBudgets()

  const isCurrentMonth = selectedMonth >= dayjs().format('YYYY-MM')

  const categoryData = data?.categoryExpense
    ? Object.entries(data.categoryExpense as Record<string, number>)
        .map(([name, amount], i) => ({ name, amount, color: CAT_COLORS[i % CAT_COLORS.length] }))
        .filter((d) => d.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    : []

  const totalExpense = categoryData.reduce((s, d) => s + d.amount, 0)

  const weeklyData = data
    ? [
        { name: '지난주', amount: data.lastWeekExpense, color: '#E2E8F0' },
        { name: '이번주', amount: data.thisWeekExpense, color: '#6F8FAF' },
      ]
    : []

  const trendData = (trend ?? []).map((t) => ({
    name: dayjs(t.yearMonth).format('M월'),
    income: t.income,
    expense: t.expense,
  }))

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
            {fmt(data.netSaving)}
          </p>
          <div className="flex items-center gap-0 divide-x divide-gray-100">
            <div className="pr-4">
              <p className="text-[11px] text-gray-400 mb-0.5">수입</p>
              <p className="text-sm font-bold text-income">{fmt(data.income)}</p>
            </div>
            <div className="px-4">
              <p className="text-[11px] text-gray-400 mb-0.5">지출</p>
              <p className="text-sm font-bold text-expense">{fmt(data.expense)}</p>
            </div>
            {data.assetMove > 0 && (
              <div className="pl-4">
                <p className="text-[11px] text-gray-400 mb-0.5">저축이동</p>
                <p className="text-sm font-bold text-blue-main">{fmt(data.assetMove)}</p>
              </div>
            )}
          </div>
        </motion.div>
      ) : null}

      {/* Category breakdown */}
      {isLoading ? (
        <Skeleton className="h-80" />
      ) : categoryData.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
        >
          <p className="text-sm font-bold text-text-primary mb-4">지출 카테고리</p>

          <div className="flex justify-center mb-5">
            <PieChart width={160} height={160}>
              <Pie
                data={categoryData}
                dataKey="amount"
                cx={80}
                cy={80}
                innerRadius={44}
                outerRadius={72}
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
              >
                {categoryData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [fmt(v)]}
                contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }}
              />
            </PieChart>
          </div>

          <div className="space-y-3">
            {categoryData.map((d) => {
              const pct = totalExpense > 0 ? d.amount / totalExpense : 0
              const prevAmt = (prevData?.categoryExpense as Record<string, number> | undefined)?.[d.name] ?? 0
              const diff = d.amount - prevAmt
              const budget = budgets?.[d.name]
              const budgetPct = budget ? Math.min(100, (d.amount / budget) * 100) : null
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs font-medium text-text-primary">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {prevData && diff !== 0 && (
                        <span className={`text-[10px] ${diff > 0 ? 'text-expense' : 'text-income'}`}>
                          {diff > 0 ? '▲' : '▼'} {fmt(Math.abs(diff))}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-text-primary">{fmt(d.amount)}</span>
                      {budget && (
                        <span className="text-[10px] text-gray-400">/{fmt(budget)}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    {budgetPct !== null ? (
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${budgetPct}%`,
                          backgroundColor: budgetPct >= 90 ? '#D64545' : d.color,
                        }}
                      />
                    ) : (
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, pct * 100)}%`, backgroundColor: d.color }}
                      />
                    )}
                  </div>
                  {budget && (
                    <p className={`text-[10px] mt-0.5 ${budgetPct! >= 100 ? 'text-expense font-semibold' : 'text-gray-400'}`}>
                      예산 {Math.round(budgetPct!)}% 사용
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      ) : null}

      {/* 6-month trend */}
      {trendData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
        >
          <p className="text-sm font-bold text-text-primary mb-3">6개월 추이</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={trendData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, name: string) => [fmt(v), name === 'income' ? '수입' : '지출']}
                contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }}
              />
              <Bar dataKey="income" fill="#2F9E73" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#D64545" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-3 mt-2 justify-center">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-income" />
              <span className="text-[10px] text-gray-400">수입</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-expense" />
              <span className="text-[10px] text-gray-400">지출</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Weekly comparison */}
      {isLoading ? (
        <Skeleton className="h-28" />
      ) : data && (data.thisWeekExpense > 0 || data.lastWeekExpense > 0) ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-text-primary">주간 지출 비교</p>
            {data.weeklyDiff !== 0 && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  data.weeklyDiff > 0 ? 'bg-red-50 text-expense' : 'bg-green-50 text-income'
                }`}
              >
                {data.weeklyDiff > 0 ? '+' : ''}
                {fmt(data.weeklyDiff)}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barCategoryGap="40%">
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: number) => [fmt(v)]}
                contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {weeklyData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      ) : null}

      {/* Loan / Savings */}
      {!isLoading && data && (data.totalLoanBalance > 0 || data.totalSaved > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 gap-3"
        >
          {data.totalLoanBalance > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">총 대출잔액</p>
              <AmountText amount={data.totalLoanBalance} type="expense" className="text-sm" />
            </div>
          )}
          {data.totalSaved > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">총 저축액</p>
              <AmountText amount={data.totalSaved} type="income" className="text-sm" />
            </div>
          )}
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
