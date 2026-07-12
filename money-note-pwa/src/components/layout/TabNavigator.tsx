import { motion } from 'framer-motion'
import { Home, PlusCircle, List, PiggyBank, Wallet, Settings } from 'lucide-react'

type Tab = '홈' | '입력' | '내역' | '저축' | '용돈' | '설정'

interface TabNavigatorProps {
  activeTab: Tab
  onChange: (tab: Tab) => void
}

const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: '홈', icon: Home, label: '홈' },
  { id: '입력', icon: PlusCircle, label: '입력' },
  { id: '내역', icon: List, label: '내역' },
  { id: '저축', icon: PiggyBank, label: '저축' },
  { id: '용돈', icon: Wallet, label: '용돈' },
  { id: '설정', icon: Settings, label: '설정' },
]

export function TabNavigator({ activeTab, onChange }: TabNavigatorProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-gray-100 safe-bottom z-30">
      <div className="flex">
        {tabs.map(({ id, icon: Icon, label }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              className="flex-1 flex flex-col items-center py-2 gap-0.5"
              onClick={() => onChange(id)}
            >
              <motion.div animate={{ scale: active ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                <Icon
                  size={22}
                  className={active ? 'text-blue-deep' : 'text-text-sub'}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </motion.div>
              <span className={`text-[10px] font-medium ${active ? 'text-blue-deep' : 'text-text-sub'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
