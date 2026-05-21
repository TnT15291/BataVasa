import { View, Text, Pressable, StyleSheet, RefreshControl, ActivityIndicator, TextInput, Modal, Alert } from 'react-native'
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
import { getRates, convertCents } from '@services/fx'
import { parseUniversalEntry, type UniversalEntry } from '@services/ai/universalEntry'
import { getProviderKey } from '@services/ai/openai'
import { matchCategory } from '@features/finance/i18n'
import { formatAmount } from '@features/finance/services'
import { VoiceButton } from '@components/VoiceButton'
import { useFinanceStore } from '@store/financeStore'
import { getDateFnsLocale } from '@services/locale'
import type { Transaction } from '../types'

type Period = 'today' | 'week' | 'month' | 'all'
type CurrencyTotals = { income: number; expense: number }
type PeriodTotals = Map<string, CurrencyTotals>
type ActivityItem =
  | { type: 'header'; id: string; label: string; income: number; expense: number }
  | { type: 'tx'; id: string; tx: Transaction }

function emptyTotals(): PeriodTotals {
  return new Map()
}

function addToTotals(totals: PeriodTotals, currency: string, signedCents: number) {
  const entry = totals.get(currency) ?? { income: 0, expense: 0 }
  if (signedCents > 0) entry.income += signedCents
  else entry.expense += Math.abs(signedCents)
  totals.set(currency, entry)
}

function summarizeTransactions(txs: Transaction[]) {
  return txs.reduce(
    (acc, tx) => {
      if (tx.amount_cents > 0) acc.income += tx.amount_cents
      else acc.expense += Math.abs(tx.amount_cents)
      return acc
    },
    { income: 0, expense: 0 }
  )
}

