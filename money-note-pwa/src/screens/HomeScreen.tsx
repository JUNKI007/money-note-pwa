import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, PiggyBank, RefreshCw } from 'lucide-react'
import dayjs from 'dayjs'
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Cell,
  PieChart, Pie, Tooltip,
} from 'recharts'
import { useDashboard } from '@/hooks/useDashboard'
import { useAppStore } from '@/store/appStore'
import { AmountText } from '@/components/ui/AmountText'

const CAT_COLORS = ['#6F8FAF','#2F9E73','#F59E0B','#8B5CF6','#EC4899','#D64545','#14B8A6','#F97316']

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-2xl ${className}`} />
}

export function HomeScreen() {
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const { data, isLoading, isFetching, refetch } = useDashboard(selectedMonth)

  const prevMonth = () => setSelectedMonth(dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM'))
  const nextMonth = () => {
    const next = dayjs(selectedMonth).add(1, 'month').format('YYYY-MM')
    if (next <= dayjs().format('YYYY-MM')) setSelectedMonth(next)
  }
  const isCurrentMonth = selectedMonth >= dayjs().format('YYYY-MM')

  const weeklyData = data ? [
    { name: '지난주', amount: data.lastWeekExpense, color: '#CBD5E1' },
    { name: '이번주', amount: data.thisWeekExpense, color: '#6F8FAF' },
  ] : []

  const categoryData = data?.categoryExpense
    ? Object.entries(data.categoryExpense as Record<string, number>)
        .map(([name, amount]) => ({ name, amount }))
        .filter(d => d.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6)
    : []

  return (
    <div className="px-4 pt-4 pb-4 space-y-3">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 text-text-sub active:text-text-primary">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-text-primary">
            {dayjs(selectedMonth).format('YYYY년 M월')}
          </span>
          <motion.button
            onClick={() => refetch()}
            animate={{ rotate: isFetching ? 360 : 0 }}
            transition={{ repeat: isFetching ? Infinity : 0, duration: 0.8, ease: 'linear' }}
            className="p-1 text-text-sub"
          >
            <RefreshCw size={15} />
          </motion.button>
        </div>
        <button
          onClick={nextMonth}
          className={`p-2 ${isCurrentMonth ? 'opacity-20' : 'text-text-sub active:text-text-primary'}`}
          disabled={isCurrentMonth}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 메인 카드 */}
      {isLoading ? (
        <Skeleton className="h-36" />
      ) : data ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-deep rounded-3xl p-5 text-white"
        >
          <p className="text-blue-200 text-xs font-medium mb-3">이번 달 순저축</p>
          <p className="text-4xl font-bold tracking-tight mb-4">
            {data.netSaving >= 0 ? '+' : ''}{data.netSaving.toLocaleString('ko-KR')}원
          </p>
          <div className="flex gap-3">
            <div className="flex-1 bg-white/10 rounded-2xl p-3">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp size={12} className="text-green-300" />
                <span className="text-[10px] text-blue-200">수입</span>
              </div>
              <p className="text-sm font-bold">{data.income.toLocaleString('ko-KR')}원</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-2xl p-3">
              <div className="flex items-center gap-1 mb-1">
                <TrendingDown size={12} className="text-red-300" />
                <span className="text-[10px] text-blue-200">지출</span>
              </div>
              <p className="text-sm font-bold">{data.expense.toLocaleString('ko-KR')}원</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-2xl p-3">
              <div className="flex items-center gap-1 mb-1">
                <PiggyBank size={12} className="text-yellow-300" />
                <span className="text-[10px] text-blue-200">저축</span>
              </div>
              <p className="text-sm font-bold">{(data.assetMove ?? 0).toLocaleString('ko-KR')}원</p>
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* 주간 비교 */}
      {isLoading ? (
        <Skeleton className="h-36" />
      ) : data && (data.thisWeekExpense > 0 || data.lastWeekExpense > 0) ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-3xl p-4"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-text-primary">주간 지출 비교</p>
            {data.weeklyDiff !== 0 && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                data.weeklyDiff > 0 ? 'bg-red-50 text-expense' : 'bg-green-50 text-income'
              }`}>
                {data.weeklyDiff > 0 ? '+' : ''}{data.weeklyDiff.toLocaleString('ko-KR')}원
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="40%">
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString('ko-KR')}원`]}
                contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                {weeklyData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      ) : null}

      {/* 카테고리별 지출 */}
      {isLoading ? (
        <Skeleton className="h-44" />
      ) : categoryData.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-3xl p-4"
        >
          <p className="text-sm font-bold text-text-primary mb-3">카테고리별 지출</p>
          <div className="flex items-center gap-3">
            <ResponsiveContainer width={96} height={96}>
              <PieChart>
                <Pie data={categoryData} dataKey="amount" cx="50%" cy="50%" innerRadius={26} outerRadius={44} paddingAngle={2}>
                  {categoryData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {categoryData.slice(0, 5).map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                    <span className="text-xs text-text-sub truncate max-w-[60px]">{d.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-text-primary">{d.amount.toLocaleString('ko-KR')}원</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* 대출/저축 현황 */}
      {!isLoading && data && (data.totalLoanBalance > 0 || data.totalSaved > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 gap-3"
        >
          {data.totalLoanBalance > 0 && (
            <div className="bg-card rounded-2xl p-4">
              <p className="text-xs text-text-sub mb-1">총 대출잔액</p>
              <AmountText amount={data.totalLoanBalance} type="expense" className="text-sm" />
            </div>
          )}
          {data.totalSaved > 0 && (
            <div className="bg-card rounded-2xl p-4">
              <p className="text-xs text-text-sub mb-1">총 저축액</p>
              <AmountText amount={data.totalSaved} type="income" className="text-sm" />
            </div>
          )}
        </motion.div>
      )}

      {/* 빈 상태 */}
      <AnimatePresence>
        {!isLoading && data && data.income === 0 && data.expense === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-sm font-medium text-text-sub">이번 달 거래 내역이 없어요</p>
            <p className="text-xs text-gray-300 mt-1">입력 탭에서 거래를 추가해보세요</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
