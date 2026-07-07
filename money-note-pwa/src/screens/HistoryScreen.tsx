import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { useTransactions, useDeleteTransaction } from '@/hooks/useTransactions'
import { useAppStore } from '@/store/appStore'
import { AmountText } from '@/components/ui/AmountText'
import { PullToRefresh } from '@/components/ui/PullToRefresh'

type FlowFilter = '전체' | '플러스' | '마이너스' | '이동·저축·상환'

export function HistoryScreen() {
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const [flowFilter, setFlowFilter] = useState<FlowFilter>('전체')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: transactions, isLoading, refetch } = useTransactions({
    yearMonth: selectedMonth,
    ...(flowFilter !== '전체' ? { flow_type: flowFilter } : {}),
  })
  const deleteTx = useDeleteTransaction()

  const prevMonth = () => setSelectedMonth(dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM'))
  const nextMonth = () => {
    const next = dayjs(selectedMonth).add(1, 'month').format('YYYY-MM')
    if (next <= dayjs().format('YYYY-MM')) setSelectedMonth(next)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteTx.mutateAsync(id)
    } finally {
      setDeletingId(null)
    }
  }

  // Group by date
  const grouped = (transactions ?? []).reduce<Record<string, typeof transactions>>((acc, tx) => {
    if (!acc[tx!.date]) acc[tx!.date] = []
    acc[tx!.date]!.push(tx)
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

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
            className={selectedMonth >= dayjs().format('YYYY-MM') ? 'opacity-30 p-1' : 'p-1 text-text-sub'}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Flow filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(['전체', '플러스', '마이너스', '이동·저축·상환'] as FlowFilter[]).map((f) => (
            <button
              key={f}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${flowFilter === f ? 'bg-blue-deep text-white' : 'bg-card text-text-sub'}`}
              onClick={() => setFlowFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-main border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedDates.length === 0 ? (
          <p className="text-center text-text-sub py-12">거래 내역이 없습니다</p>
        ) : (
          <div className="space-y-4">
            {sortedDates.map((date) => (
              <div key={date}>
                <p className="text-xs font-semibold text-text-sub mb-2">
                  {dayjs(date).format('M월 D일 (ddd)')}
                </p>
                <div className="bg-card rounded-2xl overflow-hidden">
                  <AnimatePresence>
                    {grouped[date]!.map((tx, i) => (
                      <motion.div
                        key={tx!.id}
                        layout
                        exit={{ opacity: 0, height: 0 }}
                        className={`flex items-center px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{tx!.category}</p>
                          <p className="text-xs text-text-sub truncate">{tx!.detail || tx!.member}</p>
                        </div>
                        <AmountText
                          amount={tx!.amount}
                          type={tx!.flow_type === '플러스' ? 'income' : tx!.flow_type === '마이너스' ? 'expense' : 'neutral'}
                          showSign
                          className="text-sm mr-3"
                        />
                        <motion.button
                          className="p-1.5 text-gray-300 active:text-expense"
                          onClick={() => handleDelete(tx!.id)}
                          disabled={deletingId === tx!.id}
                          whileTap={{ scale: 0.85 }}
                        >
                          <Trash2 size={16} />
                        </motion.button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}
