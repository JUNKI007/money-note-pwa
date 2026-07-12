import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface FixedExpense {
  fixed_id: string
  name: string
  flow_type: string
  category: string
  member: string
  amount: number
  memo: string
  start_yearMonth: string
  is_active: boolean
}

export function useFixedExpenses() {
  return useQuery({
    queryKey: ['fixedExpenses'],
    queryFn: () => gasPost<FixedExpense[]>('getFixedExpenses'),
    staleTime: 300_000,
    gcTime: 600_000,
  })
}

export function useAddFixedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      gasPost<FixedExpense>('addFixedExpense', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixedExpenses'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateFixedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      gasPost<FixedExpense>('updateFixedExpense', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixedExpenses'] }),
  })
}

export function useDeleteFixedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      gasPost('deleteFixedExpense', { id, name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixedExpenses'] }),
  })
}

export function useApplyFixedExpenses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (yearMonth: string) =>
      gasPost<{ applied: number }>('applyFixedExpenses', { yearMonth }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
