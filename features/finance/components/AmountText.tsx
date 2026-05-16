import { Text, type TextStyle } from 'react-native'
import { formatAmount } from '../services'
import { useTheme } from '@design/useTheme'

type Props = {
  cents: number
  currency?: string
  showSign?: boolean
  style?: TextStyle
}

export function AmountText({ cents, currency = 'VND', showSign = true, style }: Props) {
  const theme = useTheme()
  const isExpense = cents < 0
  const color = showSign
    ? isExpense
      ? theme.finance.expense
      : theme.finance.income
    : theme.text.primary
  const prefix = showSign ? (isExpense ? '-' : '+') : ''
  return (
    <Text style={[{ color, fontVariant: ['tabular-nums'], fontWeight: '600' }, style]}>
      {prefix}
      {formatAmount(cents, currency)}
    </Text>
  )
}
