import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Modal,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Feather } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { hapticSaveSuccess } from '@services/haptics'
import { notifySaved } from '@store/toastStore'
import { getProviderKey } from '@services/ai/openai'
import { parseHabitLog } from '../aiParser'
import { VoiceButton } from '@components/VoiceButton'
import { useSettingsStore } from '@store/settingsStore'
import { requestNotificationPermission } from '@services/notifications'
import { useHabitsBootstrap, useHabits, useHabitActions } from '../hooks/useHabits'
import type { Cadence } from '../types'

const CADENCES: Cadence[] = ['daily', 'weekdays', 'weekly', 'monthly', 'custom']
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0] as const

const PRESET_ICONS = ['✅', '💪', '🏃', '📚', '🧘', '💧', '🥗', '😴', '🎯', '🧹', '💊', '🎸', '✍️', '🌿', '🚴']
const PRESET_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
  '#00BCD4', '#8BC34A', '#FFC107', '#3F51B5', '#E91E63',
]

export function HabitFormScreen() {
  useHabitsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const habits = useHabits()
  const { createHabit, updateHabit, deleteHabit } = useHabitActions()
  const aiProvider = useSettingsStore((s) => s.aiProvider)

  const params = useLocalSearchParams<{ id?: string }>()
  const editingId = typeof params.id === 'string' ? params.id : null
  const editingHabit = useMemo(
    () => (editingId ? habits.find((h) => h.id === editingId) ?? null : null),
    [editingId, habits]
  )
  const isEditing = !!editingId

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('✅')
  const [color, setColor] = useState('#4CAF50')
  const [cadence, setCadence] = useState<Cadence>('daily')
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [target, setTarget] = useState('1')
  const [notificationTimes, setNotificationTimes] = useState<string[]>([])
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [pickerDate, setPickerDate] = useState(new Date())
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const [smartText, setSmartText] = useState('')
  const [parsing, setParsing] = useState(false)

  useEffect(() => {
    if (!editingHabit || prefilled) return
    setName(editingHabit.name)
    setIcon(editingHabit.icon)
    setColor(editingHabit.color)
    setCadence(editingHabit.cadence)
    setScheduleDays((editingHabit.schedule_days ?? '')
      .split(',')
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6))
    setTarget(String(editingHabit.target_per_period))
    setNotificationTimes(editingHabit.notification_times ? JSON.parse(editingHabit.notification_times) : [])
    setPrefilled(true)
  }, [editingHabit, prefilled])

  const WEEKDAYS = [
    { value: 1, label: t.day_mon },
    { value: 2, label: t.day_tue },
    { value: 3, label: t.day_wed },
    { value: 4, label: t.day_thu },
    { value: 5, label: t.day_fri },
    { value: 6, label: t.day_sat },
    { value: 0, label: t.day_sun },
  ]

  const cadenceLabel = (c: Cadence): string => {
    const map: Record<Cadence, string> = {
      daily: t.cadence_daily,
      weekdays: t.cadence_weekdays,
      weekly: t.cadence_weekly,
      monthly: t.cadence_monthly,
      custom: t.cadence_custom,
    }
    return map[c]
  }

  const toggleScheduleDay = (day: number) => {
    setScheduleDays((days) => days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day].sort((a, b) => a - b))
  }

  const confirmTimePicker = (date: Date) => {
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    const timeStr = `${h}:${m}`
    setNotificationTimes((prev) => prev.includes(timeStr) ? prev : [...prev, timeStr].sort())
    setShowTimePicker(false)
  }

  const removeNotificationTime = (time: string) => {
    setNotificationTimes((prev) => prev.filter((v) => v !== time))
  }

  const onSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      Alert.alert(t.invalid_amount, t.habit_name_placeholder)
      return
    }
    const targetNum = parseInt(target, 10)
    if (isNaN(targetNum) || targetNum < 1) {
      Alert.alert(t.invalid_amount, t.habit_target)
      return
    }
    setSubmitting(true)
    const schedule_days = cadence === 'custom'
      ? (scheduleDays.length > 0 ? scheduleDays.join(',') : WEEKDAY_VALUES.join(','))
      : null
    const notification_times = notificationTimes.length > 0 ? JSON.stringify(notificationTimes) : null
    const res = isEditing
      ? await updateHabit({ id: editingId!, name: trimmed, icon, color, cadence, target_per_period: targetNum, schedule_days, notification_times })
      : await createHabit({ name: trimmed, icon, color, cadence, target_per_period: targetNum, schedule_days, notification_times })
    setSubmitting(false)
    if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); return }
    void hapticSaveSuccess()
    notifySaved(t, useSettingsStore.getState().syncHabits)
    router.back()
  }

  const onDelete = () => {
    Alert.alert(t.delete_habit, t.delete_habit_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          const r = await deleteHabit(editingId!)
          if (r.ok) router.back()
          else Alert.alert(t.could_not_save, r.error ?? '')
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
      const parsed = await parseHabitLog(input, habits)
      if (!parsed) { Alert.alert(t.ai_error, t.parse_failed); return }
      setName(parsed.matched_habit_name)
      setSmartText('')
    } catch {
      Alert.alert(t.ai_error, t.parse_failed)
    } finally {
      setParsing(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
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
            placeholder={t.nl_placeholder_habits}
            placeholderTextColor={theme.text.muted}
            style={[styles.smartInput, { color: theme.text.primary }]}
            returnKeyType="done"
            editable={!parsing}
            multiline
            onSubmitEditing={() => handleSmartParse()}
          />
          <View style={styles.smartActions}>
            <VoiceButton onResult={(text) => handleSmartParse(text)} disabled={parsing} size={38} module="habits" />
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

      {/* Name */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.new_habit.toUpperCase()}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t.habit_name_placeholder}
        placeholderTextColor={theme.text.muted}
        style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        autoFocus={!isEditing}
      />

      {/* Icon */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.habit_icon.toUpperCase()}</Text>
      <View style={styles.grid}>
        {PRESET_ICONS.map((ic) => (
          <Pressable
            key={ic}
            onPress={() => setIcon(ic)}
            style={[styles.iconBtn, {
              backgroundColor: icon === ic ? theme.brand.primary + '22' : theme.bg.elevated,
              borderColor: icon === ic ? theme.brand.primary : theme.border.subtle,
            }]}
          >
            <Text style={{ fontSize: 20 }}>{ic}</Text>
          </Pressable>
        ))}
      </View>

      {/* Color */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.category_color.toUpperCase()}</Text>
      <View style={styles.colorRow}>
        {PRESET_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[styles.colorBtn, { backgroundColor: c, borderColor: color === c ? theme.text.primary : 'transparent' }]}
          />
        ))}
      </View>

      {/* Cadence */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.habit_cadence.toUpperCase()}</Text>
      <View style={styles.cadenceRow}>
        {CADENCES.map((c) => {
          const active = cadence === c
          return (
            <Pressable
              key={c}
              onPress={() => setCadence(c)}
              style={[styles.cadenceBtn, {
                backgroundColor: active ? theme.brand.primary : theme.bg.elevated,
                borderColor: active ? theme.brand.primary : theme.border.subtle,
              }]}
            >
              <Text style={{ color: active ? '#fff' : theme.text.secondary, fontSize: 13, fontWeight: '600' }}>
                {cadenceLabel(c)}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {cadence === 'custom' ? (
        <>
          <Text style={[styles.label, { color: theme.text.muted }]}>{t.schedule_days_label.toUpperCase()}</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => {
              const active = scheduleDays.includes(day.value)
              return (
                <Pressable
                  key={day.value}
                  onPress={() => toggleScheduleDay(day.value)}
                  style={[styles.weekdayBtn, {
                    backgroundColor: active ? theme.brand.primary : theme.bg.elevated,
                    borderColor: active ? theme.brand.primary : theme.border.subtle,
                  }]}
                >
                  <Text style={[styles.weekdayText, { color: active ? '#fff' : theme.text.secondary }]}>
                    {day.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </>
      ) : null}

      {/* Target */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.habit_target.toUpperCase()}</Text>
      <View style={styles.targetRow}>
        <Pressable
          onPress={() => setTarget(String(Math.max(1, parseInt(target, 10) - 1)))}
          style={[styles.targetBtn, { backgroundColor: theme.bg.elevated, borderColor: theme.border.strong }]}
        >
          <Text style={[styles.targetBtnText, { color: theme.text.primary }]}>−</Text>
        </Pressable>
        <Text style={[styles.targetValue, { color: theme.text.primary }]}>{target}</Text>
        <Pressable
          onPress={() => setTarget(String(Math.min(99, parseInt(target, 10) + 1)))}
          style={[styles.targetBtn, { backgroundColor: theme.bg.elevated, borderColor: theme.border.strong }]}
        >
          <Text style={[styles.targetBtnText, { color: theme.text.primary }]}>+</Text>
        </Pressable>
      </View>

      {/* Notifications */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.habit_notifications.toUpperCase()}</Text>
      {notificationTimes.length === 0 ? (
        <Text style={[styles.emptyNote, { color: theme.text.muted }]}>{t.habit_no_notifications}</Text>
      ) : (
        <View style={styles.timeChipRow}>
          {notificationTimes.map((time) => (
            <View key={time} style={[styles.timeChip, { backgroundColor: theme.bg.elevated, borderColor: theme.border.strong }]}>
              <Feather name="clock" size={13} color={theme.text.secondary} style={{ marginRight: 4 }} />
              <Text style={[styles.timeChipText, { color: theme.text.primary }]}>{time}</Text>
              <Pressable onPress={() => removeNotificationTime(time)} hitSlop={8} style={{ marginLeft: 6 }}>
                <Feather name="x" size={13} color={theme.text.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {notificationTimes.length < 5 ? (
        <Pressable
          onPress={async () => {
            const granted = await requestNotificationPermission()
            if (!granted) {
              Alert.alert(t.habit_notification_permission_title, t.habit_notification_permission_msg)
              return
            }
            setPickerDate(new Date())
            setShowTimePicker(true)
          }}
          style={[styles.addTimeBtn, { borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        >
          <Feather name="plus" size={14} color={theme.brand.primary} />
          <Text style={[styles.addTimeBtnText, { color: theme.brand.primary }]}>{t.habit_add_notification}</Text>
        </Pressable>
      ) : null}

      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="default"
          onChange={(_, date) => { setShowTimePicker(false); if (date) confirmTimePicker(date) }}
        />
      )}
      {showTimePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowTimePicker(false)}>
            <Pressable style={[styles.modalSheet, { backgroundColor: theme.bg.elevated }]}>
              <DateTimePicker
                value={pickerDate}
                mode="time"
                display="spinner"
                onChange={(_, date) => { if (date) setPickerDate(date) }}
                style={{ width: '100%' }}
              />
              <Pressable
                onPress={() => confirmTimePicker(pickerDate)}
                style={[styles.modalConfirm, { backgroundColor: theme.brand.primary }]}
              >
                <Text style={styles.modalConfirmText}>{t.save}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

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
          <Text style={[styles.deleteBtnText, { color: theme.text.danger }]}>{t.delete_habit}</Text>
        </Pressable>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing[4], gap: spacing[3] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '800' },
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
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  colorBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  cadenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  cadenceBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  weekdayBtn: { minWidth: 48, alignItems: 'center', borderRadius: radius.full, borderWidth: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  weekdayText: { fontSize: 12, fontWeight: '800' },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  targetBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  targetBtnText: { fontSize: 22, fontWeight: '300' },
  targetValue: { fontSize: 24, fontWeight: '700', minWidth: 40, textAlign: 'center' },
  saveBtn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center', marginTop: spacing[2] },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing[3] },
  deleteBtnText: { fontSize: 15 },
  emptyNote: { fontSize: 13, fontStyle: 'italic' },
  timeChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  timeChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  timeChipText: { fontSize: 13, fontWeight: '600' },
  addTimeBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  addTimeBtnText: { fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing[4], gap: spacing[3] },
  modalConfirm: { paddingVertical: spacing[3], borderRadius: radius.md, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
