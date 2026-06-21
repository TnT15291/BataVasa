import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { useGoalsStore } from '@store/goalsStore'
import { useFinanceStore } from '@store/financeStore'
import { useFinanceBootstrap, useCategories } from '@features/finance/hooks/useFinance'
import { matchCategory, translateCategoryName } from '@features/finance/i18n'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { getProviderKey, isAiAvailable } from '@services/ai/openai'
import { VoiceButton } from '@components/VoiceButton'
import { notifySaved } from '@store/toastStore'
import { hapticSaveSuccess } from '@services/haptics'
import { parseGoalEntry, type ParsedGoal } from '../aiParser'
import { GoalCoachSheet } from '../components/GoalCoachSheet'
import type { GoalMetricBinding, GoalWithProgress, CreateGoalInput } from '../types'

type SourceKind = 'finance' | 'habits' | 'journals' | 'reminders'

// Maps a chosen source into the goal's binding + target type/unit. Shared by
// the manual Save path and the draft goal built for the cross-module coach.
function goalMeta(sourceKind: SourceKind, sourceId: string, currency: string) {
  const binding: GoalMetricBinding =
    sourceKind === 'finance' ? { module: 'finance', aggregation: 'sum_amount', category_id: sourceId }
    : sourceKind === 'habits' ? { module: 'habits', aggregation: 'completion_rate', habit_id: sourceId }
    : sourceKind === 'journals' ? { module: 'journals', aggregation: 'entry_count', tag: sourceId }
    : { module: 'reminders', aggregation: 'completed_count' }
  const targetType = sourceKind === 'finance' ? 'amount' as const : sourceKind === 'habits' ? 'rate' as const : 'count' as const
  const unit = sourceKind === 'finance' ? currency : sourceKind === 'habits' ? '%' : 'count'
  return { binding, targetType, unit }
}

const JOURNAL_TAGS = [
  'all', 'work', 'family', 'health', 'money', 'sleep',
  'exercise', 'stress', 'food', 'travel', 'social',
] as const

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function dateStringFromLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localDateFromString(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part))
  if (!year || !month || !day) return new Date()
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function displayTargetForParsedGoal(parsed: ParsedGoal): string {
  if (parsed.source === 'habits' && parsed.target_value < 20) return '100'
  return String(parsed.target_value)
}

