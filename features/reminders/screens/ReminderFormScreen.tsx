import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { useRemindersBootstrap, useReminders, useReminderActions } from '../hooks/useReminders'
import type { Recurrence } from '../types'

const RECURRENCES: Recurrence[] = ['none', 'daily', 'weekly', 'monthly']

export function ReminderFormScreen() {
  useRemindersBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const reminders = useReminders()
  const { createReminder, updateReminder, deleteReminder } = useReminderActions()

  const params = useLocalSearchParams<{ id?: string; prefill?: string }>()
  const editingId = typeof params.id === 'string' ? params.id : null
  const editingReminder = useMemo(
    () => (editingId ? reminders.find((r) => r.id === editingId) ?? null : null),
    [editingId, reminders]
  )
  const isEditing = !!editingId

  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [remindAt, setRemindAt] = useState(() => {
    const d = new Date(); d.setMinutes(d.getMinutes() + 30); d.setSeconds(0, 0); return d
  })
  const [recurrence, setRecurrence] = useState<Recurrence>('none')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    if (!editingReminder || prefilled) return
    setTitle(editingReminder.title)
    setNote(editingReminder.note ?? '')
    setRemindAt(new Date(editingReminder.remind_at))
    setRecurrence(editingReminder.recurrence)
    setPrefilled(true)
  }, [editingReminder, prefilled])

  useEffect(() => {
    if (editingId || prefilled || !params.prefill) return
    try {
      const p = JSON.parse(params.prefill as string)
      if (p.title) setTitle(p.title)
      if (p.note) setNote(p.note)
      if (p.remind_at) setRemindAt(new Date(p.remind_at))
      if (p.recurrence && ['none', 'daily', 'weekly', 'monthly'].includes(p.recurrence))
        setRecurrence(p.recurrence as Recurrence)
      setPrefilled(true)
    } catch { /* ignore malformed prefill */ }
  }, [editingId, prefilled, params.prefill])

  const recurrenceLabel = (r: Recurrence) => {
    const map: Record<Recurrence, string> = {
      none: t.recurrence_none,
      daily: t.recurrence_daily,
      weekly: t.recurrence_weekly,
      monthly: t.recurrence_monthly,
    }
    return map[r]
  }

  const dateStr = format(remindAt, 'dd/MM/yyyy', { locale: getDateFnsLocale(language) })
  const timeStr = format(remindAt, 'HH:mm', { locale: getDateFnsLocale(language) })

  const onSave = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      Alert.alert(t.invalid_amount, t.reminder_title_placeholder)
      return
    }
    setSubmitting(true)
    const res = isEditing
      ? await updateReminder({ id: editingId!, title: trimmed, note: note.trim() || undefined, remind_at: remindAt.toISOString(), recurrence })
      : await createReminder({ title: trimmed, note: note.trim() || undefined, remind_at: remindAt.toISOString(), recurrence })
    setSubmitting(false)
    if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); return }
    router.back()
  }

  const onDelete = () => {
    Alert.alert(t.delete_reminder, t.delete_reminder_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          const r = await deleteReminder(editingId!)
          if (r.ok) router.back()
          else Alert.alert(t.could_not_save, r.error ?? '')
        },
      },
    ])
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.new_reminder.toUpperCase()}</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t.reminder_title_placeholder}
        placeholderTextColor={theme.text.muted}
        style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        autoFocus={!isEditing}
      />

      {/* Note */}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={t.reminder_note_placeholder}
        placeholderTextColor={theme.text.muted}
        multiline
        numberOfLines={3}
        style={[styles.input, styles.noteInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
      />

      {/* Date & Time */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.reminder_date_time.toUpperCase()}</Text>
      <View style={styles.dateRow}>
        <Pressable
          onPress={() => { setShowTimePicker(false); setShowDatePicker(true) }}
          style={[styles.datePill, { backgroundColor: theme.bg.elevated, borderColor: theme.border.strong }]}
        >
          <Text style={{ color: theme.text.primary, fontSize: 15 }}>📅 {dateStr}</Text>
        </Pressable>
        <Pressable
          onPress={() => { setShowDatePicker(false); setShowTimePicker(true) }}
          style={[styles.datePill, { backgroundColor: theme.bg.elevated, borderColor: theme.border.strong }]}
        >
          <Text style={{ color: theme.text.primary, fontSize: 15 }}>🕐 {timeStr}</Text>
        </Pressable>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={remindAt}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, date) => { setShowDatePicker(Platform.OS === 'ios'); if (date) setRemindAt((prev) => { const d = new Date(date); d.setHours(prev.getHours(), prev.getMinutes(), 0, 0); return d }) }}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={remindAt}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => { setShowTimePicker(Platform.OS === 'ios'); if (date) setRemindAt((prev) => { const d = new Date(prev); d.setHours(date.getHours(), date.getMinutes(), 0, 0); return d }) }}
        />
      )}

      {/* Recurrence */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.reminder_recurrence.toUpperCase()}</Text>
      <View style={styles.recurrenceRow}>
        {RECURRENCES.map((r) => {
          const active = recurrence === r
          return (
            <Pressable
              key={r}
              onPress={() => setRecurrence(r)}
              style={[styles.recurrenceBtn, {
                backgroundColor: active ? theme.brand.primary : theme.bg.elevated,
                borderColor: active ? theme.brand.primary : theme.border.subtle,
              }]}
            >
              <Text style={{ color: active ? '#fff' : theme.text.secondary, fontSize: 12, fontWeight: '600' }}>
                {recurrenceLabel(r)}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Save */}
      <Pressable
        onPress={onSave}
        disabled={submitting}
        style={[styles.saveBtn, { backgroundColor: submitting ? theme.text.muted : theme.brand.primary }]}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>{isEditing ? t.update : t.save}</Text>}
      </Pressable>

      {isEditing && (
        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <Text style={[styles.deleteBtnText, { color: theme.semantic.danger }]}>{t.delete_reminder}</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  dateRow: { flexDirection: 'row', gap: spacing[3] },
  datePill: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: spacing[3], alignItems: 'center' },
  recurrenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  recurrenceBtn: { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radius.md, borderWidth: 1 },
  saveBtn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center', marginTop: spacing[2] },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing[3] },
  deleteBtnText: { fontSize: 15 },
})
