import { useMemo, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { getProviderKey } from '@services/ai/openai'
import { parseReminderEntry, type ParsedReminder } from '@services/ai/reminderParser'
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
  const adv = reminder.advance_minutes ?? 0
  const eventTime = new Date(new Date(reminder.remind_at).getTime() + adv * 60000)
  const isPast = eventTime < new Date() && !isDone
  const dateStr = format(eventTime, 'dd/MM/yyyy HH:mm', { locale: getDateFnsLocale(language) })

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
        {adv > 0 && (
          <Text style={[styles.rowAdvance, { color: theme.brand.primary }]}>
            🔔 {adv < 60 ? `${adv}m` : adv < 1440 ? `${adv / 60}h` : `${adv / 1440}d`} {t.remind_before.toLowerCase()}
          </Text>
        )}
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
  const { createReminder, updateReminder } = useReminderActions()
  const aiProvider = useSettingsStore((s) => s.aiProvider)

  const [nlText, setNlText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsedReminder, setParsedReminder] = useState<ParsedReminder | null>(null)
  const [originalNlText, setOriginalNlText] = useState('')

  const handleNlParse = async () => {
    if (!nlText.trim()) return
    const key = await getProviderKey(aiProvider)
    if (!key) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    setParsing(true)
    try {
      const result = await parseReminderEntry(nlText.trim())
      if (!result) { Alert.alert(t.ai_error, t.parse_failed); return }
      setOriginalNlText(nlText.trim())
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
    router.push({ pathname: '/reminder', params: p ? { prefill: JSON.stringify(p) } : {} } as any)
  }

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
      {/* NL input */}
      <View style={[styles.nlRow, { backgroundColor: theme.bg.secondary, borderBottomColor: theme.border.subtle }]}>
        <TextInput
          value={nlText}
          onChangeText={setNlText}
          placeholder={t.nl_placeholder_reminder}
          placeholderTextColor={theme.text.muted}
          style={[styles.nlInput, { color: theme.text.primary, backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
          returnKeyType="done"
          onSubmitEditing={handleNlParse}
          editable={!parsing}
        />
        <Pressable
          onPress={handleNlParse}
          disabled={parsing || !nlText.trim()}
          style={[styles.nlBtn, { backgroundColor: (parsing || !nlText.trim()) ? theme.border.strong : theme.brand.primary }]}
        >
          {parsing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.nlBtnText}>{t.parse_btn}</Text>}
        </Pressable>
      </View>

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
        onPress={() => router.push('/reminders-report' as any)}
        accessibilityRole="button"
        accessibilityLabel={t.reminders_report_title}
        style={[styles.reportBtn, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
      >
        <Text style={styles.reportBtnText}>📊</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/reminder' as any)}
        accessibilityRole="button"
        accessibilityLabel={t.new_reminder}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      {/* NL confirm modal */}
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
                const advStr = adv === 0 ? '' : ` · ${adv < 60 ? `${adv}m` : adv < 1440 ? `${adv / 60}h` : `${adv / 1440}d`} ${t.remind_before.toLowerCase()}`
                return `🔔 ${parsedReminder.title}${advStr}${parsedReminder.note ? ' · ' + parsedReminder.note : ''}`
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
  rowAdvance: { fontSize: 11, fontWeight: '500' },
  rowNote: { fontSize: 12 },
  badge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: '600' },
  chevron: { fontSize: 20, lineHeight: 22 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing[3] },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyMsg: { fontSize: 14, textAlign: 'center' },
  reportBtn: {
    position: 'absolute', left: spacing[6], bottom: spacing[8],
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    elevation: 3, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  reportBtnText: { fontSize: 20 },
  fab: {
    position: 'absolute', right: spacing[6], bottom: spacing[8],
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
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
