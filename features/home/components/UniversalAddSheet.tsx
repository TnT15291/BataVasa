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
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { parseUniversalCandidates, type UniversalCandidate, type UniversalEntry, type MissingField } from '@services/ai/universalEntry'
import { getProviderKey } from '@services/ai/openai'
import { hapticSaveSuccess } from '@services/haptics'
import { notifySaved } from '@store/toastStore'
import { VoiceButton } from '@components/VoiceButton'
import { matchCategory } from '@features/finance/i18n'
import { useCategories } from '@features/finance/hooks/useFinance'
import { maybeConfirmPlanItemMatch } from '@features/finance/planMatch'
import type { Category, Transaction } from '@features/finance/types'
import { useFinanceStore } from '@store/financeStore'
import { useRemindersStore } from '@store/remindersStore'
import { useHabitsStore } from '@store/habitsStore'
import { useJournalsStore } from '@store/journalsStore'
import { formatAmount } from '@features/finance/services'
import { MODULE_COLORS } from '@design/moduleColors'

type IconName = keyof typeof Feather.glyphMap

function getModuleMeta(): Record<string, { icon: IconName; color: string }> {
  return {
    finance:  { icon: 'dollar-sign', color: MODULE_COLORS.finance },
    finance_debt: { icon: 'users', color: MODULE_COLORS.finance },
    reminder: { icon: 'bell', color: MODULE_COLORS.tasks },
    habits:   { icon: 'check-circle', color: MODULE_COLORS.habits },
    journal:  { icon: 'book-open', color: MODULE_COLORS.journal },
  }
}

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

type CandidateCardProps = {
  candidate: UniversalCandidate
  selected: boolean
  onToggle: (id: string) => void
  index: number
  language: string
  currency: string
  t: ReturnType<typeof useTranslation>['t']
  theme: ReturnType<typeof useTheme>
}

