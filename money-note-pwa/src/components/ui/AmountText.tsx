interface AmountTextProps {
  amount: number
  type?: 'income' | 'expense' | 'neutral'
  className?: string
  showSign?: boolean
}

const colorMap = {
  income: 'text-income',
  expense: 'text-expense',
  neutral: 'text-text-primary',
}

export function AmountText({ amount, type = 'neutral', className = '', showSign }: AmountTextProps) {
  const sign = showSign ? (type === 'income' ? '+' : type === 'expense' ? '-' : '') : ''
  return (
    <span className={`font-semibold tabular-nums ${colorMap[type]} ${className}`}>
      {sign}{amount.toLocaleString('ko-KR')}원
    </span>
  )
}
