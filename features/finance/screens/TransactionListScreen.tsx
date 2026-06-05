import { View, Text, Pressable, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { FlashList } from '@shopify/flash-list'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo, useState, useCallback, useEffect } from 'react'
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  format,
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
import { useSettingsStore } from '@store/settingsStore'
import { getRates, convertMinorAmount, summarizeInCurrency } from '@services/fx'
import { formatAmount } from '@features/finance/services'
import { translateCategoryName } from '../i18n'
import { getDateFnsLocale } from '@services/locale'
import type { Transaction } from '../types'
import { SkeletonTransactionList } from '@components/SkeletonBox'
import { FAB } from '@components/FAB'

type Period = 'today' | 'week' | 'month' | 'all'
type CurrencyTotals = { income: number; expense: number }
type PeriodTotals = Map<string, CurrencyTotals>
type ActivityItem =
  | { type: 'header'; id: string; label: string; income: number; expense: number; currency: string }
  | { type: 'tx'; id: string; tx: Transaction }
type RecurringCandidate = {
  key: string
  title: string
  categoryName: string
  amount: number
  currency: string
  count: number
  lastDate: Date
  nextDate: Date
}

function emptyTotals(): PeriodTotals {
  return new Map()
}

function addToTotals(totals: PeriodTotals, currency: string, signedCents: number) {
  const entry = totals.get(currency) ?? { income: 0, expense: 0 }
  if (signedCents > 0) entry.income += signedCents
  else entry.expense += Math.abs(signedCents)
  totals.set(currency, entry)
}

