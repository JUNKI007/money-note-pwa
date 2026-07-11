import { useState } from 'react'
import { Plus, LogOut, Trash2 } from 'lucide-react'
import { useLoans, useAddLoan, useDeactivateLoan } from '@/hooks/useLoans'
import { useSavingGoals, useAddSavingGoal, useDeactivateSavingGoal } from '@/hooks/useSavings'
import { useBudgets, useSetBudget } from '@/hooks/useBudget'
import {
  useRecurrings,
  useAddRecurring,
  useDeleteRecurring,
  useApplyRecurring,
} from '@/hooks/useRecurring'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { gasPost } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { AmountText } from '@/components/ui/AmountText'
import dayjs from 'dayjs'

const EXPENSE_CATEGORIES = ['식비', '카페', '쇼핑', '교통', '의료', '문화', '교육', '공과금', '기타소비']
const FLOW_CATEGORIES: Record<string, string[]> = {
  '마이너스': ['식비', '카페', '쇼핑', '교통', '의료', '문화', '교육', '공과금', '기타소비'],
  '플러스': ['월급', '부수입', '용돈', '환급', '기타수입'],
  '이동·저축·상환': ['적금', '비상금저축', '대출상환', '계좌이체'],
}
const MEMBERS = ['남편', '아내', '공동']

