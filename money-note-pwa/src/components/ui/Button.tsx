import { motion } from 'framer-motion'

interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'ghost' | 'danger'
  onClick?: () => void
  disabled?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit'
  className?: string
}

const variants = {
  primary: 'bg-blue-main text-white active:bg-blue-deep',
  ghost: 'bg-transparent text-blue-main border border-blue-main',
  danger: 'bg-expense text-white active:bg-red-700',
}

export function Button({
  children,
  variant = 'primary',
  onClick,
  disabled,
  fullWidth,
  type = 'button',
  className = '',
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      className={`px-4 py-3 rounded-xl font-semibold text-sm transition-colors
        ${variants[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
        ${className}`}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.97 }}
    >
      {children}
    </motion.button>
  )
}
