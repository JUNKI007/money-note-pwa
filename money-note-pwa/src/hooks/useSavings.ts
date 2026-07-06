import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface SavingGoal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  target_date: string
  is_active: boolean
}

export function useSavingGoals() {
  return useQuery({
    queryKey: ['savings'],
    queryFn: () => gasPost<SavingGoal[]>('getSavingGoals'),
    staleTime: 0,
  })
}

export function useAddSavingGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      gasPost<SavingGoal>('addSavingGoal', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savings'] }),
  })
}

export function useUpdateSavingGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      gasPost<SavingGoal>('updateSavingGoal', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savings'] }),
  })
}

export function useDeactivateSavingGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => gasPost('deactivateSavingGoal', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savings'] }),
  })
}
