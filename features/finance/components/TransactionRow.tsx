import { Pressable, Text, View, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { Transaction, Category } from '../types'
import { AmountText } from './AmountText'
import { translateCategoryName } from '../i18n'
import { useTranslation } from '@services/i18n'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
import { IconBadge } from '@components/ui'

type Props = {
  tx: Transaction
  category: Category | undefined
  onPress?: () => void
}

export function TransactionRow({ tx, category, onPress }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const rawCategoryName = category ? translateCategoryName(category, t) : '?'
  const categoryMismatch = !!category && (
    (tx.amount_cents < 0 && category.kind === 'income') ||
    (tx.amount_cents > 0 && category.kind !== 'income')
  )
  const displayName = categoryMismatch
      ? tx.amount_cents < 0 ? t.expense : t.income
      : rawCategoryName
  const isExpense = tx.amount_cents < 0
  const iconName = category && category.icon in Feather.glyphMap
    ? category.icon as keyof typeof Feather.glyphMap
    : isExpense ? 'arrow-up-right' : 'arrow-down-left'
  const directionColor = isExpense ? theme.finance.expense : theme.finance.income
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
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={t.edit_transaction}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
      ]}
    >
      <IconBadge color={category?.color ?? MODULE_COLORS.finance} size="lg" style={styles.iconWrap}>
        <Feather name={iconName} size={17} color="#fff" />
        <View style={[styles.directionBadge, { backgroundColor: directionColor, borderColor: theme.bg.elevated }]}>
          <Feather name={isExpense ? 'arrow-up-right' : 'arrow-down-left'} size={8} color="#fff" />
        </View>
      </IconBadge>
      <View style={styles.middle}>
        <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={2}>
          {displayName}
        </Text>
        {categoryMismatch ? (
          <Text style={[styles.sub, { color: theme.text.muted }]} numberOfLines={1}>
            {rawCategoryName} · {tx.merchant ?? tx.note ?? t.review_queue}
          </Text>
        ) : tx.merchant || tx.note ? (
          <Text style={[styles.sub, { color: theme.text.muted }]} numberOfLines={1}>
            {tx.merchant ?? tx.note}
          </Text>
        ) : null}
        {tx.needs_review || categoryMismatch ? (
          <View style={[styles.reviewPill, { backgroundColor: theme.semantic.warning + '22' }]}>
            <Feather name="alert-circle" size={11} color={theme.semantic.warning} />
            <Text style={[styles.reviewText, { color: theme.semantic.warning }]}>{t.review_queue}</Text>
          </View>
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
    borderWidth: 1,
    marginBottom: spacing[2],
    gap: spacing[3],
  },
  iconWrap: {
    position: 'relative',
  },
  directionBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  reviewPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2, marginTop: 4 },
  reviewText: { fontSize: 12, fontWeight: '700' },
})
