import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Trash2, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { useSaveTransaction } from '@/hooks/useTransactions'
import { useLoans } from '@/hooks/useLoans'
import { useSavingGoals } from '@/hooks/useSavings'
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
import { CardImport } from '@/components/CardImport'

type FlowType = '플러스' | '마이너스' | '이동·저축·상환'
type InputTab = FlowType | '고정지출'

const CATEGORIES: Record<FlowType, string[]> = {
  '플러스': ['월급', '부수입', '용돈', '환급', '기타수입'],
  '마이너스': ['식비', '카페', '쇼핑', '교통', '의료', '문화', '교육', '공과금', 'OTT·구독', '기타소비'],
  '이동·저축·상환': ['적금', '비상금저축', '대출상환', '계좌이체'],
}
const ALL_CATEGORIES = {
  ...CATEGORIES,
  '고정지출': ['식비', '카페', '쇼핑', '교통', '의료', '문화', '교육', '공과금', 'OTT·구독', '기타소비',
               '월급', '부수입', '용돈', '환급', '기타수입', '적금', '비상금저축', '대출상환', '계좌이체'],
}

const MEMBERS = ['남편', '아내', '공동']
const ALL_FLOW_TYPES: FlowType[] = ['플러스', '마이너스', '이동·저축·상환']

const FLOW_COLOR: Record<InputTab, string> = {
  '플러스': 'bg-income text-white',
  '마이너스': 'bg-expense text-white',
  '이동·저축·상환': 'bg-blue-main text-white',
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

  // 고정지출 편집 상태
  const [fixedSheet, setFixedSheet] = useState(false)
  const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null)
  const [fixedForm, setFixedForm] = useState(emptyFixedForm)

  const saveTx = useSaveTransaction()
  const { data: loans } = useLoans()
  const { data: savingGoals } = useSavingGoals()
  const { data: fixedExpenses, isLoading: fixedLoading } = useFixedExpenses()
  const addFixed = useAddFixedExpense()
  const updateFixed = useUpdateFixedExpense()
  const deleteFixed = useDeleteFixedExpense()

  const activeLoans = loans?.filter((l) => l.is_active) ?? []
  const activeSavings = savingGoals?.filter((s) => s.is_active) ?? []
  const activeFixed = (fixedExpenses ?? []).filter((f) => f.is_active)

  const handleSubmit = async () => {
    if (!category || !amount || isNaN(Number(amount))) return
    const flowType = inputTab as FlowType
    try {
      await saveTx.mutateAsync({
        date, member, flow_type: flowType, category, detail,
        amount: Number(amount), memo,
        ...(category === '대출상환' && loanId ? { loan_id: loanId } : {}),
        ...(['적금', '비상금저축'].includes(category) && savingGoalId ? { saving_goal_id: savingGoalId } : {}),
      })
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setCategory(''); setDetail(''); setAmount(''); setMemo('')
        setLoanId(''); setSavingGoalId('')
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

  const fixedCats = ALL_CATEGORIES['고정지출']
  const isFixed = inputTab === '고정지출'
  const flowType = isFixed ? '마이너스' : (inputTab as FlowType)

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <h1 className="text-xl font-bold text-text-primary">거래 입력</h1>

      {/* 탭: 플러스 / 마이너스 / 이동·저축·상환 / 고정지출 */}
      <div className="grid grid-cols-4 gap-1.5">
        {(['플러스', '마이너스', '이동·저축·상환', '고정지출'] as InputTab[]).map((t) => (
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

      {/* ── 고정지출 관리 뷰 ── */}
      {isFixed ? (
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
                    onClick={() => deleteFixed.mutate(fx.fixed_id)}
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
                <div className="flex flex-wrap gap-1.5">
                  {(CATEGORIES[fixedForm.flow_type] ?? fixedCats).map((c) => (
                    <button
                      key={c}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                        ${fixedForm.category === c ? 'bg-blue-deep text-white' : 'bg-bg-app text-text-sub'}`}
                      onClick={() => setFixedForm((f) => ({ ...f, category: c }))}
                    >
                      {c}
                    </button>
                  ))}
                </div>
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
              <div className="flex flex-wrap gap-2">
                {CATEGORIES[flowType].map((c) => (
                  <button
                    key={c}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                      ${category === c ? 'bg-blue-deep text-white' : 'bg-bg-app text-text-sub'}`}
                    onClick={() => { setCategory(c); setLoanId(''); setSavingGoalId('') }}
                  >
                    {c}
                  </button>
                ))}
              </div>
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
    </div>
  )
}
