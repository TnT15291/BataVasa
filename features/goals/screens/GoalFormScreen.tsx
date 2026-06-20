import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { useGoalsStore } from '@store/goalsStore'
import { useFinanceBootstrap, useCategories } from '@features/finance/hooks/useFinance'
import { translateCategoryName } from '@features/finance/i18n'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { notifySaved } from '@store/toastStore'
import { hapticSaveSuccess } from '@services/haptics'
import type { GoalMetricBinding } from '../types'

type SourceKind = 'finance' | 'habits' | 'journals' | 'reminders'

const JOURNAL_TAGS = [
  'all', 'work', 'family', 'health', 'money', 'sleep',
  'exercise', 'stress', 'food', 'travel', 'social',
] as const

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function GoalFormScreen() {
  useFinanceBootstrap()
  useHabitsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const currency = useSettingsStore((s) => s.displayCurrency || s.currency)
  const syncGoals = useSettingsStore((s) => s.syncGoals)
  const params = useLocalSearchParams<{ id?: string }>()
  const editingId = typeof params.id === 'string' ? params.id : null
  const goals = useGoalsStore((s) => s.goals)
  const createGoal = useGoalsStore((s) => s.createGoal)
  const updateGoal = useGoalsStore((s) => s.updateGoal)
  const categories = useCategories()
  const habits = useHabits()
  const editing = useMemo(() => goals.find((g) => g.id === editingId) ?? null, [goals, editingId])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sourceKind, setSourceKind] = useState<SourceKind>('finance')
  const [sourceId, setSourceId] = useState('')
  const [targetText, setTargetText] = useState('')
  const [startDate, setStartDate] = useState(todayDate())
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  const financeCategories = categories.filter((c) => c.kind === 'savings' || c.kind === 'income' || c.kind === 'discretionary' || c.kind === 'essential')

  useEffect(() => {
    if (!editing || prefilled) return
    setTitle(editing.title)
    setDescription(editing.description ?? '')
    setTargetText(String(editing.target_value))
    setStartDate(editing.start_date.slice(0, 10))
    setDueDate(editing.due_date?.slice(0, 10) ?? '')
    if (editing.binding?.module === 'habits') {
      setSourceKind('habits')
      setSourceId(editing.binding.habit_id)
    } else if (editing.binding?.module === 'finance') {
      setSourceKind('finance')
      setSourceId(editing.binding.category_id)
    } else if (editing.binding?.module === 'journals') {
      setSourceKind('journals')
      setSourceId(editing.binding.tag)
    } else if (editing.binding?.module === 'reminders') {
      setSourceKind('reminders')
      setSourceId('')
    }
    setPrefilled(true)
  }, [editing, prefilled])

  useEffect(() => {
    if (sourceId) return
    if (sourceKind === 'finance' && financeCategories[0]) setSourceId(financeCategories[0].id)
    if (sourceKind === 'habits' && habits[0]) setSourceId(habits[0].id)
    if (sourceKind === 'journals') setSourceId('all')
  }, [sourceKind, sourceId, financeCategories, habits])

  // Journals/Reminders track a plain count of entries / completed tasks.
  const isCount = sourceKind === 'journals' || sourceKind === 'reminders'

  const onSave = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      Alert.alert(t.could_not_save, t.goal_title_required)
      return
    }
    // Reminders track all completed tasks, so they need no sub-source selection.
    if (sourceKind !== 'reminders' && !sourceId) {
      Alert.alert(t.could_not_save, t.goal_source_required)
      return
    }
    const target = Number(targetText.replace(',', '.'))
    if (!Number.isFinite(target) || target <= 0) {
      Alert.alert(t.could_not_save, t.invalid_amount_msg)
      return
    }

    const binding: GoalMetricBinding =
      sourceKind === 'finance' ? { module: 'finance', aggregation: 'sum_amount', category_id: sourceId }
      : sourceKind === 'habits' ? { module: 'habits', aggregation: 'completion_rate', habit_id: sourceId }
      : sourceKind === 'journals' ? { module: 'journals', aggregation: 'entry_count', tag: sourceId }
      : { module: 'reminders', aggregation: 'completed_count' }

    const targetType = sourceKind === 'finance' ? 'amount' as const : sourceKind === 'habits' ? 'rate' as const : 'count' as const
    const unit = sourceKind === 'finance' ? currency : sourceKind === 'habits' ? '%' : 'count'

    setSubmitting(true)
    const input = {
      title: trimmed,
      description: description.trim() || undefined,
      target_type: targetType,
      target_value: target,
      unit,
      start_date: `${startDate}T00:00:00.000Z`,
      due_date: dueDate ? `${dueDate}T23:59:59.999Z` : null,
      metric_binding: binding,
    }
    if (editingId) {
      const r = await updateGoal({ id: editingId, ...input })
      setSubmitting(false)
      if (!r.ok) {
        Alert.alert(t.could_not_save, r.error ?? '')
        return
      }
      void hapticSaveSuccess()
      notifySaved(t, syncGoals)
      router.back()
      return
    }

    const r = await createGoal(input)
    setSubmitting(false)
    if (!r.ok) {
      Alert.alert(t.could_not_save, r.error ?? '')
      return
    }
    void hapticSaveSuccess()
    notifySaved(t, syncGoals)
    // New goals route to the detail screen with the AI coach auto-opening.
    if (r.id) {
      router.replace({ pathname: '/goal-detail', params: { id: r.id, coach: '1' } })
    } else {
      router.back()
    }
  }

  const tagLabels: Record<string, string> = {
    all: t.tag_all, work: t.tag_work, family: t.tag_family, health: t.tag_health,
    money: t.tag_money, sleep: t.tag_sleep, exercise: t.tag_exercise,
    stress: t.tag_stress, food: t.tag_food, travel: t.tag_travel, social: t.tag_social,
  }
  const sources = sourceKind === 'finance'
    ? financeCategories.map((c) => ({ id: c.id, label: translateCategoryName(c, t), color: c.color }))
    : sourceKind === 'habits'
    ? habits.map((h) => ({ id: h.id, label: h.name, color: h.color || MODULE_COLORS.habits }))
    : sourceKind === 'journals'
    ? JOURNAL_TAGS.map((tag) => ({ id: tag, label: tagLabels[tag] ?? tag, color: MODULE_COLORS.journal }))
    : []
  const sourceHint = sourceKind === 'finance'
    ? t.goal_source_finance_hint
    : sourceKind === 'habits'
    ? t.goal_source_habit_hint
    : sourceKind === 'journals'
    ? t.goal_source_journal_hint
    : t.goal_source_reminder_hint
  const accentColor = sourceKind === 'finance'
    ? MODULE_COLORS.finance
    : sourceKind === 'habits'
    ? MODULE_COLORS.habits
    : sourceKind === 'journals'
    ? MODULE_COLORS.journal
    : MODULE_COLORS.tasks

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg.primary }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.goals}</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t.goal_title_placeholder}
        placeholderTextColor={theme.text.muted}
        style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        autoFocus={!editingId}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={t.goal_description_placeholder}
        placeholderTextColor={theme.text.muted}
        style={[styles.input, styles.textarea, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        multiline
      />

      <Text style={[styles.label, { color: theme.text.muted }]}>{t.goal_source}</Text>
      <View style={styles.segment}>
        {([
          { key: 'finance' as const, label: t.goal_source_finance, icon: MODULE_ICONS.finance, color: MODULE_COLORS.finance, target: '' },
          { key: 'habits' as const, label: t.goal_source_habit, icon: MODULE_ICONS.habits, color: MODULE_COLORS.habits, target: '80' },
          { key: 'journals' as const, label: t.goal_source_journal, icon: MODULE_ICONS.journal, color: MODULE_COLORS.journal, target: '10' },
          { key: 'reminders' as const, label: t.goal_source_reminder, icon: MODULE_ICONS.tasks, color: MODULE_COLORS.tasks, target: '10' },
        ]).map((item) => {
          const active = sourceKind === item.key
          return (
            <Pressable
              key={item.key}
              onPress={() => { setSourceKind(item.key); setSourceId(''); setTargetText(item.target) }}
              style={[styles.segmentBtn, { backgroundColor: active ? item.color : theme.bg.elevated, borderColor: active ? item.color : theme.border.subtle }]}
            >
              <Feather name={item.icon} size={14} color={active ? '#fff' : item.color} />
              <Text style={[styles.segmentText, { color: active ? '#fff' : theme.text.secondary }]} numberOfLines={1}>{item.label}</Text>
            </Pressable>
          )
        })}
      </View>
      <View style={[styles.explainBox, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <Feather name="link-2" size={15} color={accentColor} />
        <Text style={[styles.explainText, { color: theme.text.secondary }]}>{sourceHint}</Text>
      </View>

      <View style={styles.sourceGrid}>
        {sources.map((source) => {
          const active = sourceId === source.id
          return (
            <Pressable
              key={source.id}
              onPress={() => setSourceId(source.id)}
              style={[styles.sourceChip, { backgroundColor: active ? source.color : theme.bg.elevated, borderColor: active ? source.color : theme.border.subtle }]}
            >
              <Text style={[styles.sourceText, { color: active ? '#fff' : theme.text.secondary }]} numberOfLines={1}>{source.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <Text style={[styles.label, { color: theme.text.muted }]}>{t.goal_target}</Text>
      <TextInput
        value={targetText}
        onChangeText={setTargetText}
        placeholder={sourceKind === 'finance' ? currency : isCount ? '10' : '80'}
        placeholderTextColor={theme.text.muted}
        keyboardType={isCount ? 'number-pad' : 'decimal-pad'}
        style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
      />
      <Text style={[styles.hint, { color: theme.text.muted }]}>{sourceKind === 'finance' ? t.goal_amount_type : sourceKind === 'habits' ? t.goal_rate_type : t.goal_count_type}</Text>

      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Text style={[styles.label, { color: theme.text.muted }]}>{t.goal_start_date}</Text>
          <TextInput value={startDate} onChangeText={setStartDate} placeholder={t.date_hint} placeholderTextColor={theme.text.muted} style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]} />
        </View>
        <View style={styles.dateField}>
          <Text style={[styles.label, { color: theme.text.muted }]}>{t.goal_due_date}</Text>
          <TextInput value={dueDate} onChangeText={setDueDate} placeholder={t.goal_no_due_date} placeholderTextColor={theme.text.muted} style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]} />
        </View>
      </View>

      <Text style={[styles.hint, { color: theme.text.muted }]}>{t.goal_auto_progress}</Text>
      <Pressable onPress={onSave} disabled={submitting} style={[styles.saveBtn, { backgroundColor: submitting ? theme.text.muted : MODULE_COLORS.analysis }]}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editingId ? t.update : t.save}</Text>}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  label: { fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  segmentBtn: { flexBasis: '47%', flexGrow: 1, minHeight: 42, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  segmentText: { fontSize: 12, fontWeight: '700' },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  sourceChip: { maxWidth: '48%', borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  sourceText: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 18 },
  explainBox: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  explainText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: spacing[2] },
  dateField: { flex: 1, gap: spacing[2] },
  saveBtn: { minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
