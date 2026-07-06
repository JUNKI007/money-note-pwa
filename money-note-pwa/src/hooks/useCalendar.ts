import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface CalendarEvent {
  id: string
  date: string
  title: string
  description: string
  color: string
  linked_amount: number | null
  linked_transaction_id: string
}

export function useCalendarEvents(yearMonth: string) {
  return useQuery({
    queryKey: ['calendar', yearMonth],
    queryFn: () => gasPost<CalendarEvent[]>('getCalendarEvents', { yearMonth }),
    staleTime: 0,
  })
}

export function useAddCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      gasPost<CalendarEvent>('addCalendarEvent', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      gasPost<CalendarEvent>('updateCalendarEvent', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => gasPost('deleteCalendarEvent', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}
