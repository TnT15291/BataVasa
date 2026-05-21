import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  addWeeks, subWeeks,
  addMonths, subMonths,
  addYears, subYears,
  format, parseISO, isValid,
} from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useFinanceBootstrap, useTransactions, useCategories } from '../hooks/useFinance'
import { generateReport, type ReportType } from '@services/ai/reports'
import { getDateFnsLocale } from '@services/locale'
import { useSettingsStore } from '@store/settingsStore'
import { getProviderKey } from '@services/ai/openai'
import { track } from '@services/analytics'
import { formatAmount } from '../services'

type Period = ReportType

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
  const router = useRouter()
  const { t } = useTranslation()
  const allTxs = useTransactions()
  const cats = useCategories()
  const language = useSettingsStore((s) => s.language)
  const currency = useSettingsStore((s) => s.currency)
  const aiProvider = useSettingsStore((s) => s.aiProvider)
  const dfLocale = getDateFnsLocale(language)

  const [hasApiKey, setHasApiKey] = useState(false)
  const [keyChecked, setKeyChecked] = useState(false)
  const [period, setPeriod] = useState<Period>('monthly')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getProviderKey(aiProvider).then((k) => {
      setHasApiKey(!!k)
      setKeyChecked(true)
    })
  }, [aiProvider])

  const onPeriodChange = (p: Period) => {
    setPeriod(p)
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
    else if (period === 'yearly') setAnchorDate((d) => dir === 1 ? addYears(d, 1) : subYears(d, 1))
  }

  const range = getRange()
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
  const summary = useMemo(() => {
    const income = rangeTxs.filter((tx) => tx.amount_cents > 0).reduce((s, tx) => s + tx.amount_cents, 0)
    const expense = rangeTxs.filter((tx) => tx.amount_cents < 0).reduce((s, tx) => s + Math.abs(tx.amount_cents), 0)
    return { count: rangeTxs.length, income, expense }
  }, [rangeTxs])
  const chartMax = Math.max(summary.income, summary.expense, 1)
  const incomePct = Math.max(6, (summary.income / chartMax) * 100)
  const expensePct = Math.max(6, (summary.expense / chartMax) * 100)

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
              <TextInput
                value={customFrom}
                onChangeText={(v) => { setCustomFrom(v); setReport(null) }}
                placeholder={t.date_hint}
                placeholderTextColor={theme.text.muted}
                style={[styles.dateInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <Text style={[styles.dateSep, { color: theme.text.muted }]}>→</Text>
            <View style={styles.customField}>
              <Text style={[styles.customLabel, { color: theme.text.muted }]}>{t.to_date}</Text>
              <TextInput
                value={customTo}
                onChangeText={(v) => { setCustomTo(v); setReport(null) }}
                placeholder={t.date_hint}
                placeholderTextColor={theme.text.muted}
                style={[styles.dateInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        )}
      </View>

      {/* Report content */}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>{summary.count}</Text>
            <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.report_entries}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Text style={[styles.statValue, { color: theme.text.primary }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatAmount(summary.income, currency, language)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.income}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Text style={[styles.statValue, { color: theme.text.primary }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatAmount(summary.expense, currency, language)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.expense}</Text>
          </View>
        </View>
        <View style={[styles.snapshotCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.snapshotHeader}>
            <Text style={[styles.snapshotTitle, { color: theme.text.primary }]}>{t.report_snapshot}</Text>
            <Text style={[styles.snapshotMeta, { color: theme.text.muted }]}>{range ? range.label : t.custom_range}</Text>
          </View>
          <View style={styles.chartRow}>
            <Text style={[styles.chartLabel, { color: theme.text.muted }]}>{t.income}</Text>
            <View style={[styles.chartTrack, { backgroundColor: theme.bg.secondary }]}>
              <View style={[styles.chartBar, { width: `${incomePct}%`, backgroundColor: theme.finance.income }]} />
            </View>
          </View>
          <View style={styles.chartRow}>
            <Text style={[styles.chartLabel, { color: theme.text.muted }]}>{t.expense}</Text>
            <View style={[styles.chartTrack, { backgroundColor: theme.bg.secondary }]}>
              <View style={[styles.chartBar, { width: `${expensePct}%`, backgroundColor: theme.finance.expense }]} />
            </View>
          </View>
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
        {report ? (
          <>
            <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <Text style={[styles.reportText, { color: theme.text.primary }]}>{report}</Text>
            </View>
            <Pressable onPress={shareReport} style={[styles.shareBtn, { borderColor: theme.border.strong }]}>
              <Text style={[styles.shareText, { color: theme.text.secondary }]}>📤 {t.copy}</Text>
            </Pressable>
          </>
        ) : !loading ? (
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
      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated }]}>
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
  tabText: { fontSize: 13, fontWeight: '600' },
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
    fontSize: 13,
    fontFamily: 'Courier',
  },
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
  chartRow: { gap: spacing[1] },
  chartLabel: { fontSize: 11, fontWeight: '600' },
  chartTrack: { height: 10, borderRadius: radius.full, overflow: 'hidden' },
  chartBar: { height: '100%', borderRadius: radius.full },
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
  reportText: { fontSize: 14, lineHeight: 22 },
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
