import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import dayjs from 'dayjs'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useDashboard } from '@/hooks/useDashboard'
import { useAppStore } from '@/store/appStore'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { PullToRefresh } from '@/components/ui/PullToRefresh'

export function HomeScreen() {
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const { data, isLoading, refetch } = useDashboard(selectedMonth)

  const prevMonth = () => setSelectedMonth(dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM'))
  const nextMonth = () => {
    const next = dayjs(selectedMonth).add(1, 'month').format('YYYY-MM')
    if (next <= dayjs().format('YYYY-MM')) setSelectedMonth(next)
  }

  return (
    <PullToRefresh onRefresh={() => refetch().then(() => {})}>
      <div className="px-4 pt-6 pb-4 space-y-4">
        {/* Month selector */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={prevMonth} className="p-1 text-text-sub">
            <ChevronLeft size={20} />
          </button>
          <span className="text-base font-bold text-text-primary">
            {dayjs(selectedMonth).format('YYYY년 M월')}
          </span>
          <button
            onClick={nextMonth}
            className={`p-1 ${selectedMonth >= dayjs().format('YYYY-MM') ? 'opacity-30' : 'text-text-sub'}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-main border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '수입', amount: data.income, type: 'income' as const, icon: TrendingUp },
                { label: '지출', amount: data.expense, type: 'expense' as const, icon: TrendingDown },
                { label: '순저축', amount: data.netSaving, type: 'neutral' as const, icon: PiggyBank },
              ].map(({ label, amount, type, icon: Icon }) => (
                <Card key={label} className="text-center">
                  <Icon size={16} className={`mx-auto mb-1 ${type === 'income' ? 'text-income' : type === 'expense' ? 'text-expense' : 'text-blue-main'}`} />
                  <p className="text-[10px] text-text-sub mb-0.5">{label}</p>
                  <AmountText amount={amount} type={type} className="text-sm" />
                </Card>
              ))}
            </div>

            {/* Weekly chart */}
            {data.weeklyExpenses?.length > 0 && (
              <Card>
                <p className="text-sm font-semibold text-text-primary mb-3">주간 지출</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={data.weeklyExpenses} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(v: number) => [`${v.toLocaleString('ko-KR')}원`, '지출']}
                      contentStyle={{ borderRadius: 8, border: 'none', fontSize: 12 }}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {data.weeklyExpenses.map((_, i) => (
                        <Cell key={i} fill="#6F8FAF" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Recent transactions */}
            {data.recentTransactions?.length > 0 && (
              <Card>
                <p className="text-sm font-semibold text-text-primary mb-3">최근 거래</p>
                <div className="space-y-3">
                  {data.recentTransactions.slice(0, 5).map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">{tx.category}</p>
                        <p className="text-xs text-text-sub">{tx.detail || tx.date}</p>
                      </div>
                      <AmountText
                        amount={tx.amount}
                        type={tx.flow_type === '플러스' ? 'income' : 'expense'}
                        showSign
                        className="text-sm"
                      />
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : (
          <p className="text-center text-text-sub py-12">데이터를 불러올 수 없습니다</p>
        )}
      </div>
    </PullToRefresh>
  )
}
