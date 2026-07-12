import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface AllowanceEntry {
  id: string
  date: string
  member: string
  type: '입금' | '지출'
  amount: number
  detail: string
  memo: string
  created_at: string
}

export function useAllowanceEntries(member?: string) {
  return useQuery({
    queryKey: ['allowance', member],
    queryFn: () => gasPost<AllowanceEntry[]>('getAllowanceEntries', member ? { member } : {}),
    staleTime: 60_000,
  })
}

export function useAddAllowanceEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      date: string
      member: string
      type: '입금' | '지출'
      amount: number
      detail?: string
      memo?: string
    }) => gasPost<AllowanceEntry>('addAllowanceEntry', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allowance'] })
    },
  })
}

export function useDeleteAllowanceEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => gasPost('deleteAllowanceEntry', { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allowance'] })
    },
  })
}
