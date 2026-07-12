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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PullToRefresh } from '@/components/ui/PullToRefresh'

dayjs.locale('ko')

const EVENT_COLORS = ['#6F8FAF', '#2F9E73', '#D64545', '#F59E0B', '#8B5CF6', '#EC4899']
const DOW = ['일', '월', '화', '수', '목', '금', '토']

const isMultiDay = (ev: CalendarEvent) => !!ev.end_date && ev.end_date > ev.start_date

// Greedy lane assignment so multi-day events don't visually overlap in same week
function assignLanes(events: CalendarEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => {
    if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date)
    return (b.end_date || b.start_date).localeCompare(a.end_date || a.start_date)
  })
  const map = new Map<string, number>()
  const laneEnd: string[] = []
  sorted.forEach((ev) => {
    let lane = 0
    while (laneEnd[lane] !== undefined && laneEnd[lane] >= ev.start_date) lane++
    map.set(ev.event_id, lane)
    laneEnd[lane] = ev.end_date || ev.start_date
  })
  return map
}

interface WeekRowProps {
  week: (number | null)[]
  yearMonth: string
  events: CalendarEvent[]
  today: string
  onDayClick: (d: number) => void
  onEventClick: (ev: CalendarEvent) => void
}

function WeekRow({ week, yearMonth, events, today, onDayClick, onEventClick }: WeekRowProps) {
  const cellDates = week.map((d) => (d ? `${yearMonth}-${String(d).padStart(2, '0')}` : null))
  const validDates = cellDates.filter(Boolean) as string[]
  if (!validDates.length) return null

  const weekStart = validDates[0]
  const weekEnd = validDates[validDates.length - 1]

  const multiEvents = events.filter(
    (ev) => isMultiDay(ev) && ev.start_date <= weekEnd && ev.end_date >= weekStart,
  )
  const laneMap = assignLanes(multiEvents)
  const numLanes = multiEvents.length > 0 ? Math.max(...Array.from(laneMap.values())) + 1 : 0

  const singleForDate = (dateStr: string | null) =>
    dateStr ? events.filter((ev) => !isMultiDay(ev) && ev.start_date === dateStr) : []

  return (
    <div className="border-b border-gray-50 last:border-b-0">
      {/* Day numbers */}
      <div className="grid grid-cols-7">
        {week.map((d, i) => {
          const dateStr = cellDates[i]
          const isToday = dateStr === today
          return (
            <div
              key={i}
              className={`py-1.5 flex justify-center ${d ? 'cursor-pointer' : ''}`}
              onClick={() => d && onDayClick(d)}
            >
              {d && (
                <div
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? 'bg-blue-main text-white'
                      : i === 0
                        ? 'text-expense'
                        : i === 6
                          ? 'text-blue-main'
                          : 'text-text-primary'
                  }`}
                >
                  {d}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Multi-day event bars */}
      {numLanes > 0 && (
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: `repeat(${numLanes}, 18px)`,
            rowGap: '2px',
          }}
        >
          {multiEvents.map((ev) => {
            const evClipStart = ev.start_date < weekStart ? weekStart : ev.start_date
            const evClipEnd = ev.end_date > weekEnd ? weekEnd : ev.end_date
            const startDayNum = parseInt(evClipStart.slice(-2))
            const endDayNum = parseInt(evClipEnd.slice(-2))
            const colStart = week.findIndex((d) => d === startDayNum) + 1
            const colEnd = week.findIndex((d) => d === endDayNum) + 1
            if (colStart < 1) return null
            const span = Math.max(1, colEnd - colStart + 1)
            const lane = laneMap.get(ev.event_id)!
            const roundedLeft = ev.start_date >= weekStart
            const roundedRight = ev.end_date <= weekEnd

            return (
              <div
                key={ev.event_id}
                className={`flex items-center text-white text-[10px] font-medium overflow-hidden cursor-pointer
                  ${roundedLeft ? 'rounded-l-full pl-1.5' : 'ml-0'}
                  ${roundedRight ? 'rounded-r-full' : 'mr-0'}
                `}
                style={{
                  backgroundColor: ev.color,
                  gridColumn: `${colStart} / span ${span}`,
                  gridRow: lane + 1,
                  marginLeft: roundedLeft ? '2px' : '0',
                  marginRight: roundedRight ? '2px' : '0',
                }}
                onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
              >
                {roundedLeft && <span className="truncate leading-none">{ev.title}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Single-day events + tap area */}
      <div className="grid grid-cols-7 pb-1.5">
        {week.map((d, i) => {
          const dateStr = cellDates[i]
          const singles = singleForDate(dateStr)
          return (
            <div
              key={i}
              className={`min-h-[18px] px-0.5 ${d ? 'cursor-pointer' : ''}`}
              onClick={() => d && onDayClick(d)}
            >
              {singles.slice(0, 2).map((ev) => (
                <div
                  key={ev.event_id}
                  className="text-[9px] font-medium px-1 py-px rounded-full text-white truncate mb-0.5 mx-px"
                  style={{ backgroundColor: ev.color }}
                  onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                >
                  {ev.title}
                </div>
              ))}
              {singles.length > 2 && (
                <p className="text-[9px] text-text-sub text-center">+{singles.length - 2}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CalendarScreen() {
  const { selectedMonth, setSelectedMonth } = useAppStore()
  const { data: events, isLoading, refetch } = useCalendarEvents(selectedMonth)
  const addEvent = useAddCalendarEvent()
  const updateEvent = useUpdateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    memo: '',
    color: EVENT_COLORS[0],
    end_date: '',
    linked_amount: '',
  })

  const today = dayjs().format('YYYY-MM-DD')
  const firstDay = dayjs(selectedMonth + '-01')
  const daysInMonth = firstDay.daysInMonth()
  const startDow = firstDay.day()
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const openAdd = (d: number) => {
    const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`
    setSelectedDate(dateStr)
    setEditEvent(null)
    setForm({ title: '', memo: '', color: EVENT_COLORS[0], end_date: '', linked_amount: '' })
    setSheetOpen(true)
  }

  const openEdit = (ev: CalendarEvent) => {
    setEditEvent(ev)
    setSelectedDate(ev.start_date)
    setForm({
      title: ev.title,
      memo: ev.memo,
      color: ev.color,
      end_date: isMultiDay(ev) ? ev.end_date : '',
      linked_amount: ev.linked_amount != null ? String(ev.linked_amount) : '',
    })
    setSheetOpen(true)
  }

  const handleSave = async () => {
    if (!form.title || !selectedDate) return
    const endDate = form.end_date && form.end_date >= selectedDate ? form.end_date : selectedDate
    const payload = {
      start_date: selectedDate,
      end_date: endDate,
      title: form.title,
      memo: form.memo,
      color: form.color,
      linked_amount: form.linked_amount ? Number(form.linked_amount) : null,
      created_by: '가족',
    }
    if (editEvent) {
      await updateEvent.mutateAsync({ ...payload, event_id: editEvent.event_id })
    } else {
      await addEvent.mutateAsync(payload)
    }
    setSheetOpen(false)
  }

  const handleDelete = async (event_id: string) => {
    await deleteEvent.mutateAsync(event_id)
    setSheetOpen(false)
  }

  return (
    <PullToRefresh onRefresh={() => refetch().then(() => {})}>
      <div className="px-4 pt-4 pb-4">
        {/* Month nav */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => setSelectedMonth(dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM'))}
            className="p-1 text-text-sub"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-base font-bold text-text-primary">
            {dayjs(selectedMonth).format('YYYY년 M월')}
          </span>
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

        {/* Calendar grid */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DOW.map((d, i) => (
              <div
                key={d}
                className={`text-center text-xs py-2 font-semibold ${
                  i === 0 ? 'text-expense' : i === 6 ? 'text-blue-main' : 'text-text-sub'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-blue-main border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            weeks.map((week, wi) => (
              <WeekRow
                key={wi}
                week={week}
                yearMonth={selectedMonth}
                events={events ?? []}
                today={today}
                onDayClick={openAdd}
                onEventClick={openEdit}
              />
            ))
          )}
        </div>

        {/* Add/Edit Sheet */}
        <BottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={editEvent ? '일정 수정' : '일정 추가'}
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-sub mb-1 block">시작 날짜</label>
              <p className="text-sm font-semibold text-text-primary">{selectedDate}</p>
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">종료 날짜 (여러 날 일정인 경우)</label>
              <input
                type="date"
                value={form.end_date}
                min={selectedDate ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
              />
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
              <label className="text-xs text-text-sub mb-1 block">메모 (선택)</label>
              <input
                type="text"
                value={form.memo}
                onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                className="w-full bg-bg-app rounded-xl px-3 py-2.5 text-sm text-text-primary"
                placeholder="메모"
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
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      form.color === c ? 'border-gray-700 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              {editEvent && (
                <Button variant="danger" onClick={() => setConfirmDeleteEventId(editEvent.event_id)}>
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

      <ConfirmDialog
        isOpen={!!confirmDeleteEventId}
        message="일정을 삭제하시겠습니까?"
        onConfirm={() => {
          if (confirmDeleteEventId) handleDelete(confirmDeleteEventId)
          setConfirmDeleteEventId(null)
        }}
        onCancel={() => setConfirmDeleteEventId(null)}
      />
    </PullToRefresh>
  )
}
