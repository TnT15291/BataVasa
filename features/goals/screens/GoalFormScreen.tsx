import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native'
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
import { useGoalLinkInbox } from '@store/goalLinkInbox'
import { useFinanceBootstrap, useCategories } from '@features/finance/hooks/useFinance'
import { matchCategory, translateCategoryName } from '@features/finance/i18n'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { isAiAvailable } from '@services/ai/openai'
import { parseGoalMeasures } from '@services/goalProgress'
import { uuid } from '@services/uuid'
import { VoiceButton } from '@components/VoiceButton'
import { notifySaved } from '@store/toastStore'
import { hapticSaveSuccess } from '@services/haptics'
import { parseGoalEntry, type ParsedGoal } from '../aiParser'
import { MetricPickerSheet, type MetricSelection } from '../components/MetricPickerSheet'
import type { GoalDirection, GoalMetricBinding, CreateGoalInput } from '../types'

type SourceKind = 'finance' | 'habits' | 'journals' | 'reminders'

// One measure as edited in the form. A goal can carry several; progress = lowest.
type DraftMeasure = {
  key: string
  kind: SourceKind
  sourceId: string
  targetText: string
}

// Cap goals ("stay under X", e.g. "không vượt quá 2tr ăn ngoài") are inferred
// from the goal title's wording instead of a toggle — everything else accumulates
// toward its target (reach). Diacritic-folded so it works with/without accents.
const CAP_MARKERS = [
  'vuot qua', 'khong qua', 'toi da', 'gioi han', 'han che', 'duoi ', 'bot ',
  'ngan sach', 'under', 'less than', 'no more than', 'budget', 'limit',
] as const
function inferFinanceDirection(title: string): GoalDirection {
  const folded = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
  return CAP_MARKERS.some((m) => folded.includes(m)) ? 'cap' : 'reach'
}

// Maps a measure into its binding + target type/unit. Habits are always tracked
// by number of completed sessions (count) — the consistency-% mode was dropped
// because it confusingly hits 100% after a single day.
function goalMeta(sourceKind: SourceKind, sourceId: string, currency: string) {
  const binding: GoalMetricBinding =
    sourceKind === 'finance' ? { module: 'finance', aggregation: 'sum_amount', category_id: sourceId }
    : sourceKind === 'habits' ? { module: 'habits', aggregation: 'completion_count', habit_id: sourceId }
    : sourceKind === 'journals' ? { module: 'journals', aggregation: 'entry_count', tag: sourceId }
    : { module: 'reminders', aggregation: 'completed_count' }
  const targetType = sourceKind === 'finance' ? 'amount' as const : 'count' as const
  const unit = sourceKind === 'finance' ? currency : 'count'
  return { binding, targetType, unit }
}