export function GoalFormScreen() {
  useFinanceBootstrap()
  useHabitsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const currency = useSettingsStore((s) => s.displayCurrency || s.currency)
  const syncGoals = useSettingsStore((s) => s.syncGoals)
  const aiProvider = useSettingsStore((s) => s.aiProvider)
  const params = useLocalSearchParams<{ id?: string }>()
  const editingId = typeof params.id === 'string' ? params.id : null
  const goals = useGoalsStore((s) => s.goals)
  const createGoal = useGoalsStore((s) => s.createGoal)
  const updateGoal = useGoalsStore((s) => s.updateGoal)
  const createCategory = useFinanceStore((s) => s.createCategory)
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
  const [smartText, setSmartText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'due' | null>(null)
  const [hasSmartReview, setHasSmartReview] = useState(false)
  const [pendingFinanceCategoryName, setPendingFinanceCategoryName] = useState('')
  // Draft goal pre-save: drives the cross-module suggestion sheet that pops up
  // right after Smart Entry parsing, before the goal is committed.
  const [coachGoal, setCoachGoal] = useState<GoalWithProgress | null>(null)
  const [showCoach, setShowCoach] = useState(false)

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

  // Validate current form state and build the create payload. Reused by the
  // manual Save button and the coach's "create goal & apply" path.
  const buildCreateInput = (resolvedSourceId = sourceId): { ok: true; input: CreateGoalInput } | { ok: false; error: string } => {
    const trimmed = title.trim()
    if (!trimmed) return { ok: false, error: t.goal_title_required }
    // Reminders track all completed tasks, so they need no sub-source selection.
    if (sourceKind !== 'reminders' && !resolvedSourceId) return { ok: false, error: t.goal_source_required }
    const target = Number(targetText.replace(',', '.'))
    if (!Number.isFinite(target) || target <= 0) return { ok: false, error: t.invalid_amount_msg }
    const { binding, targetType, unit } = goalMeta(sourceKind, resolvedSourceId, currency)
    return {
      ok: true,
      input: {
        title: trimmed,
        description: description.trim() || undefined,
        target_type: targetType,
        target_value: target,
        unit,
        start_date: `${startDate}T00:00:00.000Z`,
        due_date: dueDate ? `${dueDate}T23:59:59.999Z` : null,
        metric_binding: binding,
      },
    }
  }

  const resolveSourceIdForSave = async (): Promise<{ ok: true; sourceId: string } | { ok: false; error: string }> => {
    if (sourceKind === 'reminders' || sourceId) return { ok: true, sourceId }
    const name = pendingFinanceCategoryName.trim()
    if (sourceKind !== 'finance' || !name) return { ok: false, error: t.goal_source_required }
    const res = await createCategory({
      name,
      icon: 'target',
      color: MODULE_COLORS.finance,
      kind: 'savings',
    })
    if (!res.ok) return { ok: false, error: res.error ?? t.goal_source_required }
    const created = useFinanceStore.getState().categories.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
    if (!created) return { ok: false, error: t.goal_source_required }
    setSourceId(created.id)
    setPendingFinanceCategoryName('')
    return { ok: true, sourceId: created.id }
  }

  const onSave = async () => {
    setSubmitting(true)
    const resolved = await resolveSourceIdForSave()
    if (!resolved.ok) {
      setSubmitting(false)
      Alert.alert(t.could_not_save, resolved.error)
      return
    }
    const built = buildCreateInput(resolved.sourceId)
    if (!built.ok) {
      setSubmitting(false)
      Alert.alert(t.could_not_save, built.error)
      return
    }
    if (editingId) {
      const r = await updateGoal({ id: editingId, ...built.input })
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

    const r = await createGoal(built.input)
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

  // Coach draft-apply: persist the goal from the current form, return its id so
  // the sheet can attach the selected cross-module items and route to detail.
  const persistGoalFromForm = async (): Promise<{ ok: boolean; goalId?: string; error?: string }> => {
    const resolved = await resolveSourceIdForSave()
    if (!resolved.ok) return { ok: false, error: resolved.error }
    const built = buildCreateInput(resolved.sourceId)
    if (!built.ok) return { ok: false, error: built.error }
    const r = await createGoal(built.input)
    return { ok: r.ok, goalId: r.id, error: r.error }
  }

  const onCoachApplied = (goalId?: string) => {
    setShowCoach(false)
    if (goalId) router.replace({ pathname: '/goal-detail', params: { id: goalId } })
    else router.replace('/goals')
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

  const applyParsedGoal = (parsed: ParsedGoal) => {
    const targetDisplay = displayTargetForParsedGoal(parsed)
    setTitle(parsed.title)
    setDescription(parsed.description)
    setSourceKind(parsed.source)
    setTargetText(targetDisplay)
    setStartDate(parsed.start_date)
    setDueDate(parsed.due_date ?? '')

    // Resolve the concrete source id + a human label for the draft goal.
    let resolvedId = ''
    let sourceLabel = ''
    if (parsed.source === 'finance') {
      const matched = matchCategory(financeCategories, parsed.source_hint, t)
      resolvedId = matched?.id ?? ''
      sourceLabel = matched ? translateCategoryName(matched, t) : parsed.source_hint.trim()
      setPendingFinanceCategoryName(matched ? '' : parsed.source_hint.trim())
    } else if (parsed.source === 'habits') {
      setPendingFinanceCategoryName('')
      const hint = parsed.source_hint.toLowerCase()
      const matched = habits.find((h) => {
        const name = h.name.toLowerCase()
        return name === hint || name.includes(hint) || hint.includes(name)
      }) ?? habits[0]
      resolvedId = matched?.id ?? ''
      sourceLabel = matched?.name ?? ''
    } else if (parsed.source === 'journals') {
      setPendingFinanceCategoryName('')
      const hint = parsed.source_hint.toLowerCase()
      const matched = JOURNAL_TAGS.find((tag) => {
        const label = (tagLabels[tag] ?? tag).toLowerCase()
        return tag === hint || label === hint || label.includes(hint) || hint.includes(label)
      }) ?? 'all'
      resolvedId = matched
      sourceLabel = tagLabels[matched] ?? matched
    } else {
      setPendingFinanceCategoryName('')
      resolvedId = ''
      sourceLabel = t.goal_source_reminder
    }
    setSourceId(resolvedId)
    setSmartText('')
    setHasSmartReview(true)

    // Pop up cross-module suggestions immediately from a draft (unsaved) goal.
    // Skip when editing (would create a duplicate) or when AI is unavailable —
    // then the user just reviews the filled form and taps Save.
    const canCoach = parsed.source === 'reminders' || resolvedId || (parsed.source === 'finance' && sourceLabel.trim())
    if (editingId || !isAiAvailable() || !canCoach) return
    const target = Number(targetDisplay.replace(',', '.')) || 0
    const { binding, targetType, unit } = goalMeta(parsed.source, resolvedId, currency)
    const nowIso = new Date().toISOString()
    const draft: GoalWithProgress = {
      id: 'draft',
      user_id: null,
      title: parsed.title,
      description: parsed.description || null,
      target_type: targetType,
      target_value: target,
      unit,
      start_date: `${parsed.start_date}T00:00:00.000Z`,
      due_date: parsed.due_date ? `${parsed.due_date}T23:59:59.999Z` : null,
      metric_binding: JSON.stringify(binding),
      status: 'active',
      created_at: nowIso,
      updated_at: nowIso,
      deleted_at: null,
      synced_at: null,
      binding,
      progress: { current: 0, target, percent: 0, label: `0 / ${target}`, sourceLabel },
    }
    setCoachGoal(draft)
    setShowCoach(true)
  }

  const handleSmartParse = async (override?: string) => {
    const input = (override ?? smartText).trim()
    if (!input || parsing) return
    const key = await getProviderKey(aiProvider)
    if (!key) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    if (override) setSmartText(override)
    setParsing(true)
    try {
      const parsed = await parseGoalEntry(input, {
        categories: financeCategories,
        habits,
        journalTags: JOURNAL_TAGS,
        currency,
      })
      if (!parsed) { Alert.alert(t.ai_error, t.parse_failed); return }
      applyParsedGoal(parsed)
    } catch {
      Alert.alert(t.ai_error, t.parse_failed)
    } finally {
      setParsing(false)
    }
  }

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
  const recommendedSources = [
    { key: 'finance' as const, label: t.goal_source_finance, icon: MODULE_ICONS.finance, color: MODULE_COLORS.finance, target: '' },
    { key: 'habits' as const, label: t.goal_source_habit, icon: MODULE_ICONS.habits, color: MODULE_COLORS.habits, target: '100' },
  ]
  const moreSources = [
    { key: 'journals' as const, label: t.goal_source_journal, icon: MODULE_ICONS.journal, color: MODULE_COLORS.journal, target: '10' },
    { key: 'reminders' as const, label: t.goal_source_reminder, icon: MODULE_ICONS.tasks, color: MODULE_COLORS.tasks, target: '10' },
  ]
  const renderSourceButton = (item: typeof recommendedSources[number] | typeof moreSources[number]) => {
    const active = sourceKind === item.key
    return (
      <Pressable
        key={item.key}
        onPress={() => { setSourceKind(item.key); setSourceId(''); setTargetText(item.target); setPendingFinanceCategoryName('') }}
        style={[styles.segmentBtn, { backgroundColor: active ? item.color : theme.bg.elevated, borderColor: active ? item.color : theme.border.subtle }]}
      >
        <Feather name={item.icon} size={14} color={active ? '#fff' : item.color} />
        <Text style={[styles.segmentText, { color: active ? '#fff' : theme.text.secondary }]} numberOfLines={1}>{item.label}</Text>
      </Pressable>
    )
  }
  const selectedSourceLabel = sourceKind === 'finance'
    ? pendingFinanceCategoryName.trim()
      ? `${pendingFinanceCategoryName.trim()} (${t.new_category})`
      : sources.find((s) => s.id === sourceId)?.label ?? ''
    : sourceKind === 'habits'
    ? sources.find((s) => s.id === sourceId)?.label ?? ''
    : sourceKind === 'journals'
    ? sources.find((s) => s.id === sourceId)?.label ?? ''
    : t.goal_source_reminder
  const targetSummary = targetText.trim()
    ? `${targetText.trim()} ${sourceKind === 'finance' ? currency : isCount ? t.goal_count_type : '%'}`
    : ''

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg.primary }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
            placeholder={t.nl_placeholder_goals}
            placeholderTextColor={theme.text.muted}
            style={[styles.smartInput, { color: theme.text.primary }]}
            returnKeyType="done"
            editable={!parsing}
            multiline
            onSubmitEditing={() => handleSmartParse()}
          />
          <View style={styles.smartActions}>
            <VoiceButton onResult={(text) => handleSmartParse(text)} disabled={parsing} size={44} module="goals" />
            <Pressable
              onPress={() => handleSmartParse()}
              disabled={parsing || !smartText.trim()}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t.send}
              style={[styles.smartSend, { backgroundColor: parsing || !smartText.trim() ? theme.border.strong : theme.brand.primary }]}
            >
              {parsing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
            </Pressable>
          </View>
        </View>
        <Text style={[styles.smartHint, { color: theme.text.muted }]}>{t.smart_entry_hint}</Text>
      </View>

      {hasSmartReview ? (
        <View style={[styles.reviewCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.reviewHeader}>
            <Feather name="check-circle" size={16} color={accentColor} />
            <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{t.ai_confirm_parsed}</Text>
          </View>
          {[
            [t.goals, title],
            [t.goal_primary_metric, selectedSourceLabel],
            [t.goal_target, targetSummary],
            [t.goal_due_date, dueDate || t.goal_no_due_date],
          ].map(([label, value]) => value ? (
            <View key={label} style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, { color: theme.text.muted }]}>{label}</Text>
              <Text style={[styles.reviewValue, { color: theme.text.primary }]} numberOfLines={2}>{value}</Text>
            </View>
          ) : null)}
        </View>
      ) : null}

      <Text style={[styles.label, { color: theme.text.muted }]}>{t.goals}</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t.goal_title_placeholder}
        placeholderTextColor={theme.text.muted}
        style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={t.goal_description_placeholder}
        placeholderTextColor={theme.text.muted}
        style={[styles.input, styles.textarea, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        multiline
      />

      <Text style={[styles.label, { color: theme.text.muted }]}>{t.goal_primary_metric}</Text>
      <Text style={[styles.sourceGroupLabel, { color: theme.text.muted }]}>{t.goal_recommended_sources}</Text>
      <View style={styles.segment}>
        {recommendedSources.map(renderSourceButton)}
      </View>
      <Text style={[styles.sourceGroupLabel, { color: theme.text.muted }]}>{t.goal_more_sources}</Text>
      <View style={styles.segment}>
        {moreSources.map(renderSourceButton)}
      </View>
      <View style={[styles.explainBox, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <Feather name="link-2" size={15} color={accentColor} />
        <View style={styles.explainCopy}>
          <Text style={[styles.explainText, { color: theme.text.secondary }]}>{sourceHint}</Text>
          <Text style={[styles.explainSubtext, { color: theme.text.muted }]}>{t.goal_primary_metric_hint}</Text>
        </View>
      </View>

      <View style={styles.sourceGrid}>
        {sources.map((source) => {
          const active = sourceId === source.id
          return (
            <Pressable
              key={source.id}
              onPress={() => { setSourceId(source.id); setPendingFinanceCategoryName('') }}
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
        placeholder={sourceKind === 'finance' ? currency : isCount ? '10' : '100'}
        placeholderTextColor={theme.text.muted}
        keyboardType={isCount ? 'number-pad' : 'decimal-pad'}
        style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
      />
      <Text style={[styles.hint, { color: theme.text.muted }]}>{sourceKind === 'finance' ? t.goal_amount_type : sourceKind === 'habits' ? t.goal_rate_type : t.goal_count_type}</Text>

      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Text style={[styles.label, { color: theme.text.muted }]}>{t.goal_start_date}</Text>
          <Pressable
            onPress={() => setDatePickerTarget('start')}
            style={[styles.dateInput, { borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
          >
            <Feather name="calendar" size={16} color={theme.brand.primary} />
            <Text style={[styles.dateInputText, { color: theme.text.primary }]}>{startDate || t.date_hint}</Text>
          </Pressable>
        </View>
        <View style={styles.dateField}>
          <Text style={[styles.label, { color: theme.text.muted }]}>{t.goal_due_date}</Text>
          <Pressable
            onPress={() => setDatePickerTarget('due')}
            style={[styles.dateInput, { borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
          >
            <Feather name="calendar" size={16} color={theme.brand.primary} />
            <Text style={[styles.dateInputText, { color: dueDate ? theme.text.primary : theme.text.muted }]}>
              {dueDate || t.goal_no_due_date}
            </Text>
            {dueDate ? (
              <Pressable
                onPress={(event) => { event.stopPropagation(); setDueDate('') }}
                hitSlop={8}
                style={styles.clearDateBtn}
              >
                <Feather name="x" size={15} color={theme.text.muted} />
              </Pressable>
            ) : null}
          </Pressable>
        </View>
      </View>

      {datePickerTarget ? (
        <DateTimePicker
          value={datePickerTarget === 'start' ? localDateFromString(startDate) : localDateFromString(dueDate || startDate)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={datePickerTarget === 'due' ? localDateFromString(startDate) : undefined}
          onChange={(_, date) => {
            if (Platform.OS !== 'ios') setDatePickerTarget(null)
            if (!date) return
            const next = dateStringFromLocalDate(date)
            if (datePickerTarget === 'start') {
              setStartDate(next)
              if (dueDate && localDateFromString(dueDate) < localDateFromString(next)) setDueDate(next)
            } else {
              setDueDate(next)
            }
          }}
        />
      ) : null}

      <Text style={[styles.hint, { color: theme.text.muted }]}>{t.goal_auto_progress}</Text>
      <Pressable onPress={onSave} disabled={submitting} style={[styles.saveBtn, { backgroundColor: submitting ? theme.text.muted : MODULE_COLORS.analysis }]}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editingId ? t.update : t.save}</Text>}
      </Pressable>
    </ScrollView>

    {coachGoal ? (
      <GoalCoachSheet
        visible={showCoach}
        goal={coachGoal}
        onClose={() => setShowCoach(false)}
        persistBeforeApply={persistGoalFromForm}
        onApplied={onCoachApplied}
      />
    ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[3] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  reviewCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[3] },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  reviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  reviewLabel: { width: 104, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  reviewValue: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  smartInputWrap: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    paddingBottom: 56,
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
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartHint: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  segmentBtn: { flexBasis: '47%', flexGrow: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  segmentText: { fontSize: 12, fontWeight: '700' },
  sourceGroupLabel: { marginTop: -spacing[1], fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  sourceChip: { maxWidth: '48%', borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  sourceText: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 18 },
  explainBox: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  explainCopy: { flex: 1, gap: 2 },
  explainText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  explainSubtext: { fontSize: 12, lineHeight: 17 },
  dateRow: { flexDirection: 'row', gap: spacing[2] },
  dateField: { flex: 1, gap: spacing[2] },
  dateInput: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dateInputText: { flex: 1, fontSize: 15, fontWeight: '600' },
  clearDateBtn: { width: 26, height: 26, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
