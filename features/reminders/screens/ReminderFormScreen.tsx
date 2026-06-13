import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { hapticSaveSuccess } from '@services/haptics'
import { notifySaved, toast } from '@store/toastStore'
import { getProviderKey } from '@services/ai/openai'
import { parseReminderEntry } from '../aiParser'
import { VoiceButton } from '@components/VoiceButton'
import { ConfirmEntrySheet, type ConfirmField } from '@components/ConfirmEntrySheet'
import { useRemindersBootstrap, useReminders, useReminderActions } from '../hooks/useReminders'
import type { Recurrence, ReminderPriority } from '../types'
import { MODULE_COLORS } from '@design/moduleColors'

const RECURRENCES: Recurrence[] = ['none', 'daily', 'weekly', 'monthly']
const ADVANCE_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880] as const
const PRIORITIES: ReminderPriority[] = ['low', 'medium', 'high']

function getInitialReminderTime(dateParam?: string): Date {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  d.setSeconds(0, 0)

  if (dateParam) {
    const match = dateParam.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) {
      const year = Number(match[1])
      const month = Number(match[2]) - 1
      const day = Number(match[3])
      d.setFullYear(year, month, day)
    }
  }

  return d
}

export function ReminderFormScreen() {
  useRemindersBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const reminders = useReminders()
  const { createReminder, updateReminder, deleteReminder, restoreReminder } = useReminderActions()
  const aiProvider = useSettingsStore((s) => s.aiProvider)
  const aiAutoConfirm = useSettingsStore((s) => s.aiAutoConfirm)

  const params = useLocalSearchParams<{ id?: string; prefill?: string; date?: string }>()
  const editingId = typeof params.id === 'string' ? params.id : null
  const editingReminder = useMemo(
    () => (editingId ? reminders.find((r) => r.id === editingId) ?? null : null),
    [editingId, reminders]
  )
  const isEditing = !!editingId

  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [remindAt, setRemindAt] = useState(() => getInitialReminderTime(typeof params.date === 'string' ? params.date : undefined))
  const [recurrence, setRecurrence] = useState<Recurrence>('none')
  const [priority, setPriority] = useState<ReminderPriority>('medium')
  const [isInbox, setIsInbox] = useState(false)
  const [advanceMinutes, setAdvanceMinutes] = useState(0)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const [smartText, setSmartText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [confirmSheet, setConfirmSheet] = useState<{
    rawInput: string
    fields: ConfirmField[]
    payload: { title: string; note: string; remind_at: string; advance_minutes: number; recurrence: Recurrence }
  } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  useEffect(() => {
    if (!editingReminder || prefilled) return
    setTitle(editingReminder.title)
    setNote(editingReminder.note ?? '')
    // Reconstruct event time: remind_at is notification time, event = remind_at + advance_minutes
    const adv = editingReminder.advance_minutes ?? 0
    const eventTime = new Date(new Date(editingReminder.remind_at).getTime() + adv * 60000)
    setRemindAt(eventTime)
    setAdvanceMinutes(adv)
    setRecurrence(editingReminder.recurrence)
    setPriority(editingReminder.priority ?? 'medium')
    setIsInbox((editingReminder.is_inbox ?? 0) === 1)
    setPrefilled(true)
  }, [editingReminder, prefilled])

  useEffect(() => {
    if (editingId || prefilled || !params.prefill) return
    try {
      const p = JSON.parse(params.prefill as string)
      if (p.title) setTitle(p.title)
      if (p.note) setNote(p.note)
      if (p.remind_at) {
        const adv = Number(p.advance_minutes ?? 0)
        const eventTime = new Date(new Date(p.remind_at).getTime() + adv * 60000)
        setRemindAt(eventTime)
        setAdvanceMinutes(adv)
      }
      if (p.recurrence && ['none', 'daily', 'weekly', 'monthly'].includes(p.recurrence))
        setRecurrence(p.recurrence as Recurrence)
      if (p.priority && ['low', 'medium', 'high'].includes(p.priority))
        setPriority(p.priority as ReminderPriority)
      if (p.is_inbox != null) setIsInbox(Number(p.is_inbox) === 1)
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

  const locale = getDateFnsLocale(language)
  const dateStr = format(remindAt, 'dd/MM/yyyy', { locale })
  const timeStr = format(remindAt, 'HH:mm', { locale })
  const notifyAt = new Date(remindAt.getTime() - advanceMinutes * 60000)
  const notifyTimeStr = !isInbox && advanceMinutes > 0 ? format(notifyAt, 'HH:mm dd/MM', { locale }) : null

  const advanceLabel = (mins: number): string => {
    if (mins === 0) return t.at_event_time
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${mins / 60}h`
    return `${mins / 1440}d`
  }

  const onSave = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      Alert.alert(t.could_not_save, t.reminder_title_required)
      return
    }
    setSubmitting(true)
    const payload = {
      title: trimmed,
      note: note.trim() || undefined,
      remind_at: isInbox ? undefined : notifyAt.toISOString(),
      advance_minutes: isInbox ? 0 : advanceMinutes,
      recurrence: isInbox ? 'none' as const : recurrence,
      priority,
      is_inbox: isInbox ? 1 : 0,
    }
    const res = isEditing
      ? await updateReminder({ id: editingId!, ...payload })
      : await createReminder(payload)
    setSubmitting(false)
    if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); return }
    void hapticSaveSuccess()
    notifySaved(t, useSettingsStore.getState().syncReminders)
    router.back()
  }

  const onDelete = () => {
    Alert.alert(t.delete_reminder, t.delete_reminder_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          const id = editingId!
          const r = await deleteReminder(id)
          if (r.ok) router.back()
          else Alert.alert(t.could_not_save, r.error ?? '')
          if (r.ok) toast.undo(t.toast_deleted, t.undo, () => { void restoreReminder(id) })
        },
      },
    ])
  }

  const handleSmartParse = async (override?: string) => {
    const input = (override ?? smartText).trim()
    if (!input || parsing) return
    const key = await getProviderKey(aiProvider)
    if (!key) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    if (override) setSmartText(override)
    setParsing(true)
    try {
      const parsed = await parseReminderEntry(input)
      if (!parsed) { Alert.alert(t.ai_error, t.parse_failed); return }
      const isVoice = override !== undefined
      if (parsed.missing.includes('date')) {
        // No date in the input: ask whether to add one or file it in the
        // unscheduled inbox — the reminder equivalent of "không xác định".
        Alert.alert(
          t.smart_missing_title,
          `"${parsed.title}"\n${t.smart_missing_fields.replace('{{fields}}', t.field_date)}\n\n${t.smart_missing_reminder_prompt}`,
          [
            { text: t.cancel, style: 'cancel' },
            {
              text: t.smart_fill_more,
              onPress: () => {
                setTitle(parsed.title)
                setNote(parsed.note || '')
                setIsInbox(false)
                setSmartText('')
                setShowDatePicker(true)
              },
            },
            {
              text: t.reminder_save_inbox,
              onPress: () => {
                void (async () => {
                  const res = await createReminder({
                    title: parsed.title,
                    note: parsed.note || undefined,
                    advance_minutes: 0,
                    recurrence: 'none',
                    priority: 'medium',
                    is_inbox: 1,
                  })
                  if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); return }
                  void hapticSaveSuccess()
                  notifySaved(t, useSettingsStore.getState().syncReminders)
                  router.back()
                })()
              },
            },
          ]
        )
        return
      }
      if (isVoice || aiAutoConfirm) {
        const fields: ConfirmField[] = [
          { label: t.new_reminder, value: parsed.title },
          { label: t.date, value: format(new Date(parsed.remind_at), 'EEE, dd MMM yyyy / HH:mm', { locale }) },
        ]
        if (parsed.recurrence !== 'none') {
          const recMap: Record<string, string> = { daily: t.recurrence_daily, weekly: t.recurrence_weekly, monthly: t.recurrence_monthly }
          fields.push({ label: t.reminder_recurrence, value: recMap[parsed.recurrence] ?? parsed.recurrence })
        }
        if (parsed.advance_minutes > 0) fields.push({ label: t.remind_before, value: advanceLabel(parsed.advance_minutes) })
        if (parsed.note) fields.push({ label: t.note_optional.replace(/\s*\(.+\)/, ''), value: parsed.note })
        setConfirmSheet({ rawInput: input, fields, payload: { title: parsed.title, note: parsed.note, remind_at: parsed.remind_at, advance_minutes: parsed.advance_minutes, recurrence: parsed.recurrence } })
      } else {
        setTitle(parsed.title)
        setNote(parsed.note || '')
        setAdvanceMinutes(parsed.advance_minutes ?? 0)
        setRecurrence(parsed.recurrence)
        setPriority('medium')
        setIsInbox(false)
        setRemindAt(new Date(parsed.remind_at))
        setSmartText('')
      }
    } catch {
      Alert.alert(t.ai_error, t.parse_failed)
    } finally {
      setParsing(false)
    }
  }

  const onSheetSave = async () => {
    if (!confirmSheet) return
    setConfirmBusy(true)
    const { title, note, remind_at, advance_minutes, recurrence } = confirmSheet.payload
    const notifyAt = new Date(new Date(remind_at).getTime() - advance_minutes * 60000)
    const res = await createReminder({
      title,
      note: note || undefined,
      remind_at: notifyAt.toISOString(),
      advance_minutes,
      recurrence,
      priority: 'medium',
      is_inbox: 0,
    })
    setConfirmBusy(false)
    if (res.ok) {
      void hapticSaveSuccess()
      notifySaved(t, useSettingsStore.getState().syncReminders)
      setConfirmSheet(null)
      router.back()
    } else {
      Alert.alert(t.could_not_save, res.error ?? '')
    }
  }

  const onSheetEdit = () => {
    if (!confirmSheet) return
    const { title, note, remind_at, advance_minutes, recurrence } = confirmSheet.payload
    setTitle(title)
    setNote(note)
    setAdvanceMinutes(advance_minutes)
    setRecurrence(recurrence)
    setPriority('medium')
    setIsInbox(false)
    setRemindAt(new Date(remind_at))
    setSmartText('')
    setConfirmSheet(null)
  }

  return (
    // KeyboardAvoidingView wraps both the scroll body and the absolute footer so
    // the Save button + inputs lift above the keyboard. Explicit Android behavior
    // is required because edge-to-edge (app.json) disables auto-resize.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: theme.brand.primary + '1F' }]}>
              <Feather name="zap" size={16} color={theme.brand.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{t.smart_entry}</Text>
          </View>
          <View style={[styles.smartInputWrap, { backgroundColor: theme.bg.primary, borderColor: theme.border.strong }]}>
            <TextInput
              value={smartText}
              onChangeText={setSmartText}
              placeholder={t.nl_placeholder_reminder}
              placeholderTextColor={theme.text.muted}
              style={[styles.smartInput, { color: theme.text.primary }]}
              returnKeyType="done"
              editable={!parsing}
              multiline
              onSubmitEditing={() => handleSmartParse()}
            />
            <View style={styles.smartActions}>
              <VoiceButton onResult={(text) => handleSmartParse(text)} disabled={parsing} size={38} module="reminders" />
              <Pressable
                onPress={() => handleSmartParse()}
                disabled={parsing || !smartText.trim()}
                style={[styles.smartSend, { backgroundColor: parsing || !smartText.trim() ? theme.border.strong : theme.brand.primary }]}
              >
                {parsing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.previewCard, { backgroundColor: MODULE_COLORS.tasks + '14', borderColor: MODULE_COLORS.tasks + '44' }]}>
          <View style={[styles.previewIcon, { backgroundColor: MODULE_COLORS.tasks + '1F' }]}>
            <Feather name="bell" size={26} color={MODULE_COLORS.tasks} />
          </View>
          <View style={styles.previewBody}>
            <Text style={[styles.previewKicker, { color: theme.text.muted }]}>{isEditing ? t.update : t.new_reminder}</Text>
            <Text style={[styles.previewTitle, { color: theme.text.primary }]} numberOfLines={2}>
              {title.trim() || t.reminder_title_placeholder}
            </Text>
            <View style={styles.previewMetaRow}>
              <Feather name={isInbox ? 'inbox' : 'calendar'} size={13} color={theme.text.muted} />
              <Text style={[styles.previewMeta, { color: theme.text.muted }]}>
                {isInbox ? t.reminder_inbox : `${dateStr} / ${timeStr}`}
              </Text>
            </View>
            {notifyTimeStr ? (
              <View style={styles.previewMetaRow}>
                <Feather name="clock" size={13} color={MODULE_COLORS.tasks} />
                <Text style={[styles.previewMeta, { color: theme.text.muted }]}>{t.remind_before}: {notifyTimeStr}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={() => setIsInbox((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isInbox }}
          style={[styles.inboxToggle, {
            backgroundColor: isInbox ? theme.brand.primary + '18' : theme.bg.elevated,
            borderColor: isInbox ? theme.brand.primary : theme.border.subtle,
          }]}
        >
          <Feather name="inbox" size={18} color={isInbox ? theme.brand.primary : theme.text.muted} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.inboxTitle, { color: isInbox ? theme.brand.primary : theme.text.primary }]}>{t.reminder_inbox}</Text>
            <Text style={[styles.inboxBody, { color: theme.text.muted }]}>{t.reminder_inbox_hint}</Text>
          </View>
        </Pressable>

        <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t.reminder_title_placeholder}
            placeholderTextColor={theme.text.muted}
            style={[styles.titleInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.primary }]}
            autoFocus={!isEditing}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t.reminder_note_placeholder}
            placeholderTextColor={theme.text.muted}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.noteInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.primary }]}
          />
        </View>

        {!isInbox && <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: theme.brand.primary + '1F' }]}>
              <Feather name="calendar" size={16} color={theme.brand.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{t.event_time}</Text>
          </View>
          <View style={styles.dateRow}>
            <Pressable
              onPress={() => { setShowTimePicker(false); setShowDatePicker(true) }}
              style={[styles.datePill, { backgroundColor: theme.bg.primary, borderColor: theme.border.strong }]}
            >
              <Feather name="calendar" size={16} color={theme.brand.primary} />
              <Text style={[styles.datePillText, { color: theme.text.primary }]}>{dateStr}</Text>
            </Pressable>
            <Pressable
              onPress={() => { setShowDatePicker(false); setShowTimePicker(true) }}
              style={[styles.datePill, { backgroundColor: theme.bg.primary, borderColor: theme.border.strong }]}
            >
              <Feather name="clock" size={16} color={theme.brand.primary} />
              <Text style={[styles.datePillText, { color: theme.text.primary }]}>{timeStr}</Text>
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
        </View>}

        {!isInbox && <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: MODULE_COLORS.tasks + '1F' }]}>
              <Feather name="bell" size={16} color={MODULE_COLORS.tasks} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{t.remind_before}</Text>
          </View>
          <View style={styles.optionRow}>
            {ADVANCE_OPTIONS.map((mins) => {
              const active = advanceMinutes === mins
              return (
                <Pressable
                  key={mins}
                  onPress={() => setAdvanceMinutes(mins)}
                  style={[styles.optionBtn, {
                    backgroundColor: active ? theme.brand.primary : theme.bg.primary,
                    borderColor: active ? theme.brand.primary : theme.border.subtle,
                  }]}
                >
                  <Text style={{ color: active ? '#fff' : theme.text.secondary, fontSize: 12, fontWeight: '700' }}>
                    {advanceLabel(mins)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          {notifyTimeStr ? (
            <View style={styles.notifyHintRow}>
              <Feather name="clock" size={13} color={theme.text.muted} />
              <Text style={[styles.notifyHint, { color: theme.text.muted }]}>{notifyTimeStr}</Text>
            </View>
          ) : null}
        </View>}

        <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: theme.brand.primary + '1F' }]}>
              <Feather name="flag" size={16} color={theme.brand.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{t.reminder_priority}</Text>
          </View>
          <View style={styles.optionRow}>
            {PRIORITIES.map((p) => {
              const active = priority === p
              const label = p === 'low'
                ? t.reminder_priority_low
                : p === 'medium'
                ? t.reminder_priority_medium
                : t.reminder_priority_high
              return (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[styles.optionBtn, {
                    backgroundColor: active ? theme.brand.primary : theme.bg.primary,
                    borderColor: active ? theme.brand.primary : theme.border.subtle,
                  }]}
                >
                  <Text style={{ color: active ? '#fff' : theme.text.secondary, fontSize: 12, fontWeight: '700' }}>
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {!isInbox && <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: theme.brand.primary + '1F' }]}>
              <Feather name="repeat" size={16} color={theme.brand.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{t.reminder_recurrence}</Text>
          </View>
          <View style={styles.optionRow}>
            {RECURRENCES.map((r) => {
              const active = recurrence === r
              return (
                <Pressable
                  key={r}
                  onPress={() => setRecurrence(r)}
                  style={[styles.optionBtn, {
                    backgroundColor: active ? theme.brand.primary : theme.bg.primary,
                    borderColor: active ? theme.brand.primary : theme.border.subtle,
                  }]}
                >
                  <Text style={{ color: active ? '#fff' : theme.text.secondary, fontSize: 12, fontWeight: '700' }}>
                    {recurrenceLabel(r)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>}

        {isEditing && (
          <Pressable onPress={onDelete} style={[styles.deleteBtn, { borderColor: theme.semantic.danger + '55' }]}>
            <Feather name="trash-2" size={16} color={theme.semantic.danger} />
            <Text style={[styles.deleteBtnText, { color: theme.semantic.danger }]}>{t.delete_reminder}</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <Pressable
          onPress={onSave}
          disabled={submitting}
          style={[styles.saveBtn, { backgroundColor: submitting ? theme.text.muted : theme.brand.primary }]}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{isEditing ? t.update : t.save}</Text>}
        </Pressable>
      </View>
      {confirmSheet && (
        <ConfirmEntrySheet
          visible={!!confirmSheet}
          rawInput={confirmSheet.rawInput}
          fields={confirmSheet.fields}
          onSave={onSheetSave}
          onEdit={onSheetEdit}
          onCancel={() => setConfirmSheet(null)}
          busy={confirmBusy}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3], paddingBottom: 112 },
  previewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    flexDirection: 'row',
    gap: spacing[3],
  },
  previewIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBody: { flex: 1, gap: spacing[1] },
  previewKicker: { fontSize: 12, fontWeight: '700' },
  previewTitle: { fontSize: 21, lineHeight: 27, fontWeight: '700' },
  previewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  previewMeta: { fontSize: 12, lineHeight: 17 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
  },
  inboxToggle: {
    minHeight: 58,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  inboxTitle: { fontSize: 15, fontWeight: '700' },
  inboxBody: { fontSize: 12, marginTop: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  smartInputWrap: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    paddingBottom: 46,
  },
  smartInput: { minHeight: 42, fontSize: 14, lineHeight: 19 },
  smartActions: {
    position: 'absolute',
    right: spacing[2],
    bottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  smartSend: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '700' },
  titleInput: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 17, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  dateRow: { flexDirection: 'row', gap: spacing[3] },
  datePill: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  datePillText: { fontSize: 15, fontWeight: '700' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  optionBtn: { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radius.full, borderWidth: 1 },
  notifyHintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  notifyHint: { fontSize: 12, fontStyle: 'italic' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700' },
})