const MODULE_BY_KIND: Record<SourceKind, keyof typeof MODULE_ICONS> = {
  finance: 'finance', habits: 'habits', journals: 'journal', reminders: 'tasks',
}
const COLOR_BY_KIND: Record<SourceKind, string> = {
  finance: MODULE_COLORS.finance, habits: MODULE_COLORS.habits, journals: MODULE_COLORS.journal, reminders: MODULE_COLORS.tasks,
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
  // The parser already normalizes habit targets deterministically (rate→100 or
  // an explicit session count), so just echo the value it resolved.
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
  const params = useLocalSearchParams<{ id?: string; measureModule?: string; measureId?: string; goalTitle?: string }>()
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
  const [measures, setMeasures] = useState<DraftMeasure[]>([])
  const [startDate, setStartDate] = useState(todayDate())
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [smartText, setSmartText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'due' | null>(null)
  const [hasSmartReview, setHasSmartReview] = useState(false)
  const [showMetricPicker, setShowMetricPicker] = useState(false)

  const financeCategories = categories.filter((c) => c.kind === 'savings' || c.kind === 'income' || c.kind === 'discretionary' || c.kind === 'essential')

  const tagLabels: Record<string, string> = {
    all: t.tag_all, work: t.tag_work, family: t.tag_family, health: t.tag_health,
    money: t.tag_money, sleep: t.tag_sleep, exercise: t.tag_exercise,
    stress: t.tag_stress, food: t.tag_food, travel: t.tag_travel, social: t.tag_social,
  }

  useEffect(() => {
    if (!editing || prefilled) return
    setTitle(editing.title)
    setDescription(editing.description ?? '')
    setStartDate(editing.start_date.slice(0, 10))
    setDueDate(editing.due_date?.slice(0, 10) ?? '')
    setMeasures(parseGoalMeasures(editing).map((m) => ({
      key: uuid(),
      kind: m.binding.module,
      sourceId: m.binding.module === 'finance' ? m.binding.category_id
        : m.binding.module === 'habits' ? m.binding.habit_id
        : m.binding.module === 'journals' ? m.binding.tag
        : '',
      targetText: String(m.target_value),
    })))
    setPrefilled(true)
  }, [editing, prefilled])

  // Reverse-entry: opened from a habit/category via the 🎯 "set as goal" action —
  // seed a single measure (and optional title) bound to that source.
  useEffect(() => {
    if (editingId || seeded) return
    const mod = params.measureModule
    const mid = params.measureId
    if ((mod !== 'finance' && mod !== 'habits') || typeof mid !== 'string' || !mid) return
    if (typeof params.goalTitle === 'string' && params.goalTitle) setTitle(params.goalTitle)
    setMeasures([{ key: uuid(), kind: mod, sourceId: mid, targetText: '' }])
    setSeeded(true)
  }, [editingId, seeded, params.measureModule, params.measureId, params.goalTitle])

  // A habit/category created via its full editor (opened from the metric picker)
  // hands its id back through the inbox — attach it here as a measure.
  const pendingLink = useGoalLinkInbox((s) => s.pending)
  const clearLink = useGoalLinkInbox((s) => s.clear)
  useEffect(() => {
    if (!pendingLink) return
    const key = `${pendingLink.kind}:${pendingLink.id}`
    setMeasures((prev) => prev.some((m) => `${m.kind}:${m.sourceId}` === key)
      ? prev
      : [...prev, { key: uuid(), kind: pendingLink.kind, sourceId: pendingLink.id, targetText: '' }])
    clearLink()
  }, [pendingLink, clearLink])

  const measureLabel = (m: DraftMeasure): string => {
    if (m.kind === 'finance') {
      const c = financeCategories.find((cat) => cat.id === m.sourceId)
      return c ? translateCategoryName(c, t) : ''
    }
    if (m.kind === 'habits') return habits.find((h) => h.id === m.sourceId)?.name ?? ''
    if (m.kind === 'journals') return tagLabels[m.sourceId] ?? m.sourceId
    return t.goal_source_reminder
  }
  // Everything except finance (an amount) is counted.
  const measureIsCount = (m: DraftMeasure) => m.kind !== 'finance'
  const measureUnitLabel = (m: DraftMeasure) => m.kind === 'finance' ? currency : t.goal_count_type

  const updateMeasure = (key: string, patch: Partial<DraftMeasure>) =>
    setMeasures((prev) => prev.map((m) => m.key === key ? { ...m, ...patch } : m))
  const removeMeasure = (key: string) => setMeasures((prev) => prev.filter((m) => m.key !== key))

  // Measures picked from the bottom-sheet (multi-select); de-dupe against the
  // measures already on the goal.
  const handleMeasuresSelected = (sels: MetricSelection[]) => {
    setMeasures((prev) => {
      const existing = new Set(prev.map((m) => `${m.kind}:${m.sourceId}`))
      const additions: DraftMeasure[] = sels
        .filter((s) => !existing.has(`${s.kind}:${s.id}`))
        .map((s) => ({
          key: uuid(),
          kind: s.kind,
          sourceId: s.id,
          // Habits are counted by sessions, so let the user type the number.
          targetText: s.kind === 'habits' ? '' : s.defaultTarget,
        }))
      return [...prev, ...additions]
    })
  }

  // Validate the form and build the create payload. Reused by Save + the coach.
  const buildCreateInput = (): { ok: true; input: CreateGoalInput } | { ok: false; error: string } => {
    const trimmed = title.trim()
    if (!trimmed) return { ok: false, error: t.goal_title_required }
    if (measures.length === 0) return { ok: false, error: t.goal_source_required }
    const built: NonNullable<CreateGoalInput['measures']> = []
    for (const m of measures) {
      if (m.kind !== 'reminders' && !m.sourceId) return { ok: false, error: t.goal_source_required }
      const target = Number(m.targetText.replace(',', '.'))
      if (!Number.isFinite(target) || target <= 0) return { ok: false, error: t.invalid_amount_msg }
      const { binding, targetType, unit } = goalMeta(m.kind, m.sourceId, currency)
      built.push({
        binding,
        target_type: targetType,
        target_value: target,
        unit,
        // 'cap' (stay-under) is inferred from the title wording; only finance can cap.
        direction: m.kind === 'finance' ? inferFinanceDirection(trimmed) : 'reach',
      })
    }
    return {
      ok: true,
      input: {
        title: trimmed,
        description: description.trim() || undefined,
        start_date: `${startDate}T00:00:00.000Z`,
        due_date: dueDate ? `${dueDate}T23:59:59.999Z` : null,
        measures: built,
      },
    }
  }

  const onSave = async () => {
    const built = buildCreateInput()
    if (!built.ok) {
      Alert.alert(t.could_not_save, built.error)
      return
    }
    setSubmitting(true)
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
    if (r.id) {
      router.replace({ pathname: '/goal-detail', params: { id: r.id } })
    } else {
      router.back()
    }
  }

  const applyParsedGoal = async (parsed: ParsedGoal) => {
    const targetDisplay = displayTargetForParsedGoal(parsed)
    setTitle(parsed.title)
    setDescription(parsed.description)
    setStartDate(parsed.start_date)
    setDueDate(parsed.due_date ?? '')

    // Resolve the concrete source id for the measure.
    let resolvedId = ''
    if (parsed.source === 'finance') {
      const matched = matchCategory(financeCategories, parsed.source_hint, t)
      if (matched) {
        resolvedId = matched.id
      } else {
        const name = parsed.source_hint.trim()
        if (name) {
          const res = await createCategory({ name, icon: 'target', color: MODULE_COLORS.finance, kind: 'discretionary' })
          if (res.ok) {
            const created = useFinanceStore.getState().categories.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
            resolvedId = created?.id ?? ''
          }
        }
      }
    } else if (parsed.source === 'habits') {
      const hint = parsed.source_hint.toLowerCase()
      const matched = habits.find((h) => {
        const name = h.name.toLowerCase()
        return name === hint || name.includes(hint) || hint.includes(name)
      }) ?? habits[0]
      resolvedId = matched?.id ?? ''
    } else if (parsed.source === 'journals') {
      const hint = parsed.source_hint.toLowerCase()
      const matched = JOURNAL_TAGS.find((tag) => {
        const label = (tagLabels[tag] ?? tag).toLowerCase()
        return tag === hint || label === hint || label.includes(hint) || hint.includes(label)
      }) ?? 'all'
      resolvedId = matched
    }

    // Smart Entry fills a single measure; the user can add more before saving.
    setMeasures([{ key: uuid(), kind: parsed.source, sourceId: resolvedId, targetText: targetDisplay }])
    setSmartText('')
    setHasSmartReview(true)
  }

  const handleSmartParse = async (override?: string) => {
    const input = (override ?? smartText).trim()
    if (!input || parsing) return
    if (!isAiAvailable()) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    if (override) setSmartText(override)
    setParsing(true)
    try {
      const parsed = await parseGoalEntry(input, {
        categories: financeCategories,
        habits,
        journalTags: JOURNAL_TAGS,
        currency,
      })
      if (!parsed) { Alert.alert(t.goal_unsupported_title, t.goal_unsupported_msg); return }
      await applyParsedGoal(parsed)
    } catch {
      Alert.alert(t.ai_error, t.parse_failed)
    } finally {
      setParsing(false)
    }
  }

  const firstMeasure = measures[0]
  const accentColor = firstMeasure ? COLOR_BY_KIND[firstMeasure.kind] : MODULE_COLORS.analysis
  const reviewMetric = firstMeasure ? measureLabel(firstMeasure) : ''
  const reviewTarget = firstMeasure && firstMeasure.targetText.trim()
    ? `${firstMeasure.targetText.trim()} ${measureUnitLabel(firstMeasure)}`
    : ''

  const renderMeasure = (m: DraftMeasure) => {
    const color = COLOR_BY_KIND[m.kind]
    const isCount = measureIsCount(m)
    return (
      <View key={m.key} style={[styles.measureCard, { backgroundColor: theme.bg.elevated, borderColor: color + '40' }]}>
        <View style={styles.measureHeader}>
          <View style={[styles.measureIcon, { backgroundColor: color + '1F' }]}>
            <Feather name={MODULE_ICONS[MODULE_BY_KIND[m.kind]]} size={15} color={color} />
          </View>
          <View style={styles.measureHeaderText}>
            <Text style={[styles.measureModule, { color: theme.text.muted }]} numberOfLines={1}>
              {m.kind === 'finance' ? t.goal_source_finance : m.kind === 'habits' ? t.goal_source_habit : m.kind === 'journals' ? t.goal_source_journal : t.goal_source_reminder}
            </Text>
            <Text style={[styles.measureName, { color: theme.text.primary }]} numberOfLines={1}>{measureLabel(m) || '—'}</Text>
          </View>
          <Pressable onPress={() => removeMeasure(m.key)} hitSlop={8} style={styles.measureRemove} accessibilityRole="button" accessibilityLabel={t.delete}>
            <Feather name="x" size={18} color={theme.text.muted} />
          </Pressable>
        </View>

        <View style={styles.measureTargetRow}>
          <TextInput
            value={m.targetText}
            onChangeText={(v) => updateMeasure(m.key, { targetText: v })}
            placeholder={m.kind === 'finance' ? currency : '10'}
            placeholderTextColor={theme.text.muted}
            keyboardType={isCount ? 'number-pad' : 'decimal-pad'}
            style={[styles.measureTargetInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.primary }]}
          />
          <Text style={[styles.measureUnit, { color: theme.text.muted }]}>{measureUnitLabel(m)}</Text>
        </View>
        {m.kind === 'finance' ? (
          <Text style={[styles.measureHint, { color: theme.text.muted }]}>{t.goal_finance_semantics}</Text>
        ) : null}
      </View>
    )
  }

  return (
    <>
    {/* KeyboardAvoidingView keeps the focused input above the keyboard. Explicit
        Android 'height' behavior is required because edge-to-edge (app.json)
        disables the OS auto-resize. */}
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg.primary }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg.primary }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
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
              {parsing ? <ActivityIndicator size="small" color={theme.brand.onPrimary} /> : <Feather name="send" size={16} color={theme.brand.onPrimary} />}
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
            [t.goal_primary_metric, reviewMetric],
            [t.goal_target, reviewTarget],
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

      <Text style={[styles.label, { color: theme.text.muted }]}>{t.goal_measures}</Text>
      {measures.length === 0 ? (
        <View style={[styles.explainBox, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <Feather name="link-2" size={15} color={MODULE_COLORS.analysis} />
          <View style={styles.explainCopy}>
            <Text style={[styles.explainText, { color: theme.text.secondary }]}>{t.goal_select_modules_hint}</Text>
            <Text style={[styles.explainSubtext, { color: theme.text.muted }]}>{t.goal_primary_metric_hint}</Text>
          </View>
        </View>
      ) : (
        measures.map(renderMeasure)
      )}
      <Pressable
        onPress={() => setShowMetricPicker(true)}
        style={[styles.addMeasureBtn, { borderColor: MODULE_COLORS.analysis + '66' }]}
        accessibilityRole="button"
      >
        <Feather name="plus" size={16} color={MODULE_COLORS.analysis} />
        <Text style={[styles.addMeasureText, { color: MODULE_COLORS.analysis }]}>{t.goal_add_measure}</Text>
      </Pressable>

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
    </KeyboardAvoidingView>

    <MetricPickerSheet
      visible={showMetricPicker}
      existing={measures.map((m) => `${m.kind}:${m.sourceId}`)}
      onClose={() => setShowMetricPicker(false)}
      onConfirm={handleMeasuresSelected}
    />
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
  segmentBtn: { flexBasis: '47%', flexGrow: 1, minHeight: 40, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  segmentText: { fontSize: 12, fontWeight: '700' },
  measureCard: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], gap: spacing[3] },
  measureHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  measureIcon: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  measureHeaderText: { flex: 1, gap: 2 },
  measureModule: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  measureName: { fontSize: 15, fontWeight: '700' },
  measureRemove: { width: 30, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  measureTargetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  measureTargetInput: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  measureUnit: { fontSize: 13, fontWeight: '700', minWidth: 44 },
  measureHint: { fontSize: 12, lineHeight: 17 },
  addMeasureBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, minHeight: 48 },
  addMeasureText: { fontSize: 14, fontWeight: '700' },
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
