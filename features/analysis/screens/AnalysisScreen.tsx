import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { subDays, startOfMonth, subMonths, parseISO } from 'date-fns'
import { useTheme, getCardStyle, type Theme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { isAiAvailable } from '@services/ai/openai'
import { generateCrossModuleInsights } from '@services/ai/crossModuleInsight'
import { useFinanceBootstrap, useTransactions, useCategories, useDebts, usePlanItems } from '@features/finance/hooks/useFinance'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { useJournalsBootstrap, useJournals } from '@features/journals/hooks/useJournals'
import { useRemindersBootstrap, useReminders } from '@features/reminders/hooks/useReminders'
import { listRecentLogs } from '@features/habits/services'
import { calculateSafeToSpend, formatAmount } from '@features/finance/services'
import { translateCategoryName } from '@features/finance/i18n'
import { convertMinorAmount, getRates } from '@services/fx'
import { InsightText } from '@/components/InsightText'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader, ModuleOverview, EmptyState, Sparkle } from '@components/ui'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'

export function AnalysisScreen() {
  useFinanceBootstrap()
  useHabitsBootstrap()
  useJournalsBootstrap()
  useRemindersBootstrap()

  const theme = useTheme()
  const cardStyle = getCardStyle(theme)
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const currency = useSettingsStore((s) => s.currency)
  const cycleStartDay = useSettingsStore((s) => s.financeCycleStartDay)
  const countPlannedIncome = useSettingsStore((s) => s.safeToSpendCountPlannedIncome)
  const countCarryOver = useSettingsStore((s) => s.safeToSpendCarryOver)
  const hideJournals = useSettingsStore((s) => s.hideJournals)

  const transactions = useTransactions()
  const categories = useCategories()
  const debts = useDebts()
  const planItems = usePlanItems()
  const habits = useHabits()
  const journals = useJournals()
  const reminders = useReminders()

  // Mirror ReportsScreen: show amounts in the user's display currency when FX
  // rates are available, falling back to the storage currency otherwise.
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const [fxRates, setFxRates] = useState<Record<string, number> | null>(null)
  useEffect(() => { getRates(displayCurrency).then(setFxRates) }, [displayCurrency])
  const reportCurrency = fxRates ? displayCurrency : currency
  const amountInReportCurrency = useCallback((amount: number, txCurrency: string) => {
    if (txCurrency === reportCurrency) return amount
    if (fxRates) return convertMinorAmount(amount, txCurrency, reportCurrency, fxRates)
    if (txCurrency === currency) return amount
    return null
  }, [currency, reportCurrency, fxRates])

  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    if (!isAiAvailable()) {
      Alert.alert(t.no_api_key, t.no_api_key_msg)
      return
    }

    setLoading(true)
    setResult(null)
    try {
      // Per-day habit logs unlock the kept-vs-missed correlation block; the
      // analysis still works without them if the load fails.
      const logsResult = await listRecentLogs(30)
      const habitLogs = logsResult.ok ? logsResult.value : []
      const text = await generateCrossModuleInsights({ transactions, categories, habits, journals, habitLogs, reminders, planItems, debts })
      setResult(text)
    } catch (e: any) {
      if (e?.message === 'NO_DATA') {
        Alert.alert(t.analysis_no_data, t.analysis_no_data_msg)
      } else {
        Alert.alert(t.ai_error, e?.message ?? 'Unknown error')
      }
    } finally {
      setLoading(false)
    }
  }, [transactions, categories, habits, journals, reminders, planItems, debts, t])

  const moduleCount = [
    transactions.length > 0,
    habits.length > 0,
    journals.length > 0,
  ].filter(Boolean).length

  const highlights = useMemo(() => {
    const today = new Date()
    const from30 = subDays(today, 29)
    const catMap = new Map(categories.map((c) => [c.id, c]))

    const last30Txs = transactions.filter((tx) => {
      const d = parseISO(tx.occurred_at)
      return d >= from30 && d <= today
    })
    const expenseTxs = last30Txs.filter((tx) => tx.amount_cents < 0)
    let totalExpense = 0
    const catTotals = new Map<string, number>()
    for (const tx of expenseTxs) {
      const amount = amountInReportCurrency(tx.amount_cents, tx.currency)
      if (amount === null) continue
      const abs = Math.abs(amount)
      totalExpense += abs
      // An income-kind category on a negative tx is a mis-categorization; don't
      // let it surface as "top spending" (e.g. "Other Income" as biggest expense).
      const cat = catMap.get(tx.category_id)
      if (cat?.kind === 'income') continue
      catTotals.set(tx.category_id, (catTotals.get(tx.category_id) ?? 0) + abs)
    }
    let topCatId = ''
    let topCatAmt = 0
    for (const [id, amt] of catTotals) {
      if (amt > topCatAmt) { topCatAmt = amt; topCatId = id }
    }
    const topCat = topCatId ? catMap.get(topCatId) : null

    const bestStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0

    const last30Journals = journals.filter((j) => {
      const d = parseISO(j.occurred_at)
      return d >= from30 && d <= today
    })
    const moodEntries = hideJournals ? [] : last30Journals.filter((j) => j.mood !== null)
    const avgMood = moodEntries.length > 0
      ? moodEntries.reduce((s, j) => s + (j.mood ?? 0), 0) / moodEntries.length
      : null
    const safeToSpend = calculateSafeToSpend({
      transactions,
      categories,
      planItems,
      debts,
      currency: reportCurrency,
      fxRates,
      cycleStartDay,
      countPlannedIncome,
      countCarryOver,
      now: today,
    })

    return { totalExpense, topCat, bestStreak, journalCount: last30Journals.length, avgMood, safeToSpend: safeToSpend.safeToSpend }
  }, [transactions, categories, planItems, debts, habits, journals, reportCurrency, fxRates, cycleStartDay, countPlannedIncome, countCarryOver, amountInReportCurrency, hideJournals])

  const comparison = useMemo(() => {
    // Compare like-for-like: month-to-date vs the SAME elapsed window last month.
    // `subMonths(today, 1)` keeps the same wall-clock moment one month earlier, so
    // we never pit a partial month against a full one (which always read as a drop).
    const today = new Date()
    const thisStart = startOfMonth(today)
    const lastTo = subMonths(today, 1)
    const lastStart = startOfMonth(lastTo)

    const sumExpense = (from: Date, to: Date) => {
      let total = 0
      for (const tx of transactions) {
        if (tx.amount_cents >= 0) continue
        const d = parseISO(tx.occurred_at)
        if (d < from || d > to) continue
        const amount = amountInReportCurrency(tx.amount_cents, tx.currency)
        if (amount === null) continue
        total += Math.abs(amount)
      }
      return total
    }

    const avgMoodIn = (from: Date, to: Date) => {
      if (hideJournals) return null
      const moods = journals.filter((j) => {
        const d = parseISO(j.occurred_at)
        return d >= from && d <= to && j.mood !== null
      })
      return moods.length > 0 ? moods.reduce((s, j) => s + (j.mood ?? 0), 0) / moods.length : null
    }

    const thisExp = sumExpense(thisStart, today)
    const lastExp = sumExpense(lastStart, lastTo)
    const thisAvgMood = avgMoodIn(thisStart, today)
    const lastAvgMood = avgMoodIn(lastStart, lastTo)

    const expDelta = lastExp > 0 ? Math.round(((thisExp - lastExp) / lastExp) * 100) : undefined
    const moodDelta = lastAvgMood && lastAvgMood > 0
      ? Math.round(((thisAvgMood ?? 0) - lastAvgMood) / lastAvgMood * 100) : undefined

    return {
      thisExp, lastExp, expDelta,
      thisAvgMood, lastAvgMood, moodDelta,
      hasFinance: thisExp > 0 || lastExp > 0,
      hasMood: thisAvgMood !== null || lastAvgMood !== null,
    }
  }, [transactions, journals, categories, amountInReportCurrency, hideJournals])

  const hasData = moduleCount > 0
  const hasComparison = comparison.hasFinance || comparison.hasMood

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[2] }]}>
        <AppHeader subtitle={t.nav_insights} onBack={router.canGoBack() ? () => router.back() : undefined} onSettings={() => router.push('/settings')} />
        <ModuleOverview
          eyebrow={t.report_snapshot}
          value={t.analysis_subtitle}
          subtitle={moduleCount >= 2 ? t.analysis_patterns : t.analysis_no_data_msg}
          icon="cpu"
          accent={theme.brand.primary}
          stats={[
            { key: 'finance', label: t.nav_finance, value: transactions.length > 0 ? String(transactions.length) : '-', color: theme.finance.income },
            { key: 'habits', label: t.nav_habits, value: habits.length > 0 ? String(habits.length) : '-', color: theme.brand.accent },
            { key: 'journal', label: t.nav_journal, value: journals.length > 0 ? String(journals.length) : '-', color: theme.brand.primary },
          ]}
        />
        {/* Highlights — last 30 days summary */}
        {hasData && (
          <View style={[styles.card, cardStyle, { backgroundColor: theme.bg.elevated }]}>
            <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.analysis_highlights}</Text>
            <View style={styles.highlightGrid}>
              {transactions.length > 0 && (
                <>
                  <HighlightItem
                    icon={MODULE_ICONS.finance}
                    color={MODULE_COLORS.finance}
                    label={t.expense}
                    value={formatAmount(highlights.totalExpense, reportCurrency, language)}
                    theme={theme}
                  />
                  <HighlightItem
                    icon="folder"
                    color={MODULE_COLORS.finance}
                    label={t.analysis_top_spending}
                    value={highlights.topCat ? translateCategoryName(highlights.topCat, t) : '—'}
                    theme={theme}
                  />
                </>
              )}
              {transactions.length > 0 && (
                <HighlightItem
                  icon="shield"
                  color={MODULE_COLORS.finance}
                  label={t.safe_to_spend}
                  value={`${highlights.safeToSpend < 0 ? '-' : ''}${formatAmount(highlights.safeToSpend, reportCurrency, language)}`}
                  theme={theme}
                />
              )}
              {habits.length > 0 && (
                <HighlightItem
                  icon={MODULE_ICONS.habits}
                  color={MODULE_COLORS.habits}
                  label={t.report_current_streak}
                  value={`${highlights.bestStreak} ${t.report_days}`}
                  theme={theme}
                />
              )}
              {journals.length > 0 && (
                <HighlightItem
                  icon={MODULE_ICONS.journal}
                  color={MODULE_COLORS.journal}
                  label={t.nav_journal}
                  value={
                    highlights.journalCount > 0
                      ? hideJournals
                        ? t.hide_journals_locked_count.replace('{{count}}', String(highlights.journalCount))
                        : `${highlights.journalCount} ${t.report_entries}${highlights.avgMood ? `  ·  ${highlights.avgMood.toFixed(1)} ★` : ''}`
                      : '—'
                  }
                  theme={theme}
                />
              )}
            </View>
          </View>
        )}

        {/* Comparison — this month vs last month */}
        {hasComparison && (
          <View style={[styles.card, cardStyle, { backgroundColor: theme.bg.elevated }]}>
            <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.analysis_vs_last_month}</Text>
            {comparison.hasFinance && (
              <CompRow
                label={t.expense}
                value={formatAmount(comparison.thisExp, reportCurrency, language)}
                delta={comparison.expDelta}
                deltaPositive={false}
                theme={theme}
              />
            )}
            {comparison.hasMood && (
              <CompRow
                label={t.report_avg_mood}
                value={comparison.thisAvgMood ? `${comparison.thisAvgMood.toFixed(1)} ★` : '—'}
                delta={comparison.moodDelta}
                deltaPositive={true}
                theme={theme}
              />
            )}
          </View>
        )}

        {/* AI Patterns */}
        {result ? (
          <View style={[styles.card, cardStyle, { backgroundColor: theme.bg.elevated }]}>
            <View style={styles.cardHeader}>
              <Sparkle size={12} color={theme.brand.primary} />
              <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.analysis_patterns}</Text>
            </View>
            <InsightText text={result} />
          </View>
        ) : !loading ? (
          hasData ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.analysis_subtitle}</Text>
              {moduleCount < 2 && (
                <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.analysis_no_data_msg}</Text>
              )}
            </View>
          ) : (
            <EmptyState
              icon="cpu"
              accent={MODULE_COLORS.analysis}
              title={t.analysis_title}
              body={moduleCount < 2 ? t.analysis_no_data_msg : undefined}
            />
          )
        ) : (
          <View style={styles.spinner}>
            <ActivityIndicator size="large" color={theme.brand.primary} />
            <Text style={[styles.emptyBody, { color: theme.text.muted, marginTop: spacing[3] }]}>{t.generating}</Text>
          </View>
        )}
      </ScrollView>

      {/* Opaque backdrop behind the translucent status bar so scrolled content
          doesn't collide with the system clock when this screen is shown as a
          tab (no native header). A no-op when pushed with a native header. */}
      <View
        pointerEvents="none"
        style={[styles.statusScrim, { height: insets.top, backgroundColor: theme.bg.primary }]}
      />

      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated, paddingBottom: spacing[4] + insets.bottom }]}>
        <Pressable
          onPress={run}
          disabled={loading}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: loading ? theme.text.muted : theme.brand.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={theme.brand.onPrimary} />
          ) : (
            <Text style={[styles.btnText, { color: theme.brand.onPrimary }]}>{result ? t.refresh : t.analysis_generate}</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function HighlightItem({ icon, color, label, value, theme }: { icon: keyof typeof Feather.glyphMap; color: string; label: string; value: string; theme: Theme }) {
  return (
    <View style={styles.highlightItem}>
      <View style={[styles.highlightIconWrap, { backgroundColor: color + '1F' }]}>
        <Feather name={icon} size={15} color={color} />
      </View>
      <Text style={[styles.highlightLabel, { color: theme.text.muted }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.highlightValue, { color: theme.text.primary }]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

function CompRow({
  label, value, delta, deltaPositive, theme,
}: {
  label: string; value: string; delta?: number; deltaPositive: boolean; theme: Theme
}) {
  const improved = deltaPositive ? (delta ?? 0) > 0 : (delta ?? 0) < 0
  const deltaColor = delta === undefined || delta === 0
    ? theme.text.muted
    : improved ? theme.semantic.success : theme.semantic.danger

  return (
    <View style={styles.compRow}>
      <Text style={[styles.compLabel, { color: theme.text.secondary }]}>{label}</Text>
      <Text style={[styles.compValue, { color: theme.text.primary }]}>{value}</Text>
      {delta !== undefined && delta !== 0 && (
        <View style={[styles.deltaBadge, { backgroundColor: deltaColor + '22' }]}>
          <Text style={[styles.deltaText, { color: deltaColor }]}>
            {delta > 0 ? `+${delta}%` : `${delta}%`}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  radarStats: { gap: spacing[2] },
  radarMetricRow: { flexDirection: 'row', gap: spacing[2] },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
  },
  sectionLabel: { fontSize: 12, fontWeight: '600' },
  highlightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  highlightItem: { flex: 1, minWidth: '40%', gap: 2 },
  highlightIconWrap: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  highlightLabel: { fontSize: 12, marginTop: 2 },
  highlightValue: { fontSize: 14, fontWeight: '600' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  compLabel: { flex: 1, fontSize: 13 },
  compValue: { fontSize: 13, fontWeight: '600' },
  deltaBadge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  deltaText: { fontSize: 12, fontWeight: '600' },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing[6] },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: spacing[2], textAlign: 'center' },
  emptyBody: { fontSize: 13, textAlign: 'center', paddingHorizontal: spacing[4] },
  spinner: { alignItems: 'center', paddingTop: spacing[6] },
  footer: { padding: spacing[4], borderTopWidth: StyleSheet.hairlineWidth },
  btn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
