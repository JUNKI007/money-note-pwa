import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { gasPost } from '@/api/client'
import { useAppStore } from '@/store/appStore'

/**
 * 로그인 직후 모든 탭 데이터를 백그라운드에서 미리 가져옴.
 * 탭 이동 시 캐시 히트 → 로딩 없이 즉시 표시.
 */
export function Prefetcher() {
  const qc = useQueryClient()
  const selectedMonth = useAppStore((s) => s.selectedMonth)

  useEffect(() => {
    const ym = selectedMonth
    const prevYm = dayjs(ym).subtract(1, 'month').format('YYYY-MM')

    // 모든 요청을 병렬로 prefetch (에러 무시)
    const prefetch = (queryKey: unknown[], fn: () => Promise<unknown>) =>
      qc.prefetchQuery({ queryKey, queryFn: fn, staleTime: 60_000 }).catch(() => {})

    prefetch(['dashboard', ym], () => gasPost('getDashboard', { yearMonth: ym }))
    prefetch(['dashboard', prevYm], () => gasPost('getDashboard', { yearMonth: prevYm }))
    prefetch(['transactions', { yearMonth: ym }], () => gasPost('getTransactions', { yearMonth: ym }))
    prefetch(['calendar', ym], () => gasPost('getCalendarEvents', { yearMonth: ym }))
    prefetch(['loans'], () => gasPost('getLoans'))
    prefetch(['savings'], () => gasPost('getSavingGoals'))
    prefetch(['budgets'], () => gasPost('getBudgets'))
    prefetch(['recurrings'], () => gasPost('getRecurrings'))
    prefetch(['monthlyTrend', 6], () => gasPost('getMonthlyTrend', { months: 6 }))
  }, []) // 마운트 1회만 실행

  return null
}
