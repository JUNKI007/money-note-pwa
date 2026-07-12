import { AnimatePresence, motion } from 'framer-motion'
import { X, Utensils, Coffee, ShoppingBag, Car, HeartPulse, Film, BookOpen, Zap, Tv, Plane, Shirt, Scissors, ShoppingCart, Smartphone, Home, Wine, Palette, Gift, MoreHorizontal, Banknote, TrendingUp, CircleDollarSign, RefreshCw, PiggyBank, CreditCard, Bus, Dumbbell, Baby, PawPrint, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface CategoryDef {
  label: string
  icon: LucideIcon
  color: string
}

export const MINUS_CATEGORIES: CategoryDef[] = [
  { label: '식비',      icon: Utensils,         color: '#F97316' },
  { label: '카페',      icon: Coffee,            color: '#A16207' },
  { label: '쇼핑',      icon: ShoppingBag,       color: '#EC4899' },
  { label: '교통',      icon: Car,               color: '#6366F1' },
  { label: '의료·건강', icon: HeartPulse,         color: '#EF4444' },
  { label: '문화·여가', icon: Film,              color: '#8B5CF6' },
  { label: '교육',      icon: BookOpen,          color: '#0EA5E9' },
  { label: '공과금',    icon: Zap,               color: '#EAB308' },
  { label: 'OTT·구독',  icon: Tv,               color: '#14B8A6' },
  { label: '여행',      icon: Plane,             color: '#3B82F6' },
  { label: '패션',      icon: Shirt,             color: '#F43F5E' },
  { label: '미용',      icon: Scissors,          color: '#A855F7' },
  { label: '생필품',    icon: ShoppingCart,      color: '#22C55E' },
  { label: '통신',      icon: Smartphone,        color: '#06B6D4' },
  { label: '주거비',    icon: Home,              color: '#64748B' },
  { label: '외식·술',   icon: Wine,              color: '#DC2626' },
  { label: '취미',      icon: Palette,           color: '#7C3AED' },
  { label: '선물',      icon: Gift,              color: '#DB2777' },
  { label: '운동',      icon: Dumbbell,          color: '#16A34A' },
  { label: '육아',      icon: Baby,              color: '#F59E0B' },
  { label: '반려동물',  icon: PawPrint,          color: '#78716C' },
  { label: '수리·유지', icon: Wrench,            color: '#475569' },
  { label: '버스·지하철', icon: Bus,             color: '#4F46E5' },
  { label: '기타소비',  icon: MoreHorizontal,    color: '#94A3B8' },
]

export const PLUS_CATEGORIES: CategoryDef[] = [
  { label: '월급',      icon: Banknote,          color: '#16A34A' },
  { label: '보너스',    icon: TrendingUp,        color: '#0EA5E9' },
  { label: '부수입',    icon: CircleDollarSign,  color: '#F59E0B' },
  { label: '환급',      icon: RefreshCw,         color: '#14B8A6' },
  { label: '적금해지',  icon: PiggyBank,         color: '#8B5CF6' },
  { label: '용돈받음',  icon: CreditCard,        color: '#EC4899' },
  { label: '기타수입',  icon: MoreHorizontal,    color: '#94A3B8' },
]

// 텍스트 레이블 배열 (기존 코드 호환용)
export const MINUS_CATEGORY_LABELS = MINUS_CATEGORIES.map((c) => c.label)
export const PLUS_CATEGORY_LABELS = PLUS_CATEGORIES.map((c) => c.label)

interface CategoryPickerProps {
  isOpen: boolean
  onClose: () => void
  categories: CategoryDef[]
  selected: string
  onSelect: (label: string) => void
  title?: string
}

export function CategoryPicker({ isOpen, onClose, categories, selected, onSelect, title = '카테고리' }: CategoryPickerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[80vh] flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <h2 className="text-base font-bold text-text-primary">{title}</h2>
              <button onClick={onClose} className="p-1 text-text-sub">
                <X size={20} />
              </button>
            </div>

            {/* 그리드 */}
            <div className="overflow-y-auto px-4 pb-8 no-scrollbar">
              <div className="grid grid-cols-4 gap-3 py-2">
                {categories.map(({ label, icon: Icon, color }) => {
                  const isSelected = selected === label
                  return (
                    <button
                      key={label}
                      onClick={() => { onSelect(label); onClose() }}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all
                        ${isSelected ? 'ring-2 ring-offset-1' : 'active:scale-95'}`}
                      style={isSelected ? { outline: `2px solid ${color}`, backgroundColor: color + '18' } : {}}
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: color + '20' }}
                      >
                        <Icon size={22} style={{ color }} strokeWidth={1.8} />
                      </div>
                      <span
                        className="text-[10px] font-medium leading-tight text-center"
                        style={{ color: isSelected ? color : '#64748B' }}
                      >
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
