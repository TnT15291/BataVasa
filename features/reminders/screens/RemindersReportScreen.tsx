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
import { useRemindersBootstrap, useReminders } from '../hooks/useReminders'
import type { ReminderPriority } from '../types'

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

const DONUT = 88
const DONUT_STROKE = 16
const DONUT_INNER = DONUT - DONUT_STROKE * 2

function DonutChart({ pct, color, theme }: { pct: number; color: string; theme: any }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const rightDeg = clamped <= 50 ? clamped * 3.6 - 180 : 0
  const leftDeg = clamped <= 50 ? 180 : 180 - (clamped - 50) * 3.6
  return (
    <View style={{ width: DONUT, height: DONUT }}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: DONUT, height: DONUT, borderRadius: DONUT / 2, backgroundColor: theme.bg.secondary }} />
      {/* Right half */}
      <View style={{ position: 'absolute', right: 0, top: 0, width: DONUT / 2, height: DONUT, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: -DONUT / 2, top: 0, width: DONUT, height: DONUT, borderRadius: DONUT / 2, backgroundColor: color, transform: [{ rotate: `${rightDeg}deg` }] }} />
      </View>
      {/* Left half */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: DONUT / 2, height: DONUT, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: DONUT, height: DONUT, borderRadius: DONUT / 2, backgroundColor: color, transform: [{ rotate: `${leftDeg}deg` }] }} />
      </View>
      {/* Hole */}
      <View style={{ position: 'absolute', top: DONUT_STROKE, left: DONUT_STROKE, width: DONUT_INNER, height: DONUT_INNER, borderRadius: DONUT_INNER / 2, backgroundColor: theme.bg.elevated, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text.primary }}>{pct}%</Text>
      </View>
    </View>
  )
}

