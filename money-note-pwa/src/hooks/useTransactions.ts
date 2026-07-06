import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'
import type { Transaction } from './useDashboard'

export interface TransactionFilter {
  yearMonth?: string
  member?: string
  flow_type?: string
  category?: string
}

export function useTransactions(filter: TransactionFilter = {}) {
  return useQuery({
    queryKey: ['transactions', filter],
    queryFn: () => gasPost<Transaction[]>('getTransactions', filter as Record<string, unknown>),
    staleTime: 0,
  })
}

export function useSaveTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      gasPost<Transaction>('saveTransaction', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => gasPost('deleteTransaction', { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
