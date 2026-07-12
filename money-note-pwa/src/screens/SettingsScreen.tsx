import { useState } from 'react'
import { Plus, LogOut, Check } from 'lucide-react'
import { useLifeBudget, useSetLifeBudget } from '@/hooks/useLifeBudget'
import { MINUS_CATEGORY_LABELS } from '@/components/ui/CategoryPicker'
import { useAuthStore } from '@/store/authStore'
import { gasPost } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'

export function SettingsScreen() {
  const lock = useAuthStore((s) => s.lock)
  const { data: lifeBudget } = useLifeBudget()
  const setLifeBudget = useSetLifeBudget()

  const [lifeBudgetSheet, setLifeBudgetSheet] = useState(false)
  const [lifeBudgetForm, setLifeBudgetForm] = useState<{ categories: string[]; limit: string }>({ categories: [], limit: '' })
  const [syncing, setSyncing] = useState(false)
  const [gasUrl, setGasUrl] = useState(
    localStorage.getItem('GAS_URL_OVERRIDE') || (import.meta.env.VITE_GAS_URL as string) || ''
  )

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

  const handleSetLifeBudget = async () => {
    if (lifeBudgetForm.categories.length === 0 || !lifeBudgetForm.limit) return
    await setLifeBudget.mutateAsync({ categories: lifeBudgetForm.categories, limit: Number(lifeBudgetForm.limit) })
    setLifeBudgetSheet(false)
  }

  const openLifeBudgetSheet = () => {
    setLifeBudgetForm({
      categories: lifeBudget?.categories ?? [],
      limit: lifeBudget?.limit ? String(lifeBudget.limit) : '',
    })
    setLifeBudgetSheet(true)
  }

  const toggleCategory = (cat: string) => {
    setLifeBudgetForm((f) => ({
      ...f,
      categories: f.categories.includes(cat) ? f.categories.filter((c) => c !== cat) : [...f.categories, cat],
    }))
  }

  return (
    <div className="px-4 pt-4 pb-4 space-y-3">
      <h1 className="text-xl font-bold text-text-primary">설정</h1>

      {/* 생활비 예산 */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-text-primary">생활비 예산</p>
          <button onClick={openLifeBudgetSheet} className="p-1 text-blue-main">
            <Plus size={18} />
          </button>
        </div>
        {!lifeBudget || lifeBudget.categories.length === 0 ? (
          <p className="text-xs text-text-sub text-center py-2">생활비 예산이 설정되지 않았습니다</p>
        ) : (
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {lifeBudget.categories.map((c) => (
                <span key={c} className="text-[11px] bg-blue-50 text-blue-main px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
            <p className="text-sm font-bold text-text-primary">월 한도: {lifeBudget.limit.toLocaleString('ko-KR')}원</p>
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

      {/* 생활비 예산 sheet */}
      <BottomSheet isOpen={lifeBudgetSheet} onClose={() => setLifeBudgetSheet(false)} title="생활비 예산 설정">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-sub mb-2 block">생활비에 포함할 카테고리 (복수 선택)</label>
            <div className="flex flex-wrap gap-1.5">
              {MINUS_CATEGORY_LABELS.map((c) => {
                const selected = lifeBudgetForm.categories.includes(c)
                return (
                  <button
                    key={c}
                    onClick={() => toggleCategory(c)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                      ${selected ? 'bg-blue-deep text-white' : 'bg-bg-app text-text-sub'}`}
                  >
                    {selected && <Check size={10} />}
                    {c}
                  </button>
                )
              })}
            </div>
            {lifeBudgetForm.categories.length > 0 && (
              <p className="text-[11px] text-blue-main mt-2">{lifeBudgetForm.categories.length}개 선택됨</p>
            )}
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">월 한도 금액 (원)</label>
            <input
              type="number"
              inputMode="numeric"
              value={lifeBudgetForm.limit}
              onChange={(e) => setLifeBudgetForm((f) => ({ ...f, limit: e.target.value }))}
              placeholder="600000"
              className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
            />
            {lifeBudgetForm.limit && !isNaN(Number(lifeBudgetForm.limit)) && (
              <p className="text-xs text-text-sub mt-1">{Number(lifeBudgetForm.limit).toLocaleString('ko-KR')}원</p>
            )}
          </div>
          <Button
            fullWidth
            onClick={handleSetLifeBudget}
            disabled={lifeBudgetForm.categories.length === 0 || !lifeBudgetForm.limit || setLifeBudget.isPending}
          >
            {setLifeBudget.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