export function TransactionListScreen() {
  const isLoading = useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const txs = useTransactions()
  const cats = useCategories()
  const { remove, refresh, loadMore, hasMore, loadingMore } = useFinanceActions()
  const [refreshing, setRefreshing] = useState(false)
  const [activePeriod, setActivePeriod] = useState<Period>('month')
  const [reviewOnly, setReviewOnly] = useState(false)
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const currency = useSettingsStore((s) => s.currency)
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)

  const [fxRates, setFxRates] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    getRates(displayCurrency).then(setFxRates)
  }, [displayCurrency])

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
    const acc: Record<Period, PeriodTotals> = {
      today: emptyTotals(),
      week: emptyTotals(),
      month: emptyTotals(),
      all: emptyTotals(),
    }
    for (const tx of txs) {
      const d = new Date(tx.occurred_at)
      const cur = tx.currency
      if (d >= ranges.month.from && d <= ranges.month.to) {
        addToTotals(acc.month, cur, tx.amount_cents)
        if (d >= ranges.week.from && d <= ranges.week.to) {
          addToTotals(acc.week, cur, tx.amount_cents)
          if (d >= ranges.today.from && d <= ranges.today.to) {
            addToTotals(acc.today, cur, tx.amount_cents)
          }
        }
      }
      addToTotals(acc.all, cur, tx.amount_cents)
    }
    return acc
  }, [txs, ranges])

  const displayTotals = useMemo<Record<Period, { income: number; expense: number; mixed: boolean } | null>>(() => {
    const periods: Period[] = ['today', 'week', 'month', 'all']
    const result: Record<string, { income: number; expense: number; mixed: boolean } | null> = {}
    for (const p of periods) {
      const data = totals[p]
      if (data.size === 0) { result[p] = null; continue }
      const currencies = Array.from(data.keys())
      const alreadySingle = currencies.length === 1 && currencies[0] === displayCurrency
      if (alreadySingle) { result[p] = null; continue }
      if (!fxRates) { result[p] = null; continue }
      let totalIncome = 0
      let totalExpense = 0
      let canConvert = true
      for (const [cur, td] of data.entries()) {
        const inc = convertMinorAmount(td.income, cur, displayCurrency, fxRates)
        const exp = convertMinorAmount(td.expense, cur, displayCurrency, fxRates)
        if (inc === null || exp === null) { canConvert = false; break }
        totalIncome += inc
        totalExpense += exp
      }
      result[p] = canConvert ? { income: totalIncome, expense: totalExpense, mixed: currencies.length > 1 } : null
    }
    return result as Record<Period, { income: number; expense: number; mixed: boolean } | null>
  }, [totals, displayCurrency, fxRates])

  const filteredTxs = useMemo(() => {
    const periodTxs = activePeriod === 'all'
      ? txs
      : txs.filter((tx) => {
          const d = new Date(tx.occurred_at)
          const r = ranges[activePeriod]
          return d >= r.from && d <= r.to
        })
    return reviewOnly ? periodTxs.filter((tx) => tx.needs_review === 1) : periodTxs
  }, [txs, ranges, activePeriod, reviewOnly])

  const periodReviewCount = useMemo(() => {
    const periodTxs = activePeriod === 'all'
      ? txs
      : txs.filter((tx) => {
          const d = new Date(tx.occurred_at)
          const r = ranges[activePeriod]
          return d >= r.from && d <= r.to
        })
    return periodTxs.filter((tx) => tx.needs_review === 1).length
  }, [txs, ranges, activePeriod])

  const activeSummary = useMemo(() => summarizeInCurrency(filteredTxs, currency, null, currency), [filteredTxs, currency])
  const activeConverted = displayTotals[activePeriod]
  const overviewIncome = activeConverted?.income ?? activeSummary.income
  const overviewExpense = activeConverted?.expense ?? activeSummary.expense
  const overviewCurrency = activeConverted ? displayCurrency : currency
  const overviewNet = overviewIncome - overviewExpense
  const reviewCount = periodReviewCount
  const chartMax = Math.max(overviewIncome, overviewExpense, 1)
  const incomePct = Math.max(6, (overviewIncome / chartMax) * 100)
  const expensePct = Math.max(6, (overviewExpense / chartMax) * 100)

  const topCategory = useMemo(() => {
    const spending = new Map<string, number>()
    const targetCurrency = fxRates ? displayCurrency : currency
    for (const tx of filteredTxs) {
      if (tx.amount_cents >= 0) continue
      const amount = tx.currency === targetCurrency
        ? tx.amount_cents
        : fxRates
          ? convertMinorAmount(tx.amount_cents, tx.currency, targetCurrency, fxRates)
          : tx.currency === currency
            ? tx.amount_cents
            : null
      if (amount === null) continue
      spending.set(tx.category_id, (spending.get(tx.category_id) ?? 0) + Math.abs(amount))
    }
    const [categoryId, amount] = Array.from(spending.entries()).sort((a, b) => b[1] - a[1])[0] ?? []
    if (!categoryId) return null
    return { category: catById.get(categoryId), amount, currency: targetCurrency }
  }, [filteredTxs, catById, currency, displayCurrency, fxRates])

  const recurringCandidates = useMemo<RecurringCandidate[]>(() => {
    const groups = new Map<string, Transaction[]>()
    for (const tx of txs) {
      if (tx.amount_cents >= 0) continue
      const merchant = (tx.merchant ?? '').trim().toLowerCase()
      if (!merchant) continue
      const bucketAmount = Math.round(Math.abs(tx.amount_cents) / 1000)
      const key = `${merchant}:${tx.category_id}:${tx.currency}:${bucketAmount}`
      const list = groups.get(key) ?? []
      list.push(tx)
      groups.set(key, list)
    }
    return Array.from(groups.entries())
      .map(([key, list]) => list.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()))
      .filter((list) => list.length >= 2)
      .map((list) => {
        const latest = list[0]!
        const category = catById.get(latest.category_id)
        return {
          key: `${latest.merchant}-${latest.category_id}-${latest.currency}-${Math.abs(latest.amount_cents)}`,
          title: latest.merchant ?? category?.name ?? 'Recurring bill',
          categoryName: category?.name ?? t.category_others,
          amount: Math.abs(latest.amount_cents),
          currency: latest.currency,
          count: list.length,
          lastDate: new Date(latest.occurred_at),
          nextDate: addMonths(new Date(latest.occurred_at), 1),
        }
      })
      .sort((a, b) => b.count - a.count || b.lastDate.getTime() - a.lastDate.getTime())
      .slice(0, 3)
  }, [txs, catById])

  const createBillReminder = (candidate: RecurringCandidate) => {
    router.push({
      pathname: '/reminder',
      params: {
        prefill: JSON.stringify({
          title: t.pay_bill.replace('{{name}}', candidate.title),
          note: `${candidate.categoryName} · ${formatAmount(candidate.amount, candidate.currency, language)}`,
          remind_at: candidate.nextDate.toISOString(),
          advance_minutes: 1440,
          recurrence: 'monthly',
          priority: 'high',
        }),
      },
    })
  }

  const activityItems = useMemo<ActivityItem[]>(() => {
    const groups = new Map<string, Transaction[]>()
    for (const tx of filteredTxs) {
      const key = format(new Date(tx.occurred_at), 'yyyy-MM-dd')
      const list = groups.get(key) ?? []
      list.push(tx)
      groups.set(key, list)
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .flatMap(([key, items]) => {
        const sorted = items.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
        const headerCurrency = fxRates ? displayCurrency : currency
        const summary = summarizeInCurrency(sorted, headerCurrency, fxRates, currency)
        return [
          {
            type: 'header' as const,
            id: `header-${key}`,
            label: format(new Date(key), 'EEEE, dd MMM', { locale }),
            income: summary.income,
            expense: summary.expense,
            currency: headerCurrency,
          },
          ...sorted.map((tx) => ({ type: 'tx' as const, id: tx.id, tx })),
        ]
      })
  }, [filteredTxs, currency, displayCurrency, fxRates, locale])

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
      <FlashList
        data={activityItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={[styles.overviewCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <View style={styles.overviewTop}>
                <View>
                  <Text style={[styles.eyebrow, { color: theme.text.muted }]}>{PERIOD_ROWS.find((p) => p.key === activePeriod)?.label}</Text>
                  <AmountText
                    cents={overviewNet}
                    currency={overviewCurrency}
                    color={overviewNet < 0 ? theme.finance.expense : theme.finance.income}
                    style={styles.netAmount}
                  />
                </View>
                {activeConverted?.mixed ? (
                  <Text style={[styles.converted, { color: theme.text.muted }]}>~ {displayCurrency}</Text>
                ) : null}
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <Text style={[styles.metricLabel, { color: theme.text.muted }]}>{t.income}</Text>
                  <AmountText cents={overviewIncome} currency={overviewCurrency} showSign={false} color={theme.finance.income} style={styles.metricValue} />
                </View>
                <View style={[styles.metricDivider, { backgroundColor: theme.border.subtle }]} />
                <View style={styles.metric}>
                  <Text style={[styles.metricLabel, { color: theme.text.muted }]}>{t.expense}</Text>
                  <AmountText cents={overviewExpense} currency={overviewCurrency} showSign={false} color={theme.finance.expense} style={styles.metricValue} />
                </View>
              </View>

              <View style={styles.chartRows}>
                <View style={styles.chartRow}>
                  <View style={[styles.chartTrack, { backgroundColor: theme.bg.secondary }]}>
                    <View style={[styles.chartBar, { width: `${incomePct}%`, backgroundColor: theme.finance.income }]} />
                  </View>
                </View>
                <View style={styles.chartRow}>
                  <View style={[styles.chartTrack, { backgroundColor: theme.bg.secondary }]}>
                    <View style={[styles.chartBar, { width: `${expensePct}%`, backgroundColor: theme.finance.expense }]} />
                  </View>
                </View>
              </View>

              <Text style={[styles.insightLine, { color: theme.text.muted }]} numberOfLines={1}>
                {reviewCount > 0
                  ? t.review_queue_count.replace('{{count}}', String(reviewCount))
                  : topCategory?.category
                    ? `${translateCategoryName(topCategory.category, t)} / ${formatAmount(topCategory.amount, topCategory.currency, language)}`
                    : t.no_transactions}
              </Text>
            </View>

            <View style={[styles.segmented, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              {PERIOD_ROWS.map((row) => {
                const active = activePeriod === row.key
                return (
                  <Pressable
                    key={row.key}
                    onPress={() => setActivePeriod(row.key)}
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

            <Pressable
              onPress={() => setReviewOnly((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ selected: reviewOnly }}
              style={[styles.reviewFilter, {
                backgroundColor: reviewOnly ? theme.brand.primary + '18' : theme.bg.elevated,
                borderColor: reviewOnly ? theme.brand.primary : theme.border.subtle,
              }]}
            >
              <Feather name="alert-circle" size={16} color={reviewOnly ? theme.brand.primary : theme.text.muted} />
              <Text style={[styles.reviewFilterText, { color: reviewOnly ? theme.brand.primary : theme.text.secondary }]}>
                {t.review_queue}
              </Text>
              <Text style={[styles.reviewFilterCount, { color: theme.text.muted }]}>{periodReviewCount}</Text>
            </Pressable>

            {recurringCandidates.length > 0 ? (
              <View style={[styles.recurringCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                <View style={styles.recurringHeader}>
                  <View style={styles.recurringTitleRow}>
                    <Feather name="repeat" size={16} color={theme.brand.primary} />
                    <Text style={[styles.recurringTitle, { color: theme.text.primary }]}>{t.recurring_bills}</Text>
                  </View>
                  <Text style={[styles.recurringMeta, { color: theme.text.muted }]}>{recurringCandidates.length}</Text>
                </View>
                {recurringCandidates.map((candidate) => (
                  <View key={candidate.key} style={[styles.recurringRow, { borderColor: theme.border.subtle }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recurringName, { color: theme.text.primary }]} numberOfLines={1}>{candidate.title}</Text>
                      <Text style={[styles.recurringMeta, { color: theme.text.muted }]} numberOfLines={1}>
                        {t.recurring_times_next.replace('{{count}}', String(candidate.count)).replace('{{date}}', format(candidate.nextDate, 'dd/MM', { locale }))}
                      </Text>
                    </View>
                    <AmountText cents={candidate.amount} currency={candidate.currency} showSign={false} color={theme.finance.expense} style={styles.recurringAmount} />
                    <Pressable
                      onPress={() => createBillReminder(candidate)}
                      style={[styles.recurringBtn, { borderColor: theme.border.strong }]}
                    >
                      <Feather name="bell" size={14} color={theme.brand.primary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.analysisRow}>
              {[
                { label: t.nav_reports, icon: 'bar-chart-2' as const, route: '/reports' },
                { label: t.nav_insights, icon: 'activity' as const, route: '/insights' },
              ].map((item) => (
                <Pressable
                  key={item.route}
                  onPress={() => router.push(item.route as any)}
                  style={({ pressed }) => [
                    styles.analysisBtn,
                    { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
                  ]}
                >
                  <Feather name={item.icon} size={17} color={theme.brand.primary} />
                  <Text style={[styles.analysisText, { color: theme.text.secondary }]} numberOfLines={1}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View style={styles.dayHeader}>
                <Text style={[styles.dayTitle, { color: theme.text.muted }]}>{item.label}</Text>
                <View style={styles.dayTotals}>
                  {item.income > 0 ? <AmountText cents={item.income} currency={item.currency} showSign={false} color={theme.finance.income} style={styles.dayAmount} /> : null}
                  {item.expense > 0 ? <AmountText cents={item.expense} currency={item.currency} showSign={false} color={theme.finance.expense} style={styles.dayAmount} /> : null}
                </View>
              </View>
            )
          }
          return (
            <ReanimatedSwipeable
              renderRightActions={(_progress, _drag, swipeable) => (
                <Pressable
                  onPress={() => {
                    swipeable.close()
                    Alert.alert(t.delete, t.confirm_delete_msg, [
                      { text: t.cancel, style: 'cancel' },
                      { text: t.delete, style: 'destructive', onPress: () => remove(item.tx.id) },
                    ])
                  }}
                  style={[styles.swipeDelete, { backgroundColor: theme.semantic.danger }]}
                >
                  <Feather name="trash-2" size={20} color="#fff" />
                </Pressable>
              )}
              overshootRight={false}
            >
              <TransactionRow
                tx={item.tx}
                category={catById.get(item.tx.category_id)}
                onPress={() => router.push({ pathname: '/new', params: { id: item.tx.id } })}
                onLongPress={() => {
                  Alert.alert(t.delete, t.confirm_delete_msg, [
                    { text: t.cancel, style: 'cancel' },
                    { text: t.delete, style: 'destructive', onPress: () => remove(item.tx.id) },
                  ])
                }}
              />
            </ReanimatedSwipeable>
          )
        }}
        onEndReached={!reviewOnly && activePeriod === 'all' && hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          !reviewOnly && activePeriod === 'all' && (loadingMore || hasMore) ? (
            <View style={styles.footer}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={theme.brand.primary} />
              ) : (
                <Pressable onPress={loadMore} style={[styles.loadMoreBtn, { borderColor: theme.border.subtle }]}>
                  <Text style={{ color: theme.text.secondary, fontSize: 13 }}>{t.load_more}</Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <SkeletonTransactionList />
          ) : reviewOnly ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.brand.primary + '1F' }]}>
                <Feather name="check-circle" size={34} color={theme.brand.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_review_items}</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.brand.primary + '1F' }]}>
                <Feather name="credit-card" size={34} color={theme.brand.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_transactions}</Text>
              <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.tap_to_add}</Text>
              <Pressable
                onPress={() => router.push('/new')}
                style={[styles.emptyBtn, { backgroundColor: theme.brand.primary }]}
              >
                <Text style={styles.emptyBtnText}>{t.nav_new_transaction}</Text>
              </Pressable>
            </View>
          )
        }
      />

      <FAB
        onPress={() => router.push('/new')}
        accessibilityLabel={t.nav_new_transaction}
        style={[styles.fab, { backgroundColor: theme.brand.primary, bottom: spacing[5] }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </FAB>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: spacing[4], paddingBottom: 112 },
  headerContent: { gap: spacing[3], marginBottom: spacing[3] },
  overviewCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[3],
  },
  overviewTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  eyebrow: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[1] },
  netAmount: { fontSize: 26, fontWeight: '800' },
  converted: { fontSize: 12, fontWeight: '600' },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  metric: { flex: 1, gap: spacing[1] },
  metricDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  metricLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 16, fontWeight: '700' },
  chartRows: { gap: spacing[2] },
  chartRow: { gap: spacing[1] },
  chartTrack: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  chartBar: { height: '100%', borderRadius: radius.full },
  insightLine: { fontSize: 13 },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, alignItems: 'center', borderRadius: radius.sm, paddingVertical: spacing[2] },
  segmentText: { fontSize: 13, fontWeight: '700' },
  analysisRow: { flexDirection: 'row', gap: spacing[2] },
  reviewFilter: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[3],
  },
  reviewFilterText: { flex: 1, fontSize: 13, fontWeight: '800' },
  reviewFilterCount: { fontSize: 12, fontWeight: '800' },
  recurringCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[2],
  },
  recurringHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recurringTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  recurringTitle: { fontSize: 14, fontWeight: '800' },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[2],
  },
  recurringName: { fontSize: 13, fontWeight: '800' },
  recurringMeta: { fontSize: 11 },
  recurringAmount: { fontSize: 12, fontWeight: '800' },
  recurringBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  analysisText: { fontSize: 11, fontWeight: '700' },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  dayTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayTotals: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dayAmount: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: spacing[12], gap: spacing[2] },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[8] },
  emptyBtn: { paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  footer: { alignItems: 'center', paddingVertical: spacing[4] },
  loadMoreBtn: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  swipeDelete: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
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
