import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface LifeBudgetConfig {
  categories: string[]
  limit: number
}

export function useLifeBudget() {
  return useQuery({
    queryKey: ['lifeBudget'],
    queryFn: async () => {
      const res = await gasPost<string>('getAppConfig', { key: 'lifeBudget' })
      if (!res) return null
      try { return JSON.parse(res) as LifeBudgetConfig } catch { return null }
    },
    staleTime: 300_000,
    gcTime: 600_000,
  })
}

export function useSetLifeBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: LifeBudgetConfig) =>
      gasPost('setAppConfig', { key: 'lifeBudget', value: JSON.stringify(config) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lifeBudget'] }),
  })
}
