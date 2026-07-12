import { AnimatePresence, motion } from 'framer-motion'

interface ConfirmDialogProps {
  isOpen: boolean
  message?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  message = '삭제하시겠습니까?',
  confirmLabel = '삭제',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            className="fixed inset-x-8 top-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 p-5 shadow-xl"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
          >
            <p className="text-sm font-medium text-text-primary text-center mb-4">{message}</p>
            <div className="flex gap-2">
              <button
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-text-sub active:bg-gray-200 transition-colors"
                onClick={onCancel}
              >
                취소
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-expense text-white active:opacity-80 transition-opacity"
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
