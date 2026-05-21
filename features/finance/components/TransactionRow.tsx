import { Pressable, Text, View, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { Transaction, Category } from '../types'
import { AmountText } from './AmountText'
import { translateCategoryName } from '../i18n'
import { useTranslation } from '@services/i18n'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'

type Props = {
  tx: Transaction
  category: Category | undefined
  onPress?: () => void
  onLongPress?: () => void
}

export function TransactionRow({ tx, category, onPress, onLongPress }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const displayName = category ? translateCategoryName(category, t) : '?'
  const sign = tx.amount_cents < 0 ? '-' : '+'
  const absAmount = Math.abs(tx.amount_cents)
  const a11yLabel = [
    displayName,
    tx.merchant ?? tx.note,
    `${sign}${absAmount} ${tx.currency}`,
  ].filter(Boolean).join(', ')
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={t.edit_transaction}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: (category?.color ?? theme.brand.primary) + '20' }]}>
        <Text style={[styles.icon, { color: category?.color ?? theme.brand.primary }]}>
          {displayName.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.middle}>
        <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
          {displayName}
        </Text>
        {tx.merchant || tx.note ? (
          <Text style={[styles.sub, { color: theme.text.muted }]} numberOfLines={1}>
            {tx.merchant ?? tx.note}
          </Text>
        ) : null}
      </View>
      <AmountText cents={tx.amount_cents} currency={tx.currency} />
      <Feather name="chevron-right" size={18} color={theme.text.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing[2],
    gap: spacing[3],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontWeight: '700', fontSize: 16 },
  middle: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
})
