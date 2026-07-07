import { useQuery } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface DashboardData {
  yearMonth: string
  income: number
  expense: number
  netSaving: number
  balance: number
  weeklyExpenses: { week: string; amount: number }[]
  topCategories: { category: string; amount: number }[]
  recentTransactions: Transaction[]
}

export interface Transaction {
  id: string
  date: string
  member: string
  flow_type: string
  category: string
  detail: string
  amount: number
  memo: string
  transaction_type: string
}

export function useDashboard(yearMonth: string) {
  return useQuery({
    queryKey: ['dashboard', yearMonth],
    queryFn: () => gasPost<DashboardData>('getDashboard', { yearMonth }),
    staleTime: 0,
    gcTime: 0,
  })
}
