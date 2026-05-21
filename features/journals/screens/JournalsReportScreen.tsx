import { useState, useCallback, useMemo } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, Share, Platform,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  addWeeks, subWeeks, addMonths, subMonths, addYears, subYears,
  format, parseISO, isValid,
} from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { track } from '@services/analytics'
import { useJournalsBootstrap, useJournals } from '../hooks/useJournals'

type Period = 'weekly' | 'monthly' | 'yearly' | 'custom'

function NavRow({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
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

function StatCard({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
      <Text style={[styles.statValue, { color: theme.text.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.text.muted }]}>{label}</Text>
    </View>
  )
}

const MOOD_EMOJI = ['', '😢', '😕', '😐', '😊', '😄']

export function JournalsReportScreen() {
  useJournalsBootstrap()
  const theme = useTheme()
  const { t } = useTranslation()
  const journals = useJournals()
  const language = useSettingsStore((s) => s.language)
  const dfLocale = getDateFnsLocale(language)

  const [period, setPeriod] = useState<Period>('monthly')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null)

  const getRange = useCallback((): { from: Date; to: Date; label: string } | null => {
    if (period === 'weekly') {
      const from = startOfWeek(anchorDate, { weekStartsOn: 1 })
      const to = endOfWeek(anchorDate, { weekStartsOn: 1 })
      return { from, to, label: `${format(from, 'dd/MM', { locale: dfLocale })} – ${format(to, 'dd/MM/yyyy', { locale: dfLocale })}` }
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
    const from = parseISO(customFrom)
    const to = parseISO(customTo)
    if (!isValid(from) || !isValid(to) || from > to) return null
    return { from, to, label: `${customFrom} – ${customTo}` }
  }, [period, anchorDate, customFrom, customTo, dfLocale])

  const navigate = (dir: 1 | -1) => {
    if (period === 'weekly') setAnchorDate((d) => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1))
    else if (period === 'monthly') setAnchorDate((d) => dir === 1 ? addMonths(d, 1) : subMonths(d, 1))
    else if (period === 'yearly') setAnchorDate((d) => dir === 1 ? addYears(d, 1) : subYears(d, 1))
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
  }

  const stats = useMemo(() => {
    const range = getRange()
    if (!range) return null
    const fromIso = range.from.toISOString()
    const toIso = range.to.toISOString()
    const filtered = journals.filter((j) => j.occurred_at >= fromIso && j.occurred_at <= toIso)
    if (filtered.length === 0) return { entries: 0, avgMood: null, moodCounts: new Map<number, number>(), trend: null }

    const withMood = filtered.filter((j) => j.mood != null)
    const avgMood = withMood.length > 0
      ? withMood.reduce((s, j) => s + (j.mood ?? 0), 0) / withMood.length
      : null

    const moodCounts = new Map<number, number>()
    for (const j of withMood) {
      const m = j.mood!
      moodCounts.set(m, (moodCounts.get(m) ?? 0) + 1)
    }

    // Mood trend: compare first half vs second half
    let trend: 'up' | 'down' | 'stable' | null = null
    if (withMood.length >= 4) {
      const half = Math.floor(withMood.length / 2)
      const firstAvg = withMood.slice(0, half).reduce((s, j) => s + (j.mood ?? 0), 0) / half
      const secondAvg = withMood.slice(half).reduce((s, j) => s + (j.mood ?? 0), 0) / (withMood.length - half)
      const diff = secondAvg - firstAvg
      trend = diff > 0.3 ? 'up' : diff < -0.3 ? 'down' : 'stable'
    }

    return { entries: filtered.length, avgMood, moodCounts, trend }
  }, [getRange, journals])

  const range = getRange()
  const exportSummary = async () => {
    if (!stats || !range) return
    track('report_generated', { module: 'journals', kind: period, item_count: stats.entries })
    await Share.share({ message: JSON.stringify({ module: 'journals', period, range: range.label, stats: { entries: stats.entries, avgMood: stats.avgMood, trend: stats.trend } }, null, 2), title: 'batavasa-journals-report.json' })
  }

  const TABS: { key: Period; label: string }[] = [
    { key: 'weekly', label: t.weekly },
    { key: 'monthly', label: t.monthly },
    { key: 'yearly', label: t.yearly },
    { key: 'custom', label: t.custom_range },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <View style={[styles.tabs, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        {TABS.map(({ key, label }) => (
          <Pressable key={key} onPress={() => setPeriod(key)}
            style={[styles.tab, { borderBottomColor: period === key ? theme.brand.primary : 'transparent' }]}>
            <Text style={[styles.tabText, { color: period === key ? theme.brand.primary : theme.text.secondary }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.dateBar, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
        {period !== 'custom' ? (
          <NavRow label={range?.label ?? ''} onPrev={() => navigate(-1)} onNext={() => navigate(1)} />
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

      <ScrollView contentContainerStyle={styles.content}>
        {journals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📔</Text>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_journals}</Text>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.no_journals_msg}</Text>
          </View>
        ) : !stats || stats.entries === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.report_no_data}</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard label={t.report_entries} value={String(stats.entries)} theme={theme} />
              <StatCard label={t.report_avg_mood}
                value={stats.avgMood != null ? `${MOOD_EMOJI[Math.round(stats.avgMood)]} ${stats.avgMood.toFixed(1)}` : '—'}
                theme={theme} />
              <StatCard label={t.report_mood_trend}
                value={stats.trend === 'up' ? '↑' : stats.trend === 'down' ? '↓' : stats.trend === 'stable' ? '→' : '—'}
                theme={theme} />
            </View>

            {stats.moodCounts.size > 0 && (
              <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{t.journal_mood_label}</Text>
                {[5, 4, 3, 2, 1].map((m) => {
                  const cnt = stats.moodCounts.get(m) ?? 0
                  if (cnt === 0) return null
                  const pct = Math.round((cnt / stats.entries) * 100)
                  return (
                    <View key={m} style={styles.moodRow}>
                      <Text style={styles.moodEmoji}>{MOOD_EMOJI[m]}</Text>
                      <View style={[styles.moodBar, { backgroundColor: theme.bg.secondary }]}>
                        <View style={[styles.moodFill, { width: `${pct}%` as any, backgroundColor: theme.brand.primary }]} />
                      </View>
                      <Text style={[styles.moodPct, { color: theme.text.muted }]}>{cnt}</Text>
                    </View>
                  )
                })}
              </View>
            )}
            <Pressable onPress={exportSummary} style={[styles.exportBtn, { borderColor: theme.border.strong }]}>
              <Text style={[styles.exportText, { color: theme.text.secondary }]}>{t.export_report}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, paddingVertical: spacing[3], alignItems: 'center', borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontWeight: '600' },
  dateBar: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing[2], paddingHorizontal: spacing[4] },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { padding: spacing[2] },
  navArrow: { fontSize: 28, lineHeight: 32 },
  navLabel: { fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center' },
  customRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
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
  statCard: { flex: 1, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], alignItems: 'center', gap: spacing[1] },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing[4], gap: spacing[3] },
  cardTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  moodEmoji: { fontSize: 18, width: 28, textAlign: 'center' },
  moodBar: { flex: 1, height: 8, borderRadius: radius.full, overflow: 'hidden' },
  moodFill: { height: '100%', borderRadius: radius.full },
  moodPct: { fontSize: 12, width: 24, textAlign: 'right' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[12] },
  emptyIcon: { fontSize: 48, marginBottom: spacing[3] },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[6] },
  exportBtn: { paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  exportText: { fontSize: 14, fontWeight: '600' },
})