function CandidateCard({ candidate, selected, onToggle, index, language, currency, t, theme }: CandidateCardProps) {
  const result = candidate.entry
  const meta = getModuleMeta()[result.module]!
  const locale = getDateFnsLocale(language)
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
      result.category_hint,
      result.merchant || '',
      result.occurred_at ? format(new Date(result.occurred_at), 'dd/MM/yyyy', { locale }) : '',
    ].filter(Boolean)
  } else if (result.module === 'finance_debt') {
    const sign = result.debt_direction === 'lent' ? '- ' : '+ '
    lines = [
      `${sign}${formatAmount(result.amount_cents, currency, language)}`,
      result.debt_direction === 'borrowed' ? t.debt_borrowed : t.debt_lent,
      result.counterparty,
      result.due_at ? format(new Date(result.due_at), 'dd/MM/yyyy', { locale }) : '',
    ].filter(Boolean)
  } else if (result.module === 'reminder') {
    lines = [
      result.title,
      result.remind_at ? format(new Date(result.remind_at), 'dd/MM/yyyy HH:mm', { locale }) : '',
      result.recurrence !== 'none' ? result.recurrence : '',
      result.note || '',
    ].filter(Boolean)
  } else if (result.module === 'habits') {
    lines = [result.title, habitFrequencyLine(result.frequency, result.target_per_period, language, t)]
  } else {
    lines = [result.content?.slice(0, 120) ?? '']
  }

  const moduleLabel: Record<string, string> = {
    finance: t.classified_finance,
    finance_debt: t.debt_book,
    reminder: t.classified_reminder,
    habits: t.classified_habits,
    journal: t.classified_journal,
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
  const createDebt = useFinanceStore((s) => s.createDebt)
  const createReminder = useRemindersStore((s) => s.createReminder)
  const createHabit = useHabitsStore((s) => s.createHabit)
  const createJournal = useJournalsStore((s) => s.createJournal)

  const catState = useFinanceStore((s) => s.catState)
  const loadCategories = useFinanceStore((s) => s.loadCategories)

  const [text, setText] = useState('')
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
      translateY.value = withDelay(30, withSpring(0, { damping: 20, stiffness: 200 }))
      backdropOpacity.value = withDelay(30, withTiming(1, { duration: 250 }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const reset = () => {
    analyzeRunRef.current += 1
    setText('')
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
        translateY.value = withSpring(0, { damping: 18, stiffness: 200 })
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
    { route: '/new', icon: 'dollar-sign', color: MODULE_COLORS.finance, label: t.nav_new_transaction },
    { route: '/reminder', icon: 'bell', color: MODULE_COLORS.tasks, label: t.new_reminder },
    { route: '/habit', icon: 'check-circle', color: MODULE_COLORS.habits, label: t.new_habit },
    { route: '/journal', icon: 'book-open', color: MODULE_COLORS.journal, label: t.new_journal },
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

  const onAnalyze = async (override?: string) => {
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
        Alert.alert(t.ai_error, t.parse_failed)
      } else {
        setCandidates(parsed)
        const defaults = parsed.filter((c) => c.selectedByDefault).map((c) => c.id)
        setSelectedIds(defaults.length > 0 ? defaults : [parsed[0]!.id])
        setStep('confirm')
      }
    } catch {
      if (runId === analyzeRunRef.current) Alert.alert(t.ai_error, t.parse_failed)
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

  const persistSelected = async () => {
    const selected = candidates.filter((c) => selectedIds.includes(c.id)).map((c) => c.entry)
    if (selected.length === 0) return
    setSaving(true)

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
        if (res.tx) createdFinanceTxs.push(res.tx)
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
          occurred_at: new Date().toISOString(),
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
      } else if (entry.module === 'journal') {
        const res = await createJournal({
          content: entry.content,
          occurred_at: new Date().toISOString(),
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
      }
    }

    setSaving(false)
    void hapticSaveSuccess()
    const s = useSettingsStore.getState()
    const anySynced = selected.some((e) =>
      (e.module === 'finance' && s.syncFinance) ||
      (e.module === 'finance_debt' && s.syncFinance) ||
      (e.module === 'reminder' && s.syncReminders) ||
      (e.module === 'habits' && s.syncHabits) ||
      (e.module === 'journal' && s.syncJournals)
    )
    notifySaved(t, anySynced)
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
                  <VoiceButton onResult={(voiceText) => onAnalyze(voiceText)} disabled={analyzing} size={44} module="quick_add" />
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
                          <Text style={styles.analyzeBtnText}>{t.parse_btn}</Text>
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
                      index={index}
                      language={language}
                      currency={currency}
                      t={t}
                      theme={theme}
                    />
                  ))}
                </ScrollView>
                <View style={styles.actionRow}>
                  <Pressable onPress={handleClose} style={[styles.actionBtn, { borderColor: theme.border.strong }]}>
                    <Text style={{ color: theme.text.secondary }}>{t.cancel}</Text>
                  </Pressable>
                  <Pressable onPress={() => { analyzeRunRef.current += 1; setCandidates([]); setSelectedIds([]); setStep('input') }} style={[styles.actionBtn, { borderColor: theme.border.strong }]}>
                    <Text style={{ color: theme.text.secondary }}>{t.ai_confirm_edit}</Text>
                  </Pressable>
                  <Pressable
                    onPress={onSave}
                    disabled={saving || selectedIds.length === 0}
                    style={[styles.actionBtn, styles.saveBtn, { backgroundColor: theme.brand.primary }]}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: '#fff', fontWeight: '600' }}>{t.save}</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
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
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  input: {
    borderWidth: 1, borderRadius: radius.md,
    padding: spacing[3], fontSize: 15, minHeight: 80, textAlignVertical: 'top',
  },
  examples: { fontSize: 12, marginTop: -spacing[2] },
  analyzeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
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
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  missingText: { fontSize: 12, fontWeight: '600', flex: 1 },
  actionRow: { flexDirection: 'row', gap: spacing[2] },
  actionBtn: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.md,
    borderWidth: 1, alignItems: 'center',
  },
  saveBtn: { borderWidth: 0 },
})
