import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { parseUniversalCandidates, getLastUniversalParseError, type UniversalCandidate, type UniversalEntry, type MissingField } from '@services/ai/universalEntry'
import { getProviderKey } from '@services/ai/openai'
import { hapticSaveSuccess } from '@services/haptics'
import { notifySaved, toast } from '@store/toastStore'
import { VoiceButton } from '@components/VoiceButton'
import { InlineDateField } from '@components/InlineDateField'
import { matchCategory, translateCategoryName } from '@features/finance/i18n'
import { CategoryPicker } from '@features/finance/components/CategoryPicker'
import { useCategories } from '@features/finance/hooks/useFinance'
import { maybeConfirmPlanItemMatch } from '@features/finance/planMatch'
import type { Category, Transaction } from '@features/finance/types'
import { useFinanceStore } from '@store/financeStore'
import { useRemindersStore } from '@store/remindersStore'
import { useHabitsStore } from '@store/habitsStore'
import { useJournalsStore } from '@store/journalsStore'
import { useGoalsStore } from '@store/goalsStore'
import { formatAmount } from '@features/finance/services'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import type { GoalMetricBinding } from '@features/goals/types'

type IconName = keyof typeof Feather.glyphMap

function getModuleMeta(): Record<string, { icon: IconName; color: string }> {
  return {
    finance:  { icon: 'trending-up', color: MODULE_COLORS.finance },
    finance_plan: { icon: 'calendar', color: MODULE_COLORS.finance },
    finance_debt: { icon: 'users', color: MODULE_COLORS.finance },
    reminder: { icon: 'bell', color: MODULE_COLORS.tasks },
    habits:   { icon: 'check-circle', color: MODULE_COLORS.habits },
    journal:  { icon: 'book-open', color: MODULE_COLORS.journal },
    goals: { icon: MODULE_ICONS.goals as IconName, color: MODULE_COLORS.analysis },
  }
}

const JOURNAL_TAGS = ['all', 'work', 'family', 'health', 'money', 'sleep', 'exercise', 'stress', 'food', 'travel', 'social'] as const

// Modules eligible for direct-save (aiAutoConfirm = off) — each one has a clean
// single-row create + delete so the 5s Undo can fully reverse it. finance_plan
// and finance_debt are excluded: they spawn linked rows (plan matches, debt
// reminders) and always go through the confirm step.
const DIRECT_SAVE_MODULES = new Set<UniversalEntry['module']>(['finance', 'reminder', 'habits', 'journal', 'goals'])

type CreatedRef = { module: UniversalEntry['module']; id: string }

function habitFrequencyLine(frequency: string, target: number, language: string, t: ReturnType<typeof useTranslation>['t']): string {
  const cadence = frequency === 'weekdays'
    ? t.cadence_weekdays
    : frequency === 'weekly'
    ? t.cadence_weekly
    : frequency === 'monthly'
    ? t.cadence_monthly
    : t.cadence_daily

  if (language === 'vi') {
    if (frequency === 'weekly') return `${target} lần mỗi tuần`
    if (frequency === 'monthly') return `${target} lần mỗi tháng`
    if (frequency === 'weekdays') return `${target} lần mỗi ngày thường`
    return `${target} lần mỗi ngày`
  }
  return `${target}x ${cadence.toLowerCase()}`
}

type Props = {
  visible: boolean
  onClose: () => void
  initialText?: string
  autoAnalyzeToken?: number
}

function missingFieldLabel(field: MissingField, t: ReturnType<typeof useTranslation>['t']): string {
  const map: Record<MissingField, string> = {
    category: t.field_category,
    date: t.field_date,
    due_date: t.field_due_date,
    counterparty: t.field_counterparty,
    title: t.field_title,
    target: t.field_target,
  }
  return map[field]
}

type SheetStep = 'input' | 'confirm'

// The editable date for a candidate, mapped to each module's own date field.
// Returns null for modules with no meaningful single date (habits, monthly plan).
function getCardDateEdit(entry: UniversalEntry): { value: Date | null; mode: 'date' | 'datetime'; min?: Date; max?: Date } | null {
  const now = new Date()
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  switch (entry.module) {
    case 'finance': return { value: new Date(entry.occurred_at), mode: 'date', max: soon }
    case 'journal': return { value: new Date(entry.occurred_at), mode: 'date', max: soon }
    case 'reminder': return { value: new Date(entry.remind_at), mode: 'datetime', min: now }
    case 'finance_debt': return { value: entry.due_at ? new Date(entry.due_at) : null, mode: 'date', min: now }
    case 'goals': return { value: entry.due_date ? new Date(`${entry.due_date}T12:00:00`) : null, mode: 'date', min: now }
    default: return null
  }
}

