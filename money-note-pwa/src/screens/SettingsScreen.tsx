import { useState } from 'react'
import { Plus, LogOut } from 'lucide-react'
import { useLoans, useAddLoan, useDeactivateLoan } from '@/hooks/useLoans'
import { useSavingGoals, useAddSavingGoal, useDeactivateSavingGoal } from '@/hooks/useSavings'
import { useAuthStore } from '@/store/authStore'
import { gasPost } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { AmountText } from '@/components/ui/AmountText'

export function SettingsScreen() {
  const lock = useAuthStore((s) => s.lock)
  const { data: loans, refetch: refetchLoans } = useLoans()
  const { data: savings, refetch: refetchSavings } = useSavingGoals()
  const addLoan = useAddLoan()
  const deactivateLoan = useDeactivateLoan()
  const addSaving = useAddSavingGoal()
  const deactivateSaving = useDeactivateSavingGoal()

  const [loanSheet, setLoanSheet] = useState(false)
  const [savingSheet, setSavingSheet] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [gasUrl, setGasUrl] = useState(import.meta.env.VITE_GAS_URL ?? '')

  const [loanForm, setLoanForm] = useState({
    name: '', bank: '', principal: '', interest_rate: '', monthly_payment: '',
    start_date: '', end_date: '',
  })
  const [savingForm, setSavingForm] = useState({
    name: '', target_amount: '', target_date: '',
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
    await addSaving.mutateAsync({
      name: savingForm.name,
      target_amount: Number(savingForm.target_amount),
      target_date: savingForm.target_date,
    })
    setSavingSheet(false)
    refetchSavings()
  }

  const activeLoans = (loans ?? []).filter((l) => l.is_active)
  const activeSavings = (savings ?? []).filter((s) => s.is_active)

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <h1 className="text-xl font-bold text-text-primary">설정</h1>

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
                    <button
                      className="text-[10px] text-text-sub"
                      onClick={() => deactivateSaving.mutate(s.id)}
                    >
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
      <button
        className="flex items-center gap-2 text-expense text-sm font-medium mx-auto"
        onClick={lock}
      >
        <LogOut size={16} />
        잠금
      </button>

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
          <Button fullWidth onClick={handleAddLoan} disabled={!loanForm.name || addLoan.isPending}>
            추가
          </Button>
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
          <Button fullWidth onClick={handleAddSaving} disabled={!savingForm.name || addSaving.isPending}>
            추가
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
