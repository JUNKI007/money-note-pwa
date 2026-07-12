import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface Installment {
  installment_id: string
  purchase_date: string
  member: string
  detail: string
  category: string
  total_amount: number
  monthly_amount: number
  total_months: number
  paid_months: number
  remaining_months: number
  remaining_amount: number
  memo: string
  is_active: boolean
}

export function useInstallments() {
  return useQuery({
    queryKey: ['installments'],
    queryFn: () => gasPost<Installment[]>('getInstallments'),
    staleTime: 60_000,
    gcTime: 300_000,
  })
}

export function useAddInstallment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      gasPost<Installment>('addInstallment', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useApplyInstallments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (yearMonth: string) =>
      gasPost('applyInstallments', { yearMonth }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeactivateInstallment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => gasPost('deactivateInstallment', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['installments'] }),
  })
}
