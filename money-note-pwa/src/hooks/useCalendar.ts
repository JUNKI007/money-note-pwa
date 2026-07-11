import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gasPost } from '@/api/client'

export interface CalendarEvent {
  event_id: string
  start_date: string
  end_date: string
  title: string
  memo: string
  color: string
  linked_amount: number | null
}

export function useCalendarEvents(yearMonth: string) {
  return useQuery({
    queryKey: ['calendar', yearMonth],
    queryFn: () => gasPost<CalendarEvent[]>('getCalendarEvents', { yearMonth }),
    staleTime: 0,
    gcTime: 0,
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
    mutationFn: (eventId: string) => gasPost('deleteCalendarEvent', { id: eventId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}
