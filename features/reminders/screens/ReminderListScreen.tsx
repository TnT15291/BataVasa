import { useMemo, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import {
  addDays, endOfDay, format, getDay, startOfDay,
  startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, isSameDay, isSameMonth,
} from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
import * as Haptics from 'expo-haptics'
import { FAB } from '@components/FAB'
import { ScreenTransition } from '@components/ScreenTransition'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { getProviderKey } from '@services/ai/openai'
import { parseReminderEntry, type ParsedReminder } from '../aiParser'
import { VoiceButton } from '@components/VoiceButton'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { useRemindersBootstrap, useReminders, useReminderActions } from '../hooks/useReminders'
import type { Reminder } from '../types'

type ReminderFilter = 'all' | 'today' | 'important' | 'inbox'

function RecurrenceBadge({ recurrence }: { recurrence: Reminder['recurrence'] }) {
  const theme = useTheme()
  const { t } = useTranslation()
  if (recurrence === 'none') return null
  const labels: Record<string, string> = {
    daily: t.recurrence_daily,
    weekly: t.recurrence_weekly,
    monthly: t.recurrence_monthly,
  }
  return (
    <View style={[styles.badge, { backgroundColor: theme.brand.primary + '22' }]}>
      <Feather name="repeat" size={10} color={theme.brand.primary} />
      <Text style={[styles.badgeText, { color: theme.brand.primary }]}>{labels[recurrence]}</Text>
    </View>
  )
}

function PriorityBadge({ priority }: { priority: Reminder['priority'] }) {
  const theme = useTheme()
  const { t } = useTranslation()
  if (!priority || priority === 'medium') return null
  const color = priority === 'high' ? theme.semantic.danger : theme.text.muted
  const label = priority === 'high' ? t.reminder_priority_high : t.reminder_priority_low
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Feather name="flag" size={10} color={color} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  )
}

function ReminderRow({ reminder, onPress, onToggle, onSkip }: {
  reminder: Reminder
  onPress: () => void
  onToggle: () => void
  onSkip: () => void
}) {
  const theme = useTheme()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const isDone = reminder.completed === 1
  const adv = reminder.advance_minutes ?? 0
  const eventTime = new Date(new Date(reminder.remind_at).getTime() + adv * 60000)
  const isInbox = (reminder.is_inbox ?? 0) === 1
  const now = new Date()
  const isPast = !isInbox && eventTime < now && !isDone
  const isToday = !isInbox && eventTime >= startOfDay(now) && eventTime <= endOfDay(now)
  const statusColor = isDone ? theme.semantic.success : isPast ? theme.semantic.danger : isToday ? theme.brand.primary : MODULE_COLORS.tasks
  const canSkip = !isDone && !isInbox && reminder.recurrence !== 'none'
  const statusLabel = isDone ? t.reminder_completed : isInbox ? t.reminder_inbox : isPast ? t.reminder_past : isToday ? t.today : t.reminder_upcoming
  const dateStr = isInbox ? t.reminder_inbox : format(eventTime, isToday ? 'HH:mm' : 'dd/MM/yyyy HH:mm', { locale: getDateFnsLocale(language) })

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
          borderColor: isPast ? theme.semantic.danger + '55' : theme.border.subtle,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={reminder.title}
    >
      <View style={[styles.rowAccent, { backgroundColor: statusColor }]} />
      <Pressable
        onPress={onToggle}
        style={[styles.checkbox, {
          borderColor: isDone ? theme.semantic.success : statusColor,
          backgroundColor: isDone ? theme.semantic.success : statusColor + '12',
        }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        hitSlop={12}
      >
        {isDone && <Feather name="check" size={12} color="#fff" />}
      </Pressable>

      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.rowTitle, { color: isDone ? theme.text.muted : theme.text.primary },
              isDone && styles.strikethrough]}
            numberOfLines={1}
          >
            {reminder.title}
          </Text>
          <PriorityBadge priority={reminder.priority ?? 'medium'} />
          <RecurrenceBadge recurrence={reminder.recurrence} />
        </View>
        <View style={styles.rowMeta}>
          <View style={[styles.timePill, { backgroundColor: statusColor + '18' }]}>
            <Feather name={isInbox ? 'inbox' : 'clock'} size={11} color={statusColor} />
            <Text style={[styles.timePillText, { color: statusColor }]}>{dateStr}</Text>
          </View>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        {adv > 0 && !isInbox && (
          <Text style={[styles.rowAdvance, { color: theme.brand.primary }]}>
            {adv < 60 ? `${adv}m` : adv < 1440 ? `${adv / 60}h` : `${adv / 1440}d`} {t.remind_before.toLowerCase()}
          </Text>
        )}
        {reminder.note ? (
          <Text style={[styles.rowNote, { color: theme.text.muted }]} numberOfLines={1}>
            {reminder.note}
          </Text>
        ) : null}
      </View>

      {canSkip ? (
        <Pressable
          onPress={(e) => { e.stopPropagation(); onSkip() }}
          style={[styles.skipBtn, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}
          accessibilityRole="button"
          accessibilityLabel={t.reminder_skip}
          hitSlop={8}
        >
          <Feather name="skip-forward" size={15} color={theme.text.secondary} />
        </Pressable>
      ) : null}
      <Feather name="chevron-right" size={20} color={theme.text.muted} />
    </Pressable>
  )
}

