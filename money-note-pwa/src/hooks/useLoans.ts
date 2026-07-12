import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface Loan {
  loan_id: string
  id: string
  name: string
  member: string
  principal: number
  balance: number
  interest_rate: number
  start_date: string
  end_date: string
  repayment_type: '이자전용' | '원금+이자' // 이자전용: 이자만 납부, 원금+이자: 원금도 함께 상환
  monthly_payment: number
  is_active: boolean
  memo: string
}

export function useLoans() {
  return useQuery({
    queryKey: ['loans'],
    queryFn: () => gasPost<Loan[]>('getLoans'),
    staleTime: 60_000,
    gcTime: 300_000,
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
