import { View, Text, Pressable, StyleSheet, Alert } from 'react-native'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { FlashList } from '@shopify/flash-list'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useFinanceBootstrap, useDebts, useDebtActions } from '../hooks/useFinance'
import { AmountText } from '../components/AmountText'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { summarizeDebts, formatAmount } from '../services'
import { FAB } from '@components/FAB'
import { ScreenTransition } from '@components/ScreenTransition'
import { toast } from '@store/toastStore'
import type { Debt, DebtDirection } from '../types'

type Filter = 'all' | DebtDirection

export function DebtListScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const debts = useDebts()
  const { settleDebt, deleteDebt, restoreDebt } = useDebtActions()
  const [filter, setFilter] = useState<Filter>('all')
  const currency = useSettingsStore((s) => s.currency)
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)

  const summary = useMemo(() => summarizeDebts(debts, currency), [debts, currency])

  const filtered = useMemo(
    () => (filter === 'all' ? debts : debts.filter((d) => d.direction === filter)),
    [debts, filter]
  )

  const confirmSettle = (debt: Debt) => {
    Alert.alert(
      t.debt_settle_confirm_title,
      t.debt_settle_confirm_msg
        .replace('{{name}}', debt.counterparty)
        .replace('{{amount}}', formatAmount(debt.amount_cents, debt.currency, language)),
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.debt_mark_paid,
          onPress: () => {
            void (async () => {
              const settleNote = (debt.direction === 'lent' ? t.debt_settle_tx_note_lent : t.debt_settle_tx_note_borrowed)
                .replace('{{name}}', debt.counterparty)
              const r = await settleDebt(debt.id, { settleNote })
              if (!r.ok) {
                toast.error(t.could_not_save, r.error)
                return
              }
              toast.success(t.debt_settled_toast)
            })()
          },
        },
      ]
    )
  }

  const confirmDelete = (debt: Debt) => {
    Alert.alert(t.debt_book, `${debt.counterparty} · ${formatAmount(debt.amount_cents, debt.currency, language)}\n\n${t.debt_delete_msg}`, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await deleteDebt(debt.id)
            if (!r.ok) {
              toast.error(t.could_not_save, r.error)
              return
            }
            toast.undo(t.toast_deleted, t.undo, () => { void restoreDebt(debt.id) })
          })()
        },
      },
    ])
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t.all_period },
    { key: 'lent', label: t.debt_lent },
    { key: 'borrowed', label: t.debt_borrowed },
  ]

  const now = new Date()

  return (
    <ScreenTransition style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={[styles.summaryCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.text.muted }]}>{t.debt_outstanding_lent}</Text>
                <AmountText cents={summary.lentOutstanding} currency={currency} showSign={false} color={theme.finance.expense} style={styles.metricValue} />
              </View>
              <View style={[styles.metricDivider, { backgroundColor: theme.border.subtle }]} />
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.text.muted }]}>{t.debt_outstanding_borrowed}</Text>
                <AmountText cents={summary.borrowedOutstanding} currency={currency} showSign={false} color={theme.finance.income} style={styles.metricValue} />
              </View>
            </View>

            <View style={[styles.segmented, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              {FILTERS.map((row) => {
                const active = filter === row.key
                return (
                  <Pressable
                    key={row.key}
                    onPress={() => setFilter(row.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[styles.segment, { backgroundColor: active ? theme.brand.primary : 'transparent' }]}
                  >
                    <Text style={[styles.segmentText, { color: active ? '#fff' : theme.text.secondary }]}>
                      {row.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const settled = item.status === 'settled'
          const overdue = !settled && !!item.due_at && new Date(item.due_at) < now
          const meta = settled
            ? `${t.debt_settled}${item.settled_at ? ` · ${format(new Date(item.settled_at), 'dd MMM yyyy', { locale })}` : ''}`
            : item.due_at
              ? `${overdue ? `${t.debt_overdue} · ` : ''}${t.debt_due_date}: ${format(new Date(item.due_at), 'dd MMM yyyy', { locale })}`
              : t.debt_no_due_date
          return (
            <ReanimatedSwipeable
              renderRightActions={(_progress, _drag, swipeable) => (
                <Pressable
                  onPress={() => {
                    swipeable.close()
                    confirmDelete(item)
                  }}
                  style={[styles.swipeDelete, { backgroundColor: theme.semantic.danger }]}
                >
                  <Feather name="trash-2" size={20} color="#fff" />
                </Pressable>
              )}
              overshootRight={false}
            >
              <Pressable
                onPress={() => router.push({ pathname: '/debt' as any, params: { id: item.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${item.counterparty} · ${meta} · ${formatAmount(item.amount_cents, item.currency, language)} · ${item.direction === 'lent' ? t.debt_lent : t.debt_borrowed}`}
                style={[styles.row, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle, opacity: settled ? 0.6 : 1 }]}
              >
                <View style={[styles.rowIcon, { backgroundColor: (item.direction === 'lent' ? theme.finance.expense : theme.finance.income) + '1F' }]}>
                  <Feather
                    name={settled ? 'check-circle' : item.direction === 'lent' ? 'user-minus' : 'user-plus'}
                    size={16}
                    color={settled ? theme.semantic.success : item.direction === 'lent' ? theme.finance.expense : theme.finance.income}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: theme.text.primary }]} numberOfLines={1}>
                    {item.counterparty}
                  </Text>
                  <Text style={[styles.rowMeta, { color: overdue ? theme.semantic.danger : theme.text.muted }]} numberOfLines={1}>
                    {meta}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <AmountText
                    cents={item.amount_cents}
                    currency={item.currency}
                    showSign={false}
                    color={item.direction === 'lent' ? theme.finance.expense : theme.finance.income}
                    style={styles.rowAmount}
                  />
                  <Text style={[styles.rowMeta, { color: theme.text.muted }]}>
                    {item.direction === 'lent' ? t.debt_lent : t.debt_borrowed}
                  </Text>
                </View>
                {!settled ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation()
                      confirmSettle(item)
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t.debt_mark_paid}
                    hitSlop={6}
                    style={[styles.settleBtn, { borderColor: theme.border.strong }]}
                  >
                    <Feather name="check" size={15} color={theme.semantic.success} />
                  </Pressable>
                ) : null}
              </Pressable>
            </ReanimatedSwipeable>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.brand.primary + '1F' }]}>
              <Feather name="users" size={34} color={theme.brand.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.debt_empty}</Text>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.debt_empty_hint}</Text>
          </View>
        }
      />

      <FAB
        onPress={() => router.push('/debt' as any)}
        accessibilityLabel={t.debt_new}
        style={[styles.fab, { backgroundColor: theme.brand.primary, bottom: spacing[5] }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </FAB>
    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: spacing[4], paddingBottom: 112 },
  headerContent: { gap: spacing[3], marginBottom: spacing[3] },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
  },
  metric: { flex: 1, gap: spacing[1] },
  metricDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  metricLabel: { fontSize: 12, fontWeight: '500' },
  metricValue: { fontSize: 16, fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, alignItems: 'center', borderRadius: radius.sm, paddingVertical: spacing[2] },
  segmentText: { fontSize: 13, fontWeight: '700' },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowAmount: { fontSize: 14, fontWeight: '700' },
  settleBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDelete: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
  empty: { alignItems: 'center', marginTop: spacing[12], gap: spacing[2] },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[8] },
  fab: {
    position: 'absolute',
    right: spacing[6],
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
})