const CAL_COL_W = '14.2857%'

function ReminderCalendarView({
  reminders,
  calendarMonth,
  onMonthChange,
}: {
  reminders: Reminder[]
  calendarMonth: Date
  onMonthChange: (d: Date) => void
}) {
  const theme = useTheme()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const router = useRouter()
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const locale = getDateFnsLocale(language)
  const today = new Date()

  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(calendarMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = (getDay(monthStart) + 6) % 7

  const getEventTime = (r: Reminder) =>
    new Date(new Date(r.remind_at).getTime() + (r.advance_minutes ?? 0) * 60000)

  const remindersByDay = useMemo(() => {
    const map = new Map<string, Reminder[]>()
    for (const r of reminders) {
      const d = getEventTime(r)
      if (isSameMonth(d, calendarMonth)) {
        const key = format(d, 'yyyy-MM-dd')
        const arr = map.get(key) ?? []
        arr.push(r)
        map.set(key, arr)
      }
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders, calendarMonth])

  const weekHeaders = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i)
    return format(d, 'EEEEE', { locale })
  })

  const cells: (Date | null)[] = [...Array(startPad).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null
  const selectedRems = selectedKey ? (remindersByDay.get(selectedKey) ?? []) : []

  return (
    <View style={[styles.calCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
      <View style={styles.calMonthHeader}>
        <Pressable
          onPress={() => { onMonthChange(subMonths(calendarMonth, 1)); setSelectedDay(null) }}
          hitSlop={12}
          style={styles.calNavBtn}
        >
          <Feather name="chevron-left" size={20} color={theme.text.primary} />
        </Pressable>
        <Text style={[styles.calMonthTitle, { color: theme.text.primary }]}>
          {format(calendarMonth, 'MMMM yyyy', { locale })}
        </Text>
        <Pressable
          onPress={() => { onMonthChange(addMonths(calendarMonth, 1)); setSelectedDay(null) }}
          hitSlop={12}
          style={styles.calNavBtn}
        >
          <Feather name="chevron-right" size={20} color={theme.text.primary} />
        </Pressable>
      </View>

      <View style={styles.calWeekRow}>
        {weekHeaders.map((d, i) => (
          <Text key={i} style={[styles.calWeekDay, { color: theme.text.muted, width: CAL_COL_W }]}>{d}</Text>
        ))}
      </View>

      <View style={styles.calGrid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`pad-${i}`} style={{ width: CAL_COL_W, aspectRatio: 1 }} />
          const key = format(day, 'yyyy-MM-dd')
          const dayRems = remindersByDay.get(key) ?? []
          const isToday = isSameDay(day, today)
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
          const dayIsPast = !isToday && day < today
          const hasIncomplete = dayRems.some((r) => r.completed === 0)
          const dotColor = dayIsPast && hasIncomplete
            ? theme.semantic.danger
            : hasIncomplete
            ? theme.brand.primary
            : theme.semantic.success
          return (
            <Pressable
              key={key}
              onPress={() => setSelectedDay(isSelected ? null : day)}
              style={[
                styles.calCell,
                { width: CAL_COL_W },
                isSelected && { backgroundColor: theme.brand.primary, borderRadius: radius.full },
                isToday && !isSelected && { backgroundColor: theme.brand.primary + '22', borderRadius: radius.full },
              ]}
            >
              <Text
                style={[
                  styles.calDayNum,
                  { color: isSelected ? '#fff' : isToday ? theme.brand.primary : theme.text.primary },
                  (isToday || isSelected) && styles.calDayNumBold,
                ]}
              >
                {format(day, 'd')}
              </Text>
              {dayRems.length > 0 && (
                <View style={[styles.calDot, { backgroundColor: isSelected ? '#ffffff88' : dotColor }]} />
              )}
            </Pressable>
          )
        })}
      </View>

      {selectedDay && (
        <View style={[styles.calDayDetail, { borderTopColor: theme.border.subtle }]}>
          <Text style={[styles.calDayDetailHeader, { color: theme.text.secondary }]}>
            {format(selectedDay, 'EEEE, d MMMM', { locale })}
          </Text>
          {selectedRems.length === 0 ? (
            <Text style={[styles.calDayDetailEmpty, { color: theme.text.muted }]}>{t.reminder_today_none}</Text>
          ) : (
            selectedRems.map((r) => {
              const isDone = r.completed === 1
              const time = getEventTime(r)
              const isPast = !isDone && time < today
              const dc = isDone ? theme.semantic.success : isPast ? theme.semantic.danger : theme.brand.primary
              return (
                <Pressable
                  key={r.id}
                  onPress={() => router.push({ pathname: '/reminder', params: { id: r.id } })}
                  style={[styles.calDayRow, { borderBottomColor: theme.border.subtle }]}
                >
                  <View style={[styles.calDayRowDot, { backgroundColor: dc }]} />
                  <Text
                    style={[
                      styles.calDayRowTitle,
                      { color: isDone ? theme.text.muted : theme.text.primary },
                      isDone && styles.strikethrough,
                    ]}
                    numberOfLines={1}
                  >
                    {r.title}
                  </Text>
                  <Text style={[styles.calDayRowTime, { color: theme.text.muted }]}>
                    {format(time, 'HH:mm')}
                  </Text>
                </Pressable>
              )
            })
          )}
        </View>
      )}
    </View>
  )
}

