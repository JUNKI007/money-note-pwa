import { useAppStore } from '@/store/appStore'
import { TabNavigator } from './TabNavigator'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { activeTab, setActiveTab } = useAppStore()
  return (
    <div className="min-h-screen bg-bg-app">
      <main className="pb-20">{children}</main>
      <TabNavigator activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}
