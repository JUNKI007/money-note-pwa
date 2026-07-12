import { useQuery } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface DashboardData {
  yearMonth: string
  income: number
  expense: number
  assetMove: number
  netSaving: number
  thisWeekExpense: number
  lastWeekExpense: number
  weeklyDiff: number
  totalLoanBalance: number
  totalSaved: number
  categoryExpense: Record<string, number>
}

export interface Transaction {
  transaction_id: string
  id: string // transaction_id alias (하위 호환)
  date: string
  member: string
  flow_type: string
  category: string
  detail: string
  amount: number
  memo: string
  transaction_type: string
}

export interface MonthlyTrend {
  yearMonth: string
  income: number
  expense: number
  assetMove: number
}

export function useMonthlyTrend(months = 6) {
  return useQuery({
    queryKey: ['monthlyTrend', months],
    queryFn: () => gasPost<MonthlyTrend[]>('getMonthlyTrend', { months }),
    staleTime: 300_000,
    gcTime: 600_000,
  })
}

export function useDashboard(yearMonth: string) {
  return useQuery({
    queryKey: ['dashboard', yearMonth],
    queryFn: () => gasPost<DashboardData>('getDashboard', { yearMonth }),
    staleTime: 60_000,
    gcTime: 300_000,
  })
}
