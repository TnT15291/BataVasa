import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Share, Platform,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  addWeeks, subWeeks, addMonths, subMonths, addYears, subYears,
  format, parseISO, isValid, differenceInDays,
} from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { exportAllHabits } from '../services'
import { track } from '@services/analytics'
import { useHabitsBootstrap, useHabits } from '../hooks/useHabits'
import type { HabitLog } from '../types'

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

export function HabitsReportScreen() {
  useHabitsBootstrap()
  const theme = useTheme()
  const { t } = useTranslation()
  const habits = useHabits()
  const language = useSettingsStore((s) => s.language)
  const dfLocale = getDateFnsLocale(language)

  const [period, setPeriod] = useState<Period>('monthly')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null)
  const [allLogs, setAllLogs] = useState<HabitLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    exportAllHabits().then((r) => {
      if (r.ok) {
        try {
          const parsed = JSON.parse(r.value)
          setAllLogs(parsed.logs ?? [])
        } catch {}
      }
      setLoading(false)
    })
  }, [])

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
    if (!range || allLogs.length === 0 && habits.length === 0) return null
    const fromIso = range.from.toISOString()
    const toIso = range.to.toISOString()
    const periodLogs = allLogs.filter((l) => l.occurred_at >= fromIso && l.occurred_at <= toIso)
    const totalCompletions = periodLogs.length
    const days = differenceInDays(range.to, range.from) + 1
    const maxPossible = habits.length * days
    const completionRate = maxPossible > 0 ? Math.round((totalCompletions / maxPossible) * 100) : 0
    const bestStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0
    return { totalCompletions, completionRate, bestStreak, days }
  }, [getRange, allLogs, habits])

  const range = getRange()
  const exportSummary = async () => {
    if (!stats || !range) return
    track('report_generated', { module: 'habits', kind: period, item_count: stats.totalCompletions })
    await Share.share({ message: JSON.stringify({ module: 'habits', period, range: range.label, stats }, null, 2), title: 'batavasa-habits-report.json' })
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
          <Pressable
            key={key}
            onPress={() => { setPeriod(key); }}
            style={[styles.tab, { borderBottomColor: period === key ? theme.brand.primary : 'transparent' }]}
          >
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
        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing[8] }} color={theme.brand.primary} />
        ) : habits.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_habits}</Text>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.no_habits_msg}</Text>
          </View>
        ) : !stats ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.report_no_data}</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard label={t.report_habits_completed} value={String(stats.totalCompletions)} theme={theme} />
              <StatCard label={t.report_completion_rate} value={`${stats.completionRate}%`} theme={theme} />
              <StatCard label={t.report_best_streak} value={`${stats.bestStreak} ${t.report_days}`} theme={theme} />
            </View>

            <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{t.habits}</Text>
              {habits.map((h) => (
                <View key={h.id} style={styles.habitRow}>
                  <Text style={styles.habitIcon}>{h.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.habitName, { color: theme.text.primary }]}>{h.name}</Text>
                    <Text style={[styles.habitMeta, { color: theme.text.muted }]}>
                      {t.report_best_streak}: {h.streak} {t.report_days}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
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
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  habitIcon: { fontSize: 24 },
  habitName: { fontSize: 15, fontWeight: '500' },
  habitMeta: { fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[12] },
  emptyIcon: { fontSize: 48, marginBottom: spacing[3] },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[6] },
  exportBtn: { paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  exportText: { fontSize: 14, fontWeight: '600' },
})
