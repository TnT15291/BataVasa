import { Text, type TextStyle } from 'react-native'
import { formatAmount } from '../services'
import { useTheme } from '@design/useTheme'
import { useSettingsStore } from '@store/settingsStore'

type Props = {
  cents: number
  currency?: string
  showSign?: boolean
  /** Explicit color override — takes priority over the sign-derived income/expense color. */
  color?: string
  style?: TextStyle
}

export function AmountText({ cents, currency, showSign = true, color, style }: Props) {
  const theme = useTheme()
  const storeCurrency = useSettingsStore((s) => s.currency)
  const language = useSettingsStore((s) => s.language)
  const c = currency ?? storeCurrency
  const isExpense = cents < 0
  const signColor = showSign
    ? isExpense ? theme.finance.expense : theme.finance.income
    : theme.text.primary
  // color prop always wins; style can still override font size / weight / etc
  const resolvedColor = color ?? signColor
  const prefix = showSign ? (isExpense ? '-' : '+') : ''
  return (
    <Text style={[{ fontVariant: ['tabular-nums'], fontWeight: '600' }, style, { color: resolvedColor }]}>
      {prefix}
      {formatAmount(cents, c, language)}
    </Text>
  )
}
