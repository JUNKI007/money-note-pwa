import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { AppShell } from '@/components/layout/AppShell'
import { AuthScreen } from '@/screens/AuthScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { InputScreen } from '@/screens/InputScreen'
import { HistoryScreen } from '@/screens/HistoryScreen'
import { CalendarScreen } from '@/screens/CalendarScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const activeTab = useAppStore((s) => s.activeTab)

  if (!isAuthenticated) return <AuthScreen />

  return (
    <AppShell>
      {activeTab === '홈' && <HomeScreen />}
      {activeTab === '입력' && <InputScreen />}
      {activeTab === '내역' && <HistoryScreen />}
      {activeTab === '캘린더' && <CalendarScreen />}
      {activeTab === '설정' && <SettingsScreen />}
    </AppShell>
  )
}
