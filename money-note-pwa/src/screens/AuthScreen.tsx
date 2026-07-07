import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gasPost } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { Delete } from 'lucide-react'

export function AuthScreen() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const unlock = useAuthStore((s) => s.unlock)

  const handleKey = async (key: string) => {
    if (loading) return
    if (key === 'del') {
      setPin((p) => p.slice(0, -1))
      setError(false)
      return
    }
    const next = pin + key
    setPin(next)
    setError(false)
    if (next.length >= 4) {
      setPin('')
      setLoading(true)
      try {
        const result = await gasPost<boolean>('verifyPin', { pin: next })
        if (result) {
          unlock()
        } else {
          setError(true)
          setPin('')
        }
      } catch {
        setError(true)
        setPin('')
      } finally {
        setLoading(false)
      }
    }
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del']

  return (
    <div className="min-h-screen bg-bg-app flex flex-col items-center justify-center px-8 safe-top">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="text-4xl mb-3">💰</div>
        <h1 className="text-2xl font-bold text-text-primary">우리집 머니노트</h1>
        <p className="text-text-sub text-sm mt-1">PIN을 입력해 주세요</p>
      </motion.div>

      <div className="flex gap-4 mb-10">
        {[0,1,2,3,4,5].slice(0, Math.max(4, pin.length)).map((i) => (
          <motion.div
            key={i}
            className={`w-3 h-3 rounded-full ${i < pin.length ? 'bg-blue-deep' : 'bg-gray-200'}`}
            animate={{ scale: i === pin.length - 1 ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.15 }}
          />
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-expense text-sm mb-4"
          >
            PIN이 일치하지 않습니다
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {keys.map((k, i) => (
          k === '' ? (
            <div key={i} />
          ) : (
            <motion.button
              key={k}
              className={`h-16 rounded-2xl text-xl font-semibold flex items-center justify-center
                ${k === 'del' ? 'bg-transparent text-text-sub' : 'bg-card text-text-primary shadow-sm'}`}
              onClick={() => handleKey(k)}
              whileTap={{ scale: 0.9 }}
            >
              {k === 'del' ? <Delete size={22} /> : k}
            </motion.button>
          )
        ))}
      </div>
    </div>
  )
}
