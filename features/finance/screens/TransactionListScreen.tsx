import { View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useMemo, useState, useCallback } from 'react'
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns'
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
import { useTranslation } from '@services/i18n'

type Period = 'today' | 'week' | 'month' | 'all'

export function TransactionListScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const txs = useTransactions()
  const cats = useCategories()
  const { remove, refresh } = useFinanceActions()
  const [refreshing, setRefreshing] = useState(false)
  const [activePeriod, setActivePeriod] = useState<Period>('today')

  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats])

  const ranges = useMemo(() => {
    const now = new Date()
    return {
      today: { from: startOfDay(now), to: endOfDay(now) },
      week: { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) },
      month: { from: startOfMonth(now), to: endOfMonth(now) },
    }
  }, [])

  const totals = useMemo(() => {
    const acc = {
      today: { income: 0, expense: 0 },
      week: { income: 0, expense: 0 },
      month: { income: 0, expense: 0 },
      all: { income: 0, expense: 0 },
    }
    for (const tx of txs) {
      const d = new Date(tx.occurred_at)
      const isIncome = tx.amount_cents > 0
      const abs = Math.abs(tx.amount_cents)
      const key = isIncome ? 'income' : 'expense'

      if (d >= ranges.month.from && d <= ranges.month.to) {
        acc.month[key] += abs
        if (d >= ranges.week.from && d <= ranges.week.to) {
          acc.week[key] += abs
          if (d >= ranges.today.from && d <= ranges.today.to) {
            acc.today[key] += abs
          }
        }
      }
      acc.all[key] += abs
    }
    return acc
  }, [txs, ranges])

  const filteredTxs = useMemo(() => {
    if (activePeriod === 'all') return txs
    const r = ranges[activePeriod]
    return txs.filter((tx) => {
      const d = new Date(tx.occurred_at)
      return d >= r.from && d <= r.to
    })
  }, [txs, ranges, activePeriod])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const PERIOD_ROWS: { key: Period; label: string }[] = [
    { key: 'today', label: t.today },
    { key: 'week', label: t.this_week },
    { key: 'month', label: t.this_month },
    { key: 'all', label: t.all_period },
  ]

  return (
    <View style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      <View style={[styles.summary, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        {PERIOD_ROWS.map((row, idx) => {
          const active = activePeriod === row.key
          const data = totals[row.key]
          const isLast = idx === PERIOD_ROWS.length - 1
          return (
            <Pressable
              key={row.key}
              onPress={() => setActivePeriod(row.key)}
              style={({ pressed }) => [
                styles.periodRow,
                !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border.subtle },
                active && { backgroundColor: theme.bg.secondary },
                pressed && !active && { backgroundColor: theme.bg.secondary },
              ]}
            >
              <View style={styles.periodLabelWrap}>
                <View
                  style={[
                    styles.periodDot,
                    { backgroundColor: active ? theme.brand.primary : 'transparent' },
                  ]}
                />
                <Text
                  style={{
                    color: active ? theme.text.primary : theme.text.secondary,
                    fontWeight: active ? '600' : '500',
                    fontSize: 14,
                  }}
                >
                  {row.label}
                </Text>
              </View>
              <View style={styles.periodAmounts}>
                <AmountText
                  cents={data.income}
                  showSign={false}
                  style={{ color: theme.finance.income, fontSize: 13 }}
                />
                <Text style={{ color: theme.text.muted, fontSize: 12 }}>·</Text>
                <AmountText
                  cents={data.expense}
                  showSign={false}
                  style={{ color: theme.finance.expense, fontSize: 13 }}
                />
              </View>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.aiRow}>
        {[
          { label: '🧠', title: t.ai_insights, route: '/insights' },
          { label: '📊', title: t.nav_reports, route: '/reports' },
          { label: '💬', title: t.ai_chat, route: '/chat' },
        ].map((item) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as any)}
            style={({ pressed }) => [
              styles.aiBtn,
              {
                backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
                borderColor: theme.border.subtle,
              },
            ]}
          >
            <Text style={styles.aiBtnIcon}>{item.label}</Text>
            <Text style={[styles.aiBtnLabel, { color: theme.text.secondary }]}>{item.title}</Text>
          </Pressable>
        ))}
      </View>

      <FlashList
        data={filteredTxs}
        keyExtractor={(tx) => tx.id}
        renderItem={({ item }) => (
          <TransactionRow
            tx={item}
            category={catById.get(item.category_id)}
            onPress={() => router.push({ pathname: '/new', params: { id: item.id } } as any)}
            onLongPress={() => remove(item.id)}
          />
        )}
        contentContainerStyle={{ padding: spacing[4] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_transactions}</Text>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.tap_to_add}</Text>
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
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  periodLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  periodDot: { width: 8, height: 8, borderRadius: radius.full },
  periodAmounts: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  aiRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
  },
  aiBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[1],
  },
  aiBtnIcon: { fontSize: 18 },
  aiBtnLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
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
