import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  unlock: () => void
  lock: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      unlock: () => set({ isAuthenticated: true }),
      lock: () => set({ isAuthenticated: false }),
    }),
    { name: 'auth', partialize: () => ({}) },
  ),
)
