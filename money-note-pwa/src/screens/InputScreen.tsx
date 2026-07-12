import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Trash2, Plus, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { useSaveTransaction } from '@/hooks/useTransactions'
import { useLoans } from '@/hooks/useLoans'
import { useSavingGoals } from '@/hooks/useSavings'
import { useAddInstallment } from '@/hooks/useInstallments'
import { useAddAllowanceEntry } from '@/hooks/useAllowance'
import {
  useFixedExpenses,
  useAddFixedExpense,
  useUpdateFixedExpense,
  useDeleteFixedExpense,
  type FixedExpense,
} from '@/hooks/useFixedExpenses'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CategoryPicker, MINUS_CATEGORIES, PLUS_CATEGORIES } from '@/components/ui/CategoryPicker'
import { CardImport } from '@/components/CardImport'

type FlowType = '플러스' | '마이너스'
type InputTab = FlowType | '용돈' | '고정지출'


const MEMBERS = ['남편', '아내', '공동']
const ALLOWANCE_MEMBERS = ['남편', '아내']
const ALL_FLOW_TYPES: FlowType[] = ['플러스', '마이너스']

const FLOW_COLOR: Record<InputTab, string> = {
  '플러스': 'bg-income text-white',
  '마이너스': 'bg-expense text-white',
  '용돈': 'bg-purple-500 text-white',
  '고정지출': 'bg-gray-700 text-white',
}

const emptyFixedForm = {
  name: '', flow_type: '마이너스' as FlowType, category: '', member: MEMBERS[0], amount: '', memo: '',
}