function StatCard({
  label, value, delta, deltaPositive = true, theme,
}: { label: string; value: string; delta?: number; deltaPositive?: boolean; theme: any }) {
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

export function RemindersReportScreen() {
  useRemindersBootstrap()
  const theme = useTheme()
  const { t } = useTranslation()
  const reminders = useReminders()
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
    const filtered = reminders.filter((r) => r.remind_at >= fromIso && r.remind_at <= toIso)
    if (filtered.length === 0) return { total: 0, completed: 0, completionRate: 0, byPriority: new Map<ReminderPriority, { total: number; completed: number }>(), overdue: [] }
    const completed = filtered.filter((r) => r.completed === 1).length
    const completionRate = Math.round((completed / filtered.length) * 100)
    const byPriority = new Map<ReminderPriority, { total: number; completed: number }>()
    for (const r of filtered) {
      const p = r.priority ?? 'medium'
      const entry = byPriority.get(p) ?? { total: 0, completed: 0 }
      entry.total++
      if (r.completed === 1) entry.completed++
      byPriority.set(p, entry)
    }
    const nowIso = new Date().toISOString()
    const overdue = filtered
      .filter((r) => r.completed === 0 && r.remind_at < nowIso)
      .sort((a, b) => a.remind_at.localeCompare(b.remind_at))
    return { total: filtered.length, completed, completionRate, byPriority, overdue }
  }, [getRange, reminders])

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
    const prevReminders = reminders.filter((r) => r.remind_at >= fromIso && r.remind_at <= toIso)
    const completed = prevReminders.filter((r) => r.completed === 1).length
    return {
      total: prevReminders.length,
      completed,
      completionRate: prevReminders.length > 0 ? Math.round((completed / prevReminders.length) * 100) : 0,
    }
  }, [period, anchorDate, reminders])

  const calcDelta = (cur: number, prev: number): number | undefined =>
    prev === 0 ? undefined : Math.round(((cur - prev) / Math.abs(prev)) * 100)

  const completionDelta = stats && prevStats ? calcDelta(stats.completionRate, prevStats.completionRate) : undefined

  const range = getRange()
  const exportSummary = async () => {
    if (!stats || !range) return
    track('report_generated', { module: 'reminders', kind: period, item_count: stats.total })
    await Share.share({ message: JSON.stringify({ module: 'reminders', period, range: range.label, stats }, null, 2), title: 'batavasa-reminders-report.json' })
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
        {reminders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_reminders}</Text>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.no_reminders_msg}</Text>
          </View>
        ) : !stats || stats.total === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.report_no_data}</Text>
          </View>
        ) : (
          <>
            {/* Donut + summary */}
            <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <View style={styles.donutRow}>
                <DonutChart
                  pct={stats.completionRate}
                  color={stats.completionRate >= 80 ? theme.semantic.success : stats.completionRate >= 50 ? theme.semantic.warning : theme.semantic.danger}
                  theme={theme}
                />
                <View style={styles.donutMeta}>
                  <Text style={[styles.donutCount, { color: theme.text.primary }]}>
                    {stats.completed} / {stats.total}
                  </Text>
                  {completionDelta !== undefined && completionDelta !== 0 && (
                    <Text style={[styles.deltaBadge, { color: completionDelta >= 0 ? theme.semantic.success : theme.semantic.danger }]}>
                      {completionDelta >= 0 ? '+' : ''}{completionDelta}%
                    </Text>
                  )}
                  <Text style={[styles.donutLabel, { color: theme.text.muted }]}>{t.report_completion_rate}</Text>
                </View>
              </View>
            </View>

            {/* By Priority */}
            {(['high', 'medium', 'low'] as ReminderPriority[]).some((p) => (stats.byPriority.get(p)?.total ?? 0) > 0) && (
              <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{t.report_by_priority}</Text>
                </View>
                {(['high', 'medium', 'low'] as ReminderPriority[]).map((p) => {
                  const pd = stats.byPriority.get(p)
                  if (!pd || pd.total === 0) return null
                  const rate = Math.round((pd.completed / pd.total) * 100)
                  const pColor = p === 'high' ? theme.semantic.danger : p === 'medium' ? theme.semantic.warning : theme.semantic.info
                  const pLabel = p === 'high' ? t.priority_high : p === 'medium' ? t.priority_medium : t.priority_low
                  return (
                    <View key={p} style={styles.priorityRow}>
                      <Text style={[styles.priorityLabel, { color: pColor }]}>{pLabel}</Text>
                      <View style={[styles.priorityBarTrack, { backgroundColor: theme.bg.secondary }]}>
                        <View style={[styles.priorityBarFill, { width: `${rate}%` as any, backgroundColor: pColor }]} />
                      </View>
                      <Text style={[styles.priorityCount, { color: theme.text.muted }]}>{pd.completed}/{pd.total}</Text>
                      <Text style={[styles.priorityPct, { color: pColor }]}>{rate}%</Text>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Overdue */}
            {stats.overdue.length > 0 && (
              <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: theme.text.secondary }]}>{t.report_overdue}</Text>
                  <Text style={[styles.cardTitle, { color: theme.semantic.danger }]}>{stats.overdue.length}</Text>
                </View>
                {stats.overdue.slice(0, 5).map((r) => {
                  const pColor = r.priority === 'high' ? theme.semantic.danger : r.priority === 'medium' ? theme.semantic.warning : theme.semantic.info
                  return (
                    <View key={r.id} style={[styles.overdueRow, { borderColor: theme.border.subtle }]}>
                      <View style={[styles.overdueDot, { backgroundColor: pColor }]} />
                      <Text style={[styles.overdueTitle, { color: theme.text.primary }]} numberOfLines={1}>{r.title}</Text>
                      <Text style={[styles.overdueDate, { color: theme.text.muted }]}>
                        {format(new Date(r.remind_at), 'dd/MM', { locale: dfLocale })}
                      </Text>
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
  statsGrid: { flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 100, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], alignItems: 'center', gap: spacing[1] },
  statValue: { fontSize: 22, fontWeight: '700' },
  deltaBadge: { fontSize: 11, fontWeight: '700' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing[4], gap: spacing[3] },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  cardTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  donutMeta: { flex: 1, gap: spacing[1] },
  donutCount: { fontSize: 24, fontWeight: '800' },
  donutLabel: { fontSize: 12 },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  priorityLabel: { fontSize: 12, fontWeight: '700', width: 58 },
  priorityBarTrack: { flex: 1, height: 6, borderRadius: radius.full, overflow: 'hidden' },
  priorityBarFill: { height: '100%', borderRadius: radius.full },
  priorityCount: { fontSize: 12, width: 36, textAlign: 'right' },
  priorityPct: { fontSize: 12, fontWeight: '700', width: 34, textAlign: 'right' },
  overdueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[1], borderBottomWidth: StyleSheet.hairlineWidth },
  overdueDot: { width: 8, height: 8, borderRadius: radius.full },
  overdueTitle: { flex: 1, fontSize: 14 },
  overdueDate: { fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[12] },
  emptyIcon: { fontSize: 48, marginBottom: spacing[3] },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[6] },
  exportBtn: { paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  exportText: { fontSize: 14, fontWeight: '600' },
})