export function SettingsScreen() {
  const lock = useAuthStore((s) => s.lock)
  const { selectedMonth } = useAppStore()
  const { data: loans, refetch: refetchLoans } = useLoans()
  const { data: savings, refetch: refetchSavings } = useSavingGoals()
  const { data: budgets } = useBudgets()
  const { data: recurrings } = useRecurrings()
  const addLoan = useAddLoan()
  const deactivateLoan = useDeactivateLoan()
  const addSaving = useAddSavingGoal()
  const deactivateSaving = useDeactivateSavingGoal()
  const setBudget = useSetBudget()
  const addRecurring = useAddRecurring()
  const deleteRecurring = useDeleteRecurring()
  const applyRecurring = useApplyRecurring()

  const [loanSheet, setLoanSheet] = useState(false)
  const [savingSheet, setSavingSheet] = useState(false)
  const [budgetSheet, setBudgetSheet] = useState(false)
  const [recurringSheet, setRecurringSheet] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [gasUrl, setGasUrl] = useState(
    localStorage.getItem('GAS_URL_OVERRIDE') || (import.meta.env.VITE_GAS_URL as string) || ''
  )

  const [loanForm, setLoanForm] = useState({
    name: '', bank: '', principal: '', interest_rate: '', monthly_payment: '',
    start_date: '', end_date: '',
  })
  const [savingForm, setSavingForm] = useState({
    name: '', target_amount: '', target_date: '',
  })
  const [budgetForm, setBudgetForm] = useState({ category: EXPENSE_CATEGORIES[0], amount: '' })
  const [recurringForm, setRecurringForm] = useState({
    flow_type: '마이너스',
    category: '',
    member: MEMBERS[0],
    detail: '',
    amount: '',
    memo: '',
    day_of_month: '1',
  })

  const handleSaveGasUrl = () => {
    localStorage.setItem('GAS_URL_OVERRIDE', gasUrl)
    alert('저장되었습니다. 새로고침 후 적용됩니다.')
  }

  const handleSyncCalendar = async () => {
    setSyncing(true)
    try {
      await gasPost('syncCalendar')
      alert('Google Calendar 동기화 완료')
    } catch (e) {
      alert('동기화 실패: ' + (e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  const handleAddLoan = async () => {
    if (!loanForm.name) return
    await addLoan.mutateAsync({
      name: loanForm.name,
      bank: loanForm.bank,
      principal: Number(loanForm.principal),
      interest_rate: Number(loanForm.interest_rate),
      monthly_payment: Number(loanForm.monthly_payment),
      start_date: loanForm.start_date,
      end_date: loanForm.end_date,
    })
    setLoanSheet(false)
    refetchLoans()
  }

  const handleAddSaving = async () => {
    if (!savingForm.name) return
    await addSaving.mutateAsync({
      name: savingForm.name,
      target_amount: Number(savingForm.target_amount),
      target_date: savingForm.target_date,
    })
    setSavingSheet(false)
    refetchSavings()
  }

  const handleSetBudget = async () => {
    if (!budgetForm.category || !budgetForm.amount) return
    await setBudget.mutateAsync({ category: budgetForm.category, amount: Number(budgetForm.amount) })
    setBudgetSheet(false)
  }

  const handleAddRecurring = async () => {
    if (!recurringForm.category || !recurringForm.amount) return
    await addRecurring.mutateAsync({
      flow_type: recurringForm.flow_type,
      category: recurringForm.category,
      member: recurringForm.member,
      detail: recurringForm.detail,
      amount: Number(recurringForm.amount),
      memo: recurringForm.memo,
      day_of_month: Number(recurringForm.day_of_month),
    })
    setRecurringSheet(false)
    setRecurringForm({ flow_type: '마이너스', category: '', member: MEMBERS[0], detail: '', amount: '', memo: '', day_of_month: '1' })
  }

  const handleApplyRecurring = async () => {
    setApplying(true)
    try {
      const result = await applyRecurring.mutateAsync(selectedMonth)
      alert(`${(result as { applied: number }).applied}건의 정기 거래가 이번 달에 적용되었습니다.`)
    } catch (e) {
      alert('적용 실패: ' + (e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  const activeLoans = (loans ?? []).filter((l) => l.is_active)
  const activeSavings = (savings ?? []).filter((s) => s.is_active)
  const activeRecurrings = (recurrings ?? []).filter((r) => r.is_active)
  const budgetEntries = Object.entries(budgets ?? {})

  const recurringCategories = FLOW_CATEGORIES[recurringForm.flow_type] ?? []

  return (
    <div className="px-4 pt-4 pb-4 space-y-3">
      <h1 className="text-xl font-bold text-text-primary">설정</h1>

      {/* Budget */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-text-primary">카테고리 예산</p>
          <button onClick={() => setBudgetSheet(true)} className="p-1 text-blue-main">
            <Plus size={18} />
          </button>
        </div>
        {budgetEntries.length === 0 ? (
          <p className="text-xs text-text-sub text-center py-2">예산이 설정되지 않았습니다</p>
        ) : (
          <div className="space-y-2">
            {budgetEntries.map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-sm text-text-primary">{cat}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{amt.toLocaleString('ko-KR')}원</span>
                  <button
                    className="text-[10px] text-expense"
                    onClick={() => setBudget.mutate({ category: cat, amount: 0 })}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recurring */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-text-primary">정기 거래</p>
          <div className="flex items-center gap-2">
            <button
              className="text-xs text-blue-main font-medium px-2 py-1 bg-blue-50 rounded-lg"
              onClick={handleApplyRecurring}
              disabled={applying || activeRecurrings.length === 0}
            >
              {applying ? '적용 중...' : `${dayjs(selectedMonth).format('M월')} 적용`}
            </button>
            <button onClick={() => setRecurringSheet(true)} className="p-1 text-blue-main">
              <Plus size={18} />
            </button>
          </div>
        </div>
        {activeRecurrings.length === 0 ? (
          <p className="text-xs text-text-sub text-center py-2">등록된 정기 거래가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {activeRecurrings.map((r) => (
              <div key={r.recurring_id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">{r.category}</p>
                  <p className="text-xs text-text-sub">매월 {r.day_of_month}일 · {r.member}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${r.flow_type === '마이너스' ? 'text-expense' : 'text-income'}`}>
                    {r.flow_type === '마이너스' ? '-' : '+'}{r.amount.toLocaleString('ko-KR')}원
                  </span>
                  <button
                    className="p-1 text-gray-300 active:text-expense"
                    onClick={() => deleteRecurring.mutate(r.recurring_id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Loans */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-text-primary">대출 목록</p>
          <button onClick={() => setLoanSheet(true)} className="p-1 text-blue-main">
            <Plus size={18} />
          </button>
        </div>
        {activeLoans.length === 0 ? (
          <p className="text-xs text-text-sub text-center py-2">등록된 대출이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {activeLoans.map((l) => (
              <div key={l.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">{l.name}</p>
                  <p className="text-xs text-text-sub">{l.bank} · {l.interest_rate}%</p>
                </div>
                <div className="text-right">
                  <AmountText amount={l.current_balance} type="expense" className="text-sm" />
                  <button
                    className="text-[10px] text-text-sub mt-0.5 block ml-auto"
                    onClick={() => deactivateLoan.mutate(l.id)}
                  >
                    비활성화
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Savings */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-text-primary">저축 목표</p>
          <button onClick={() => setSavingSheet(true)} className="p-1 text-blue-main">
            <Plus size={18} />
          </button>
        </div>
        {activeSavings.length === 0 ? (
          <p className="text-xs text-text-sub text-center py-2">등록된 저축 목표가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {activeSavings.map((s) => {
              const pct = s.target_amount > 0 ? Math.min(100, (s.current_amount / s.target_amount) * 100) : 0
              return (
                <div key={s.id}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-text-primary">{s.name}</p>
                    <button className="text-[10px] text-text-sub" onClick={() => deactivateSaving.mutate(s.id)}>
                      비활성화
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-bg-app rounded-full h-1.5">
                      <div className="bg-income h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-text-sub">{Math.round(pct)}%</span>
                  </div>
                  <p className="text-xs text-text-sub mt-0.5">
                    <AmountText amount={s.current_amount} className="text-xs" /> / <AmountText amount={s.target_amount} className="text-xs" />
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* GAS URL */}
      <Card>
        <p className="text-sm font-semibold text-text-primary mb-2">GAS API URL</p>
        <input
          type="text"
          value={gasUrl}
          onChange={(e) => setGasUrl(e.target.value)}
          className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-xs text-text-primary mb-2"
          placeholder="https://script.google.com/..."
        />
        <Button variant="ghost" onClick={handleSaveGasUrl} fullWidth>저장</Button>
      </Card>

      {/* Calendar sync */}
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">Google Calendar 동기화</p>
          <Button variant="ghost" onClick={handleSyncCalendar} disabled={syncing}>
            {syncing ? '동기화 중...' : '동기화'}
          </Button>
        </div>
      </Card>

      {/* Logout */}
      <button className="flex items-center gap-2 text-expense text-sm font-medium mx-auto" onClick={lock}>
        <LogOut size={16} />
        잠금
      </button>

      {/* Budget sheet */}
      <BottomSheet isOpen={budgetSheet} onClose={() => setBudgetSheet(false)} title="예산 설정">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-sub mb-1 block">카테고리</label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${budgetForm.category === c ? 'bg-blue-deep text-white' : 'bg-bg-app text-text-sub'}`}
                  onClick={() => setBudgetForm((f) => ({ ...f, category: c }))}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">월 예산 (원)</label>
            <input
              type="number"
              inputMode="numeric"
              value={budgetForm.amount}
              onChange={(e) => setBudgetForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0"
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
          </div>
          <Button fullWidth onClick={handleSetBudget} disabled={!budgetForm.amount || setBudget.isPending}>
            저장
          </Button>
        </div>
      </BottomSheet>

      {/* Recurring sheet */}
      <BottomSheet isOpen={recurringSheet} onClose={() => setRecurringSheet(false)} title="정기 거래 추가">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-sub mb-1 block">유형</label>
            <div className="flex gap-2">
              {['마이너스', '플러스', '이동·저축·상환'].map((ft) => (
                <button
                  key={ft}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium ${recurringForm.flow_type === ft ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'}`}
                  onClick={() => setRecurringForm((f) => ({ ...f, flow_type: ft, category: '' }))}
                >
                  {ft}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">카테고리</label>
            <div className="flex flex-wrap gap-1.5">
              {recurringCategories.map((c) => (
                <button
                  key={c}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${recurringForm.category === c ? 'bg-blue-deep text-white' : 'bg-bg-app text-text-sub'}`}
                  onClick={() => setRecurringForm((f) => ({ ...f, category: c }))}
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
                  className={`flex-1 py-1.5 rounded-xl text-sm font-medium ${recurringForm.member === m ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'}`}
                  onClick={() => setRecurringForm((f) => ({ ...f, member: m }))}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">상세 내역 (선택)</label>
            <input
              type="text"
              value={recurringForm.detail}
              onChange={(e) => setRecurringForm((f) => ({ ...f, detail: e.target.value }))}
              placeholder="예: 넷플릭스"
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">금액 (원)</label>
            <input
              type="number"
              inputMode="numeric"
              value={recurringForm.amount}
              onChange={(e) => setRecurringForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0"
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">매월 결제일</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="28"
              value={recurringForm.day_of_month}
              onChange={(e) => setRecurringForm((f) => ({ ...f, day_of_month: e.target.value }))}
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
          </div>
          <Button fullWidth onClick={handleAddRecurring} disabled={!recurringForm.category || !recurringForm.amount || addRecurring.isPending}>
            추가
          </Button>
        </div>
      </BottomSheet>

      {/* Add Loan Sheet */}
      <BottomSheet isOpen={loanSheet} onClose={() => setLoanSheet(false)} title="대출 추가">
        <div className="space-y-3">
          {[
            { label: '대출명', key: 'name', type: 'text', placeholder: '예: 주택담보대출' },
            { label: '은행', key: 'bank', type: 'text', placeholder: '예: 국민은행' },
            { label: '원금 (원)', key: 'principal', type: 'number', placeholder: '0' },
            { label: '금리 (%)', key: 'interest_rate', type: 'number', placeholder: '3.5' },
            { label: '월 상환액 (원)', key: 'monthly_payment', type: 'number', placeholder: '0' },
            { label: '시작일', key: 'start_date', type: 'date', placeholder: '' },
            { label: '종료일', key: 'end_date', type: 'date', placeholder: '' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-text-sub mb-1 block">{label}</label>
              <input
                type={type}
                value={loanForm[key as keyof typeof loanForm]}
                onChange={(e) => setLoanForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
              />
            </div>
          ))}
          <Button fullWidth onClick={handleAddLoan} disabled={!loanForm.name || addLoan.isPending}>추가</Button>
        </div>
      </BottomSheet>

      {/* Add Saving Sheet */}
      <BottomSheet isOpen={savingSheet} onClose={() => setSavingSheet(false)} title="저축 목표 추가">
        <div className="space-y-3">
          {[
            { label: '목표명', key: 'name', type: 'text', placeholder: '예: 여행 적금' },
            { label: '목표 금액 (원)', key: 'target_amount', type: 'number', placeholder: '0' },
            { label: '목표일', key: 'target_date', type: 'date', placeholder: '' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-text-sub mb-1 block">{label}</label>
              <input
                type={type}
                value={savingForm[key as keyof typeof savingForm]}
                onChange={(e) => setSavingForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
              />
            </div>
          ))}
          <Button fullWidth onClick={handleAddSaving} disabled={!savingForm.name || addSaving.isPending}>추가</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