export function InputScreen() {
  const { setActiveTab } = useAppStore()

  // 일반 거래 입력 상태
  const [inputTab, setInputTab] = useState<InputTab>('마이너스')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [member, setMember] = useState(MEMBERS[0])
  const [category, setCategory] = useState('')
  const [detail, setDetail] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [loanId, setLoanId] = useState('')
  const [savingGoalId, setSavingGoalId] = useState('')
  const [success, setSuccess] = useState(false)
  // 할부 상태
  const [isInstallment, setIsInstallment] = useState(false)
  const [installmentMonths, setInstallmentMonths] = useState(3)

  // 고정지출 편집 상태
  const [fixedSheet, setFixedSheet] = useState(false)
  const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null)
  const [fixedForm, setFixedForm] = useState(emptyFixedForm)
  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const [fixedCatPickerOpen, setFixedCatPickerOpen] = useState(false)

  const [allowanceType, setAllowanceType] = useState<'지출' | '입금'>('지출')

  const saveTx = useSaveTransaction()
  const addAllowanceEntry = useAddAllowanceEntry()
  const addInstallment = useAddInstallment()
  const { data: loans } = useLoans()
  const { data: savingGoals } = useSavingGoals()
  const { data: fixedExpenses, isLoading: fixedLoading } = useFixedExpenses()
  const addFixed = useAddFixedExpense()
  const updateFixed = useUpdateFixedExpense()
  const deleteFixed = useDeleteFixedExpense()

  const activeLoans = loans?.filter((l) => l.is_active) ?? []
  const activeSavings = savingGoals?.filter((s) => s.is_active) ?? []
  const activeFixed = (fixedExpenses ?? []).filter((f) => f.is_active)
  const [confirmDeleteFixedId, setConfirmDeleteFixedId] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!category || !amount || isNaN(Number(amount))) return
    const flowType = inputTab as FlowType
    try {
      // 마이너스 + 할부 선택 시 → 할부 원장에 등록
      if (flowType === '마이너스' && isInstallment) {
        const totalAmt = Number(amount)
        await addInstallment.mutateAsync({
          purchase_date: date,
          member,
          detail: detail || category,
          category,
          total_amount: totalAmt,
          monthly_amount: Math.round(totalAmt / installmentMonths),
          total_months: installmentMonths,
          memo,
        })
      } else {
        await saveTx.mutateAsync({
          date, member, flow_type: flowType, category, detail,
          amount: Number(amount), memo,
          ...(category === '대출상환' && loanId ? { loan_id: loanId } : {}),
          ...(['적금', '비상금저축'].includes(category) && savingGoalId ? { saving_goal_id: savingGoalId } : {}),
        })
      }
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setCategory(''); setDetail(''); setAmount(''); setMemo('')
        setLoanId(''); setSavingGoalId('')
        setIsInstallment(false)
        setActiveTab('내역')
      }, 800)
    } catch (e) {
      alert('저장 실패: ' + (e as Error).message)
    }
  }

  const openAddFixed = () => {
    setEditingFixed(null)
    setFixedForm(emptyFixedForm)
    setFixedSheet(true)
  }

  const openEditFixed = (fx: FixedExpense) => {
    setEditingFixed(fx)
    setFixedForm({
      name: fx.name,
      flow_type: fx.flow_type as FlowType,
      category: fx.category,
      member: fx.member,
      amount: String(fx.amount),
      memo: fx.memo || '',
    })
    setFixedSheet(true)
  }

  const handleSaveFixed = async () => {
    if (!fixedForm.category || !fixedForm.amount) return
    const payload = {
      name: fixedForm.name || fixedForm.category,
      flow_type: fixedForm.flow_type,
      category: fixedForm.category,
      member: fixedForm.member,
      amount: Number(fixedForm.amount),
      memo: fixedForm.memo,
    }
    if (editingFixed) {
      await updateFixed.mutateAsync({ ...payload, id: editingFixed.fixed_id })
    } else {
      await addFixed.mutateAsync(payload)
    }
    setFixedSheet(false)
  }

  const isFixed = inputTab === '고정지출'
  const isAllowance = inputTab === '용돈'

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <h1 className="text-xl font-bold text-text-primary">거래 입력</h1>

      {/* 탭: 플러스 / 마이너스 / 용돈 / 고정지출 */}
      <div className="grid grid-cols-4 gap-1.5">
        {(['플러스', '마이너스', '용돈', '고정지출'] as InputTab[]).map((t) => (
          <button
            key={t}
            className={`py-2 rounded-xl text-[11px] font-semibold transition-colors leading-tight
              ${inputTab === t ? FLOW_COLOR[t] : 'bg-card text-text-sub'}`}
            onClick={() => {
              setInputTab(t)
              setCategory('')
              setLoanId('')
              setSavingGoalId('')
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── 용돈 입력 뷰 (집안 재정과 완전 분리 — ALLOWANCE 시트만 기록) ── */}
      {isAllowance ? (
        <>
          {/* 입금 / 지출 토글 */}
          <div className="flex gap-2">
            {(['지출', '입금'] as const).map((t) => (
              <button
                key={t}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors
                  ${allowanceType === t
                    ? t === '지출' ? 'bg-expense text-white' : 'bg-income text-white'
                    : 'bg-card text-text-sub'}`}
                onClick={() => setAllowanceType(t)}
              >
                {t === '지출' ? '💸 지출' : '💰 입금'}
              </button>
            ))}
          </div>

          <div className="bg-purple-50 rounded-2xl px-4 py-2.5">
            <p className="text-xs text-purple-700">
              {allowanceType === '지출'
                ? '용돈 지출은 집안 지출에 포함되지 않아요. 개인 잔액에서만 차감돼요.'
                : '추가 용돈, 선물 등 개인 입금을 기록해요.'}
            </p>
          </div>

          <div className="bg-card rounded-2xl p-4 space-y-3">
            {/* 날짜 */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">날짜</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
              />
            </div>

            {/* 멤버 (남편/아내만) */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">누구 용돈?</label>
              <div className="flex gap-2">
                {ALLOWANCE_MEMBERS.map((m) => (
                  <button
                    key={m}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                      ${member === m ? 'bg-purple-500 text-white' : 'bg-bg-app text-text-sub'}`}
                    onClick={() => setMember(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* 내역 */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">
                {allowanceType === '지출' ? '사용 내역' : '입금 내역'}
              </label>
              <input
                type="text"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={allowanceType === '지출' ? '예: 점심, 카페, 쇼핑 등' : '예: 월 용돈, 선물 등'}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-gray-300"
              />
            </div>

            {/* 금액 */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">금액 (원)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-gray-300"
              />
              {amount && !isNaN(Number(amount)) && (
                <p className="text-xs text-text-sub mt-1">{Number(amount).toLocaleString('ko-KR')}원</p>
              )}
            </div>

            {/* 메모 */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">메모 (선택)</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모"
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-gray-300"
              />
            </div>
          </div>

          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-purple-100 text-purple-700 text-sm font-medium text-center py-3 rounded-xl"
              >
                저장되었습니다 ✓
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            fullWidth
            onClick={async () => {
              if (!amount || isNaN(Number(amount))) return
              try {
                await addAllowanceEntry.mutateAsync({
                  date,
                  member,
                  type: allowanceType,
                  amount: Number(amount),
                  detail: detail || (allowanceType === '지출' ? '용돈 사용' : '용돈 입금'),
                  memo,
                })
                setSuccess(true)
                setTimeout(() => {
                  setSuccess(false)
                  setDetail(''); setAmount(''); setMemo('')
                  setActiveTab('홈')
                }, 800)
              } catch (e) {
                alert('저장 실패: ' + (e as Error).message)
              }
            }}
            disabled={!amount || addAllowanceEntry.isPending}
          >
            {addAllowanceEntry.isPending ? '저장 중...' : allowanceType === '지출' ? '지출 저장' : '입금 저장'}
          </Button>
        </>
      ) : /* ── 고정지출 관리 뷰 ── */
      isFixed ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-sub">매달 1일에 자동 적용됩니다</p>
            <button
              className="flex items-center gap-1 text-xs font-semibold text-blue-main bg-blue-50 px-3 py-1.5 rounded-xl"
              onClick={openAddFixed}
            >
              <Plus size={13} /> 추가
            </button>
          </div>

          {fixedLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-main border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeFixed.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm text-text-sub">등록된 고정지출이 없습니다</p>
              <p className="text-xs text-gray-300 mt-1">추가 버튼을 눌러 등록해보세요</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl overflow-hidden">
              {activeFixed.map((fx, i) => (
                <div
                  key={fx.fixed_id}
                  className={`flex items-center px-4 py-3.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{fx.name}</p>
                    <p className="text-xs text-text-sub">{fx.category} · {fx.member} · 매달 1일</p>
                  </div>
                  <span className={`text-sm font-semibold mr-3 ${
                    fx.flow_type === '마이너스' ? 'text-expense' :
                    fx.flow_type === '플러스' ? 'text-income' : 'text-blue-main'
                  }`}>
                    {fx.flow_type === '마이너스' ? '-' : fx.flow_type === '플러스' ? '+' : ''}
                    {fx.amount.toLocaleString('ko-KR')}원
                  </span>
                  <button
                    className="p-1.5 text-gray-300 active:text-blue-main mr-0.5"
                    onClick={() => openEditFixed(fx)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="p-1.5 text-gray-300 active:text-expense"
                    onClick={() => setConfirmDeleteFixedId(fx.fixed_id)}
                    disabled={deleteFixed.isPending}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 고정지출 추가/수정 시트 */}
          <BottomSheet
            isOpen={fixedSheet}
            onClose={() => setFixedSheet(false)}
            title={editingFixed ? '고정지출 수정' : '고정지출 추가'}
          >
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-sub mb-1 block">표시 이름</label>
                <input
                  type="text"
                  value={fixedForm.name}
                  onChange={(e) => setFixedForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: 넷플릭스, 월세 등"
                  className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="text-xs text-text-sub mb-1 block">유형</label>
                <div className="flex gap-2">
                  {ALL_FLOW_TYPES.map((ft) => (
                    <button
                      key={ft}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors
                        ${fixedForm.flow_type === ft ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'}`}
                      onClick={() => setFixedForm((f) => ({ ...f, flow_type: ft, category: '' }))}
                    >
                      {ft}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-text-sub mb-1 block">카테고리</label>
                <button
                  onClick={() => setFixedCatPickerOpen(true)}
                  className="w-full flex items-center justify-between bg-bg-app rounded-xl px-3 py-2.5"
                >
                  {fixedForm.category ? (
                    <span className="text-sm font-medium text-text-primary">{fixedForm.category}</span>
                  ) : (
                    <span className="text-sm text-gray-300">카테고리 선택</span>
                  )}
                  <ChevronRight size={16} className="text-gray-300" />
                </button>
              </div>
              <div>
                <label className="text-xs text-text-sub mb-1 block">구성원</label>
                <div className="flex gap-2">
                  {MEMBERS.map((m) => (
                    <button
                      key={m}
                      className={`flex-1 py-1.5 rounded-xl text-sm font-medium transition-colors
                        ${fixedForm.member === m ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'}`}
                      onClick={() => setFixedForm((f) => ({ ...f, member: m }))}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-text-sub mb-1 block">금액 (원)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={fixedForm.amount}
                  onChange={(e) => setFixedForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                />
                {fixedForm.amount && !isNaN(Number(fixedForm.amount)) && (
                  <p className="text-xs text-text-sub mt-1">{Number(fixedForm.amount).toLocaleString('ko-KR')}원</p>
                )}
              </div>
              <div>
                <label className="text-xs text-text-sub mb-1 block">메모 (선택)</label>
                <input
                  type="text"
                  value={fixedForm.memo}
                  onChange={(e) => setFixedForm((f) => ({ ...f, memo: e.target.value }))}
                  placeholder="메모"
                  className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                />
              </div>
              {!editingFixed && (
                <p className="text-xs text-blue-main bg-blue-50 rounded-xl px-3 py-2">
                  추가 즉시 이번 달({dayjs().format('YYYY년 M월')}) 1일 거래로 자동 등록됩니다
                </p>
              )}
              <Button
                fullWidth
                onClick={handleSaveFixed}
                disabled={!fixedForm.category || !fixedForm.amount || addFixed.isPending || updateFixed.isPending}
              >
                {addFixed.isPending || updateFixed.isPending ? '저장 중...' : editingFixed ? '수정 저장' : '추가하기'}
              </Button>
            </div>
          </BottomSheet>

          <ConfirmDialog
            isOpen={!!confirmDeleteFixedId}
            message="고정지출 항목을 삭제하시겠습니까?"
            onConfirm={() => {
              if (confirmDeleteFixedId) deleteFixed.mutate(confirmDeleteFixedId)
              setConfirmDeleteFixedId(null)
            }}
            onCancel={() => setConfirmDeleteFixedId(null)}
          />
        </div>
      ) : (
        /* ── 일반 거래 입력 뷰 ── */
        <>
          <div className="bg-card rounded-2xl p-4 space-y-3">
            {/* Date */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">날짜</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
              />
            </div>

            {/* Member */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">구성원</label>
              <div className="flex gap-2">
                {MEMBERS.map((m) => (
                  <button
                    key={m}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                      ${member === m ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'}`}
                    onClick={() => setMember(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">카테고리</label>
              <button
                onClick={() => setCatPickerOpen(true)}
                className="w-full flex items-center justify-between bg-bg-app rounded-xl px-3 py-2.5"
              >
                {category ? (
                  <span className="text-sm font-medium text-text-primary">{category}</span>
                ) : (
                  <span className="text-sm text-gray-300">카테고리 선택</span>
                )}
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            </div>

            {/* Loan selector */}
            {category === '대출상환' && activeLoans.length > 0 && (
              <div>
                <label className="text-xs text-text-sub mb-1 block">대출 선택</label>
                <select
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                  className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                >
                  <option value="">선택 안 함</option>
                  {activeLoans.map((l) => (
                    <option key={l.loan_id ?? l.id} value={l.loan_id ?? l.id}>{l.name} ({l.member})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Saving goal selector */}
            {['적금', '비상금저축'].includes(category) && activeSavings.length > 0 && (
              <div>
                <label className="text-xs text-text-sub mb-1 block">저축 목표 선택</label>
                <select
                  value={savingGoalId}
                  onChange={(e) => setSavingGoalId(e.target.value)}
                  className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                >
                  <option value="">선택 안 함</option>
                  {activeSavings.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Detail */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">상세 내역</label>
              <input
                type="text"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="예: 스타벅스, 마트 등"
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-gray-300"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">금액 (원)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-gray-300"
              />
              {amount && !isNaN(Number(amount)) && (
                <p className="text-xs text-text-sub mt-1">{Number(amount).toLocaleString('ko-KR')}원</p>
              )}
            </div>

            {/* 할부 선택 (마이너스 탭에서만) */}
            {(inputTab as string) === '마이너스' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-text-sub">할부 결제</label>
                  <button
                    type="button"
                    onClick={() => setIsInstallment((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      isInstallment ? 'bg-blue-main' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        isInstallment ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                {isInstallment && (
                  <div className="bg-blue-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-blue-main font-medium">할부 개월수</p>
                    <div className="flex gap-2 flex-wrap">
                      {[2, 3, 6, 9, 12, 24, 36].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            installmentMonths === m
                              ? 'bg-blue-main text-white'
                              : 'bg-white text-text-sub'
                          }`}
                          onClick={() => setInstallmentMonths(m)}
                        >
                          {m}개월
                        </button>
                      ))}
                    </div>
                    {amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
                      <p className="text-xs text-blue-main">
                        월 {Math.round(Number(amount) / installmentMonths).toLocaleString('ko-KR')}원 × {installmentMonths}개월
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Memo */}
            <div>
              <label className="text-xs text-text-sub mb-1 block">메모 (선택)</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모"
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-gray-300"
              />
            </div>
          </div>

          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-income/10 text-income text-sm font-medium text-center py-3 rounded-xl"
              >
                저장되었습니다 ✓
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            fullWidth
            onClick={handleSubmit}
            disabled={!category || !amount || saveTx.isPending}
          >
            {saveTx.isPending ? '저장 중...' : '저장하기'}
          </Button>

          {/* 카드 이용내역 가져오기 */}
          <div className="border-t border-gray-100 pt-3">
            <CardImport />
          </div>
        </>
      )}

      {/* 일반 거래 카테고리 픽커 */}
      <CategoryPicker
        isOpen={catPickerOpen}
        onClose={() => setCatPickerOpen(false)}
        categories={inputTab === '플러스' ? PLUS_CATEGORIES : MINUS_CATEGORIES}
        selected={category}
        onSelect={(c) => { setCategory(c); setLoanId(''); setSavingGoalId('') }}
        title={inputTab === '플러스' ? '수입 카테고리' : '지출 카테고리'}
      />

      {/* 고정지출 카테고리 픽커 */}
      <CategoryPicker
        isOpen={fixedCatPickerOpen}
        onClose={() => setFixedCatPickerOpen(false)}
        categories={fixedForm.flow_type === '플러스' ? PLUS_CATEGORIES : MINUS_CATEGORIES}
        selected={fixedForm.category}
        onSelect={(c) => setFixedForm((f) => ({ ...f, category: c }))}
        title="카테고리 선택"
      />
    </div>
  )
}
