import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Trash2, Pencil, Search, X } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
dayjs.locale('ko')
import {
  useTransactions,
  useDeleteTransaction,
  useUpdateTransaction,
} from '@/hooks/useTransactions'
import { useDeleteFixedExpense } from '@/hooks/useFixedExpenses'
import { useAppStore } from '@/store/appStore'
import { AmountText } from '@/components/ui/AmountText'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { MINUS_CATEGORY_LABELS, PLUS_CATEGORY_LABELS } from '@/components/ui/CategoryPicker'
import type { Transaction } from '@/hooks/useDashboard'

type FlowFilter = '전체' | '플러스' | '마이너스' | '이동·저축·상환'

const CATEGORIES: Record<string, string[]> = {
  '플러스': PLUS_CATEGORY_LABELS,
  '마이너스': MINUS_CATEGORY_LABELS,
  '이동·저축·상환': ['적금', '비상금저축', '대출상환', '계좌이체'],
}

const MEMBERS = ['남편', '아내', '공동']

// 메모에서 고정지출 ID 추출
function extractFixedId(memo: string): string | null {
  const m = memo?.match(/\[고정:([^\]]+)\]/)
  return m ? m[1] : null
}

export function HistoryScreen() {
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const [flowFilter, setFlowFilter] = useState<FlowFilter>('전체')
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // 고정지출 연동 삭제: {txId, fixedId}
  const [confirmFixed, setConfirmFixed] = useState<{ txId: string; fixedId: string } | null>(null)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [editForm, setEditForm] = useState({
    date: '', member: '', flow_type: '', category: '', detail: '', amount: '', memo: '',
  })

  const { data: transactions, isLoading } = useTransactions({
    yearMonth: selectedMonth,
    ...(flowFilter !== '전체' ? { flow_type: flowFilter } : {}),
  })
  const deleteTx = useDeleteTransaction()
  const updateTx = useUpdateTransaction()
  const deleteFixed = useDeleteFixedExpense()

  const prevMonth = () => setSelectedMonth(dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM'))
  const nextMonth = () => {
    const next = dayjs(selectedMonth).add(1, 'month').format('YYYY-MM')
    if (next <= dayjs().format('YYYY-MM')) setSelectedMonth(next)
  }

  // 휴지통 클릭 시: 고정지출 연동 거래인지 확인
  const onTrashClick = (tx: Transaction) => {
    const fixedId = extractFixedId(tx.memo || '')
    if (fixedId) {
      setConfirmFixed({ txId: tx.transaction_id, fixedId })
    } else {
      setConfirmDeleteId(tx.transaction_id)
    }
  }

  const handleDelete = async (id: string) => {
    if (!id) return
    setDeletingId(id)
    try {
      await deleteTx.mutateAsync(id)
    } catch (e) {
      alert('삭제 실패: ' + (e as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  const openEdit = (tx: Transaction) => {
    setEditTx(tx)
    setEditForm({
      date: tx.date,
      member: tx.member,
      flow_type: tx.flow_type,
      category: tx.category,
      detail: tx.detail || '',
      amount: String(tx.amount),
      memo: tx.memo || '',
    })
  }

  const handleUpdate = async () => {
    if (!editTx) return
    if (!editTx.transaction_id) { alert('ID 없음 - 데이터 오류'); return }
    try {
      await updateTx.mutateAsync({
        id: editTx.transaction_id,
        date: editForm.date,
        member: editForm.member,
        flow_type: editForm.flow_type,
        category: editForm.category,
        detail: editForm.detail,
        amount: Number(editForm.amount),
        memo: editForm.memo,
      })
      setEditTx(null)
    } catch (e) {
      alert('수정 실패: ' + (e as Error).message)
    }
  }

  const filtered = (transactions ?? []).filter((tx) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      tx!.category.toLowerCase().includes(q) ||
      (tx!.detail || '').toLowerCase().includes(q) ||
      (tx!.memo || '').toLowerCase().includes(q)
    )
  })

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, tx) => {
    if (!acc[tx!.date]) acc[tx!.date] = []
    acc[tx!.date]!.push(tx)
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const editCategories = CATEGORIES[editForm.flow_type] ?? []

  return (
    <div className="px-4 pt-4 pb-4 space-y-3">
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

      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="카테고리, 내역, 메모 검색"
          className="w-full bg-white rounded-xl pl-8 pr-8 py-2.5 text-xs text-text-primary border border-gray-100 shadow-sm"
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
            onClick={() => setSearch('')}
          >
            <X size={14} />
          </button>
        )}
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
                  {grouped[date]!.map((tx, i) => {
                    const isFixed = !!extractFixedId(tx!.memo || '')
                    return (
                      <motion.div
                        key={tx!.transaction_id}
                        layout
                        exit={{ opacity: 0, height: 0 }}
                        className={`flex items-center px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-text-primary truncate">{tx!.category}</p>
                            {isFixed && (
                              <span className="text-[9px] bg-blue-50 text-blue-main px-1.5 py-0.5 rounded-full shrink-0">고정</span>
                            )}
                          </div>
                          <p className="text-xs text-text-sub truncate">{tx!.detail || tx!.member}</p>
                        </div>
                        <AmountText
                          amount={tx!.amount}
                          type={tx!.flow_type === '플러스' ? 'income' : tx!.flow_type === '마이너스' ? 'expense' : 'neutral'}
                          showSign
                          className="text-sm mr-2"
                        />
                        <button
                          className="p-1.5 text-gray-300 active:text-blue-main mr-0.5"
                          onClick={() => openEdit(tx!)}
                        >
                          <Pencil size={14} />
                        </button>
                        <motion.button
                          className="p-1.5 text-gray-300 active:text-expense"
                          onClick={() => onTrashClick(tx!)}
                          disabled={deletingId === tx!.transaction_id}
                          whileTap={{ scale: 0.85 }}
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit sheet */}
      <BottomSheet isOpen={!!editTx} onClose={() => setEditTx(null)} title="거래 수정">
        {editTx && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-sub mb-1 block">날짜</label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">구성원</label>
              <div className="flex gap-2">
                {MEMBERS.map((m) => (
                  <button
                    key={m}
                    className={`flex-1 py-1.5 rounded-xl text-sm font-medium transition-colors
                      ${editForm.member === m ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'}`}
                    onClick={() => setEditForm((f) => ({ ...f, member: m }))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">유형</label>
              <div className="flex gap-2">
                {['플러스', '마이너스', '이동·저축·상환'].map((ft) => (
                  <button
                    key={ft}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors
                      ${editForm.flow_type === ft ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'}`}
                    onClick={() => setEditForm((f) => ({ ...f, flow_type: ft, category: '' }))}
                  >
                    {ft}
                  </button>
                ))}
              </div>
            </div>
            {editCategories.length > 0 && (
              <div>
                <label className="text-xs text-text-sub mb-1 block">카테고리</label>
                <div className="flex flex-wrap gap-1.5">
                  {editCategories.map((c) => (
                    <button
                      key={c}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                        ${editForm.category === c ? 'bg-blue-deep text-white' : 'bg-bg-app text-text-sub'}`}
                      onClick={() => setEditForm((f) => ({ ...f, category: c }))}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-text-sub mb-1 block">상세 내역</label>
              <input
                type="text"
                value={editForm.detail}
                onChange={(e) => setEditForm((f) => ({ ...f, detail: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">금액 (원)</label>
              <input
                type="number"
                inputMode="numeric"
                value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">메모</label>
              <input
                type="text"
                value={editForm.memo}
                onChange={(e) => setEditForm((f) => ({ ...f, memo: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
              />
            </div>
            <Button fullWidth onClick={handleUpdate} disabled={updateTx.isPending}>
              {updateTx.isPending ? '저장 중...' : '수정 저장'}
            </Button>
          </div>
        )}
      </BottomSheet>

      {/* 일반 거래 삭제 확인 */}
      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        message="이 거래를 삭제하시겠습니까?"
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* 고정지출 연동 거래 삭제 확인 */}
      <ConfirmDialog
        isOpen={!!confirmFixed}
        message="고정지출에서 자동 생성된 거래입니다.&#10;고정지출도 함께 삭제할까요?"
        confirmLabel="거래만 삭제"
        onConfirm={() => {
          if (confirmFixed) handleDelete(confirmFixed.txId)
          setConfirmFixed(null)
        }}
        onCancel={() => setConfirmFixed(null)}
      >
        <button
          className="w-full py-3 rounded-2xl bg-expense text-white text-sm font-semibold mt-2"
          onClick={async () => {
            if (confirmFixed) {
              await handleDelete(confirmFixed.txId)
              await deleteFixed.mutateAsync(confirmFixed.fixedId)
            }
            setConfirmFixed(null)
          }}
        >
          고정지출도 함께 삭제
        </button>
      </ConfirmDialog>
    </div>
  )
}