export function ReminderListScreen() {
  useRemindersBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const reminders = useReminders()
  const { createReminder, updateReminder, skipReminder, deleteReminder } = useReminderActions()
  const aiProvider = useSettingsStore((s) => s.aiProvider)
  const language = useSettingsStore((s) => s.language)

  const [nlText, setNlText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsedReminder, setParsedReminder] = useState<ParsedReminder | null>(null)
  const [originalNlText, setOriginalNlText] = useState('')
  const [activeFilter, setActiveFilter] = useState<ReminderFilter>('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())

  const handleNlParse = async (override?: string) => {
    const input = (override ?? nlText).trim()
    if (!input) return
    const key = await getProviderKey(aiProvider)
    if (!key) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    if (override) setNlText(override)
    setParsing(true)
    try {
      const result = await parseReminderEntry(input)
      if (!result) { Alert.alert(t.ai_error, t.parse_failed); return }
      setOriginalNlText(input)
      setParsedReminder(result)
    } catch { Alert.alert(t.ai_error, t.parse_failed) }
    finally { setParsing(false) }
  }

  const handleNlConfirm = async () => {
    if (!parsedReminder) return
    const adv = parsedReminder.advance_minutes ?? 0
    const notifyAt = new Date(new Date(parsedReminder.remind_at).getTime() - adv * 60000)
    await createReminder({
      title: parsedReminder.title,
      note: parsedReminder.note || undefined,
      remind_at: notifyAt.toISOString(),
      advance_minutes: adv,
      recurrence: parsedReminder.recurrence,
    })
    setParsedReminder(null)
    setNlText('')
  }

  const handleNlEdit = () => {
    const p = parsedReminder
    setParsedReminder(null)
    setNlText('')
    router.push({ pathname: '/reminder', params: p ? { prefill: JSON.stringify(p) } : {} })
  }

  const { overdue, today, next7Days, nextMonth, later, completed, inbox } = useMemo(() => {
    const now = new Date()
    const dayStart = startOfDay(now)
    const dayEnd = endOfDay(now)
    const sevenDaysLater = endOfDay(addDays(now, 7))
    const thirtyDaysLater = endOfDay(addDays(now, 30))
    const eventAt = (r: Reminder) => new Date(new Date(r.remind_at).getTime() + (r.advance_minutes ?? 0) * 60000)
    const scoped = reminders.filter((r) => {
      if (activeFilter === 'today') {
        const d = eventAt(r)
        return (r.is_inbox ?? 0) !== 1 && r.completed === 0 && d >= dayStart && d <= dayEnd
      }
      if (activeFilter === 'important') return r.priority === 'high' && r.completed === 0
      if (activeFilter === 'inbox') return (r.is_inbox ?? 0) === 1 && r.completed === 0
      return true
    })
    const active = scoped.filter((r) => r.completed === 0)
    const completed = reminders
      .filter((r) => r.completed === 1)
      .sort((a, b) => eventAt(b).getTime() - eventAt(a).getTime())
    const inbox = active
      .filter((r) => (r.is_inbox ?? 0) === 1)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    const overdue = active
      .filter((r) => (r.is_inbox ?? 0) !== 1 && eventAt(r) < now)
      .sort((a, b) => eventAt(a).getTime() - eventAt(b).getTime())
    const today = active
      .filter((r) => {
        const d = eventAt(r)
        return (r.is_inbox ?? 0) !== 1 && d >= now && d >= dayStart && d <= dayEnd
      })
      .sort((a, b) => eventAt(a).getTime() - eventAt(b).getTime())
    const next7Days = active
      .filter((r) => {
        const d = eventAt(r)
        return (r.is_inbox ?? 0) !== 1 && d > dayEnd && d <= sevenDaysLater
      })
      .sort((a, b) => eventAt(a).getTime() - eventAt(b).getTime())
    const nextMonth = active
      .filter((r) => {
        const d = eventAt(r)
        return (r.is_inbox ?? 0) !== 1 && d > sevenDaysLater && d <= thirtyDaysLater
      })
      .sort((a, b) => eventAt(a).getTime() - eventAt(b).getTime())
    const later = active
      .filter((r) => (r.is_inbox ?? 0) !== 1 && eventAt(r) > thirtyDaysLater)
      .sort((a, b) => eventAt(a).getTime() - eventAt(b).getTime())
    return { overdue, today, next7Days, nextMonth, later, completed, inbox }
  }, [reminders, activeFilter])

  const nextReminder = today[0] ?? next7Days[0] ?? nextMonth[0] ?? later[0] ?? overdue[0] ?? null
  const completedCount = completed.length
  const activeCount = reminders.length - completedCount

  const toggleDone = (r: Reminder) => {
    const completing = r.completed !== 1
    updateReminder({ id: r.id, completed: completing ? 1 : 0 })
    void Haptics.impactAsync(completing ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
  }

  const skip = (r: Reminder) => {
    skipReminder(r.id)
  }

  const renderGroup = (title: string, items: Reminder[]) => {
    if (items.length === 0) return null
    return (
      <View key={title} style={styles.group}>
        <View style={styles.groupTitleRow}>
          <Text style={[styles.groupHeader, { color: theme.text.primary }]}>{title}</Text>
          <Text style={[styles.groupCount, { color: theme.text.muted }]}>{items.length}</Text>
        </View>

        <View style={styles.listStack}>
          {items.map((r) => (
            <ReanimatedSwipeable
              key={r.id}
              renderRightActions={(_p, _d, swipeable) => (
                <Pressable
                  onPress={() => {
                    swipeable.close()
                    Alert.alert(t.delete, t.confirm_delete_item, [
                      { text: t.cancel, style: 'cancel' },
                      { text: t.delete, style: 'destructive', onPress: () => deleteReminder(r.id) },
                    ])
                  }}
                  style={[styles.swipeDelete, { backgroundColor: theme.semantic.danger }]}
                >
                  <Feather name="trash-2" size={20} color="#fff" />
                </Pressable>
              )}
              overshootRight={false}
            >
              <ReminderRow
                reminder={r}
                onPress={() => router.push({ pathname: '/reminder', params: { id: r.id } })}
                onToggle={() => toggleDone(r)}
                onSkip={() => skip(r)}
              />
            </ReanimatedSwipeable>
          ))}
        </View>
      </View>
    )
  }

  return (
    <ScreenTransition style={{ backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: MODULE_COLORS.tasks + '14', borderColor: MODULE_COLORS.tasks + '44' }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={[styles.heroKicker, { color: theme.text.muted }]}>{t.nav_reminders}</Text>
              <Text style={[styles.heroTitle, { color: theme.text.primary }]}>
                {nextReminder ? nextReminder.title : t.reminder_today_none}
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.text.muted }]}>
                {nextReminder
                  ? format(new Date(new Date(nextReminder.remind_at).getTime() + (nextReminder.advance_minutes ?? 0) * 60000), 'dd/MM/yyyy HH:mm', { locale: getDateFnsLocale(language) })
                  : t.reminder_add_hint}
              </Text>
            </View>
            <View style={[styles.heroIcon, { backgroundColor: MODULE_COLORS.tasks + '1F' }]}>
              <Feather name="bell" size={28} color={MODULE_COLORS.tasks} />
            </View>
          </View>
          <View style={styles.statGrid}>
            <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.statValue, { color: theme.semantic.danger }]}>{overdue.length}</Text>
              <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.reminder_past}</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.statValue, { color: theme.brand.primary }]}>{today.length}</Text>
              <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.today}</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.statValue, { color: theme.text.primary }]}>{activeCount}</Text>
              <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.all_period}</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.statValue, { color: theme.semantic.success }]}>{completedCount}</Text>
              <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.reminder_completed}</Text>
            </View>
          </View>
        </View>

        <View style={styles.analysisRow}>
          {[
            { label: t.nav_reports, icon: 'bar-chart-2' as const, route: '/reminders-report', bg: MODULE_COLORS.tasks },
            { label: t.nav_insights, icon: 'cpu' as const, route: '/reminders-insights', bg: theme.brand.primary },
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

        <View style={[styles.viewToggle, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          {(['list', 'calendar'] as const).map((mode) => {
            const isActive = viewMode === mode
            const label = mode === 'list' ? t.view_list : t.view_calendar
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                style={[styles.viewToggleBtn, { backgroundColor: isActive ? theme.brand.primary : 'transparent' }]}
              >
                <Feather name={mode === 'list' ? 'list' : 'calendar'} size={14} color={isActive ? '#fff' : theme.text.secondary} />
                <Text style={[styles.viewToggleBtnText, { color: isActive ? '#fff' : theme.text.secondary }]}>{label}</Text>
              </Pressable>
            )
          })}
        </View>

        {viewMode === 'list' && (
          <View style={[styles.filterRow, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            {([
              { key: 'all', label: t.all_period },
              { key: 'today', label: t.today },
              { key: 'important', label: t.reminder_important },
              { key: 'inbox', label: t.reminder_inbox },
            ] as { key: ReminderFilter; label: string }[]).map((item) => {
              const active = activeFilter === item.key
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setActiveFilter(item.key)}
                  style={[styles.filterBtn, { backgroundColor: active ? theme.brand.primary : 'transparent' }]}
                >
                  <Text style={[styles.filterText, { color: active ? '#fff' : theme.text.secondary }]} numberOfLines={1}>{item.label}</Text>
                </Pressable>
              )
            })}
          </View>
        )}

        {viewMode === 'calendar' ? (
          <ReminderCalendarView
            reminders={reminders}
            calendarMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
          />
        ) : reminders.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.brand.primary + '1F' }]}>
              <Feather name="bell" size={34} color={theme.brand.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_reminders}</Text>
            <Text style={[styles.emptyMsg, { color: theme.text.muted }]}>{t.no_reminders_msg}</Text>
            <Pressable
              onPress={() => router.push('/reminder')}
              style={[styles.emptyBtn, { backgroundColor: theme.brand.primary }]}
            >
              <Text style={styles.emptyBtnText}>{t.new_reminder}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {activeFilter === 'all' ? renderGroup(t.reminder_inbox, inbox) : null}
            {renderGroup(t.reminder_past, overdue)}
            {renderGroup(t.today, today)}
            {renderGroup(t.reminder_next7days, next7Days)}
            {renderGroup(t.reminder_nextmonth, nextMonth)}
            {renderGroup(t.reminder_later, later)}
            {activeFilter === 'all' ? renderGroup(t.reminder_completed, completed) : null}
          </>
        )}
      </ScrollView>

      <FAB
        onPress={() => router.push('/reminder')}
        accessibilityLabel={t.new_reminder}
        style={[styles.fab, { backgroundColor: theme.brand.primary, bottom: spacing[5] }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </FAB>

      <Modal visible={!!parsedReminder} transparent animationType="slide" onRequestClose={() => setParsedReminder(null)}>
        <Pressable style={styles.backdrop} onPress={() => setParsedReminder(null)} />
        <View style={[styles.sheet, { backgroundColor: theme.bg.elevated }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.border.strong }]} />
          <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>{t.ai_confirm_title}</Text>

          <View style={[styles.infoRow, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.infoLabel, { color: theme.text.muted }]}>{t.ai_confirm_you_said}</Text>
            <Text style={[styles.infoValue, { color: theme.text.primary }]}>{originalNlText}</Text>
          </View>

          <View style={[styles.infoRow, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.infoLabel, { color: theme.text.muted }]}>{t.ai_confirm_parsed}</Text>
            <Text style={[styles.infoValue, { color: theme.text.primary }]}>
              {parsedReminder ? (() => {
                const adv = parsedReminder.advance_minutes ?? 0
                const advStr = adv === 0 ? '' : ` / ${adv < 60 ? `${adv}m` : adv < 1440 ? `${adv / 60}h` : `${adv / 1440}d`} ${t.remind_before.toLowerCase()}`
                return `${parsedReminder.title}${advStr}${parsedReminder.note ? ' / ' + parsedReminder.note : ''}`
              })() : ''}
            </Text>
          </View>

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
    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: 112 },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[4],
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  heroText: { flex: 1, gap: spacing[1] },
  heroKicker: { fontSize: 12, fontWeight: '500' },
  heroTitle: { fontSize: 20, fontWeight: '700' },
  heroSubtitle: { fontSize: 13, lineHeight: 18 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  statChip: {
    width: '48%',
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  filterBtn: { flex: 1, alignItems: 'center', borderRadius: radius.sm, paddingVertical: spacing[2] },
  filterText: { fontSize: 13, fontWeight: '600' },
  group: { gap: spacing[2] },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupHeader: { fontSize: 15, fontWeight: '600' },
  groupCount: { fontSize: 12, fontWeight: '700' },
  listStack: { gap: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
    overflow: 'hidden',
  },
  rowAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  skipBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1, gap: spacing[1] },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  strikethrough: { textDecorationLine: 'line-through' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  timePillText: { fontSize: 12, fontWeight: '700' },
  statusText: { fontSize: 12, fontWeight: '700' },
  rowAdvance: { fontSize: 12, fontWeight: '500' },
  rowNote: { fontSize: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { fontSize: 12, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing[3] },
  emptyIconWrap: { width: 72, height: 72, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyMsg: { fontSize: 14, textAlign: 'center' },
  emptyBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  analysisRow: { flexDirection: 'row', gap: spacing[2] },
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
  fab: {
    position: 'absolute', right: spacing[6],
    width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  nlInput: {
    minHeight: 42,
    fontSize: 14,
    lineHeight: 19,
  },
  nlBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3],
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing[2] },
  sheetTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  infoRow: { borderRadius: radius.md, borderWidth: 1, padding: spacing[3], gap: spacing[1] },
  infoLabel: { fontSize: 12, fontWeight: '600' },
  infoValue: { fontSize: 15 },
  sheetActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  sheetBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.md, alignItems: 'center', borderWidth: 1 },
  sheetBtnText: { fontSize: 15, fontWeight: '600' },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingVertical: spacing[2],
    gap: spacing[1],
  },
  viewToggleBtnText: { fontSize: 13, fontWeight: '600' },
  calCard: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  calMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  calNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  calMonthTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  calWeekRow: { flexDirection: 'row', paddingHorizontal: spacing[2], paddingBottom: spacing[1] },
  calWeekDay: { textAlign: 'center', fontSize: 11, fontWeight: '600' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing[2], paddingBottom: spacing[2] },
  calCell: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  calDayNum: { fontSize: 13 },
  calDayNumBold: { fontWeight: '700' },
  calDot: { width: 5, height: 5, borderRadius: 3 },
  calDayDetail: { borderTopWidth: 1, padding: spacing[3], gap: spacing[2] },
  calDayDetailHeader: { fontSize: 13, fontWeight: '600' },
  calDayDetailEmpty: { fontSize: 13, textAlign: 'center', paddingVertical: spacing[2] },
  calDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  calDayRowDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  calDayRowTitle: { fontSize: 14, fontWeight: '500', flex: 1 },
  calDayRowTime: { fontSize: 12, fontWeight: '600' },
  swipeDelete: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
})
