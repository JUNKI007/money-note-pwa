import { create } from 'zustand'
import dayjs from 'dayjs'

type Tab = '홈' | '입력' | '내역' | '저축' | '설정'

interface AppState {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  selectedMonth: string
  setSelectedMonth: (month: string) => void
}

export const useAppStore = create<AppState>()((set) => ({
  activeTab: '홈',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedMonth: dayjs().format('YYYY-MM'),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
}))
