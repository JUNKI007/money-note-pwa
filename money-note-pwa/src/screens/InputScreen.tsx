import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dayjs from 'dayjs'
import { useSaveTransaction } from '@/hooks/useTransactions'
import { useAddRecurring } from '@/hooks/useRecurring'
import { useLoans } from '@/hooks/useLoans'
import { useSavingGoals } from '@/hooks/useSavings'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/Button'

type FlowType = '플러스' | '마이너스' | '이동·저축·상환'

const CATEGORIES: Record<FlowType, string[]> = {
  '플러스': ['월급', '부수입', '용돈', '환급', '기타수입'],
  '마이너스': ['식비', '카페', '쇼핑', '교통', '의료', '문화', '교육', '공과금', '기타소비'],
  '이동·저축·상환': ['적금', '비상금저축', '대출상환', '계좌이체'],
}

const MEMBERS = ['남편', '아내', '공동']

export function InputScreen() {
  const { setActiveTab } = useAppStore()
  const [flowType, setFlowType] = useState<FlowType>('마이너스')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [member, setMember] = useState(MEMBERS[0])
  const [category, setCategory] = useState('')
  const [detail, setDetail] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [loanId, setLoanId] = useState('')
  const [savingGoalId, setSavingGoalId] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [success, setSuccess] = useState(false)

  const saveTx = useSaveTransaction()
  const addRecurring = useAddRecurring()
  const { data: loans } = useLoans()
  const { data: savingGoals } = useSavingGoals()

  const activeLoans = loans?.filter((l) => l.is_active) ?? []
  const activeSavings = savingGoals?.filter((s) => s.is_active) ?? []

  const handleSubmit = async () => {
    if (!category || !amount || isNaN(Number(amount))) return
    try {
      await saveTx.mutateAsync({
        date,
        member,
        flow_type: flowType,
        category,
        detail,
        amount: Number(amount),
        memo,
        ...(category === '대출상환' && loanId ? { loan_id: loanId } : {}),
        ...(['적금','비상금저축'].includes(category) && savingGoalId ? { saving_goal_id: savingGoalId } : {}),
      })

      if (isRecurring) {
        await addRecurring.mutateAsync({
          flow_type: flowType,
          category,
          member,
          detail,
          amount: Number(amount),
          memo,
          day_of_month: Number(dayOfMonth),
        })
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setCategory('')
        setDetail('')
        setAmount('')
        setMemo('')
        setLoanId('')
        setSavingGoalId('')
        setIsRecurring(false)
        setActiveTab('내역')
      }, 800)
    } catch (e) {
      alert('저장 실패: ' + (e as Error).message)
    }
  }

  const flowColors: Record<FlowType, string> = {
    '플러스': 'bg-income text-white',
    '마이너스': 'bg-expense text-white',
    '이동·저축·상환': 'bg-blue-main text-white',
  }

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <h1 className="text-xl font-bold text-text-primary">거래 입력</h1>

      {/* Flow type tabs */}
      <div className="flex gap-2">
        {(['플러스', '마이너스', '이동·저축·상환'] as FlowType[]).map((f) => (
          <button
            key={f}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors
              ${flowType === f ? flowColors[f] : 'bg-card text-text-sub'}`}
            onClick={() => { setFlowType(f); setCategory(''); setLoanId(''); setSavingGoalId('') }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Form */}
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
                <option key={l.id} value={l.id}>{l.name} ({l.bank})</option>
              ))}
            </select>
          </div>
        )}

        {/* Saving goal selector */}
        {['적금','비상금저축'].includes(category) && activeSavings.length > 0 && (
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

        {/* Recurring toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-text-primary">정기 거래로 등록</p>
            <p className="text-xs text-text-sub">매월 자동으로 추가할 수 있습니다</p>
          </div>
          <button
            className={`w-11 h-6 rounded-full transition-colors relative ${isRecurring ? 'bg-blue-main' : 'bg-gray-200'}`}
            onClick={() => setIsRecurring((v) => !v)}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                isRecurring ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {isRecurring && (
          <div>
            <label className="text-xs text-text-sub mb-1 block">매월 결제일</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="28"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
          </div>
        )}
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
    </div>
  )
}
