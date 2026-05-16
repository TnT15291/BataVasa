import { View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useMemo, useState, useCallback } from 'react'
import {
  useFinanceBootstrap,
  useCategories,
  useTransactions,
  useFinanceActions,
} from '../hooks/useFinance'
import { TransactionRow } from '../components/TransactionRow'
import { AmountText } from '../components/AmountText'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'

export function TransactionListScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const txs = useTransactions()
  const cats = useCategories()
  const { remove, refresh } = useFinanceActions()
  const [refreshing, setRefreshing] = useState(false)

  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of txs) {
      if (t.amount_cents > 0) income += t.amount_cents
      else expense += t.amount_cents
    }
    return { income, expense, net: income + expense }
  }, [txs])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  return (
    <View style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      <View style={[styles.summary, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.text.muted }]}>Income</Text>
          <AmountText cents={totals.income} showSign={false} style={{ color: theme.finance.income }} />
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.text.muted }]}>Expense</Text>
          <AmountText cents={Math.abs(totals.expense)} showSign={false} style={{ color: theme.finance.expense }} />
        </View>
        <View style={[styles.summaryRow, styles.netRow, { borderColor: theme.border.subtle }]}>
          <Text style={[styles.summaryLabel, { color: theme.text.primary, fontWeight: '600' }]}>Net</Text>
          <AmountText cents={totals.net} />
        </View>
      </View>

      <FlashList
        data={txs}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TransactionRow
            tx={item}
            category={catById.get(item.category_id)}
            onLongPress={() => remove(item.id)}
          />
        )}
        contentContainerStyle={{ padding: spacing[4] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>No transactions yet</Text>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>
              Tap the + button to log your first transaction.
            </Text>
          </View>
        }
      />

      <Pressable
        onPress={() => router.push('/new')}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summary: {
    margin: spacing[4],
    marginBottom: 0,
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[2], marginTop: spacing[1] },
  summaryLabel: { fontSize: 13 },
  empty: { alignItems: 'center', marginTop: spacing[12] },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[8] },
  fab: {
    position: 'absolute',
    right: spacing[6],
    bottom: spacing[8],
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
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '600', lineHeight: 30 },
})
