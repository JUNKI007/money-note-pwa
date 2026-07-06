import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface Loan {
  id: string
  name: string
  bank: string
  principal: number
  current_balance: number
  interest_rate: number
  start_date: string
  end_date: string
  monthly_payment: number
  is_active: boolean
}

export function useLoans() {
  return useQuery({
    queryKey: ['loans'],
    queryFn: () => gasPost<Loan[]>('getLoans'),
    staleTime: 0,
  })
}

export function useAddLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => gasPost<Loan>('addLoan', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loans'] }),
  })
}

export function useUpdateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => gasPost<Loan>('updateLoan', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loans'] }),
  })
}

export function useDeactivateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => gasPost('deactivateLoan', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loans'] }),
  })
}
