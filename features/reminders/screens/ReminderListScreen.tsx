import { useMemo } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { useRemindersBootstrap, useReminders, useReminderActions } from '../hooks/useReminders'
import type { Reminder } from '../types'

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
      <Text style={[styles.badgeText, { color: theme.brand.primary }]}>↻ {labels[recurrence]}</Text>
    </View>
  )
}

function ReminderRow({ reminder, onPress, onToggle, isLast }: {
  reminder: Reminder
  onPress: () => void
  onToggle: () => void
  isLast: boolean
}) {
  const theme = useTheme()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const isDone = reminder.completed === 1
  const isPast = new Date(reminder.remind_at) < new Date() && !isDone
  const dateStr = format(new Date(reminder.remind_at), 'dd/MM/yyyy HH:mm', { locale: getDateFnsLocale(language) })

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border.subtle },
        pressed && { backgroundColor: theme.bg.secondary },
      ]}
      accessibilityRole="button"
      accessibilityLabel={reminder.title}
    >
      <Pressable
        onPress={onToggle}
        style={[styles.checkbox, {
          borderColor: isDone ? theme.semantic.success : theme.border.strong,
          backgroundColor: isDone ? theme.semantic.success : 'transparent',
        }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        hitSlop={8}
      >
        {isDone && <Text style={styles.checkmark}>✓</Text>}
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
          <RecurrenceBadge recurrence={reminder.recurrence} />
        </View>
        <Text style={[styles.rowDate, { color: isPast ? theme.semantic.danger : theme.text.muted }]}>
          {dateStr}
        </Text>
        {reminder.note ? (
          <Text style={[styles.rowNote, { color: theme.text.muted }]} numberOfLines={1}>
            {reminder.note}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.chevron, { color: theme.text.muted }]}>›</Text>
    </Pressable>
  )
}

export function ReminderListScreen() {
  useRemindersBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const reminders = useReminders()
  const { updateReminder } = useReminderActions()

  const { upcoming, past } = useMemo(() => {
    const now = new Date()
    const active = reminders.filter((r) => r.completed === 0)
    const done = reminders.filter((r) => r.completed === 1)
    const upcoming = active.filter((r) => new Date(r.remind_at) >= now)
    const pastActive = active.filter((r) => new Date(r.remind_at) < now)
    return { upcoming: [...upcoming, ...pastActive], past: done }
  }, [reminders])

  const toggleDone = (r: Reminder) => {
    updateReminder({ id: r.id, completed: r.completed === 1 ? 0 : 1 })
  }

  const renderGroup = (title: string, items: Reminder[]) => {
    if (items.length === 0) return null
    return (
      <View key={title}>
        <Text style={[styles.groupHeader, { color: theme.text.muted }]}>{title.toUpperCase()}</Text>
        <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          {items.map((r, idx) => (
            <ReminderRow
              key={r.id}
              reminder={r}
              onPress={() => router.push({ pathname: '/reminder', params: { id: r.id } } as any)}
              onToggle={() => toggleDone(r)}
              isLast={idx === items.length - 1}
            />
          ))}
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={styles.content}>
        {reminders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyIcon]}>🔔</Text>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_reminders}</Text>
            <Text style={[styles.emptyMsg, { color: theme.text.muted }]}>{t.no_reminders_msg}</Text>
          </View>
        ) : (
          <>
            {renderGroup(t.reminder_upcoming, upcoming)}
            {renderGroup(t.reminder_completed, past)}
          </>
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/reminder' as any)}
        accessibilityRole="button"
        accessibilityLabel={t.new_reminder}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[2], paddingBottom: 80 },
  groupHeader: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: spacing[2], marginLeft: spacing[1] },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rowContent: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowTitle: { fontSize: 15, fontWeight: '500', flex: 1 },
  strikethrough: { textDecorationLine: 'line-through' },
  rowDate: { fontSize: 12 },
  rowNote: { fontSize: 12 },
  badge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: '600' },
  chevron: { fontSize: 20, lineHeight: 22 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing[3] },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyMsg: { fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute', right: spacing[6], bottom: spacing[8],
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '600', lineHeight: 30 },
})
