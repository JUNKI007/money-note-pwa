import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { AppShell } from '@/components/layout/AppShell'
import { Prefetcher } from '@/components/Prefetcher'
import { AuthScreen } from '@/screens/AuthScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { InputScreen } from '@/screens/InputScreen'
import { HistoryScreen } from '@/screens/HistoryScreen'
import { SavingsScreen } from '@/screens/SavingsScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const activeTab = useAppStore((s) => s.activeTab)

  if (!isAuthenticated) return <AuthScreen />

  return (
    <AppShell>
      <Prefetcher />
      {/* 탭 컴포넌트를 unmount하지 않고 CSS로 숨김 → 첫 방문 후 탭 전환 즉시 반응 */}
      <div className={activeTab === '홈' ? '' : 'hidden'}><HomeScreen /></div>
      <div className={activeTab === '입력' ? '' : 'hidden'}><InputScreen /></div>
      <div className={activeTab === '내역' ? '' : 'hidden'}><HistoryScreen /></div>
      <div className={activeTab === '저축' ? '' : 'hidden'}><SavingsScreen /></div>
      <div className={activeTab === '설정' ? '' : 'hidden'}><SettingsScreen /></div>
    </AppShell>
  )
}
