import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, CreditCard, PiggyBank, Eye, EyeOff } from 'lucide-react'
import dayjs from 'dayjs'
import {
  useSavingGoals,
  useAddSavingGoal,
  useUpdateSavingGoal,
  useDeactivateSavingGoal,
} from '@/hooks/useSavings'
import { useLoans, useAddLoan, useDeactivateLoan } from '@/hooks/useLoans'
import { useInstallments, useDeactivateInstallment } from '@/hooks/useInstallments'
import { useSaveTransaction } from '@/hooks/useTransactions'
import { Button } from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const MEMBERS = ['남편', '아내', '공동']
const REPAYMENT_TYPES = ['이자전용', '원금+이자'] as const
type SavingsTab = '저축' | '할부' | '대출'

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export function SavingsScreen() {
  const { data: savings } = useSavingGoals()
  const { data: loans } = useLoans()
  const { data: installments } = useInstallments()
  const addSaving = useAddSavingGoal()
  const updateSaving = useUpdateSavingGoal()
  const saveTx = useSaveTransaction()
  const deactivateSaving = useDeactivateSavingGoal()
  const addLoan = useAddLoan()
  const deactivateLoanMut = useDeactivateLoan()
  const deactivateInst = useDeactivateInstallment()

  const [activeTab, setActiveTab] = useState<SavingsTab>('저축')

  // 저축 추가 시트
  const [savingSheet, setSavingSheet] = useState(false)
  const [hasTarget, setHasTarget] = useState(false)
  const [savingForm, setSavingForm] = useState({
    name: '', target_amount: '', monthly_amount: '', target_date: '', memo: '',
  })

  // 입금 시트
  const [depositSheet, setDepositSheet] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositMember, setDepositMember] = useState('공동')
  const [depositDate, setDepositDate] = useState(dayjs().format('YYYY-MM-DD'))

  // 대출 추가 시트
  const [loanSheet, setLoanSheet] = useState(false)
  const [loanForm, setLoanForm] = useState({
    name: '', member: MEMBERS[0], principal: '', balance: '',
    interest_rate: '', repayment_type: '원금+이자' as typeof REPAYMENT_TYPES[number],
    monthly_payment: '', start_date: '', end_date: '', memo: '',
  })

  // 확인 다이얼로그
  const [confirmInst, setConfirmInst] = useState<string | null>(null)
  const [confirmSaving, setConfirmSaving] = useState<string | null>(null)
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null)

  const activeGoals = (savings ?? []).filter((g) => g.is_active)
  const activeLoans = (loans ?? []).filter((l) => l.is_active)
  const activeInsts = (installments ?? []).filter((i) => i.is_active && i.remaining_months > 0)
  const totalSaved = activeGoals.reduce((s, g) => s + g.current_amount, 0)
  const totalLoan = activeLoans.reduce((s, l) => s + (l.balance ?? l.principal), 0)
  const totalInstallRemain = activeInsts.reduce((s, i) => s + i.remaining_amount, 0)
  const thisMonthInstall = activeInsts.reduce((s, i) => s + i.monthly_amount, 0)

  const handleAddSaving = async () => {
    if (!savingForm.name) return
    await addSaving.mutateAsync({
      name: savingForm.name,
      has_target: hasTarget,
      target_amount: hasTarget ? Number(savingForm.target_amount) || 0 : 0,
      target_date: hasTarget ? savingForm.target_date : '',
      monthly_amount: Number(savingForm.monthly_amount) || 0,
      memo: savingForm.memo,
    })
    setSavingForm({ name: '', target_amount: '', monthly_amount: '', target_date: '', memo: '' })
    setHasTarget(false)
    setSavingSheet(false)
  }

  const handleDeposit = async () => {
    if (!depositSheet || !depositAmount) return
    const goal = activeGoals.find((g) => g.id === depositSheet)
    if (!goal) return
    const amt = Number(depositAmount)
    await Promise.all([
      updateSaving.mutateAsync({ id: depositSheet, current_amount: goal.current_amount + amt }),
      saveTx.mutateAsync({
        date: depositDate,
        member: depositMember,
        flow_type: '이동·저축·상환',
        category: '적금',
        detail: goal.name,
        amount: amt,
        memo: `[저축:${depositSheet}]`,
      }),
    ])
    setDepositAmount('')
    setDepositSheet(null)
  }

  const toggleShowOnHome = (id: string, current: boolean) => {
    updateSaving.mutate({ id, show_on_home: !current })
  }

  const handleAddLoan = async () => {
    if (!loanForm.name || !loanForm.principal) return
    await addLoan.mutateAsync({
      name: loanForm.name, member: loanForm.member,
      principal: Number(loanForm.principal),
      balance: loanForm.balance ? Number(loanForm.balance) : Number(loanForm.principal),
      interest_rate: Number(loanForm.interest_rate),
      repayment_type: loanForm.repayment_type,
      monthly_payment: Number(loanForm.monthly_payment),
      start_date: loanForm.start_date, end_date: loanForm.end_date, memo: loanForm.memo,
    })
    setLoanForm({
      name: '', member: MEMBERS[0], principal: '', balance: '', interest_rate: '',
      repayment_type: '원금+이자', monthly_payment: '', start_date: '', end_date: '', memo: '',
    })
    setLoanSheet(false)
  }

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <h1 className="text-lg font-bold text-text-primary">저축 · 대출 관리</h1>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-1 mb-1">
            <PiggyBank size={12} className="text-income" />
            <p className="text-[10px] text-gray-400">총 저축</p>
          </div>
          <p className="text-sm font-bold text-income">{fmt(totalSaved)}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-1 mb-1">
            <CreditCard size={12} className="text-expense" />
            <p className="text-[10px] text-gray-400">총 대출</p>
          </div>
          <p className="text-sm font-bold text-expense">{fmt(totalLoan)}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <p className="text-[10px] text-gray-400 mb-1">할부 잔액</p>
          <p className="text-sm font-bold text-orange-500">{fmt(totalInstallRemain)}</p>
          {thisMonthInstall > 0 && (
            <p className="text-[9px] text-gray-400">이달 {fmt(thisMonthInstall)}</p>
          )}
        </div>
      </div>

      {/* 순자산 */}
      <div className="bg-gradient-to-r from-blue-deep to-blue-main rounded-2xl p-4 shadow-sm">
        <p className="text-[11px] text-blue-100 mb-1">순자산 (저축 - 대출 - 할부잔액)</p>
        <p className={`text-xl font-bold ${totalSaved - totalLoan - totalInstallRemain >= 0 ? 'text-white' : 'text-red-200'}`}>
          {totalSaved - totalLoan - totalInstallRemain >= 0 ? '+' : ''}{fmt(totalSaved - totalLoan - totalInstallRemain)}
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {(['저축', '할부', '대출'] as SavingsTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === t ? 'bg-blue-deep text-white' : 'bg-card text-text-sub'
            }`}
          >
            {t}
            {t === '할부' && activeInsts.length > 0 && (
              <span className="ml-1 text-[9px] bg-orange-400 text-white rounded-full px-1">
                {activeInsts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 저축 섹션 ── */}
      {activeTab === '저축' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-text-primary">저축 목표</h2>
            <button
              onClick={() => setSavingSheet(true)}
              className="flex items-center gap-1 text-xs text-blue-main font-medium"
            >
              <Plus size={14} />추가
            </button>
          </div>

          {activeGoals.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
              <p className="text-sm text-gray-400">등록된 저축 목표가 없습니다</p>
              <p className="text-xs text-gray-300 mt-1">+ 추가를 눌러 저축 목표를 만들어보세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeGoals.map((g) => {
                const pct = g.has_target && g.target_amount > 0
                  ? Math.min(100, (g.current_amount / g.target_amount) * 100)
                  : null
                return (
                  <div key={g.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    {/* 헤더 */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-text-primary">{g.name}</p>
                          {g.monthly_amount > 0 && (
                            <span className="text-[10px] bg-blue-50 text-blue-main px-1.5 py-0.5 rounded-full">
                              월 {fmt(g.monthly_amount)} 자동
                            </span>
                          )}
                        </div>
                        {g.has_target && g.target_date && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {dayjs(g.target_date).format('YYYY년 M월')} 목표
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {/* 홈화면 표시 토글 */}
                        <button
                          onClick={() => toggleShowOnHome(g.id, g.show_on_home)}
                          className={`flex items-center gap-0.5 text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${
                            g.show_on_home
                              ? 'bg-orange-100 text-orange-500'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                          title="홈화면 표시 ON/OFF"
                        >
                          {g.show_on_home ? <Eye size={10} /> : <EyeOff size={10} />}
                          홈
                        </button>
                        <button
                          onClick={() => {
                            setDepositSheet(g.id)
                            setDepositAmount('')
                            setDepositMember('공동')
                            setDepositDate(dayjs().format('YYYY-MM-DD'))
                          }}
                          className="text-[11px] px-2.5 py-1 bg-blue-50 text-blue-main rounded-full font-medium"
                        >
                          입금
                        </button>
                        <button
                          onClick={() => setConfirmSaving(g.id)}
                          className="p-1.5 text-gray-300 active:text-expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* 목표 있는 저축: 진행률 바 */}
                    {pct !== null ? (
                      <>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                          <div
                            className="h-full rounded-full bg-blue-main transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-bold text-blue-deep">{fmt(g.current_amount)}</span>
                            <span className="text-[10px] text-gray-400 ml-1">/ {fmt(g.target_amount)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-blue-main">{Math.round(pct)}%</span>
                            {g.target_amount - g.current_amount > 0 && (
                              <p className="text-[10px] text-gray-400">잔여 {fmt(g.target_amount - g.current_amount)}</p>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* 목표 없는 저축: 현재 잔액만 */
                      <div className="bg-blue-50 rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="text-[11px] text-blue-400">현재 잔액</span>
                        <span className="text-sm font-bold text-blue-deep">{fmt(g.current_amount)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 할부 섹션 ── */}
      {activeTab === '할부' && (
        <div>
          {activeInsts.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
              <p className="text-sm text-gray-400">진행 중인 할부가 없습니다</p>
              <p className="text-xs text-gray-300 mt-1">거래 입력 시 할부 옵션을 사용해보세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeInsts.map((inst) => {
                const pct = (inst.paid_months / inst.total_months) * 100
                return (
                  <div key={inst.installment_id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-bold text-text-primary">{inst.detail}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {inst.member} · {dayjs(inst.purchase_date).format('YYYY.MM.DD')} 구매
                        </p>
                      </div>
                      <button
                        onClick={() => setConfirmInst(inst.installment_id)}
                        className="p-1.5 text-gray-300 active:text-expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-bg-app rounded-xl py-2">
                        <p className="text-[10px] text-gray-400">총금액</p>
                        <p className="text-xs font-bold text-text-primary">{fmt(inst.total_amount)}</p>
                      </div>
                      <div className="bg-orange-50 rounded-xl py-2">
                        <p className="text-[10px] text-orange-400">월 납입</p>
                        <p className="text-xs font-bold text-orange-500">{fmt(inst.monthly_amount)}</p>
                      </div>
                      <div className="bg-bg-app rounded-xl py-2">
                        <p className="text-[10px] text-gray-400">잔여</p>
                        <p className="text-xs font-bold text-expense">{fmt(inst.remaining_amount)}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                      <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>{inst.paid_months}회 납입 완료</span>
                      <span>잔여 {inst.remaining_months}회 ({Math.round(100 - pct)}%)</span>
                    </div>
                  </div>
                )
              })}
              <div className="bg-orange-50 rounded-2xl p-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">이달 총 할부</span>
                  <span className="font-bold text-orange-500">{fmt(thisMonthInstall)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">총 잔여</span>
                  <span className="font-bold text-expense">{fmt(totalInstallRemain)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 대출 섹션 ── */}
      {activeTab === '대출' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-text-primary">대출 목록</h2>
            <button
              onClick={() => setLoanSheet(true)}
              className="flex items-center gap-1 text-xs text-blue-main font-medium"
            >
              <Plus size={14} />추가
            </button>
          </div>
          {activeLoans.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
              <p className="text-sm text-gray-400">등록된 대출이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeLoans.map((loan) => {
                const id = loan.loan_id ?? loan.id
                const balance = loan.balance ?? loan.principal
                const isExpanded = expandedLoan === id
                const repaidPct = loan.principal > 0
                  ? Math.min(100, ((loan.principal - balance) / loan.principal) * 100) : 0
                return (
                  <div key={id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <button
                      className="w-full p-4 flex items-center justify-between text-left"
                      onClick={() => setExpandedLoan(isExpanded ? null : id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-primary">{loan.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            loan.repayment_type === '이자전용'
                              ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'
                          }`}>
                            {loan.repayment_type ?? '원금+이자'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{loan.member}</p>
                      </div>
                      <div className="text-right mr-2">
                        <p className="text-sm font-bold text-expense">{fmt(balance)}</p>
                        {loan.repayment_type === '이자전용' && loan.interest_rate > 0 && (
                          <p className="text-[10px] text-gray-400">
                            월이자 ≈ {fmt(Math.round(balance * (loan.interest_rate / 100) / 12))}
                          </p>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-300 shrink-0" /> : <ChevronDown size={16} className="text-gray-300 shrink-0" />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-50">
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                          <div><p className="text-gray-400">원금</p><p className="font-semibold">{fmt(loan.principal)}</p></div>
                          <div><p className="text-gray-400">잔액</p><p className="font-semibold text-expense">{fmt(balance)}</p></div>
                          {loan.interest_rate > 0 && <div><p className="text-gray-400">금리</p><p className="font-semibold">{loan.interest_rate}%</p></div>}
                          {loan.monthly_payment > 0 && <div><p className="text-gray-400">월 납입</p><p className="font-semibold">{fmt(loan.monthly_payment)}</p></div>}
                          {loan.end_date && <div><p className="text-gray-400">만기</p><p className="font-semibold">{dayjs(loan.end_date).format('YYYY.MM')}</p></div>}
                        </div>
                        {loan.repayment_type !== '이자전용' && repaidPct > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                              <span>상환 진행률</span><span>{Math.round(repaidPct)}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-income rounded-full" style={{ width: `${repaidPct}%` }} />
                            </div>
                          </div>
                        )}
                        {loan.memo && <p className="text-[10px] text-gray-400 mt-2">{loan.memo}</p>}
                        <button
                          onClick={() => deactivateLoanMut.mutate(id)}
                          className="mt-3 text-[11px] text-gray-400 active:text-expense"
                        >
                          상환 완료 처리
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 저축 목표 추가 시트 ── */}
      <BottomSheet isOpen={savingSheet} onClose={() => setSavingSheet(false)} title="저축 목표 추가">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-sub mb-1 block">적금명</label>
            <input
              type="text"
              placeholder="예: 강아지 적금, 결혼적금, 비상금"
              value={savingForm.name}
              onChange={(e) => setSavingForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
          </div>

          {/* 목표 있음/없음 */}
          <div>
            <label className="text-xs text-text-sub mb-1.5 block">목표 설정</label>
            <div className="flex gap-2">
              {[{ v: false, label: '목표 없음 (자유 저축)' }, { v: true, label: '목표 금액/날짜 있음' }].map(({ v, label }) => (
                <button
                  key={String(v)}
                  onClick={() => setHasTarget(v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    hasTarget === v ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 목표 금액/날짜 (목표 있을 때만) */}
          {hasTarget && (
            <>
              <div>
                <label className="text-xs text-text-sub mb-1 block">목표 금액 (원)</label>
                <input
                  type="number" inputMode="numeric"
                  placeholder="16000000"
                  value={savingForm.target_amount}
                  onChange={(e) => setSavingForm((f) => ({ ...f, target_amount: e.target.value }))}
                  className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="text-xs text-text-sub mb-1 block">목표 날짜 (선택)</label>
                <input
                  type="month"
                  value={savingForm.target_date.slice(0, 7)}
                  onChange={(e) => setSavingForm((f) => ({ ...f, target_date: e.target.value + '-01' }))}
                  className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-text-sub mb-1 block">월 자동 납입액 (원, 선택)</label>
            <input
              type="number" inputMode="numeric"
              placeholder="매달 1일 자동 차감 금액 (없으면 공란)"
              value={savingForm.monthly_amount}
              onChange={(e) => setSavingForm((f) => ({ ...f, monthly_amount: e.target.value }))}
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
            {savingForm.monthly_amount && (
              <p className="text-[11px] text-blue-main mt-1">
                매달 1일 {Number(savingForm.monthly_amount).toLocaleString('ko-KR')}원 자동 납입
              </p>
            )}
          </div>

          <Button fullWidth onClick={handleAddSaving} disabled={!savingForm.name || addSaving.isPending}>
            {addSaving.isPending ? '추가 중...' : '저축 목표 추가'}
          </Button>
        </div>
      </BottomSheet>

      {/* ── 입금 시트 ── */}
      <BottomSheet
        isOpen={!!depositSheet}
        onClose={() => setDepositSheet(null)}
        title={`입금 - ${activeGoals.find((g) => g.id === depositSheet)?.name ?? ''}`}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-sub mb-1 block">날짜</label>
            <input type="date" value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary" />
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">납입자</label>
            <div className="flex gap-2">
              {MEMBERS.map((m) => (
                <button key={m}
                  className={`flex-1 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    depositMember === m ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'
                  }`}
                  onClick={() => setDepositMember(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">입금 금액 (원)</label>
            <input type="number" inputMode="numeric" placeholder="500000"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary" />
          </div>
          <Button fullWidth onClick={handleDeposit} disabled={updateSaving.isPending || saveTx.isPending}>
            {updateSaving.isPending || saveTx.isPending ? '처리 중...' : '입금 반영'}
          </Button>
        </div>
      </BottomSheet>

      {/* ── 대출 추가 시트 ── */}
      <BottomSheet isOpen={loanSheet} onClose={() => setLoanSheet(false)} title="대출 추가">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-sub mb-1 block">대출명</label>
            <input type="text" placeholder="예: BNK경남은행"
              value={loanForm.name}
              onChange={(e) => setLoanForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary" />
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">대출자</label>
            <div className="flex gap-2">
              {MEMBERS.map((m) => (
                <button key={m}
                  className={`flex-1 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    loanForm.member === m ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'
                  }`}
                  onClick={() => setLoanForm((f) => ({ ...f, member: m }))}
                >{m}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">상환 유형</label>
            <div className="flex gap-2">
              {REPAYMENT_TYPES.map((t) => (
                <button key={t}
                  className={`flex-1 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    loanForm.repayment_type === t ? 'bg-blue-main text-white' : 'bg-bg-app text-text-sub'
                  }`}
                  onClick={() => setLoanForm((f) => ({ ...f, repayment_type: t }))}
                >{t}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-sub mb-1 block">대출 원금 (원)</label>
              <input type="number" inputMode="numeric" placeholder="10000000"
                value={loanForm.principal}
                onChange={(e) => setLoanForm((f) => ({ ...f, principal: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary" />
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">현재 잔액 (원)</label>
              <input type="number" inputMode="numeric" placeholder="원금과 같으면 공란"
                value={loanForm.balance}
                onChange={(e) => setLoanForm((f) => ({ ...f, balance: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-sub mb-1 block">금리 (%)</label>
              <input type="number" inputMode="decimal" step="0.1" placeholder="3.5"
                value={loanForm.interest_rate}
                onChange={(e) => setLoanForm((f) => ({ ...f, interest_rate: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary" />
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">월 납입액 (원)</label>
              <input type="number" inputMode="numeric" placeholder="63940"
                value={loanForm.monthly_payment}
                onChange={(e) => setLoanForm((f) => ({ ...f, monthly_payment: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-sub mb-1 block">시작일</label>
              <input type="date" value={loanForm.start_date}
                onChange={(e) => setLoanForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary" />
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">만기일</label>
              <input type="date" value={loanForm.end_date}
                onChange={(e) => setLoanForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">메모</label>
            <input type="text" value={loanForm.memo}
              onChange={(e) => setLoanForm((f) => ({ ...f, memo: e.target.value }))}
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary" />
          </div>
          <Button fullWidth onClick={handleAddLoan} disabled={addLoan.isPending}>
            {addLoan.isPending ? '추가 중...' : '대출 추가'}
          </Button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        isOpen={!!confirmInst}
        message="할부를 완납 처리하시겠습니까?"
        confirmLabel="완납 처리"
        onConfirm={() => { if (confirmInst) deactivateInst.mutate(confirmInst); setConfirmInst(null) }}
        onCancel={() => setConfirmInst(null)}
      />
      <ConfirmDialog
        isOpen={!!confirmSaving}
        message="저축 목표를 삭제하시겠습니까?"
        onConfirm={() => { if (confirmSaving) deactivateSaving.mutate(confirmSaving); setConfirmSaving(null) }}
        onCancel={() => setConfirmSaving(null)}
      />
    </div>
  )
}
