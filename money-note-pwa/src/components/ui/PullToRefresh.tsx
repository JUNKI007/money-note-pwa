import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const THRESHOLD = 72

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0 && !refreshing) setPullY(Math.min(delta * 0.4, THRESHOLD))
  }

  const handleTouchEnd = async () => {
    if (pullY >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      setPullY(THRESHOLD)
      await onRefresh()
      setRefreshing(false)
    }
    setPullY(0)
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative overflow-hidden"
    >
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center items-center bg-bg-app"
        style={{ height: pullY }}
      >
        <motion.div animate={{ rotate: refreshing ? 360 : pullY * 3 }} transition={{ repeat: refreshing ? Infinity : 0, duration: 0.8, ease: 'linear' }}>
          <RefreshCw size={20} className="text-blue-main" />
        </motion.div>
      </motion.div>
      <motion.div style={{ y: pullY }}>{children}</motion.div>
    </div>
  )
}