function applyCardDateEdit(entry: UniversalEntry, iso: string): UniversalEntry {
  switch (entry.module) {
    case 'finance':
    case 'journal':
      return { ...entry, occurred_at: iso }
    case 'reminder':
      return { ...entry, remind_at: iso }
    case 'finance_debt':
      return { ...entry, due_at: iso }
    case 'goals':
      return { ...entry, due_date: iso.slice(0, 10) }
    default:
      return entry
  }
}

type CandidateCardProps = {
  candidate: UniversalCandidate
  selected: boolean
  onToggle: (id: string) => void
  onChangeDate: (id: string, iso: string) => void
  onChangeDirection: (id: string, direction: 'expense' | 'income') => void
  onEditCategory: (id: string) => void
  cats: Category[]
  index: number
  language: string
  currency: string
  t: ReturnType<typeof useTranslation>['t']
  theme: ReturnType<typeof useTheme>
}

function CandidateCard({ candidate, selected, onToggle, onChangeDate, onChangeDirection, onEditCategory, cats, index, language, currency, t, theme }: CandidateCardProps) {
  const result = candidate.entry
  const meta = getModuleMeta()[result.module]!
  const dateEdit = getCardDateEdit(result)
  const catMatched = result.module === 'finance' ? matchCategory(cats, result.category_hint, t) : null
  const catLabel = result.module === 'finance'
    ? (catMatched ? translateCategoryName(catMatched, t) : (result.category_hint || t.field_category))
    : ''
  const scale = useSharedValue(1)

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePress = () => {
    scale.value = withSpring(0.97, { damping: 15 }, () => {
      scale.value = withSpring(1, { damping: 12 })
    })
    onToggle(candidate.id)
  }

  let lines: string[] = []
  if (result.module === 'finance') {
    const sign = result.direction === 'expense' ? '- ' : '+ '
    lines = [
      `${sign}${formatAmount(result.amount_cents, currency, language)}`,
      result.merchant || '',
    ].filter(Boolean)
  } else if (result.module === 'finance_debt') {
    const sign = result.debt_direction === 'lent' ? '- ' : '+ '
    lines = [
      `${sign}${formatAmount(result.amount_cents, currency, language)}`,
      result.debt_direction === 'borrowed' ? t.debt_borrowed : t.debt_lent,
      result.counterparty,
    ].filter(Boolean)
  } else if (result.module === 'finance_plan') {
    const sign = result.kind === 'expense' ? '- ' : '+ '
    lines = [
      `${sign}${formatAmount(result.amount_cents, currency, language)}`,
      result.name,
      result.category_hint,
      t.plan_due_day.replace('{{day}}', String(result.due_day)),
      result.recurrence === 'monthly' ? t.plan_monthly_hint : t.plan_once_hint,
    ].filter(Boolean)
  } else if (result.module === 'reminder') {
    lines = [
      result.title,
      result.recurrence !== 'none' ? result.recurrence : '',
      result.note || '',
    ].filter(Boolean)
  } else if (result.module === 'habits') {
    lines = [result.title, habitFrequencyLine(result.frequency, result.target_per_period, language, t)]
  } else if (result.module === 'journal') {
    lines = [result.content?.slice(0, 120) ?? '']
  } else {
    const unit = result.source === 'finance' ? currency : result.source === 'habits' ? '%' : 'count'
    lines = [
      result.title,
      `${result.target_value} ${unit}`,
      result.source_hint || result.source,
    ].filter(Boolean)
  }

  const moduleLabel: Record<string, string> = {
    finance: t.classified_finance,
    finance_plan: t.monthly_plan,
    finance_debt: t.debt_book,
    reminder: t.classified_reminder,
    habits: t.classified_habits,
    journal: t.classified_journal,
    goals: t.nav_goals,
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify().damping(14)} style={cardStyle}>
      <Pressable
        onPress={handlePress}
        style={[styles.resultCard, {
          backgroundColor: theme.bg.elevated,
          borderColor: selected ? meta.color : meta.color + '44',
        }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
      >
        <View style={styles.resultHeader}>
          <View style={[styles.resultIconWrap, { backgroundColor: meta.color + '1F' }]}>
            <Feather name={meta.icon} size={20} color={meta.color} />
          </View>
          <Text style={[styles.resultModule, { color: meta.color }]}>{moduleLabel[result.module]}</Text>
          <View style={[styles.resultCheck, {
            borderColor: meta.color,
            backgroundColor: selected ? meta.color : 'transparent',
          }]}>
            {selected && (
              <Animated.View entering={ZoomIn.duration(150)}>
                <Feather name="check" size={12} color="#fff" />
              </Animated.View>
            )}
          </View>
        </View>
        {lines.map((line, i) => (
          <Text key={i} style={[styles.resultLine, { color: i === 0 ? theme.text.primary : theme.text.muted }]}>
            {line}
          </Text>
        ))}
        {result.module === 'finance' ? (
          <View style={styles.editRow}>
            <View style={[styles.dirToggle, { borderColor: theme.border.strong }]}>
              {(['expense', 'income'] as const).map((d) => {
                const active = result.direction === d
                return (
                  <Pressable
                    key={d}
                    onPress={() => onChangeDirection(candidate.id, d)}
                    style={[styles.dirChip, active && { backgroundColor: meta.color }]}
                  >
                    <Text style={{ color: active ? '#fff' : theme.text.muted, fontSize: 12, fontWeight: '600' }}>
                      {d === 'expense' ? t.expense : t.income}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            <Pressable
              onPress={() => onEditCategory(candidate.id)}
              style={[styles.catChip, { borderColor: meta.color + '55', backgroundColor: meta.color + '12' }]}
            >
              <Feather name="tag" size={13} color={meta.color} />
              <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{catLabel}</Text>
              <Feather name="chevron-down" size={13} color={theme.text.muted} />
            </Pressable>
          </View>
        ) : null}
        {dateEdit ? (
          <InlineDateField
            value={dateEdit.value}
            mode={dateEdit.mode}
            minimumDate={dateEdit.min}
            maximumDate={dateEdit.max}
            color={meta.color}
            placeholder={t.set_date}
            onChange={(next) => onChangeDate(candidate.id, next.toISOString())}
          />
        ) : null}
        {candidate.missing.length > 0 ? (
          <View style={styles.missingRow}>
            <Feather name="alert-circle" size={13} color="#D97706" />
            <Text style={[styles.missingText, { color: '#D97706' }]} numberOfLines={2}>
              {t.smart_missing_fields.replace(
                '{{fields}}',
                candidate.missing.map((f) => missingFieldLabel(f, t)).join(', ')
              )}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

export function UniversalAddSheet({ visible, onClose, initialText = '', autoAnalyzeToken = 0 }: Props) {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const currency = useSettingsStore((s) => s.currency)
  const cats = useCategories()
  const createTransaction = useFinanceStore((s) => s.createTransaction)
  const createPlanItem = useFinanceStore((s) => s.createPlanItem)
  const createDebt = useFinanceStore((s) => s.createDebt)
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction)
  const createReminder = useRemindersStore((s) => s.createReminder)
  const deleteReminder = useRemindersStore((s) => s.deleteReminder)
  const createHabit = useHabitsStore((s) => s.createHabit)
  const deleteHabit = useHabitsStore((s) => s.deleteHabit)
  const habits = useHabitsStore((s) => s.habits)
  const createJournal = useJournalsStore((s) => s.createJournal)
  const deleteJournal = useJournalsStore((s) => s.deleteJournal)
  const createGoal = useGoalsStore((s) => s.createGoal)
  const deleteGoal = useGoalsStore((s) => s.deleteGoal)
  const aiAutoConfirm = useSettingsStore((s) => s.aiAutoConfirm)

  const catState = useFinanceStore((s) => s.catState)
  const loadCategories = useFinanceStore((s) => s.loadCategories)

  const [text, setText] = useState('')
  const [augmentText, setAugmentText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [candidates, setCandidates] = useState<UniversalCandidate[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [show, setShow] = useState(false)
  const [step, setStep] = useState<SheetStep>('input')
  const analyzeRunRef = useRef(0)

  useEffect(() => {
    if (catState === 'idle') void loadCategories()
  }, [catState, loadCategories])

  const translateY = useSharedValue(600)
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      setShow(true)
      translateY.value = 600
      backdropOpacity.value = 0
      translateY.value = withDelay(30, withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) }))
      backdropOpacity.value = withDelay(30, withTiming(1, { duration: 250 }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const reset = () => {
    analyzeRunRef.current += 1
    setText('')
    setAugmentText('')
    setCandidates([])
    setSelectedIds([])
    setAnalyzing(false)
    setSaving(false)
    setStep('input')
  }

  const animateOut = (onDone?: () => void) => {
    translateY.value = withTiming(650, { duration: 280 })
    backdropOpacity.value = withTiming(0, { duration: 220 }, (done) => {
      if (done) {
        runOnJS(setShow)(false)
        runOnJS(reset)()
        runOnJS(onClose)()
        if (onDone) runOnJS(onDone)()
      }
    })
  }

  const handleClose = () => animateOut()
  const goToForm = (route: string) => animateOut(() => router.push(route as any))

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY
        backdropOpacity.value = Math.max(0, 1 - e.translationY / 300)
      }
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 700) {
        runOnJS(handleClose)()
      } else {
        translateY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) })
        backdropOpacity.value = withTiming(1, { duration: 200 })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const quickModules: { route: string; icon: IconName; color: string; label: string }[] = [
    { route: '/new', icon: 'trending-up', color: MODULE_COLORS.finance, label: t.nav_new_transaction },
    { route: '/reminder', icon: 'bell', color: MODULE_COLORS.tasks, label: t.new_reminder },
    { route: '/habit', icon: 'check-circle', color: MODULE_COLORS.habits, label: t.new_habit },
    { route: '/journal', icon: 'book-open', color: MODULE_COLORS.journal, label: t.new_journal },
    { route: '/goal', icon: MODULE_ICONS.goals as IconName, color: MODULE_COLORS.analysis, label: t.new_goal },
  ]

  const categoryMatchesDirection = (cat: Category, direction: 'expense' | 'income'): boolean =>
    direction === 'income' ? cat.kind === 'income' : cat.kind !== 'income'

  const fallbackCategoryForDirection = (direction: 'expense' | 'income'): Category | null => {
    if (direction === 'income') return cats.find((c) => c.kind === 'income') ?? null
    return cats.find((c) => c.name === 'Shopping') ?? cats.find((c) => c.kind !== 'income') ?? null
  }

  const matchFinanceCategoryForDirection = (entry: Extract<UniversalEntry, { module: 'finance' }>): Category | null => {
    const matched = matchCategory(cats, entry.category_hint, t)
    if (matched && categoryMatchesDirection(matched, entry.direction)) return matched
    return fallbackCategoryForDirection(entry.direction)
  }

  const matchFinancePlanCategory = (entry: Extract<UniversalEntry, { module: 'finance_plan' }>): Category | null => {
    const matched = matchCategory(cats, entry.category_hint, t)
    if (matched && categoryMatchesDirection(matched, entry.kind)) return matched
    return null
  }

  const buildGoalBinding = (entry: Extract<UniversalEntry, { module: 'goals' }>): GoalMetricBinding | null => {
    if (entry.source === 'finance') {
      const matched = matchCategory(cats, entry.source_hint, t) ?? cats.find((c) => c.kind === 'savings') ?? cats[0]
      return matched ? { module: 'finance', aggregation: 'sum_amount', category_id: matched.id } : null
    }
    if (entry.source === 'habits') {
      const hint = entry.source_hint.toLowerCase()
      const matched = habits.find((h) => {
        const name = h.name.toLowerCase()
        return name === hint || name.includes(hint) || hint.includes(name)
      })
      return matched ? { module: 'habits', aggregation: 'completion_rate', habit_id: matched.id } : null
    }
    if (entry.source === 'journals') {
      const tag = JOURNAL_TAGS.includes(entry.source_hint as typeof JOURNAL_TAGS[number])
        ? entry.source_hint
        : 'all'
      return { module: 'journals', aggregation: 'entry_count', tag }
    }
    return { module: 'reminders', aggregation: 'completed_count' }
  }

  // Show the real backend reason (provider 429/401, "AI not configured",
  // network) when there is one; fall back to the friendly "try rephrasing"
  // message only when the AI genuinely returned no candidates.
  const showParseError = () => {
    const detail = getLastUniversalParseError()
    Alert.alert(t.ai_service_error, detail || t.parse_failed)
  }

  const onAnalyze = async (override?: string, source: 'manual' | 'voice' = 'manual') => {
    const input = (override ?? text).trim()
    if (!input || analyzing) return
    if (override) setText(override)
    const runId = analyzeRunRef.current + 1
    analyzeRunRef.current = runId
    const provider = useSettingsStore.getState().aiProvider
    const key = await getProviderKey(provider)
    if (runId !== analyzeRunRef.current) return
    if (!key) { Alert.alert(t.api_key_required, t.no_api_key_msg); return }
    setAnalyzing(true)
    try {
      const parsed = await parseUniversalCandidates(input)
      if (runId !== analyzeRunRef.current) return
      if (parsed.length === 0) {
        showParseError()
        return
      }
      // Rule 5: when the user opted out of confirmation (aiAutoConfirm = off) and
      // the parse is a single, complete, unambiguous entry from a TYPED input,
      // save it straight away and offer a 5s Undo. Voice always confirms
      // (transcription errors), and multi/ambiguous or incomplete parses still
      // go through the confirm step so nothing is saved blindly.
      const single = parsed.length === 1 ? parsed[0]! : null
      if (
        !aiAutoConfirm &&
        source === 'manual' &&
        single &&
        single.missing.length === 0 &&
        DIRECT_SAVE_MODULES.has(single.entry.module)
      ) {
        await persistSelected({ entries: [single.entry], direct: true })
        return
      }
      setCandidates(parsed)
      const defaults = parsed.filter((c) => c.selectedByDefault).map((c) => c.id)
      setSelectedIds(defaults.length > 0 ? defaults : [parsed[0]!.id])
      setStep('confirm')
    } catch {
      if (runId === analyzeRunRef.current) showParseError()
    } finally {
      if (runId === analyzeRunRef.current) setAnalyzing(false)
    }
  }

  useEffect(() => {
    if (!visible || !initialText.trim()) return
    analyzeRunRef.current += 1
    setText(initialText)
    setCandidates([])
    setSelectedIds([])
    setStep('input')
    if (autoAnalyzeToken > 0) {
      void onAnalyze(initialText)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialText, autoAnalyzeToken])

  // Progressive Capture: a one-line summary of what the session already holds,
  // so the AI can link a follow-up sentence to it (e.g. compute "remind 30 min
  // before" against an existing 09:00 task) instead of parsing in isolation.
  const describeEntryForContext = (e: UniversalEntry): string => {
    switch (e.module) {
      case 'finance': return `- finance ${e.direction} ${e.amount_cents} ${currency} ${e.merchant || e.category_hint} on ${e.occurred_at}`
      case 'finance_plan': return `- plan ${e.kind} ${e.amount_cents} ${currency} ${e.name} day ${e.due_day}`
      case 'finance_debt': return `- debt ${e.debt_direction} ${e.amount_cents} ${currency} ${e.counterparty}${e.due_at ? ` due ${e.due_at}` : ''}`
      case 'reminder': return `- task "${e.title}" at ${e.remind_at}`
      case 'habits': return `- habit "${e.title}" ${e.frequency} x${e.target_per_period}`
      case 'journal': return `- journal note "${e.content.slice(0, 60)}"`
      case 'goals': return `- goal "${e.title}" target ${e.target_value}`
    }
  }

  const buildSessionContext = (): string =>
    candidates
      .filter((c) => selectedIds.includes(c.id))
      .map((c) => describeEntryForContext(c.entry))
      .join('\n')

  // Append parsed follow-up candidates without resetting the session. New module
  // intents stack; exact duplicates (same id) are skipped so re-stating a detail
  // doesn't double it.
  const appendCandidates = (incoming: UniversalCandidate[]) => {
    const existing = new Set(candidates.map((c) => c.id))
    const fresh = incoming.filter((c) => !existing.has(c.id))
    if (fresh.length === 0) return
    setCandidates((cur) => [...cur, ...fresh])
    setSelectedIds((sel) => [...new Set([...sel, ...fresh.filter((c) => c.selectedByDefault).map((c) => c.id)])])
  }

  const onAugment = async (override?: string) => {
    const input = (override ?? augmentText).trim()
    if (!input || analyzing) return
    const runId = analyzeRunRef.current + 1
    analyzeRunRef.current = runId
    setAnalyzing(true)
    try {
      const parsed = await parseUniversalCandidates(input, buildSessionContext())
      if (runId !== analyzeRunRef.current) return
      if (parsed.length === 0) {
        showParseError()
      } else {
        appendCandidates(parsed)
        setAugmentText('')
      }
    } catch {
      if (runId === analyzeRunRef.current) showParseError()
    } finally {
      if (runId === analyzeRunRef.current) setAnalyzing(false)
    }
  }

  const onSave = () => {
    const selectedCandidates = candidates.filter((c) => selectedIds.includes(c.id))
    if (selectedCandidates.length === 0) return

    // Rule 5 extension: incomplete parses prompt for the missing fields first.
    // "Save anyway" fills sensible defaults (unknown person, today, 1×/day, …).
    const missingLabels = [...new Set(selectedCandidates.flatMap((c) => c.missing))]
      .map((f) => missingFieldLabel(f, t))
    if (missingLabels.length > 0) {
      Alert.alert(
        t.smart_missing_title,
        `${t.smart_missing_fields.replace('{{fields}}', missingLabels.join(', '))}\n\n${t.smart_missing_prompt}`,
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.smart_fill_more,
            onPress: () => { analyzeRunRef.current += 1; setCandidates([]); setSelectedIds([]); setStep('input') },
          },
          { text: t.smart_save_defaults, onPress: () => { void persistSelected() } },
        ]
      )
      return
    }
    void persistSelected()
  }

  // Reverses a direct-save (aiAutoConfirm = off) when the user taps Undo.
  const undoCreated = async (refs: CreatedRef[]) => {
    for (const ref of refs) {
      if (ref.module === 'finance') await deleteTransaction(ref.id)
      else if (ref.module === 'reminder') await deleteReminder(ref.id)
      else if (ref.module === 'habits') await deleteHabit(ref.id)
      else if (ref.module === 'journal') await deleteJournal(ref.id)
      else if (ref.module === 'goals') await deleteGoal(ref.id)
    }
  }

  const persistSelected = async (opts?: { entries?: UniversalEntry[]; direct?: boolean }) => {
    const selected = opts?.entries ?? candidates.filter((c) => selectedIds.includes(c.id)).map((c) => c.entry)
    if (selected.length === 0) return
    setSaving(true)
    const createdRefs: CreatedRef[] = []

    const financeEntries = selected.filter((entry): entry is Extract<UniversalEntry, { module: 'finance' }> => entry.module === 'finance')
    for (const entry of financeEntries) {
      const cat = matchFinanceCategoryForDirection(entry)
      if (!cat) {
        Alert.alert(t.pick_category, t.pick_category_msg)
        setSaving(false)
        return
      }
    }

    const createdFinanceTxs: Transaction[] = []
    for (const entry of selected) {
      if (entry.module === 'finance') {
        const cat = matchFinanceCategoryForDirection(entry)
        const res = await createTransaction({
          amount_cents: entry.direction === 'expense' ? -Math.abs(entry.amount_cents) : Math.abs(entry.amount_cents),
          currency,
          category_id: cat!.id,
          merchant: entry.merchant || undefined,
          note: entry.note || undefined,
          occurred_at: entry.occurred_at,
          source: 'voice',
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
        if (res.tx) { createdFinanceTxs.push(res.tx); createdRefs.push({ module: 'finance', id: res.tx.id }) }
      } else if (entry.module === 'finance_plan') {
        const cat = matchFinancePlanCategory(entry)
        const res = await createPlanItem({
          name: entry.name,
          kind: entry.kind,
          amount_cents: entry.amount_cents,
          currency,
          category_id: cat?.id ?? null,
          due_day: entry.due_day,
          recurrence: entry.recurrence,
          status: 'confirmed',
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
      } else if (entry.module === 'finance_debt') {
        // Missing counterparty saves as "unknown" instead of failing validation.
        const counterparty = entry.counterparty.trim() || t.unknown_person
        const labels = {
          reminderTitle: (entry.debt_direction === 'lent' ? t.debt_reminder_title_lent : t.debt_reminder_title_borrowed)
            .replace('{{name}}', counterparty),
          reminderNote: entry.note || undefined,
          settleNote: (entry.debt_direction === 'lent' ? t.debt_settle_tx_note_lent : t.debt_settle_tx_note_borrowed)
            .replace('{{name}}', counterparty),
        }
        const res = await createDebt({
          direction: entry.debt_direction,
          counterparty,
          amount_cents: entry.amount_cents,
          currency,
          note: entry.note || undefined,
          occurred_at: entry.occurred_at,
          due_at: entry.due_at,
          remind_days_before: 1,
        }, labels)
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
      } else if (entry.module === 'reminder') {
        const res = await createReminder({
          title: entry.title,
          note: entry.note || undefined,
          remind_at: entry.remind_at,
          advance_minutes: 0,
          recurrence: entry.recurrence,
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
        if (res.id) createdRefs.push({ module: 'reminder', id: res.id })
      } else if (entry.module === 'habits') {
        const cadence = entry.frequency === 'daily'
          ? 'daily'
          : entry.frequency === 'weekdays'
          ? 'weekdays'
          : 'weekly'
        const res = await createHabit({
          name: entry.title,
          cadence,
          target_per_period: entry.target_per_period,
          icon: '✅',
          color: MODULE_COLORS.habits,
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
        if (res.id) createdRefs.push({ module: 'habits', id: res.id })
      } else if (entry.module === 'journal') {
        const res = await createJournal({
          content: entry.content,
          mood: entry.mood ?? undefined,
          occurred_at: entry.occurred_at,
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
        if (res.journal) createdRefs.push({ module: 'journal', id: res.journal.id })
      } else if (entry.module === 'goals') {
        const binding = buildGoalBinding(entry)
        if (!binding) { setSaving(false); Alert.alert(t.could_not_save, t.goal_source_required); return }
        const targetValue = entry.source === 'habits' && entry.target_value < 20 ? 100 : entry.target_value
        const res = await createGoal({
          title: entry.title,
          description: entry.description || undefined,
          target_type: entry.source === 'finance' ? 'amount' : entry.source === 'habits' ? 'rate' : 'count',
          target_value: targetValue,
          unit: entry.source === 'finance' ? currency : entry.source === 'habits' ? '%' : 'count',
          start_date: `${entry.start_date}T00:00:00.000Z`,
          due_date: entry.due_date ? `${entry.due_date}T23:59:59.999Z` : null,
          metric_binding: binding,
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
        if (res.id) createdRefs.push({ module: 'goals', id: res.id })
      }
    }

    setSaving(false)
    void hapticSaveSuccess()
    const s = useSettingsStore.getState()
    const anySynced = selected.some((e) =>
      (e.module === 'finance' && s.syncFinance) ||
      (e.module === 'finance_plan' && s.syncFinance) ||
      (e.module === 'finance_debt' && s.syncFinance) ||
      (e.module === 'reminder' && s.syncReminders) ||
      (e.module === 'habits' && s.syncHabits) ||
      (e.module === 'journal' && s.syncJournals) ||
      (e.module === 'goals' && s.syncGoals)
    )
    if (opts?.direct && createdRefs.length > 0) {
      toast.undo(t.toast_saved, t.undo, () => { void undoCreated(createdRefs) })
    } else {
      notifySaved(t, anySynced)
    }
    handleClose()
    // Sequentially, so multiple matches prompt one at a time over the home screen.
    for (const tx of createdFinanceTxs) {
      await maybeConfirmPlanItemMatch(tx, t)
    }
  }

  const toggleCandidate = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]
    )
  }

  const changeCandidateDate = (id: string, iso: string) => {
    setCandidates((current) => current.map((candidate) =>
      candidate.id === id
        ? {
            ...candidate,
            entry: applyCardDateEdit(candidate.entry, iso),
            // Setting a date resolves the corresponding missing-field warning so
            // the save flow no longer prompts for it.
            missing: candidate.missing.filter((m) => m !== 'date' && m !== 'due_date'),
          }
        : candidate
    ))
  }

  const changeCandidateDirection = (id: string, direction: 'expense' | 'income') => {
    setCandidates((current) => current.map((candidate) =>
      candidate.id === id && candidate.entry.module === 'finance'
        ? { ...candidate, entry: { ...candidate.entry, direction } }
        : candidate
    ))
  }

  // Which finance candidate is having its category edited (drives the picker modal).
  const [catEditId, setCatEditId] = useState<string | null>(null)
  const catEditCandidate = candidates.find((c) => c.id === catEditId) ?? null
  const catEditDirection: 'expense' | 'income' =
    catEditCandidate?.entry.module === 'finance' ? catEditCandidate.entry.direction : 'expense'
  const catEditList = catEditDirection === 'income'
    ? cats.filter((c) => c.kind === 'income')
    : cats.filter((c) => c.kind !== 'income')

  const changeCandidateCategory = (id: string, category: Category) => {
    setCandidates((current) => current.map((candidate) =>
      candidate.id === id && candidate.entry.module === 'finance'
        ? {
            ...candidate,
            entry: { ...candidate.entry, category_hint: category.name },
            missing: candidate.missing.filter((m) => m !== 'category'),
          }
        : candidate
    ))
    setCatEditId(null)
  }

  return (
    <Modal visible={visible && show} transparent animationType="none" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrap}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.sheet, { backgroundColor: theme.bg.elevated }, sheetStyle]}>
            <GestureDetector gesture={panGesture}>
              <View style={styles.handleArea}>
                <View style={[styles.handle, { backgroundColor: theme.border.strong }]} />
              </View>
            </GestureDetector>

            <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>{t.universal_add_title}</Text>
            <Text style={[styles.sheetHint, { color: theme.text.secondary }]}>{t.universal_add_examples}</Text>

            {step === 'input' ? (
              <>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={t.universal_add_hint}
                  placeholderTextColor={theme.text.muted}
                  multiline
                  numberOfLines={3}
                  style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.primary }]}
                />
                <Text style={[styles.examples, { color: theme.text.muted }]}>{t.universal_add_examples}</Text>
                <View style={styles.analyzeRow}>
                  <VoiceButton onResult={(voiceText) => onAnalyze(voiceText, 'voice')} disabled={analyzing} size={44} module="quick_add" />
                  <Pressable
                    onPress={() => onAnalyze()}
                    disabled={analyzing || !text.trim()}
                    style={[styles.analyzeBtn, { backgroundColor: analyzing || !text.trim() ? theme.text.muted : theme.brand.primary }]}
                  >
                    {analyzing
                      ? <ActivityIndicator color="#fff" />
                      : (
                        <View style={styles.analyzeBtnContent}>
                          <Feather name="send" size={16} color="#fff" />
                          <Text style={styles.analyzeBtnText}>{t.create_btn}</Text>
                        </View>
                      )}
                  </Pressable>
                </View>

                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border.subtle }]} />
                  <Text style={[styles.dividerText, { color: theme.text.muted }]}>{t.universal_add_or_create}</Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border.subtle }]} />
                </View>
                <View style={styles.quickChips}>
                  {quickModules.map((m) => (
                    <Pressable
                      key={m.route}
                      onPress={() => goToForm(m.route)}
                      style={[styles.quickChip, { borderColor: m.color + '55', backgroundColor: m.color + '12' }]}
                    >
                      <Feather name={m.icon} size={16} color={m.color} />
                      <Text style={[styles.quickChipText, { color: theme.text.primary }]} numberOfLines={1}>{m.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.youSaid, { color: theme.text.muted }]}>{t.ai_confirm_you_said} "{text}"</Text>
                <ScrollView style={styles.resultsBox} contentContainerStyle={styles.resultsContent}>
                  {candidates.map((candidate, index) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      selected={selectedIds.includes(candidate.id)}
                      onToggle={toggleCandidate}
                      onChangeDate={changeCandidateDate}
                      onChangeDirection={changeCandidateDirection}
                      onEditCategory={setCatEditId}
                      cats={cats}
                      index={index}
                      language={language}
                      currency={currency}
                      t={t}
                      theme={theme}
                    />
                  ))}
                </ScrollView>

                {/* Progressive Capture: keep the session open and let the user add
                    related intents one short sentence at a time (doc: smartEntry.md). */}
                <View style={styles.augmentBlock}>
                  <Text style={[styles.augmentLabel, { color: theme.text.muted }]}>{t.smart_augment_label}</Text>
                  <View style={styles.augmentRow}>
                    <VoiceButton onResult={(v) => onAugment(v)} disabled={analyzing} size={40} module="quick_add" />
                    <TextInput
                      value={augmentText}
                      onChangeText={setAugmentText}
                      placeholder={t.smart_augment_hint}
                      placeholderTextColor={theme.text.muted}
                      style={[styles.augmentInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.primary }]}
                      onSubmitEditing={() => onAugment()}
                      returnKeyType="send"
                      blurOnSubmit={false}
                    />
                    <Pressable
                      onPress={() => onAugment()}
                      disabled={analyzing || !augmentText.trim()}
                      style={[styles.augmentSend, { backgroundColor: analyzing || !augmentText.trim() ? theme.text.muted : theme.brand.primary }]}
                      accessibilityRole="button"
                      accessibilityLabel={t.smart_augment_label}
                    >
                      {analyzing ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="plus" size={18} color="#fff" />}
                    </Pressable>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable onPress={handleClose} style={[styles.actionBtn, { borderColor: theme.border.strong }]}>
                    <Text style={{ color: theme.text.secondary }}>{t.cancel}</Text>
                  </Pressable>
                  <Pressable onPress={() => { analyzeRunRef.current += 1; setCandidates([]); setSelectedIds([]); setAugmentText(''); setStep('input') }} style={[styles.actionBtn, { borderColor: theme.border.strong }]}>
                    <Text style={{ color: theme.text.secondary }}>{t.ai_confirm_edit}</Text>
                  </Pressable>
                  <Pressable
                    onPress={onSave}
                    disabled={saving || selectedIds.length === 0}
                    style={[styles.actionBtn, styles.saveBtn, { backgroundColor: theme.brand.primary }]}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: '#fff', fontWeight: '600' }}>{candidates.length > 1 ? t.smart_confirm_all : t.save}</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>

        {catEditId ? (
          <Modal transparent animationType="fade" onRequestClose={() => setCatEditId(null)}>
            <Pressable style={styles.catBackdrop} onPress={() => setCatEditId(null)}>
              <View style={[styles.catSheet, { backgroundColor: theme.bg.elevated }]} onStartShouldSetResponder={() => true}>
                <Text style={[styles.catSheetTitle, { color: theme.text.primary }]}>{t.pick_category}</Text>
                <ScrollView>
                  <CategoryPicker
                    categories={catEditList}
                    selectedId={catEditCandidate?.entry.module === 'finance' ? (matchCategory(cats, catEditCandidate.entry.category_hint, t)?.id ?? null) : null}
                    onSelect={(c) => changeCandidateCategory(catEditId, c)}
                    filterKind={catEditDirection === 'income' ? 'income' : undefined}
                    scrollEnabled={false}
                  />
                </ScrollView>
              </View>
            </Pressable>
          </Modal>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#00000055' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[5],
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: spacing[2],
    marginTop: -spacing[2],
    marginHorizontal: -spacing[5],
  },
  handle: { width: 40, height: 4, borderRadius: 2, marginBottom: spacing[1] },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  sheetHint: { fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1, borderRadius: radius.md,
    padding: spacing[3], fontSize: 16, minHeight: 92, textAlignVertical: 'top',
  },
  examples: { fontSize: 14, marginTop: -spacing[2] },
  analyzeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[2] },
  analyzeBtn: { flex: 1, paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  analyzeBtnContent: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: -spacing[1] },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, fontWeight: '600' },
  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 44,
  },
  quickChipText: { fontSize: 13, fontWeight: '600' },
  youSaid: { fontSize: 13, fontStyle: 'italic' },
  resultsBox: { maxHeight: 360 },
  resultsContent: { gap: spacing[3] },
  resultCard: {
    borderWidth: 1.5, borderRadius: radius.lg,
    padding: spacing[4], gap: spacing[2],
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  resultIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultModule: { fontSize: 14, fontWeight: '700' },
  resultCheck: {
    marginLeft: 'auto',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLine: { fontSize: 15 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap', marginTop: spacing[1] },
  dirToggle: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.full, overflow: 'hidden' },
  dirChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 36,
    flexShrink: 1,
  },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  missingText: { fontSize: 12, fontWeight: '600', flex: 1 },
  augmentBlock: { gap: spacing[2] },
  augmentLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  augmentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  augmentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 15,
    minHeight: 44,
  },
  augmentSend: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: { flexDirection: 'row', gap: spacing[2] },
  actionBtn: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.md,
    borderWidth: 1, alignItems: 'center',
  },
  saveBtn: { borderWidth: 0 },
  catBackdrop: { flex: 1, backgroundColor: '#00000077', justifyContent: 'flex-end' },
  catSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[5],
    paddingBottom: spacing[8],
    maxHeight: '70%',
    gap: spacing[3],
  },
  catSheetTitle: { fontSize: 17, fontWeight: '700' },
})
