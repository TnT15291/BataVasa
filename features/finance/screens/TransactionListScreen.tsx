import { View, Text, Pressable, StyleSheet, RefreshControl, ActivityIndicator, TextInput, Modal, Alert } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useMemo, useState, useCallback, useEffect } from 'react'
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
import { useSettingsStore } from '@store/settingsStore'
import { getRates, convertCents } from '@services/fx'
import { parseUniversalEntry, type UniversalEntry } from '@services/ai/universalEntry'
import { getProviderKey } from '@services/ai/openai'
import { matchCategory } from '@features/finance/i18n'
import { formatAmount } from '@features/finance/services'
import { VoiceButton } from '@components/VoiceButton'
import { useFinanceStore } from '@store/financeStore'

type Period = 'today' | 'week' | 'month' | 'all'
type CurrencyTotals = { income: number; expense: number }
type PeriodTotals = Map<string, CurrencyTotals>

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
  const createTransaction = useFinanceStore((s) => s.createTransaction)
  const [refreshing, setRefreshing] = useState(false)
  const [activePeriod, setActivePeriod] = useState<Period>('today')
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const currency = useSettingsStore((s) => s.currency)
  const language = useSettingsStore((s) => s.language)

  const [nlText, setNlText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsedEntry, setParsedEntry] = useState<UniversalEntry | null>(null)
  const [originalNlText, setOriginalNlText] = useState('')

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

  // When FX rates are available and displayCurrency is set, merge multi-currency totals into one
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
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={row.label}
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
                {data.size === 0 ? (
                  <Text style={{ color: theme.text.muted, fontSize: 13 }}>—</Text>
                ) : displayTotals[row.key] ? (
                  <View style={styles.periodCurrencyLine}>
                    {displayTotals[row.key]!.mixed && (
                      <Text style={{ color: theme.text.muted, fontSize: 10 }}>≈</Text>
                    )}
                    <AmountText
                      cents={displayTotals[row.key]!.income}
                      currency={displayCurrency}
                      showSign={false}
                      color={theme.finance.income}
                      style={{ fontSize: 13 }}
                    />
                    <Text style={{ color: theme.text.muted, fontSize: 12 }}>·</Text>
                    <AmountText
                      cents={displayTotals[row.key]!.expense}
                      currency={displayCurrency}
                      showSign={false}
                      color={theme.finance.expense}
                      style={{ fontSize: 13 }}
                    />
                  </View>
                ) : (
                  Array.from(data.entries()).map(([cur, td]) => (
                    <View key={cur} style={styles.periodCurrencyLine}>
                      <AmountText
                        cents={td.income}
                        currency={cur}
                        showSign={false}
                        color={theme.finance.income}
                        style={{ fontSize: 13 }}
                      />
                      <Text style={{ color: theme.text.muted, fontSize: 12 }}>·</Text>
                      <AmountText
                        cents={td.expense}
                        currency={cur}
                        showSign={false}
                        color={theme.finance.expense}
                        style={{ fontSize: 13 }}
                      />
                    </View>
                  ))
                )}
              </View>
            </Pressable>
          )
        })}
      </View>

      <View style={[styles.nlRow, { backgroundColor: theme.bg.secondary, borderBottomColor: theme.border.subtle }]}>
        <TextInput
          value={nlText}
          onChangeText={setNlText}
          placeholder={t.nl_placeholder_finance}
          placeholderTextColor={theme.text.muted}
          style={[styles.nlInput, { color: theme.text.primary, backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
          returnKeyType="done"
          onSubmitEditing={() => handleNlParse()}
          editable={!parsing}
        />
        <VoiceButton onResult={(text) => handleNlParse(text)} disabled={parsing} size={36} module="finance" />
        <Pressable
          onPress={() => handleNlParse()}
          disabled={parsing || !nlText.trim()}
          style={[styles.nlBtn, { backgroundColor: (parsing || !nlText.trim()) ? theme.border.strong : theme.brand.primary }]}
        >
          {parsing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.nlBtnText}>{t.parse_btn}</Text>}
        </Pressable>
      </View>

      <View style={styles.aiRow}>
        <Pressable
          onPress={() => router.push('/reports' as any)}
          accessibilityRole="button"
          accessibilityLabel={t.finance_report_title}
          style={({ pressed }) => [
            styles.aiBtn,
            styles.aiBtnFull,
            {
              backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
              borderColor: theme.border.subtle,
            },
          ]}
        >
          <Text style={styles.aiBtnIcon}>📊</Text>
          <Text style={[styles.aiBtnLabel, { color: theme.text.secondary }]}>{t.finance_report_title}</Text>
        </Pressable>
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
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_transactions}</Text>
              <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.tap_to_add}</Text>
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
        <Text style={styles.fabIcon}>+</Text>
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
                {`${parsedEntry.direction === 'expense' ? '- ' : '+ '}${formatAmount(parsedEntry.amount_cents, currency, language)}${parsedEntry.category_hint ? ' · ' + parsedEntry.category_hint : ''}${parsedEntry.merchant ? ' · ' + parsedEntry.merchant : ''}`}
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
  periodAmounts: { flexDirection: 'column', alignItems: 'flex-end', gap: spacing[1] },
  periodCurrencyLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
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
  aiBtnFull: { flex: 0, flexDirection: 'row', width: '100%', justifyContent: 'center', gap: spacing[2] },
  aiBtnIcon: { fontSize: 18 },
  aiBtnLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  empty: { alignItems: 'center', marginTop: spacing[12] },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[8] },
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
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '600', lineHeight: 30 },
  nlRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nlInput: {
    flex: 1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontSize: 14,
  },
  nlBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md },
  nlBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
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
