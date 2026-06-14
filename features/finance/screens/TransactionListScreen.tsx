import { View, Text, Pressable, StyleSheet, RefreshControl, ActivityIndicator, Alert, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native'
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
  usePlanItems,
  useDebts,
  useFinanceActions,
  usePlanItemActions,
  useDebtActions,
} from '../hooks/useFinance'
import { TransactionRow } from '../components/TransactionRow'
import { AmountText } from '../components/AmountText'
import { PlanItemSheet } from '../components/PlanItemSheet'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getRates, convertMinorAmount } from '@services/fx'
import { calculateSafeToSpend, getSettledPlanItemIds, summarizeDebts, formatAmount } from '@features/finance/services'
import { translateCategoryName } from '../i18n'
import { getDateFnsLocale } from '@services/locale'
import type { Debt, PlanItem, Transaction } from '../types'
import { SkeletonTransactionList } from '@components/SkeletonBox'
import { FAB } from '@components/FAB'
import { ScreenTransition } from '@components/ScreenTransition'
import { toast } from '@store/toastStore'

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
  kind: 'income' | 'expense'
  categoryId: string | null
  amount: number
  currency: string
  count: number
  lastDate: Date
  nextDate: Date
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// Smooth height transition for the finance card expand/collapse toggles.
function animateExpand() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
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
  const planItems = usePlanItems()
  const debts = useDebts()
  const { remove, restore, refresh, loadMore, hasMore, loadingMore } = useFinanceActions()
  const { createPlanItem, deletePlanItem, restorePlanItem } = usePlanItemActions()
  const { deleteDebt, restoreDebt } = useDebtActions()
  const [refreshing, setRefreshing] = useState(false)
  const [activePeriod, setActivePeriod] = useState<Period>('month')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [showFinanceDetails, setShowFinanceDetails] = useState(false)
  const [showSafeDetails, setShowSafeDetails] = useState(false)
  const [showAllMonthlyPlanRows, setShowAllMonthlyPlanRows] = useState(false)
  const [planSheet, setPlanSheet] = useState<{ item: PlanItem | null } | null>(null)
  const [search, setSearch] = useState('')
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const currency = useSettingsStore((s) => s.currency)
  const language = useSettingsStore((s) => s.language)
  const cycleStartDay = useSettingsStore((s) => s.financeCycleStartDay)
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
    const reviewTxs = reviewOnly ? periodTxs.filter((tx) => tx.needs_review === 1) : periodTxs
    const q = search.trim().toLowerCase()
    if (!q) return reviewTxs
    return reviewTxs.filter((tx) => {
      const cat = catById.get(tx.category_id)
      return [
        tx.merchant,
        tx.note,
        cat ? translateCategoryName(cat, t) : '',
        tx.currency,
      ].some((value) => value?.toLowerCase().includes(q))
    })
  }, [txs, ranges, activePeriod, reviewOnly, search, catById, t])

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

  const activeSummary = useMemo(() => {
    let income = 0
    let expense = 0
    for (const tx of filteredTxs) {
      if (tx.currency !== currency) continue
      if (tx.amount_cents > 0) income += tx.amount_cents
      else expense += Math.abs(tx.amount_cents)
    }
    return { income, expense }
  }, [filteredTxs, currency])
  const activeConverted = displayTotals[activePeriod]
  const overviewIncome = activeConverted?.income ?? activeSummary.income
  const overviewExpense = activeConverted?.expense ?? activeSummary.expense
  const overviewCurrency = activeConverted ? displayCurrency : currency
  const overviewNet = overviewIncome - overviewExpense
  const reviewCount = periodReviewCount
  const chartMax = Math.max(overviewIncome, overviewExpense, 1)
  const incomePct = Math.max(6, (overviewIncome / chartMax) * 100)
  const expensePct = Math.max(6, (overviewExpense / chartMax) * 100)

  const safeCurrency = fxRates ? displayCurrency : currency
  const countPlannedIncome = useSettingsStore((s) => s.safeToSpendCountPlannedIncome)
  const countCarryOver = useSettingsStore((s) => s.safeToSpendCarryOver)
  const safeToSpend = useMemo(
    () => calculateSafeToSpend({
      transactions: txs,
      categories: cats,
      planItems,
      debts,
      currency: safeCurrency,
      fxRates,
      cycleStartDay,
      countPlannedIncome,
      countCarryOver,
    }),
    [txs, cats, planItems, debts, safeCurrency, fxRates, cycleStartDay, countPlannedIncome, countCarryOver]
  )

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
      const merchant = (tx.merchant ?? '').trim().toLowerCase()
      if (!merchant) continue
      const kind: RecurringCandidate['kind'] = tx.amount_cents > 0 ? 'income' : 'expense'
      const bucketAmount = Math.round(Math.abs(tx.amount_cents) / 1000)
      const key = `${kind}:${merchant}:${tx.category_id}:${tx.currency}:${bucketAmount}`
      const list = groups.get(key) ?? []
      list.push(tx)
      groups.set(key, list)
    }
    return Array.from(groups.values())
      .map((list) => list.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()))
      .filter((list) => list.length >= 2)
      .map((list) => {
        const latest = list[0]!
        const category = catById.get(latest.category_id)
        return {
          key: `${latest.merchant}-${latest.category_id}-${latest.currency}-${Math.abs(latest.amount_cents)}`,
          title: latest.merchant ?? (category ? translateCategoryName(category, t) : t.category_others),
          categoryName: category ? translateCategoryName(category, t) : t.category_others,
          kind: latest.amount_cents > 0 ? 'income' as const : 'expense' as const,
          categoryId: latest.category_id,
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

  const activePlanItems = useMemo(
    () => planItems.filter((item) => item.active === 1 && !item.deleted_at),
    [planItems]
  )

  // Paid/received this cycle: badge instead of listing as still-to-pay.
  const settledPlanIds = useMemo(
    () => getSettledPlanItemIds({ planItems: activePlanItems, transactions: txs, cycleStartDay }),
    [activePlanItems, txs, cycleStartDay]
  )

  // Base order by due day; the combined monthlyPlanRows sort sinks settled items.
  const sortedPlanItems = useMemo(
    () => [...activePlanItems].sort((a, b) => a.due_day - b.due_day),
    [activePlanItems]
  )

  // Header totals = what is still expected/owed this cycle (settled items excluded).
  const plannedTotal = useMemo(() => {
    let income = 0
    let expense = 0
    for (const item of activePlanItems) {
      if (item.currency !== currency) continue
      if (settledPlanIds.has(item.id)) continue
      if (item.kind === 'income') income += item.amount_cents
      else expense += item.amount_cents
    }
    for (const debt of debts) {
      if (debt.deleted_at || debt.status !== 'open' || !debt.due_at || debt.currency !== currency) continue
      const due = new Date(debt.due_at)
      if (due < safeToSpend.cycleFrom || due >= safeToSpend.cycleTo) continue
      if (debt.direction === 'borrowed') expense += debt.amount_cents
      else income += debt.amount_cents
    }
    return { income, expense }
  }, [activePlanItems, settledPlanIds, debts, currency, safeToSpend.cycleFrom, safeToSpend.cycleTo])

  const dueDebtPlanRows = useMemo(() => {
    const from = safeToSpend.cycleFrom
    const to = safeToSpend.cycleTo
    return debts
      .filter((debt) => {
        if (debt.deleted_at || debt.status !== 'open' || !debt.due_at) return false
        const due = new Date(debt.due_at)
        return due >= from && due < to
      })
      .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
  }, [debts, safeToSpend.cycleFrom, safeToSpend.cycleTo])

  const monthlyPlanRows = useMemo(
    () => [
      ...sortedPlanItems.map((item) => ({ type: 'plan' as const, id: item.id, item })),
      ...dueDebtPlanRows.map((debt) => ({ type: 'debt' as const, id: `debt:${debt.id}`, debt })),
    ].sort((a, b) => {
      // Settled plan items sink to the bottom so unpaid items keep the visible
      // top slots (debts are always open, so never settled). Then by due day.
      const aSettled = a.type === 'plan' && settledPlanIds.has(a.item.id) ? 1 : 0
      const bSettled = b.type === 'plan' && settledPlanIds.has(b.item.id) ? 1 : 0
      if (aSettled !== bSettled) return aSettled - bSettled
      const aDay = a.type === 'plan' ? a.item.due_day : new Date(a.debt.due_at!).getDate()
      const bDay = b.type === 'plan' ? b.item.due_day : new Date(b.debt.due_at!).getDate()
      return aDay - bDay
    }),
    [sortedPlanItems, dueDebtPlanRows, settledPlanIds]
  )
  const visibleMonthlyPlanRows = showAllMonthlyPlanRows ? monthlyPlanRows : monthlyPlanRows.slice(0, 4)
  const hiddenMonthlyPlanCount = Math.max(0, monthlyPlanRows.length - visibleMonthlyPlanRows.length)

  const debtSummary = useMemo(() => summarizeDebts(debts, currency), [debts, currency])

  const candidateInPlan = useCallback((candidate: RecurringCandidate) => {
    const normalized = candidate.title.trim().toLowerCase()
    return activePlanItems.some((item) =>
      item.kind === candidate.kind &&
      item.currency === candidate.currency &&
      item.amount_cents === candidate.amount &&
      item.name.trim().toLowerCase() === normalized
    )
  }, [activePlanItems])

  const addCandidateToPlan = useCallback(async (candidate: RecurringCandidate) => {
    const result = await createPlanItem({
      name: candidate.title,
      kind: candidate.kind,
      amount_cents: candidate.amount,
      currency: candidate.currency,
      category_id: candidate.categoryId,
      due_day: Math.min(Math.max(candidate.lastDate.getDate(), 1), 31),
      status: 'confirmed',
    })
    if (!result.ok) Alert.alert(t.ai_error, result.error ?? t.no_transactions)
  }, [createPlanItem, t])

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
        let income = 0
        let expense = 0
        for (const tx of sorted) {
          const converted = tx.currency === headerCurrency
            ? tx.amount_cents
            : fxRates
              ? convertMinorAmount(tx.amount_cents, tx.currency, headerCurrency, fxRates)
              : tx.currency === currency
                ? tx.amount_cents
                : null
          if (converted === null) continue
          if (converted > 0) income += converted
          else expense += Math.abs(converted)
        }
        return [
          {
            type: 'header' as const,
            id: `header-${key}`,
            label: format(new Date(key), 'EEEE, dd MMM', { locale }),
            income,
            expense,
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

  const deleteTransactionWithUndo = useCallback((id: string) => {
    Alert.alert(t.delete, t.confirm_delete_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const result = await remove(id)
            if (!result.ok) {
              Alert.alert(t.could_not_save, result.error ?? '')
              return
            }
            toast.undo(t.toast_deleted, t.undo, () => { void restore(id) })
          })()
        },
      },
    ])
  }, [remove, restore, t])

  const deletePlanItemWithUndo = useCallback((item: PlanItem) => {
    Alert.alert(t.delete, item.name, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const result = await deletePlanItem(item.id)
            if (!result.ok) {
              Alert.alert(t.could_not_save, result.error ?? '')
              return
            }
            toast.undo(t.toast_deleted, t.undo, () => { void restorePlanItem(item.id) })
          })()
        },
      },
    ])
  }, [deletePlanItem, restorePlanItem, t])

  const deleteDebtWithUndo = useCallback((debt: Debt) => {
    Alert.alert(t.debt_book, `${debt.counterparty} · ${formatAmount(debt.amount_cents, debt.currency, language)}\n\n${t.debt_delete_msg}`, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const result = await deleteDebt(debt.id)
            if (!result.ok) {
              Alert.alert(t.could_not_save, result.error ?? '')
              return
            }
            toast.undo(t.toast_deleted, t.undo, () => { void restoreDebt(debt.id) })
          })()
        },
      },
    ])
  }, [deleteDebt, language, restoreDebt, t])

  const PERIOD_ROWS: { key: Period; label: string }[] = [
    { key: 'today', label: t.today },
    { key: 'week', label: t.this_week },
    { key: 'month', label: t.this_month },
    { key: 'all', label: t.all_period },
  ]

  return (
    <ScreenTransition style={[styles.container, { backgroundColor: theme.bg.primary }]}>
      <FlashList
        data={activityItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand.primary}
            colors={[theme.brand.primary]}
          />
        }
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

            <View style={[styles.searchBox, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <Feather name="search" size={16} color={theme.text.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t.finance_search_placeholder}
                placeholderTextColor={theme.text.muted}
                accessibilityLabel={t.finance_search_placeholder}
                style={[styles.searchInput, { color: theme.text.primary }]}
                returnKeyType="search"
              />
              {search.trim() ? (
                <Pressable
                  onPress={() => setSearch('')}
                  accessibilityRole="button"
                  accessibilityLabel={t.cancel}
                  hitSlop={8}
                >
                  <Feather name="x" size={16} color={theme.text.muted} />
                </Pressable>
              ) : null}
            </View>

            <View style={[styles.safePanel, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <Pressable
                onPress={() => { animateExpand(); setShowSafeDetails((v) => !v) }}
                accessibilityRole="button"
                accessibilityState={{ expanded: showSafeDetails }}
                accessibilityLabel={showSafeDetails ? t.home_hide_details : t.home_show_details}
                style={styles.safeLine}
              >
                <View style={styles.safeTitleRow}>
                  <Feather
                    name={safeToSpend.safeToSpend < 0 ? 'alert-triangle' : 'shield'}
                    size={15}
                    color={safeToSpend.safeToSpend < 0 ? theme.semantic.danger : theme.brand.primary}
                  />
                  <Text style={[styles.safeLabel, { color: theme.text.secondary }]}>{t.safe_to_spend}</Text>
                </View>
                <View style={styles.safeRight}>
                  <AmountText
                    cents={safeToSpend.safeToSpend}
                    currency={safeCurrency}
                    showSign={safeToSpend.safeToSpend < 0}
                    color={safeToSpend.safeToSpend < 0 ? theme.semantic.danger : theme.brand.primary}
                    style={styles.safeAmount}
                  />
                  <Feather name={showSafeDetails ? 'chevron-up' : 'chevron-down'} size={15} color={theme.text.muted} />
                </View>
              </Pressable>
              {safeToSpend.skippedForeign > 0 ? (
                <View style={styles.safeWarnRow}>
                  <Feather name="alert-circle" size={13} color={theme.semantic.danger} />
                  <Text style={[styles.safeWarn, { color: theme.semantic.danger }]} numberOfLines={2}>
                    {t.safe_fx_missing.replace('{{count}}', String(safeToSpend.skippedForeign))}
                  </Text>
                </View>
              ) : null}
              {showSafeDetails ? (
                <>
                  <View style={styles.safeBreakdown}>
                    {countCarryOver ? (
                      <Text style={[styles.safeMeta, { color: theme.text.muted }]} numberOfLines={1}>
                        {t.safe_rollover}: {safeToSpend.carryOver < 0 ? '-' : ''}{formatAmount(safeToSpend.carryOver, safeCurrency, language)}
                      </Text>
                    ) : null}
                    <Text style={[styles.safeMeta, { color: theme.text.muted }]} numberOfLines={1}>
                      {t.safe_income}: {formatAmount(safeToSpend.income, safeCurrency, language)}
                    </Text>
                    {countPlannedIncome ? (
                      <Text style={[styles.safeMeta, { color: theme.text.muted }]} numberOfLines={1}>
                        {t.safe_planned_income}: {formatAmount(safeToSpend.plannedIncome, safeCurrency, language)}
                      </Text>
                    ) : null}
                    <Text style={[styles.safeMeta, { color: theme.text.muted }]} numberOfLines={1}>
                      {t.safe_regular_expense}: {formatAmount(safeToSpend.nonFundExpense, safeCurrency, language)}
                    </Text>
                    {safeToSpend.savingsSetAside > 0 ? (
                      <Text style={[styles.safeMeta, { color: theme.text.muted }]} numberOfLines={1}>
                        {t.safe_savings}: {formatAmount(safeToSpend.savingsSetAside, safeCurrency, language)}
                      </Text>
                    ) : null}
                    <Text style={[styles.safeMeta, { color: theme.text.muted }]} numberOfLines={1}>
                      {t.safe_planned_expense}: {formatAmount(safeToSpend.plannedExpense, safeCurrency, language)}
                    </Text>
                  </View>
                  <Text style={[styles.safeFormula, { color: theme.text.muted }]}>
                    {countPlannedIncome ? t.safe_to_spend_formula : t.safe_to_spend_formula_no_projected}
                  </Text>
                </>
              ) : null}
            </View>

            <View style={[styles.planCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <View style={styles.recurringHeader}>
                <View style={styles.recurringTitleRow}>
                  <Feather name="calendar" size={16} color={theme.brand.primary} />
                  <Text style={[styles.recurringTitle, { color: theme.text.primary }]} numberOfLines={1}>{t.monthly_plan}</Text>
                  {!showFinanceDetails && monthlyPlanRows.length > 0 ? (
                    <View style={[styles.planCountBadge, { backgroundColor: theme.brand.primary + '1F' }]}>
                      <Text style={[styles.planCountBadgeText, { color: theme.brand.primary }]}>{monthlyPlanRows.length}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.recurringHeaderRight}>
                  <Pressable
                    onPress={() => setPlanSheet({ item: null })}
                    accessibilityRole="button"
                    accessibilityLabel={t.plan_add_title}
                    hitSlop={6}
                    style={[styles.recurringBtn, { borderColor: theme.border.strong }]}
                  >
                    <Feather name="plus" size={14} color={theme.brand.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      animateExpand()
                      if (showFinanceDetails) setShowAllMonthlyPlanRows(false)
                      setShowFinanceDetails((v) => !v)
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={showFinanceDetails ? t.home_hide_details : t.home_show_details}
                    accessibilityState={{ expanded: showFinanceDetails }}
                    hitSlop={6}
                    style={[styles.recurringBtn, { borderColor: theme.border.strong }]}
                  >
                    <Feather name={showFinanceDetails ? 'chevron-up' : 'chevron-down'} size={15} color={theme.text.muted} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.planTotalsRow}>
                <View style={[styles.planTotalPill, { backgroundColor: theme.finance.income + '14', borderColor: theme.finance.income + '44' }]}>
                  <Feather name="arrow-down-left" size={13} color={theme.finance.income} />
                  <Text style={[styles.planTotalLabel, { color: theme.text.muted }]} numberOfLines={1}>{t.income}</Text>
                  <AmountText cents={plannedTotal.income} currency={currency} showSign={false} color={theme.finance.income} style={styles.planTotalAmount} />
                </View>
                <View style={[styles.planTotalPill, { backgroundColor: theme.finance.expense + '14', borderColor: theme.finance.expense + '44' }]}>
                  <Feather name="arrow-up-right" size={13} color={theme.finance.expense} />
                  <Text style={[styles.planTotalLabel, { color: theme.text.muted }]} numberOfLines={1}>{t.expense}</Text>
                  <AmountText cents={plannedTotal.expense} currency={currency} showSign={false} color={theme.finance.expense} style={styles.planTotalAmount} />
                </View>
              </View>
              {showFinanceDetails ? monthlyPlanRows.length > 0 ? (
                <>
              {visibleMonthlyPlanRows.map((row) => {
                if (row.type === 'debt') {
                  const debt = row.debt
                  const dueAt = new Date(debt.due_at!)
                  const planKind = debt.direction === 'borrowed' ? 'expense' : 'income'
                  return (
                    <ReanimatedSwipeable
                      key={row.id}
                      renderRightActions={(_progress, _drag, swipeable) => (
                        <Pressable
                          onPress={() => {
                            swipeable.close()
                            deleteDebtWithUndo(debt)
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t.delete}
                          style={[styles.swipeDelete, styles.planSwipeDelete, { backgroundColor: theme.semantic.danger }]}
                        >
                          <Feather name="trash-2" size={20} color="#fff" />
                        </Pressable>
                      )}
                      overshootRight={false}
                    >
                      <Pressable
                        onPress={() => router.push({ pathname: '/debt' as any, params: { id: debt.id } })}
                        accessibilityRole="button"
                        accessibilityLabel={`${debt.counterparty} · ${t.debt_book} · ${formatAmount(debt.amount_cents, debt.currency, language)}`}
                        style={({ pressed }) => [styles.planRow, { backgroundColor: pressed ? theme.bg.primary : theme.bg.secondary, borderColor: theme.border.subtle }]}
                      >
                        <View style={[styles.planIcon, { backgroundColor: (planKind === 'income' ? theme.finance.income : theme.finance.expense) + '1F' }]}>
                          <Feather name={planKind === 'income' ? 'arrow-down-left' : 'arrow-up-right'} size={14} color={planKind === 'income' ? theme.finance.income : theme.finance.expense} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.recurringName, { color: theme.text.primary }]} numberOfLines={1}>
                            {debt.direction === 'borrowed' ? t.debt_settle_tx_note_borrowed.replace('{{name}}', debt.counterparty) : t.debt_settle_tx_note_lent.replace('{{name}}', debt.counterparty)}
                          </Text>
                          <Text style={[styles.recurringMeta, { color: theme.text.muted }]} numberOfLines={1}>
                            {t.debt_due_date}: {format(dueAt, 'dd/MM', { locale })}
                          </Text>
                        </View>
                        <AmountText cents={debt.amount_cents} currency={debt.currency} showSign={false} color={planKind === 'income' ? theme.finance.income : theme.finance.expense} style={styles.recurringAmount} />
                      </Pressable>
                    </ReanimatedSwipeable>
                  )
                }
                const item = row.item
                const settled = settledPlanIds.has(item.id)
                return (
                  <ReanimatedSwipeable
                    key={item.id}
                    renderRightActions={(_progress, _drag, swipeable) => (
                      <Pressable
                        onPress={() => {
                          swipeable.close()
                          deletePlanItemWithUndo(item)
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t.delete}
                        style={[styles.swipeDelete, styles.planSwipeDelete, { backgroundColor: theme.semantic.danger }]}
                      >
                        <Feather name="trash-2" size={20} color="#fff" />
                      </Pressable>
                    )}
                    overshootRight={false}
                  >
                  <Pressable
                    onPress={() => setPlanSheet({ item })}
                    accessibilityRole="button"
                    accessibilityLabel={settled ? `${item.name} · ${t.plan_paid} · ${formatAmount(item.amount_cents, item.currency, language)}` : `${item.name} · ${formatAmount(item.amount_cents, item.currency, language)}`}
                    style={({ pressed }) => [styles.planRow, { backgroundColor: pressed ? theme.bg.primary : theme.bg.secondary, borderColor: theme.border.subtle, opacity: settled ? 0.55 : 1 }]}
                  >
                    <View style={[styles.planIcon, { backgroundColor: (settled ? theme.semantic.success : item.kind === 'income' ? theme.finance.income : theme.finance.expense) + '1F' }]}>
                      {settled ? (
                        <Feather name="check-circle" size={14} color={theme.semantic.success} />
                      ) : (
                        <Feather name={item.kind === 'income' ? 'arrow-down-left' : 'arrow-up-right'} size={14} color={item.kind === 'income' ? theme.finance.income : theme.finance.expense} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recurringName, { color: theme.text.primary }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.recurringMeta, { color: settled ? theme.semantic.success : theme.text.muted }]} numberOfLines={1}>
                        {settled ? t.plan_paid : t.plan_due_day.replace('{{day}}', String(item.due_day))}
                      </Text>
                    </View>
                    <AmountText cents={item.amount_cents} currency={item.currency} showSign={false} color={settled ? theme.text.muted : item.kind === 'income' ? theme.finance.income : theme.finance.expense} style={styles.recurringAmount} />
                  </Pressable>
                  </ReanimatedSwipeable>
                )
              })}
              {hiddenMonthlyPlanCount > 0 ? (
                <Pressable
                  onPress={() => { animateExpand(); setShowAllMonthlyPlanRows(true) }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.load_more} ${hiddenMonthlyPlanCount}`}
                  style={({ pressed }) => [styles.planMoreRow, { backgroundColor: pressed ? theme.bg.primary : theme.bg.secondary, borderColor: theme.border.subtle }]}
                >
                  <Feather name="more-horizontal" size={16} color={theme.brand.primary} />
                  <Text style={[styles.planMoreText, { color: theme.brand.primary }]}>
                    {t.load_more} ({hiddenMonthlyPlanCount})
                  </Text>
                </Pressable>
              ) : null}
                </>
              ) : (
                <Text style={[styles.safeFormula, { color: theme.text.muted }]}>{t.monthly_plan_empty}</Text>
              ) : null}
            </View>

            <Pressable
              onPress={() => router.push('/debts' as any)}
              accessibilityRole="button"
              accessibilityLabel={t.debt_book}
              style={[styles.reviewFilter, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
            >
              <Feather name="users" size={16} color={debtSummary.overdueCount > 0 ? theme.semantic.danger : theme.brand.primary} />
              <Text style={[styles.reviewFilterText, { color: theme.text.secondary }]}>{t.debt_book}</Text>
              <Text style={[styles.reviewFilterCount, { color: theme.text.muted }]} numberOfLines={1}>
                {debtSummary.openCount > 0
                  ? `${formatAmount(debtSummary.lentOutstanding, currency, language)} / ${formatAmount(debtSummary.borrowedOutstanding, currency, language)}`
                  : ''}
              </Text>
              <Feather name="chevron-right" size={16} color={theme.text.muted} />
            </Pressable>

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
              {periodReviewCount > 0 && (
                <Text style={[styles.reviewFilterCount, { color: reviewOnly ? theme.brand.primary : theme.text.muted }]}>{periodReviewCount}</Text>
              )}
            </Pressable>

            {showFinanceDetails && recurringCandidates.length > 0 ? (
              <View style={[styles.recurringCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                <View style={styles.recurringHeader}>
                  <View style={styles.recurringTitleRow}>
                    <Feather name="repeat" size={16} color={theme.brand.primary} />
                    <Text style={[styles.recurringTitle, { color: theme.text.primary }]}>{t.recurring_patterns}</Text>
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
                    <AmountText cents={candidate.amount} currency={candidate.currency} showSign={false} color={candidate.kind === 'income' ? theme.finance.income : theme.finance.expense} style={styles.recurringAmount} />
                    <Pressable
                      onPress={() => addCandidateToPlan(candidate)}
                      disabled={candidateInPlan(candidate)}
                      style={[styles.recurringBtn, { borderColor: theme.border.strong, opacity: candidateInPlan(candidate) ? 0.45 : 1 }]}
                    >
                      <Feather name={candidateInPlan(candidate) ? 'check' : 'plus'} size={14} color={theme.brand.primary} />
                    </Pressable>
                    {candidate.kind === 'expense' ? (
                      <Pressable
                        onPress={() => createBillReminder(candidate)}
                        style={[styles.recurringBtn, { borderColor: theme.border.strong }]}
                      >
                        <Feather name="bell" size={14} color={theme.brand.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.analysisRow}>
              {[
                { label: t.nav_reports, icon: 'bar-chart-2' as const, route: '/reports', bg: theme.brand.primary },
                { label: t.nav_insights, icon: 'cpu' as const, route: '/insights', bg: theme.brand.accent },
              ].map((item) => (
                <Pressable
                  key={item.route}
                  onPress={() => router.push(item.route as any)}
                  style={({ pressed }) => [styles.analysisBtn, { backgroundColor: pressed ? item.bg + 'CC' : item.bg }]}
                >
                  <Feather name={item.icon} size={17} color="#fff" />
                  <Text style={styles.analysisBtnText} numberOfLines={1}>{item.label}</Text>
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
                    deleteTransactionWithUndo(item.tx.id)
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
          ) : search.trim() ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.brand.primary + '1F' }]}>
                <Feather name="search" size={34} color={theme.brand.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_matching_transactions}</Text>
              <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{search.trim()}</Text>
              <Pressable
                onPress={() => setSearch('')}
                style={[styles.emptyBtn, { backgroundColor: theme.brand.primary }]}
              >
                <Text style={styles.emptyBtnText}>{t.clear_search}</Text>
              </Pressable>
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

      <PlanItemSheet
        visible={planSheet !== null}
        item={planSheet?.item ?? null}
        onClose={() => setPlanSheet(null)}
      />
    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: spacing[4], paddingBottom: 112 },
  headerContent: { gap: spacing[3], marginBottom: spacing[3] },
  overviewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
  },
  overviewTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  eyebrow: { fontSize: 12, fontWeight: '500', marginBottom: spacing[1] },
  netAmount: { fontSize: 26, fontWeight: '700' },
  converted: { fontSize: 12, fontWeight: '600' },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  metric: { flex: 1, gap: spacing[1] },
  metricDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  metricLabel: { fontSize: 12, fontWeight: '500' },
  metricValue: { fontSize: 16, fontWeight: '700' },
  chartRows: { gap: spacing[2] },
  chartRow: { gap: spacing[1] },
  chartTrack: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  chartBar: { height: '100%', borderRadius: radius.full },
  insightLine: { fontSize: 13 },
  safePanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[3],
    gap: spacing[1],
  },
  safeLine: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  safeTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  safeRight: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  safeLabel: { fontSize: 13, fontWeight: '700' },
  safeAmount: { fontSize: 17, fontWeight: '700' },
  safeMeta: { fontSize: 12 },
  safeWarnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingTop: spacing[1] },
  safeWarn: { flex: 1, fontSize: 12, fontWeight: '600' },
  safeBreakdown: { gap: 2, paddingTop: spacing[1] },
  safeFormula: { fontSize: 12, lineHeight: 16, paddingTop: spacing[1] },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, alignItems: 'center', borderRadius: radius.sm, paddingVertical: spacing[2] },
  segmentText: { fontSize: 13, fontWeight: '700' },
  searchBox: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: spacing[2] },
  analysisRow: { flexDirection: 'row', gap: spacing[2] },
  reviewFilter: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
  },
  reviewFilterText: { flex: 1, fontSize: 13, fontWeight: '600' },
  reviewFilterCount: { fontSize: 12, fontWeight: '600' },
  recurringCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[3],
    gap: spacing[2],
  },
  planCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[3],
    gap: spacing[2],
  },
  recurringHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recurringHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  recurringTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  recurringTitle: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
  planCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCountBadgeText: { fontSize: 12, fontWeight: '700' },
  planTotalsRow: { flexDirection: 'row', gap: spacing[2] },
  planTotalPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[2],
  },
  planTotalLabel: { fontSize: 12, fontWeight: '600' },
  planTotalAmount: { marginLeft: 'auto', fontSize: 12, fontWeight: '700' },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[2],
  },
  recurringName: { fontSize: 13, fontWeight: '600' },
  recurringMeta: { fontSize: 12 },
  recurringAmount: { fontSize: 12, fontWeight: '700' },
  recurringBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  planIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planMoreRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
  },
  planMoreText: { fontSize: 13, fontWeight: '700' },
  analysisBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: radius.md,
  },
  analysisBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  dayTitle: { fontSize: 12, fontWeight: '600' },
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
    borderWidth: 1,
  },
  swipeDelete: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
  planSwipeDelete: { marginBottom: 0 },
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
