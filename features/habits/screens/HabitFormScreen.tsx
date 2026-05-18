import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useHabitsBootstrap, useHabits, useHabitActions } from '../hooks/useHabits'
import type { Cadence } from '../types'

const CADENCES: Cadence[] = ['daily', 'weekdays', 'weekly']

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
  const [target, setTarget] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    if (!editingHabit || prefilled) return
    setName(editingHabit.name)
    setIcon(editingHabit.icon)
    setColor(editingHabit.color)
    setCadence(editingHabit.cadence)
    setTarget(String(editingHabit.target_per_period))
    setPrefilled(true)
  }, [editingHabit, prefilled])

  const cadenceLabel = (c: Cadence): string => {
    const map: Record<Cadence, string> = {
      daily: t.cadence_daily,
      weekdays: t.cadence_weekdays,
      weekly: t.cadence_weekly,
    }
    return map[c]
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
    const res = isEditing
      ? await updateHabit({ id: editingId!, name: trimmed, icon, color, cadence, target_per_period: targetNum })
      : await createHabit({ name: trimmed, icon, color, cadence, target_per_period: targetNum })
    setSubmitting(false)
    if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); return }
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
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
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  colorBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  cadenceRow: { flexDirection: 'row', gap: spacing[2] },
  cadenceBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  targetBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  targetBtnText: { fontSize: 22, fontWeight: '300' },
  targetValue: { fontSize: 24, fontWeight: '700', minWidth: 40, textAlign: 'center' },
  saveBtn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center', marginTop: spacing[2] },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing[3] },
  deleteBtnText: { fontSize: 15 },
})
