import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: () => gasPost<Record<string, number>>('getBudgets'),
    staleTime: 300_000,
    gcTime: 600_000,
  })
}

export function useSetBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ category, amount }: { category: string; amount: number }) =>
      gasPost<Record<string, number>>('setBudget', { category, amount }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}
