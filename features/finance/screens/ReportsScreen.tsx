import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  addWeeks, subWeeks,
  addMonths, subMonths,
  addQuarters, subQuarters,
  addYears, subYears,
  format, parseISO, isValid,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
} from 'date-fns'
import { useTheme, type Theme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation, type Translations } from '@services/i18n'
import { useFinanceBootstrap, useTransactions, useCategories } from '../hooks/useFinance'
import { translateCategoryName } from '../i18n'
import type { Category } from '../types'
import { generateReport, type ReportType } from '@services/ai/reports'
import { getDateFnsLocale } from '@services/locale'
import { useSettingsStore } from '@store/settingsStore'
import { getProviderKey } from '@services/ai/openai'
import { track } from '@services/analytics'
import { convertMinorAmount, getRates } from '@services/fx'
import { formatAmount } from '../services'
import { InsightText } from '@/components/InsightText'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Period = ReportType
type ChartBucket = { key: string; label: string; from: Date; to: Date; income: number; expense: number }

type CatBreakdownItem = { cat: Category | undefined; amount: number }

function getCategoryIconName(icon: string | undefined): string {
  if (!icon) return 'circle'
  if (icon === 'utensils') return 'coffee'
  return icon
}

function CategoryBreakdownCard({
  breakdown, totalExpense, currency, language, theme, t,
}: {
  breakdown: CatBreakdownItem[]
  totalExpense: number
  currency: string
  language: string
  theme: Theme
  t: Translations
}) {
  if (breakdown.length === 0 || totalExpense === 0) return null
  return (
    <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
      <View style={styles.snapshotHeader}>
        <Text style={[styles.snapshotTitle, { color: theme.text.primary }]}>{t.report_category_breakdown}</Text>
        <Text style={[styles.snapshotMeta, { color: theme.text.muted }]}>{t.expense}</Text>
      </View>
      <View style={[styles.stackedBar, { backgroundColor: theme.bg.secondary }]}>
        {breakdown.map((item) => (
          <View
            key={item.cat?.id ?? 'others'}
            style={{ flex: item.amount / totalExpense, height: '100%', backgroundColor: item.cat?.color ?? theme.text.muted }}
          />
        ))}
      </View>
      {breakdown.map((item) => {
        const pct = Math.round((item.amount / totalExpense) * 100)
        const color = item.cat?.color ?? theme.text.muted
        const name = item.cat
          ? item.cat.kind === 'income' ? `${t.expense} (${t.review_queue})` : translateCategoryName(item.cat, t)
          : t.category_others
        return (
          <View key={item.cat?.id ?? 'others'} style={styles.catRow}>
            <View style={[styles.catIconWrap, { backgroundColor: color + '20' }]}>
              <Feather name={getCategoryIconName(item.cat?.icon) as any} size={16} color={color} />
            </View>
            <View style={styles.catBody}>
              <View style={styles.catNameRow}>
                <Text style={[styles.catName, { color: theme.text.primary }]} numberOfLines={1}>{name}</Text>
                <Text style={[styles.catAmount, { color: theme.text.secondary }]}>
                  {formatAmount(item.amount, currency, language)}
                </Text>
              </View>
              <View style={[styles.catBarTrack, { backgroundColor: theme.bg.secondary }]}>
                <View style={[styles.catBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
              </View>
            </View>
            <Text style={[styles.catPct, { color: theme.text.muted }]}>{pct}%</Text>
          </View>
        )
      })}
    </View>
  )
}

function StatCard({
  label, value, delta, deltaPositive = true, theme,
}: {
  label: string; value: string; delta?: number; deltaPositive?: boolean; theme: Theme
}) {
  const showDelta = delta !== undefined && delta !== 0
  const isGood = deltaPositive ? (delta ?? 0) >= 0 : (delta ?? 0) <= 0
  const sign = (delta ?? 0) >= 0 ? '+' : ''
  return (
    <View style={[styles.statCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
      <Text style={[styles.statValue, { color: theme.text.primary }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {showDelta ? (
        <Text style={[styles.deltaBadge, { color: isGood ? theme.semantic.success : theme.semantic.danger }]}>
          {sign}{delta}%
        </Text>
      ) : null}
      <Text style={[styles.statLabel, { color: theme.text.muted }]}>{label}</Text>
    </View>
  )
}

function NavRow({
  label,
  onPrev,
  onNext,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
}) {
  const theme = useTheme()
  return (
    <View style={styles.navRow}>
      <Pressable onPress={onPrev} hitSlop={8} style={styles.navBtn}>
        <Text style={[styles.navArrow, { color: theme.brand.primary }]}>‹</Text>
      </Pressable>
      <Text style={[styles.navLabel, { color: theme.text.primary }]}>{label}</Text>
      <Pressable onPress={onNext} hitSlop={8} style={styles.navBtn}>
        <Text style={[styles.navArrow, { color: theme.brand.primary }]}>›</Text>
      </Pressable>
    </View>
  )
}

export function ReportsScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useTranslation()
  const allTxs = useTransactions()
  const cats = useCategories()
  const language = useSettingsStore((s) => s.language)
  const currency = useSettingsStore((s) => s.currency)
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const aiProvider = useSettingsStore((s) => s.aiProvider)
  const dfLocale = getDateFnsLocale(language)

  const [hasApiKey, setHasApiKey] = useState(false)
  const [keyChecked, setKeyChecked] = useState(false)
  const [period, setPeriod] = useState<Period>('monthly')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null)
  const [kindFilter, setKindFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fxRates, setFxRates] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    getProviderKey(aiProvider).then((k) => {
      setHasApiKey(!!k)
      setKeyChecked(true)
    })
  }, [aiProvider])

  useEffect(() => {
    getRates(displayCurrency).then(setFxRates)
  }, [displayCurrency])

  const onPeriodChange = (p: Period) => {
    setPeriod(p)
    setReport(null)
  }

  const customFromDate = useMemo(() => {
    const d = parseISO(customFrom)
    return isValid(d) ? d : new Date()
  }, [customFrom])

  const customToDate = useMemo(() => {
    const d = parseISO(customTo)
    return isValid(d) ? d : new Date()
  }, [customTo])

  const setCustomDate = (target: 'from' | 'to', date: Date) => {
    const value = format(date, 'yyyy-MM-dd')
    if (target === 'from') setCustomFrom(value)
    else setCustomTo(value)
    setReport(null)
  }

  // Compute date range from current selection
  const getRange = useCallback((): { from: Date; to: Date; label: string } | null => {
    if (period === 'weekly') {
      const from = startOfWeek(anchorDate, { weekStartsOn: 1 })
      const to = endOfWeek(anchorDate, { weekStartsOn: 1 })
      return {
        from,
        to,
        label: `${format(from, 'dd/MM', { locale: dfLocale })} – ${format(to, 'dd/MM/yyyy', { locale: dfLocale })}`,
      }
    }
    if (period === 'monthly') {
      const from = startOfMonth(anchorDate)
      const to = endOfMonth(anchorDate)
      return { from, to, label: format(anchorDate, 'MMMM yyyy', { locale: dfLocale }) }
    }
    if (period === 'quarterly') {
      const from = startOfQuarter(anchorDate)
      const to = endOfQuarter(anchorDate)
      const quarter = Math.floor(anchorDate.getMonth() / 3) + 1
      return { from, to, label: `Q${quarter} ${format(anchorDate, 'yyyy', { locale: dfLocale })}` }
    }
    if (period === 'yearly') {
      const from = startOfYear(anchorDate)
      const to = endOfYear(anchorDate)
      return { from, to, label: format(anchorDate, 'yyyy', { locale: dfLocale }) }
    }
    // custom
    const from = parseISO(customFrom)
    const to = parseISO(customTo)
    if (!isValid(from) || !isValid(to) || from > to) return null
    return { from, to, label: `${customFrom} – ${customTo}` }
  }, [period, anchorDate, customFrom, customTo, dfLocale])

  const navigate = (dir: 1 | -1) => {
    setReport(null)
    if (period === 'weekly') setAnchorDate((d) => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1))
    else if (period === 'monthly') setAnchorDate((d) => dir === 1 ? addMonths(d, 1) : subMonths(d, 1))
    else if (period === 'quarterly') setAnchorDate((d) => dir === 1 ? addQuarters(d, 1) : subQuarters(d, 1))
    else if (period === 'yearly') setAnchorDate((d) => dir === 1 ? addYears(d, 1) : subYears(d, 1))
  }

  const range = getRange()
  const reportCurrency = fxRates ? displayCurrency : currency
  const rangeTxs = useMemo(() => {
    if (!range) return []
    const fromIso = range.from.toISOString()
    const toIso = range.to.toISOString()
    return allTxs.filter((tx) => {
      if (tx.occurred_at < fromIso || tx.occurred_at > toIso) return false
      if (kindFilter === 'income') return tx.amount_cents > 0
      if (kindFilter === 'expense') return tx.amount_cents < 0
      return true
    })
  }, [allTxs, range?.from, range?.to, kindFilter])

  const amountInReportCurrency = useCallback((amount: number, txCurrency: string) => {
    if (txCurrency === reportCurrency) return amount
    if (fxRates) return convertMinorAmount(amount, txCurrency, reportCurrency, fxRates)
    if (txCurrency === currency) return amount
    return null
  }, [currency, reportCurrency, fxRates])

  const summary = useMemo(() => {
    let income = 0
    let expense = 0
    for (const tx of rangeTxs) {
      const amount = amountInReportCurrency(tx.amount_cents, tx.currency)
      if (amount === null) continue
      if (amount > 0) income += amount
      else expense += Math.abs(amount)
    }
    return { count: rangeTxs.length, income, expense }
  }, [rangeTxs, amountInReportCurrency])
  const hasRangeData = summary.count > 0

  const prevSummary = useMemo(() => {
    if (period === 'custom') return null
    const prevAnchor =
      period === 'weekly' ? subWeeks(anchorDate, 1)
      : period === 'monthly' ? subMonths(anchorDate, 1)
      : period === 'quarterly' ? subQuarters(anchorDate, 1)
      : subYears(anchorDate, 1)
    let prevFrom: Date, prevTo: Date
    if (period === 'weekly') {
      prevFrom = startOfWeek(prevAnchor, { weekStartsOn: 1 })
      prevTo = endOfWeek(prevAnchor, { weekStartsOn: 1 })
    } else if (period === 'monthly') {
      prevFrom = startOfMonth(prevAnchor)
      prevTo = endOfMonth(prevAnchor)
    } else if (period === 'quarterly') {
      prevFrom = startOfQuarter(prevAnchor)
      prevTo = endOfQuarter(prevAnchor)
    } else {
      prevFrom = startOfYear(prevAnchor)
      prevTo = endOfYear(prevAnchor)
    }
    const fromIso = prevFrom.toISOString()
    const toIso = prevTo.toISOString()
    const prevTxs = allTxs.filter((tx) => tx.occurred_at >= fromIso && tx.occurred_at <= toIso)
    let income = 0, expense = 0
    for (const tx of prevTxs) {
      const amount = amountInReportCurrency(tx.amount_cents, tx.currency)
      if (amount === null) continue
      if (amount > 0) income += amount
      else expense += Math.abs(amount)
    }
    return { count: prevTxs.length, income, expense }
  }, [period, anchorDate, allTxs, amountInReportCurrency])

  const calcDelta = (cur: number, prev: number): number | undefined =>
    prev === 0 ? undefined : Math.round(((cur - prev) / Math.abs(prev)) * 100)

  const categoryBreakdown = useMemo<CatBreakdownItem[]>(() => {
    const catMap = new Map<string, CatBreakdownItem>()
    for (const tx of rangeTxs) {
      if (tx.amount_cents >= 0) continue
      const amount = Math.abs(amountInReportCurrency(tx.amount_cents, tx.currency) ?? 0)
      if (amount === 0) continue
      const existing = catMap.get(tx.category_id)
      if (existing) existing.amount += amount
      else catMap.set(tx.category_id, { amount, cat: cats.find((c) => c.id === tx.category_id) })
    }
    const sorted = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount)
    const top = sorted.slice(0, 5)
    const othersAmount = sorted.slice(5).reduce((s, x) => s + x.amount, 0)
    if (othersAmount > 0) top.push({ amount: othersAmount, cat: undefined })
    return top
  }, [rangeTxs, cats, amountInReportCurrency])

  const chartBuckets = useMemo<ChartBucket[]>(() => {
    if (!range) return []
    const makeBucket = (from: Date, to: Date, label: string, key: string): ChartBucket => {
      let income = 0
      let expense = 0
      for (const tx of rangeTxs) {
        const d = new Date(tx.occurred_at)
        if (d < from || d > to) continue
        const amount = amountInReportCurrency(tx.amount_cents, tx.currency)
        if (amount === null) continue
        if (amount > 0) income += amount
        else expense += Math.abs(amount)
      }
      return { key, label, from, to, income, expense }
    }

    if (period === 'weekly') {
      return eachDayOfInterval({ start: range.from, end: range.to })
        .map((d) => makeBucket(startOfDay(d), endOfDay(d), format(d, 'EEE', { locale: dfLocale }), format(d, 'yyyy-MM-dd')))
    }
    if (period === 'monthly') {
      return eachDayOfInterval({ start: range.from, end: range.to })
        .map((d) => makeBucket(startOfDay(d), endOfDay(d), format(d, 'd', { locale: dfLocale }), format(d, 'yyyy-MM-dd')))
    }
    if (period === 'quarterly') {
      return eachWeekOfInterval({ start: range.from, end: range.to }, { weekStartsOn: 1 })
        .map((d, i) => makeBucket(startOfWeek(d, { weekStartsOn: 1 }), endOfWeek(d, { weekStartsOn: 1 }), `W${i + 1}`, format(d, 'yyyy-MM-dd')))
    }
    if (period === 'yearly') {
      return eachMonthOfInterval({ start: range.from, end: range.to })
        .map((d) => makeBucket(startOfMonth(d), endOfMonth(d), format(d, 'MMM', { locale: dfLocale }), format(d, 'yyyy-MM')))
    }

    const days = Math.ceil((range.to.getTime() - range.from.getTime()) / 86400000) + 1
    if (days <= 45) {
      return eachDayOfInterval({ start: range.from, end: range.to })
        .map((d) => makeBucket(startOfDay(d), endOfDay(d), format(d, 'dd/MM', { locale: dfLocale }), format(d, 'yyyy-MM-dd')))
    }
    return eachMonthOfInterval({ start: range.from, end: range.to })
      .map((d) => makeBucket(startOfMonth(d), endOfMonth(d), format(d, 'MMM yy', { locale: dfLocale }), format(d, 'yyyy-MM')))
  }, [range?.from, range?.to, rangeTxs, period, dfLocale, amountInReportCurrency])

  const chartMax = Math.max(...chartBuckets.map((b) => Math.max(b.income, b.expense)), 1)

  const generate = useCallback(async () => {
    const range = getRange()
    if (!range) {
      Alert.alert(t.invalid_date_range, '')
      return
    }
    const { from, to, label } = range
    const filtered = rangeTxs

    setLoading(true)
    setReport(null)
    try {
      const text = await generateReport(filtered, cats, label, period)
      setReport(text)
      track('report_generated', { module: 'finance', kind: period, item_count: filtered.length })
    } catch (e: any) {
      if (e?.message === 'NO_API_KEY') {
        setHasApiKey(false)
      } else if (e?.message === 'NO_DATA') {
        Alert.alert(t.no_insights, t.no_insights_msg)
      } else {
        Alert.alert(t.ai_error, e?.message ?? 'Unknown error')
      }
    } finally {
      setLoading(false)
    }
  }, [getRange, rangeTxs, cats, period, t, router])

  const shareReport = useCallback(async () => {
    if (!report) return
    try {
      await Share.share({ message: report })
    } catch {
      /* user cancelled or share unavailable — silent */
    }
  }, [report])

  const TABS: { key: Period; label: string }[] = [
    { key: 'weekly', label: t.weekly },
    { key: 'monthly', label: t.monthly },
    { key: 'quarterly', label: t.quarterly },
    { key: 'yearly', label: t.yearly },
    { key: 'custom_range' as any, label: t.custom_range },
  ].map((x) => ({ key: x.key === ('custom_range' as any) ? 'custom' : x.key, label: x.label })) as { key: Period; label: string }[]

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      {/* Period tabs */}
      <View style={[styles.tabs, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        {TABS.map(({ key, label }) => {
          const active = period === key
          return (
            <Pressable
              key={key}
              onPress={() => onPeriodChange(key)}
              style={[styles.tab, { borderBottomColor: active ? theme.brand.primary : 'transparent' }]}
            >
              <Text style={[styles.tabText, { color: active ? theme.brand.primary : theme.text.secondary }]}>
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Date navigator */}
      <View style={[styles.dateBar, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
        {period !== 'custom' ? (
          <NavRow
            label={range ? range.label : ''}
            onPrev={() => navigate(-1)}
            onNext={() => navigate(1)}
          />
        ) : (
          <View style={styles.customRow}>
            <View style={styles.customField}>
              <Text style={[styles.customLabel, { color: theme.text.muted }]}>{t.from_date}</Text>
              <Pressable
                onPress={() => setDatePickerTarget('from')}
                style={[styles.dateInput, { borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
              >
                <Text style={[styles.dateInputText, { color: customFrom ? theme.text.primary : theme.text.muted }]}>
                  {customFrom || t.date_hint}
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.dateSep, { color: theme.text.muted }]}>→</Text>
            <View style={styles.customField}>
              <Text style={[styles.customLabel, { color: theme.text.muted }]}>{t.to_date}</Text>
              <Pressable
                onPress={() => setDatePickerTarget('to')}
                style={[styles.dateInput, { borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
              >
                <Text style={[styles.dateInputText, { color: customTo ? theme.text.primary : theme.text.muted }]}>
                  {customTo || t.date_hint}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {datePickerTarget && (
        <DateTimePicker
          value={datePickerTarget === 'from' ? customFromDate : customToDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, selectedDate) => {
            if (Platform.OS !== 'ios') setDatePickerTarget(null)
            if (event.type === 'dismissed' || !selectedDate) return
            setCustomDate(datePickerTarget, selectedDate)
          }}
        />
      )}

      {/* Report content */}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsGrid}>
          <StatCard
            label={t.report_entries}
            value={String(summary.count)}
            delta={prevSummary ? calcDelta(summary.count, prevSummary.count) : undefined}
            theme={theme}
          />
          <StatCard
            label={t.income}
            value={formatAmount(summary.income, reportCurrency, language)}
            delta={prevSummary ? calcDelta(summary.income, prevSummary.income) : undefined}
            theme={theme}
          />
          <StatCard
            label={t.expense}
            value={formatAmount(summary.expense, reportCurrency, language)}
            delta={prevSummary ? calcDelta(summary.expense, prevSummary.expense) : undefined}
            deltaPositive={false}
            theme={theme}
          />
        </View>
        <View style={[styles.snapshotCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.snapshotHeader}>
            <Text style={[styles.snapshotTitle, { color: theme.text.primary }]}>{t.report_snapshot}</Text>
            <Text style={[styles.snapshotMeta, { color: theme.text.muted }]}>{range ? range.label : t.custom_range}</Text>
          </View>
          <View style={styles.legendRow}>
            {kindFilter !== 'expense' ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.finance.income }]} />
                <Text style={[styles.legendText, { color: theme.text.muted }]}>{t.income}</Text>
              </View>
            ) : null}
            {kindFilter !== 'income' ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.finance.expense }]} />
                <Text style={[styles.legendText, { color: theme.text.muted }]}>{t.expense}</Text>
              </View>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.columnChart}
          >
            {chartBuckets.map((bucket) => {
              const incomeHeight = bucket.income === 0 ? 0 : Math.max(6, (bucket.income / chartMax) * 100)
              const expenseHeight = bucket.expense === 0 ? 0 : Math.max(6, (bucket.expense / chartMax) * 100)
              return (
                <View key={bucket.key} style={styles.columnItem}>
                  <View style={styles.columnBars}>
                    {kindFilter !== 'expense' ? (
                      <View style={[styles.columnTrack, { backgroundColor: theme.bg.secondary }]}>
                        <View style={[styles.columnBar, { height: `${incomeHeight}%`, backgroundColor: theme.finance.income }]} />
                      </View>
                    ) : null}
                    {kindFilter !== 'income' ? (
                      <View style={[styles.columnTrack, { backgroundColor: theme.bg.secondary }]}>
                        <View style={[styles.columnBar, { height: `${expenseHeight}%`, backgroundColor: theme.finance.expense }]} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.columnLabel, { color: theme.text.muted }]} numberOfLines={1}>
                    {bucket.label}
                  </Text>
                </View>
              )
            })}
          </ScrollView>
        </View>
        <View style={styles.filterRow}>
          {(['all', 'income', 'expense'] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => { setKindFilter(key); setReport(null) }}
              style={[styles.filterPill, { backgroundColor: kindFilter === key ? theme.brand.primary : theme.bg.elevated, borderColor: theme.border.subtle }]}
            >
              <Text style={[styles.filterText, { color: kindFilter === key ? '#fff' : theme.text.secondary }]}>
                {key === 'all' ? t.all_period : key === 'income' ? t.income : t.expense}
              </Text>
            </Pressable>
          ))}
        </View>
        {kindFilter !== 'income' && (
          <CategoryBreakdownCard
            breakdown={categoryBreakdown}
            totalExpense={summary.expense}
            currency={reportCurrency}
            language={language}
            theme={theme}
            t={t}
          />
        )}
        {report ? (
          <>
            <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <InsightText text={report} />
            </View>
            <Pressable onPress={shareReport} style={[styles.shareBtn, { borderColor: theme.border.strong }]}>
              <Text style={[styles.shareText, { color: theme.text.secondary }]}>📤 {t.copy}</Text>
            </Pressable>
          </>
        ) : !loading && (!hasRangeData || (keyChecked && !hasApiKey)) ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{keyChecked && !hasApiKey ? '🔑' : '📊'}</Text>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
              {keyChecked && !hasApiKey ? t.setup_ai_first : (range ? range.label : t.custom_range)}
            </Text>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>
              {keyChecked && !hasApiKey ? t.no_api_key_msg : t.no_insights_msg}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Generate button */}
      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated, paddingBottom: spacing[4] + insets.bottom }]}>
        {keyChecked && !hasApiKey ? (
          <Pressable
            onPress={() => router.push('/ai-settings')}
            style={[styles.btn, { backgroundColor: theme.brand.accent }]}
          >
            <Text style={styles.btnText}>{t.go_to_settings} →</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={generate}
            disabled={loading || !keyChecked || (period === 'custom' && !range)}
            style={[
              styles.btn,
              {
                backgroundColor:
                  loading || !keyChecked || (period === 'custom' && !range)
                    ? theme.border.strong
                    : theme.brand.primary,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{report ? t.refresh : t.generate}</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  tabText: { fontSize: 12, fontWeight: '600' },
  dateBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: { padding: spacing[2] },
  navArrow: { fontSize: 28, lineHeight: 32 },
  navLabel: { fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center' },
  customRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  customField: { flex: 1, gap: spacing[1] },
  customLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 38,
    justifyContent: 'center',
  },
  dateInputText: { fontSize: 13, fontFamily: 'Courier' },
  dateSep: { fontSize: 18, paddingBottom: spacing[2] },
  content: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  statsGrid: { flexDirection: 'row', gap: spacing[3] },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    alignItems: 'center',
    gap: spacing[1],
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  deltaBadge: { fontSize: 11, fontWeight: '700' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  snapshotCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[3],
  },
  snapshotHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3], alignItems: 'center' },
  snapshotTitle: { fontSize: 15, fontWeight: '700' },
  snapshotMeta: { fontSize: 12, flex: 1, textAlign: 'right' },
  legendRow: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  legendDot: { width: 8, height: 8, borderRadius: radius.full },
  legendText: { fontSize: 11, fontWeight: '600' },
  columnChart: {
    minHeight: 170,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[1],
  },
  columnItem: { alignItems: 'center', gap: spacing[1], minWidth: 28 },
  columnBars: { height: 132, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  columnTrack: {
    width: 10,
    height: '100%',
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  columnBar: { width: '100%', borderRadius: radius.sm },
  columnLabel: { fontSize: 10, maxWidth: 34, textAlign: 'center' },
  filterRow: { flexDirection: 'row', gap: spacing[2] },
  filterPill: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  filterText: { fontSize: 12, fontWeight: '600' },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
  },
  stackedBar: { flexDirection: 'row', height: 12, borderRadius: radius.full, overflow: 'hidden' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  catIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBody: { flex: 1, gap: 2 },
  catNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  catName: { fontSize: 13, fontWeight: '500', flex: 1 },
  catAmount: { fontSize: 12 },
  catBarTrack: { height: 4, borderRadius: radius.full, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: radius.full },
  catPct: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },
  shareBtn: {
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  shareText: { fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[12] },
  emptyIcon: { fontSize: 48, marginBottom: spacing[3] },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[6] },
  footer: { padding: spacing[4], borderTopWidth: StyleSheet.hairlineWidth },
  btn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