export function TransactionListScreen() {
  const isLoading = useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const txs = useTransactions()
  const cats = useCategories()
  const { remove, refresh, loadMore, hasMore, loadingMore } = useFinanceActions()
  const createTransaction = useFinanceStore((s) => s.createTransaction)
  const [refreshing, setRefreshing] = useState(false)
  const [activePeriod, setActivePeriod] = useState<Period>('month')
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const currency = useSettingsStore((s) => s.currency)
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)

  const [nlText, setNlText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsedEntry, setParsedEntry] = useState<UniversalEntry | null>(null)
  const [originalNlText, setOriginalNlText] = useState('')
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
        const inc = convertCents(td.income, cur, displayCurrency, fxRates)
        const exp = convertCents(td.expense, cur, displayCurrency, fxRates)
        if (inc === td.income && cur !== displayCurrency) { canConvert = false; break }
        totalIncome += inc
        totalExpense += exp
      }
      result[p] = canConvert ? { income: totalIncome, expense: totalExpense, mixed: currencies.length > 1 } : null
    }
    return result as Record<Period, { income: number; expense: number; mixed: boolean } | null>
  }, [totals, displayCurrency, fxRates])

  const filteredTxs = useMemo(() => {
    if (activePeriod === 'all') return txs
    const r = ranges[activePeriod]
    return txs.filter((tx) => {
      const d = new Date(tx.occurred_at)
      return d >= r.from && d <= r.to
    })
  }, [txs, ranges, activePeriod])

  const activeSummary = useMemo(() => summarizeTransactions(filteredTxs.filter((tx) => tx.currency === currency)), [filteredTxs, currency])
  const activeConverted = displayTotals[activePeriod]
  const overviewIncome = activeConverted?.income ?? activeSummary.income
  const overviewExpense = activeConverted?.expense ?? activeSummary.expense
  const overviewCurrency = activeConverted ? displayCurrency : currency
  const overviewNet = overviewIncome - overviewExpense
  const chartMax = Math.max(overviewIncome, overviewExpense, 1)
  const incomePct = Math.max(6, (overviewIncome / chartMax) * 100)
  const expensePct = Math.max(6, (overviewExpense / chartMax) * 100)

  const topCategory = useMemo(() => {
    const spending = new Map<string, number>()
    for (const tx of filteredTxs) {
      if (tx.amount_cents >= 0 || tx.currency !== currency) continue
      spending.set(tx.category_id, (spending.get(tx.category_id) ?? 0) + Math.abs(tx.amount_cents))
    }
    const [categoryId, amount] = Array.from(spending.entries()).sort((a, b) => b[1] - a[1])[0] ?? []
    if (!categoryId) return null
    return { category: catById.get(categoryId), amount }
  }, [filteredTxs, catById, currency])

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
        const summary = summarizeTransactions(sorted.filter((tx) => tx.currency === currency))
        return [
          {
            type: 'header' as const,
            id: `header-${key}`,
            label: format(new Date(key), 'EEEE, dd MMM', { locale }),
            income: summary.income,
            expense: summary.expense,
          },
          ...sorted.map((tx) => ({ type: 'tx' as const, id: tx.id, tx })),
        ]
      })
  }, [filteredTxs, currency, locale])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const handleNlParse = async (override?: string) => {
    const input = (override ?? nlText).trim()
    if (!input) return
    const provider = useSettingsStore.getState().aiProvider
    const key = await getProviderKey(provider)
    if (!key) { Alert.alert(t.api_key_required, t.no_api_key_msg); return }
    if (override) setNlText(override)
    setParsing(true)
    try {
      const result = await parseUniversalEntry(input)
      if (!result) { Alert.alert(t.ai_error, t.parse_failed); return }
      setOriginalNlText(input)
      setParsedEntry(result)
    } catch { Alert.alert(t.ai_error, t.parse_failed) }
    finally { setParsing(false) }
  }

  const handleNlConfirm = async () => {
    if (!parsedEntry) return
    if (parsedEntry.module !== 'finance') {
      Alert.alert(t.ai_error, t.parse_failed)
      setParsedEntry(null)
      return
    }
    const cat = matchCategory(cats, parsedEntry.category_hint, t)
    if (!cat) { Alert.alert(t.pick_category, t.pick_category_msg); return }
    await createTransaction({
      amount_cents: parsedEntry.direction === 'expense' ? -Math.abs(parsedEntry.amount_cents) : Math.abs(parsedEntry.amount_cents),
      currency,
      category_id: cat.id,
      merchant: parsedEntry.merchant || undefined,
      note: parsedEntry.note || undefined,
      occurred_at: parsedEntry.occurred_at,
      source: 'voice',
    })
    setParsedEntry(null)
    setNlText('')
  }

  const handleNlEdit = () => {
    setParsedEntry(null)
    setNlText('')
    router.push('/new' as any)
  }

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
                {topCategory?.category
                  ? `${topCategory.category.name} / ${formatAmount(topCategory.amount, currency, language)}`
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

            <View style={[styles.commandBar, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
              <TextInput
                value={nlText}
                onChangeText={setNlText}
                placeholder={t.nl_placeholder_finance}
                placeholderTextColor={theme.text.muted}
                style={[styles.commandInput, { color: theme.text.primary, backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
                returnKeyType="done"
                onSubmitEditing={() => handleNlParse()}
                editable={!parsing}
              />
              <VoiceButton onResult={(text) => handleNlParse(text)} disabled={parsing} size={36} module="finance" />
              <Pressable
                onPress={() => handleNlParse()}
                disabled={parsing || !nlText.trim()}
                style={[styles.commandBtn, { backgroundColor: (parsing || !nlText.trim()) ? theme.border.strong : theme.brand.primary }]}
              >
                {parsing
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="send" size={16} color="#fff" />}
              </Pressable>
            </View>

            <View style={styles.analysisRow}>
              {[
                { label: t.nav_reports, icon: 'bar-chart-2' as const, route: '/reports' },
                { label: t.nav_insights, icon: 'activity' as const, route: '/insights' },
                { label: t.nav_chat, icon: 'message-circle' as const, route: '/chat' },
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
                  {item.income > 0 ? <AmountText cents={item.income} currency={currency} showSign={false} color={theme.finance.income} style={styles.dayAmount} /> : null}
                  {item.expense > 0 ? <AmountText cents={item.expense} currency={currency} showSign={false} color={theme.finance.expense} style={styles.dayAmount} /> : null}
                </View>
              </View>
            )
          }
          return (
            <TransactionRow
              tx={item.tx}
              category={catById.get(item.tx.category_id)}
              onPress={() => router.push({ pathname: '/new', params: { id: item.tx.id } } as any)}
              onLongPress={() => remove(item.tx.id)}
            />
          )
        }}
        onEndReached={activePeriod === 'all' && hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          activePeriod === 'all' && (loadingMore || hasMore) ? (
            <View style={styles.footer}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={theme.brand.primary} />
              ) : (
                <Pressable onPress={loadMore} style={[styles.loadMoreBtn, { borderColor: theme.border.subtle }]}>
                  <Text style={{ color: theme.text.secondary, fontSize: 13 }}>Load more</Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={theme.brand.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.brand.primary + '1F' }]}>
                <Feather name="credit-card" size={34} color={theme.brand.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_transactions}</Text>
              <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.tap_to_add}</Text>
              <Pressable
                onPress={() => router.push('/new' as any)}
                style={[styles.emptyBtn, { backgroundColor: theme.brand.primary }]}
              >
                <Text style={styles.emptyBtnText}>{t.nav_new_transaction}</Text>
              </Pressable>
            </View>
          )
        }
      />

      <Pressable
        onPress={() => router.push('/new')}
        accessibilityRole="button"
        accessibilityLabel={t.nav_new_transaction}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </Pressable>

      <Modal visible={!!parsedEntry} transparent animationType="slide" onRequestClose={() => setParsedEntry(null)}>
        <Pressable style={styles.backdrop} onPress={() => setParsedEntry(null)} />
        <View style={[styles.sheet, { backgroundColor: theme.bg.elevated }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.border.strong }]} />
          <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>{t.ai_confirm_title}</Text>

          <View style={[styles.infoRow, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.infoLabel, { color: theme.text.muted }]}>{t.ai_confirm_you_said}</Text>
            <Text style={[styles.infoValue, { color: theme.text.primary }]}>{originalNlText}</Text>
          </View>

          {parsedEntry && parsedEntry.module === 'finance' && (
            <View style={[styles.infoRow, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.infoLabel, { color: theme.text.muted }]}>{t.ai_confirm_parsed}</Text>
              <Text style={[styles.infoValue, { color: theme.text.primary }]}>
                {`${parsedEntry.direction === 'expense' ? '- ' : '+ '}${formatAmount(parsedEntry.amount_cents, currency, language)}${parsedEntry.category_hint ? ' / ' + parsedEntry.category_hint : ''}${parsedEntry.merchant ? ' / ' + parsedEntry.merchant : ''}`}
              </Text>
            </View>
          )}

          <View style={styles.sheetActions}>
            <Pressable
              onPress={handleNlEdit}
              style={[styles.sheetBtn, { backgroundColor: theme.bg.secondary, borderColor: theme.border.strong }]}
            >
              <Text style={[styles.sheetBtnText, { color: theme.text.secondary }]}>{t.nl_reject_to_form}</Text>
            </Pressable>
            <Pressable
              onPress={handleNlConfirm}
              style={[styles.sheetBtn, { backgroundColor: theme.brand.primary }]}
            >
              <Text style={[styles.sheetBtnText, { color: '#fff' }]}>{t.ai_confirm_save}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    gap: spacing[4],
  },
  overviewTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  eyebrow: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[1] },
  netAmount: { fontSize: 28, fontWeight: '800' },
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
  segmentText: { fontSize: 12, fontWeight: '700' },
  commandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  commandInput: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: 14,
  },
  commandBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md },
  analysisRow: { flexDirection: 'row', gap: spacing[2] },
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3],
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing[2] },
  sheetTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  infoRow: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], gap: spacing[1] },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15 },
  sheetActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  sheetBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.md, alignItems: 'center', borderWidth: 1 },
  sheetBtnText: { fontSize: 15, fontWeight: '600' },
})
