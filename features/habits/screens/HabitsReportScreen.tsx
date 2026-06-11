import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Share, Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  addWeeks, subWeeks, addMonths, subMonths, addYears, subYears,
  format, parseISO, isValid, differenceInDays, subDays, addDays, eachDayOfInterval,
} from 'date-fns'
import { useTheme, type Theme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { exportAllHabits } from '../services'
import { track } from '@services/analytics'
import { useHabitsBootstrap, useHabits } from '../hooks/useHabits'
import type { Habit, HabitLog } from '../types'

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

function StatCard({
  label, value, delta, deltaPositive = true, theme,
}: { label: string; value: string; delta?: number; deltaPositive?: boolean; theme: Theme }) {
  const showDelta = delta !== undefined && delta !== 0
  const isGood = deltaPositive ? (delta ?? 0) >= 0 : (delta ?? 0) <= 0
  const sign = (delta ?? 0) >= 0 ? '+' : ''
  return (
    <View style={[styles.statCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
      <Text style={[styles.statValue, { color: theme.text.primary }]}>{value}</Text>
      {showDelta ? (
        <Text style={[styles.deltaBadge, { color: isGood ? theme.semantic.success : theme.semantic.danger }]}>
          {sign}{delta}%
        </Text>
      ) : null}
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
  const [exportedHabits, setExportedHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    exportAllHabits().then((r) => {
      if (r.ok) {
        try {
          const parsed = JSON.parse(r.value)
          setAllLogs(parsed.logs ?? [])
          setExportedHabits(parsed.habits ?? [])
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
    const completedLogs = periodLogs.filter((l) => (l.skipped ?? 0) !== 1)
    const skippedLogs = periodLogs.filter((l) => (l.skipped ?? 0) === 1)
    const totalCompletions = completedLogs.length
    const days = differenceInDays(range.to, range.from) + 1
    const maxPossible = habits.length * days
    const completionRate = maxPossible > 0 ? Math.round((totalCompletions / maxPossible) * 100) : 0
    const bestStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0
    return {
      totalCompletions,
      skipCount: skippedLogs.length,
      completionRate,
      bestStreak,
      days,
      recentSkipped: skippedLogs
        .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
        .slice(0, 6),
    }
  }, [getRange, allLogs, habits])

  const prevStats = useMemo(() => {
    if (period === 'custom') return null
    const prevAnchor =
      period === 'weekly' ? subWeeks(anchorDate, 1)
      : period === 'monthly' ? subMonths(anchorDate, 1)
      : subYears(anchorDate, 1)
    const prevFrom = period === 'weekly' ? startOfWeek(prevAnchor, { weekStartsOn: 1 }) : period === 'monthly' ? startOfMonth(prevAnchor) : startOfYear(prevAnchor)
    const prevTo = period === 'weekly' ? endOfWeek(prevAnchor, { weekStartsOn: 1 }) : period === 'monthly' ? endOfMonth(prevAnchor) : endOfYear(prevAnchor)
    const fromIso = prevFrom.toISOString()
    const toIso = prevTo.toISOString()
    const prevLogs = allLogs.filter((l) => l.occurred_at >= fromIso && l.occurred_at <= toIso)
    const completed = prevLogs.filter((l) => (l.skipped ?? 0) !== 1)
    const skipped = prevLogs.filter((l) => (l.skipped ?? 0) === 1)
    const days = differenceInDays(prevTo, prevFrom) + 1
    const maxPossible = habits.length * days
    return {
      totalCompletions: completed.length,
      skipCount: skipped.length,
      completionRate: maxPossible > 0 ? Math.round((completed.length / maxPossible) * 100) : 0,
    }
  }, [period, anchorDate, allLogs, habits])

  const calcDelta = (cur: number, prev: number): number | undefined =>
    prev === 0 ? undefined : Math.round(((cur - prev) / Math.abs(prev)) * 100)

  const range = getRange()

  const CELL = 12
  const CELL_GAP = 2

  const heatmapGrid = useMemo(() => {
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')
    const thisMonday = startOfWeek(today, { weekStartsOn: 1 })
    const gridStart = subWeeks(thisMonday, 4)
    const gridEnd = endOfWeek(today, { weekStartsOn: 1 })
    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd }).map((d) => format(d, 'yyyy-MM-dd'))
    const weeks: string[][] = []
    for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7))
    return { weeks, todayStr }
  }, [])

  const weekdayLabels = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'EEEEE', { locale: dfLocale }))
  }, [dfLocale])

  const logDatesByHabit = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const log of allLogs) {
      if ((log.skipped ?? 0) === 1) continue
      const date = log.occurred_at.split('T')[0]
      if (!map.has(log.habit_id)) map.set(log.habit_id, new Set())
      map.get(log.habit_id)!.add(date!)
    }
    return map
  }, [allLogs])

  const skipDatesByHabit = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const log of allLogs) {
      if ((log.skipped ?? 0) !== 1) continue
      const date = log.occurred_at.split('T')[0]
      if (!map.has(log.habit_id)) map.set(log.habit_id, new Set())
      map.get(log.habit_id)!.add(date!)
    }
    return map
  }, [allLogs])

  const habitById = useMemo(() => {
    const map = new Map<string, Habit>()
    for (const h of exportedHabits) map.set(h.id, h)
    for (const h of habits) map.set(h.id, h)
    return map
  }, [habits, exportedHabits])

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
              <StatCard
                label={t.report_habits_completed}
                value={String(stats.totalCompletions)}
                delta={prevStats ? calcDelta(stats.totalCompletions, prevStats.totalCompletions) : undefined}
                theme={theme}
              />
              <StatCard
                label={t.report_completion_rate}
                value={`${stats.completionRate}%`}
                delta={prevStats ? calcDelta(stats.completionRate, prevStats.completionRate) : undefined}
                theme={theme}
              />
              <StatCard label={t.report_current_streak} value={`${stats.bestStreak} ${t.report_days}`} theme={theme} />
              <StatCard
                label={t.report_skipped}
                value={String(stats.skipCount)}
                delta={prevStats ? calcDelta(stats.skipCount, prevStats.skipCount) : undefined}
                deltaPositive={false}
                theme={theme}
              />
            </View>

            {/* Per-habit heatmap — 4-week calendar grid */}
            <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <View style={styles.cardTitleRow}>
                <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{t.habits}</Text>
                <Text style={[styles.cardTitle, { color: theme.text.muted }]}>{t.habit_last_4_weeks}</Text>
              </View>
              {/* Weekday header — shown once */}
              <View style={[styles.heatWeekRow, { gap: CELL_GAP }]}>
                {weekdayLabels.map((lbl, i) => (
                  <View key={i} style={{ width: CELL, alignItems: 'center' }}>
                    <Text style={[styles.heatWeekLabel, { color: theme.text.muted }]}>{lbl}</Text>
                  </View>
                ))}
              </View>
              {habits.map((h) => (
                <View key={h.id} style={styles.habitRow}>
                  {(h.icon?.codePointAt(0) ?? 0) > 127
                    ? <Text style={styles.habitIcon}>{h.icon}</Text>
                    : <Feather name="check-circle" size={22} color={theme.brand.primary} />
                  }
                  <View style={{ flex: 1, gap: CELL_GAP }}>
                    <View style={styles.habitNameRow}>
                      <Text style={[styles.habitName, { color: theme.text.primary }]}>{h.name}</Text>
                      <Text style={[styles.habitMeta, { color: theme.text.muted }]}>
                        {h.streak}{t.report_days[0]}
                      </Text>
                    </View>
                    {heatmapGrid.weeks.map((week, wi) => (
                      <View key={wi} style={[styles.heatWeekRow, { gap: CELL_GAP }]}>
                        {week.map((day) => {
                          const done = logDatesByHabit.get(h.id)?.has(day) ?? false
                          const skipped = skipDatesByHabit.get(h.id)?.has(day) ?? false
                          const future = day > heatmapGrid.todayStr
                          return (
                            <View
                              key={day}
                              style={[
                                styles.heatCell,
                                {
                                  width: CELL,
                                  height: CELL,
                                  backgroundColor: future
                                    ? 'transparent'
                                    : done ? h.color
                                    : skipped ? theme.bg.secondary
                                    : theme.border.subtle,
                                  borderWidth: skipped && !future ? 1 : 0,
                                  borderColor: theme.text.muted,
                                },
                              ]}
                            />
                          )
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            {stats.recentSkipped.length > 0 && (
              <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{t.report_skip_history}</Text>
                  <Text style={[styles.cardTitle, { color: theme.text.muted }]}>{stats.skipCount}</Text>
                </View>
                {stats.recentSkipped.map((log) => {
                  const habit = habitById.get(log.habit_id)
                  return (
                    <View key={log.id} style={[styles.skipRow, { borderColor: theme.border.subtle }]}>
                      {(habit?.icon?.codePointAt(0) ?? 0) > 127
                        ? <Text style={styles.habitIcon}>{habit?.icon}</Text>
                        : <Feather name="check-circle" size={22} color={theme.brand.primary} />
                      }
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.habitName, { color: theme.text.primary }]}>{habit?.name ?? t.deleted_habit}</Text>
                        <Text style={[styles.habitMeta, { color: theme.text.muted }]}>
                          {format(new Date(log.occurred_at), 'EEE, dd MMM', { locale: dfLocale })}
                        </Text>
                      </View>
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
  customLabel: { fontSize: 12, fontWeight: '600' },
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  statCard: { width: '47%', borderRadius: radius.lg, borderWidth: 1, padding: spacing[3], alignItems: 'center', gap: spacing[1] },
  statValue: { fontSize: 22, fontWeight: '700' },
  deltaBadge: { fontSize: 12, fontWeight: '700' },
  statLabel: { fontSize: 12, textAlign: 'center' },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[3] },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  cardTitle: { fontSize: 12, fontWeight: '600' },
  habitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  habitIcon: { fontSize: 24, marginTop: 2 },
  habitNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  habitName: { fontSize: 15, fontWeight: '500', flex: 1 },
  habitMeta: { fontSize: 12 },
  heatWeekRow: { flexDirection: 'row', alignItems: 'center' },
  heatWeekLabel: { fontSize: 9, fontWeight: '600' },
  heatCell: { borderRadius: 3 },
  skipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing[2] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[12] },
  emptyIcon: { fontSize: 48, marginBottom: spacing[3] },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[6] },
  exportBtn: { paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  exportText: { fontSize: 14, fontWeight: '600' },
})
