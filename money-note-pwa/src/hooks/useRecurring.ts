import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface RecurringTransaction {
  recurring_id: string
  flow_type: string
  category: string
  member: string
  detail: string
  amount: number
  memo: string
  day_of_month: number
  is_active: boolean
}

export function useRecurrings() {
  return useQuery({
    queryKey: ['recurrings'],
    queryFn: () => gasPost<RecurringTransaction[]>('getRecurrings'),
    staleTime: 300_000,
    gcTime: 600_000,
  })
}

export function useAddRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      gasPost<RecurringTransaction>('addRecurring', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurrings'] }),
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => gasPost('deleteRecurring', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurrings'] }),
  })
}

export function useApplyRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (yearMonth: string) => gasPost<{ applied: number }>('applyRecurring', { yearMonth }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
