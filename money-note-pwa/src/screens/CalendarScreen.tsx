import { useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import {
  useCalendarEvents,
  useAddCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  type CalendarEvent,
} from '@/hooks/useCalendar'
import { useAppStore } from '@/store/appStore'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { PullToRefresh } from '@/components/ui/PullToRefresh'

dayjs.locale('ko')

const EVENT_COLORS = ['#6F8FAF', '#2F9E73', '#D64545', '#F59E0B', '#8B5CF6', '#EC4899']

export function CalendarScreen() {
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const { data: events, isLoading, refetch } = useCalendarEvents(selectedMonth)
  const addEvent = useAddCalendarEvent()
  const updateEvent = useUpdateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState({ title: '', memo: '', color: EVENT_COLORS[0], linked_amount: '' })

  const firstDay = dayjs(selectedMonth + '-01')
  const daysInMonth = firstDay.daysInMonth()
  const startDow = firstDay.day()
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsOnDate = (d: number) => {
    const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`
    return (events ?? []).filter((e) => e.start_date === dateStr)
  }

  const openAdd = (d: number) => {
    const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`
    setSelectedDate(dateStr)
    setEditEvent(null)
    setForm({ title: '', memo: '', color: EVENT_COLORS[0], linked_amount: '' })
    setSheetOpen(true)
  }

  const openEdit = (ev: CalendarEvent) => {
    setEditEvent(ev)
    setSelectedDate(ev.start_date)
    setForm({
      title: ev.title,
      memo: ev.memo,
      color: ev.color,
      linked_amount: ev.linked_amount != null ? String(ev.linked_amount) : '',
    })
    setSheetOpen(true)
  }

  const handleSave = async () => {
    if (!form.title || !selectedDate) return
    const payload = {
      start_date: selectedDate,
      title: form.title,
      memo: form.memo,
      color: form.color,
      linked_amount: form.linked_amount ? Number(form.linked_amount) : null,
      created_by: '가족',
    }
    if (editEvent) {
      await updateEvent.mutateAsync({ ...payload, id: editEvent.id })
    } else {
      await addEvent.mutateAsync(payload)
    }
    setSheetOpen(false)
  }

  const handleDelete = async (id: string) => {
    await deleteEvent.mutateAsync(id)
    setSheetOpen(false)
  }

  return (
    <PullToRefresh onRefresh={() => refetch().then(() => {})}>
      <div className="px-4 pt-6 pb-4">
        {/* Month nav */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={() => setSelectedMonth(dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM'))} className="p-1 text-text-sub">
            <ChevronLeft size={20} />
          </button>
          <span className="text-base font-bold text-text-primary">{dayjs(selectedMonth).format('YYYY년 M월')}</span>
          <button
            onClick={() => {
              const next = dayjs(selectedMonth).add(1, 'month').format('YYYY-MM')
              if (next <= dayjs().add(2, 'month').format('YYYY-MM')) setSelectedMonth(next)
            }}
            className="p-1 text-text-sub"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['일','월','화','수','목','금','토'].map((d) => (
            <div key={d} className="text-center text-xs text-text-sub py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-2xl overflow-hidden">
          {cells.map((d, i) => {
            const dayEvents = d ? eventsOnDate(d) : []
            return (
              <div
                key={i}
                className={`bg-card min-h-[52px] p-1 ${d ? 'cursor-pointer active:bg-bg-app' : ''}`}
                onClick={() => d && openAdd(d)}
              >
                {d && (
                  <>
                    <p className={`text-xs font-medium mb-0.5 ${
                      i % 7 === 0 ? 'text-expense' : i % 7 === 6 ? 'text-blue-main' : 'text-text-primary'
                    }`}>{d}</p>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className="text-[9px] font-medium px-1 rounded truncate text-white"
                          style={{ backgroundColor: ev.color }}
                          onClick={(e) => { e.stopPropagation(); openEdit(ev) }}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-[9px] text-text-sub pl-1">+{dayEvents.length - 2}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {isLoading && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-blue-main border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Add/Edit Sheet */}
        <BottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={editEvent ? '일정 수정' : '일정 추가'}
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-sub mb-1 block">날짜</label>
              <p className="text-sm font-medium text-text-primary">{selectedDate}</p>
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">제목</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                placeholder="일정 제목"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">설명 (선택)</label>
              <input
                type="text"
                value={form.memo}
                onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                placeholder="설명"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">연결 금액 (선택)</label>
              <input
                type="number"
                inputMode="numeric"
                value={form.linked_amount}
                onChange={(e) => setForm((f) => ({ ...f, linked_amount: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">색상</label>
              <div className="flex gap-2">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${form.color === c ? 'border-text-primary scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              {editEvent && (
                <Button variant="danger" onClick={() => handleDelete(editEvent.id)}>
                  <Trash2 size={16} />
                </Button>
              )}
              <Button
                fullWidth
                onClick={handleSave}
                disabled={!form.title || addEvent.isPending || updateEvent.isPending}
              >
                {addEvent.isPending || updateEvent.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </BottomSheet>
      </div>
    </PullToRefresh>
  )
}
