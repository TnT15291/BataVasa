import { useEffect, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { isAiAvailable } from '@services/ai/openai'
import { generateGoalCoachPlan, type GoalCoachPlan } from '@services/ai/goalCoach'
import { useHabitsStore } from '@store/habitsStore'
import { useRemindersStore } from '@store/remindersStore'
import { useJournalsStore } from '@store/journalsStore'
import { useFinanceStore } from '@store/financeStore'
import { matchCategory } from '@features/finance/i18n'
import { formatAmount } from '@features/finance/services'
import { notifySaved } from '@store/toastStore'
import { hapticSaveSuccess } from '@services/haptics'
import type { GoalWithProgress } from '../types'

type Props = {
  visible: boolean
  goal: GoalWithProgress
  onClose: () => void
  /**
   * Draft mode: when provided, the goal does not exist yet. Apply first persists
   * the goal via this callback, then creates the selected cross-module items.
   * Returns the created goal id so the parent can route to its detail screen.
   */
  persistBeforeApply?: () => Promise<{ ok: boolean; goalId?: string; error?: string }>
  /** Fires after a successful apply (draft mode), with the created goal id. */
  onApplied?: (goalId?: string) => void
}

function CheckRow({
  checked, onToggle, onEdit, accent, children,
}: { checked: boolean; onToggle: () => void; onEdit?: () => void; accent: string; children: React.ReactNode }) {
  const theme = useTheme()
  const { t } = useTranslation()
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.itemRow, { backgroundColor: theme.bg.elevated, borderColor: checked ? accent + '66' : theme.border.subtle }]}
    >
      <View style={[styles.checkbox, { borderColor: checked ? accent : theme.border.strong, backgroundColor: checked ? accent : 'transparent' }]}>
        {checked ? <Feather name="check" size={13} color="#fff" /> : null}
      </View>
      <View style={styles.itemBody}>{children}</View>
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={8} style={[styles.editBtn, { borderColor: accent + '66' }]}>
          <Feather name="edit-2" size={13} color={accent} />
          <Text style={[styles.editText, { color: accent }]}>{t.update}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  )
}

export function GoalCoachSheet({ visible, goal, onClose, persistBeforeApply, onApplied }: Props) {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)

  const createHabit = useHabitsStore((s) => s.createHabit)
  const createReminder = useRemindersStore((s) => s.createReminder)
  const createJournal = useJournalsStore((s) => s.createJournal)
  const createPlanItem = useFinanceStore((s) => s.createPlanItem)
  const createCategory = useFinanceStore((s) => s.createCategory)
  const categories = useFinanceStore((s) => s.categories)
  const syncFinance = useSettingsStore((s) => s.syncFinance)

  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<GoalCoachPlan | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [applying, setApplying] = useState(false)
  const [habitSel, setHabitSel] = useState<Set<number>>(new Set())
  const [taskSel, setTaskSel] = useState<Set<number>>(new Set())
  const [spendingSel, setSpendingSel] = useState<Set<number>>(new Set())
  const [journalSel, setJournalSel] = useState(true)
  // Index of the habit suggestion currently being edited inline (null = none).
  const [editingHabit, setEditingHabit] = useState<number | null>(null)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setPlan(null)
    setUnavailable(false)
    setEditingHabit(null)
    if (!isAiAvailable()) {
      setUnavailable(true)
      return
    }
    setLoading(true)
    void (async () => {
      const result = await generateGoalCoachPlan(goal)
      if (cancelled) return
      setLoading(false)
      if (!result) {
        setUnavailable(true)
        return
      }
      setPlan(result)
      setHabitSel(new Set(result.habits.map((_, i) => i)))
      setTaskSel(new Set(result.tasks.map((_, i) => i)))
      setSpendingSel(new Set(result.spendingPlan.map((_, i) => i)))
      setJournalSel(result.journalDraft !== null)
    })()
    return () => { cancelled = true }
  }, [visible, goal])

  const toggle = (set: Set<number>, i: number, update: (s: Set<number>) => void) => {
    const next = new Set(set)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    update(next)
  }

  const cadenceLabel = (cadence: string): string =>
    cadence === 'weekdays' ? t.cadence_weekdays : cadence === 'custom' ? t.cadence_custom : t.cadence_daily

  const categoryMatchesKind = (kind: 'expense' | 'income', categoryId: string | null): boolean => {
    if (!categoryId) return true
    const category = categories.find((c) => c.id === categoryId)
    if (!category) return false
    return kind === 'income' ? category.kind === 'income' : category.kind !== 'income'
  }

  // Edit a habit suggestion inline (Option A) — patch the plan in place so the
  // draft goal flow keeps its other selections and never leaves the sheet.
  const updateHabit = (index: number, patch: Partial<GoalCoachPlan['habits'][number]>) => {
    setPlan((prev) => {
      if (!prev) return prev
      return { ...prev, habits: prev.habits.map((h, i) => (i === index ? { ...h, ...patch } : h)) }
    })
  }

  const openTaskSuggestion = (task: GoalCoachPlan['tasks'][number], index: number) => {
    const next = new Set(taskSel)
    next.delete(index)
    setTaskSel(next)
    onClose()
    router.push({
      pathname: '/reminder',
      params: { prefill: JSON.stringify({ title: task.title, remind_at: task.remind_at, recurrence: task.recurrence }) },
    })
  }

  const openSpendingSuggestion = (item: GoalCoachPlan['spendingPlan'][number], index: number) => {
    const next = new Set(spendingSel)
    next.delete(index)
    setSpendingSel(next)
    onClose()
    router.push({
      pathname: '/finance',
      params: { planPrefill: JSON.stringify(item) },
    })
  }

  const openJournalSuggestion = () => {
    if (!plan?.journalDraft) return
    setJournalSel(false)
    onClose()
    router.push({
      pathname: '/journal',
      params: {
        prefill: JSON.stringify({
          content: plan.journalDraft.content,
          mood: plan.journalDraft.mood,
          tags: plan.journalDraft.tags,
          occurred_at: new Date().toISOString(),
        }),
      },
    })
  }

  const onApply = async () => {
    if (!plan) return
    setApplying(true)
    // Draft mode: create the goal itself before its supporting items.
    let createdGoalId: string | undefined
    if (persistBeforeApply) {
      const r = await persistBeforeApply()
      if (!r.ok) { Alert.alert(t.could_not_save, r.error ?? ''); setApplying(false); return }
      createdGoalId = r.goalId
    }
    try {
      for (const i of habitSel) {
        const h = plan.habits[i]
        if (!h) continue
        const res = await createHabit({
          name: h.title,
          cadence: h.cadence,
          target_per_period: h.target_per_period,
          icon: '✅',
          color: MODULE_COLORS.habits,
        })
        if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); setApplying(false); return }
      }
      for (const i of taskSel) {
        const task = plan.tasks[i]
        if (!task) continue
        const res = await createReminder({
          title: task.title,
          remind_at: task.remind_at,
          advance_minutes: 0,
          recurrence: task.recurrence,
        })
        if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); setApplying(false); return }
      }
      for (const i of spendingSel) {
        const item = plan.spendingPlan[i]
        if (!item) continue
        const matched = matchCategory(categories, item.category_hint, t)
        let categoryId = matched && categoryMatchesKind(item.kind, matched.id) ? matched.id : null
        if (!categoryId && item.category_hint.trim()) {
          const created = await createCategory({
            name: item.category_hint.trim(),
            icon: 'tag',
            color: MODULE_COLORS.finance,
            kind: item.kind === 'income' ? 'income' : item.category_kind,
          })
          if (!created.ok) { Alert.alert(t.could_not_save, created.error ?? ''); setApplying(false); return }
          const fresh = useFinanceStore.getState().categories.find((c) => c.name === item.category_hint.trim())
          categoryId = fresh?.id ?? null
        }
        const res = await createPlanItem({
          name: item.name,
          kind: item.kind,
          amount_cents: item.amount_cents,
          currency: item.currency,
          category_id: categoryId,
          due_day: item.due_day,
          recurrence: item.recurrence,
          status: 'confirmed',
        })
        if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); setApplying(false); return }
      }
      if (journalSel && plan.journalDraft) {
        const res = await createJournal({
          content: plan.journalDraft.content,
          mood: plan.journalDraft.mood,
          tags: plan.journalDraft.tags || undefined,
          occurred_at: new Date().toISOString(),
        })
        if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); setApplying(false); return }
      }
    } catch (e) {
      Alert.alert(t.could_not_save, String(e))
      setApplying(false)
      return
    }
    setApplying(false)
    void hapticSaveSuccess()
    notifySaved(t, syncFinance)
    onApplied?.(createdGoalId)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.bg.primary, paddingBottom: insets.bottom + spacing[3] }]}>
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: MODULE_COLORS.analysis + '1F' }]}>
              <Feather name="cpu" size={18} color={MODULE_COLORS.analysis} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>{t.goal_coach_title}</Text>
              <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>{goal.title}</Text>
              <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={2}>{t.goal_primary_metric_hint}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Feather name="x" size={22} color={theme.text.muted} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={MODULE_COLORS.analysis} />
              <Text style={[styles.muted, { color: theme.text.muted }]}>{t.goal_coach_loading}</Text>
            </View>
          ) : unavailable ? (
            <View style={styles.center}>
              <Feather name="cloud-off" size={28} color={theme.text.muted} />
              <Text style={[styles.muted, { color: theme.text.muted }]}>{t.goal_coach_unavailable}</Text>
            </View>
          ) : plan ? (
            <>
              <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                {plan.summary ? (
                  <Text style={[styles.summary, { color: theme.text.secondary, backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                    {plan.summary}
                  </Text>
                ) : null}

                {plan.habits.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: MODULE_COLORS.habits }]}>{t.goal_coach_habits}</Text>
                    {plan.habits.map((h, i) => (
                      editingHabit === i ? (
                        <View key={`h${i}`} style={[styles.itemRow, { backgroundColor: theme.bg.elevated, borderColor: MODULE_COLORS.habits + '66' }]}>
                          <Pressable
                            onPress={() => toggle(habitSel, i, setHabitSel)}
                            style={[styles.checkbox, { borderColor: habitSel.has(i) ? MODULE_COLORS.habits : theme.border.strong, backgroundColor: habitSel.has(i) ? MODULE_COLORS.habits : 'transparent' }]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: habitSel.has(i) }}
                          >
                            {habitSel.has(i) ? <Feather name="check" size={13} color="#fff" /> : null}
                          </Pressable>
                          <View style={styles.itemBody}>
                            <TextInput
                              value={h.title}
                              onChangeText={(v) => updateHabit(i, { title: v })}
                              style={[styles.editInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.primary }]}
                              accessibilityLabel={t.goal_coach_habits}
                            />
                            <View style={styles.editChips}>
                              {(['daily', 'weekdays', 'custom'] as const).map((c) => {
                                const on = h.cadence === c
                                return (
                                  <Pressable
                                    key={c}
                                    onPress={() => updateHabit(i, { cadence: c })}
                                    hitSlop={8}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: on }}
                                    style={[styles.editChip, { backgroundColor: on ? MODULE_COLORS.habits : 'transparent', borderColor: on ? MODULE_COLORS.habits : theme.border.strong }]}
                                  >
                                    <Text style={[styles.editChipText, { color: on ? '#fff' : theme.text.secondary }]}>{cadenceLabel(c)}</Text>
                                  </Pressable>
                                )
                              })}
                            </View>
                            <View style={styles.stepper}>
                              <Pressable
                                onPress={() => updateHabit(i, { target_per_period: Math.max(1, h.target_per_period - 1) })}
                                hitSlop={8}
                                style={[styles.stepBtn, { borderColor: theme.border.strong }]}
                                accessibilityRole="button"
                                accessibilityLabel="−"
                              >
                                <Feather name="minus" size={16} color={theme.text.primary} />
                              </Pressable>
                              <Text style={[styles.stepValue, { color: theme.text.primary }]}>{h.target_per_period}×</Text>
                              <Pressable
                                onPress={() => updateHabit(i, { target_per_period: Math.min(20, h.target_per_period + 1) })}
                                hitSlop={8}
                                style={[styles.stepBtn, { borderColor: theme.border.strong }]}
                                accessibilityRole="button"
                                accessibilityLabel="+"
                              >
                                <Feather name="plus" size={16} color={theme.text.primary} />
                              </Pressable>
                            </View>
                          </View>
                          <Pressable onPress={() => setEditingHabit(null)} hitSlop={8} style={[styles.editBtn, { borderColor: MODULE_COLORS.habits + '66' }]}>
                            <Feather name="check" size={13} color={MODULE_COLORS.habits} />
                            <Text style={[styles.editText, { color: MODULE_COLORS.habits }]}>{t.done}</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <CheckRow key={`h${i}`} checked={habitSel.has(i)} onToggle={() => toggle(habitSel, i, setHabitSel)} onEdit={() => setEditingHabit(i)} accent={MODULE_COLORS.habits}>
                          <Text style={[styles.itemTitle, { color: theme.text.primary }]}>{h.title}</Text>
                          <Text style={[styles.itemMeta, { color: theme.text.muted }]}>
                            {h.target_per_period}× · {cadenceLabel(h.cadence)}
                          </Text>
                          {h.why ? <Text style={[styles.itemWhy, { color: theme.text.muted }]}>{h.why}</Text> : null}
                        </CheckRow>
                      )
                    ))}
                  </View>
                ) : null}

                {plan.tasks.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: MODULE_COLORS.tasks }]}>{t.goal_coach_tasks}</Text>
                    {plan.tasks.map((task, i) => (
                      <CheckRow key={`t${i}`} checked={taskSel.has(i)} onToggle={() => toggle(taskSel, i, setTaskSel)} onEdit={() => openTaskSuggestion(task, i)} accent={MODULE_COLORS.tasks}>
                        <Text style={[styles.itemTitle, { color: theme.text.primary }]}>{task.title}</Text>
                        <Text style={[styles.itemMeta, { color: theme.text.muted }]}>
                          {format(new Date(task.remind_at), 'EEE dd/MM · HH:mm', { locale })}
                        </Text>
                        {task.why ? <Text style={[styles.itemWhy, { color: theme.text.muted }]}>{task.why}</Text> : null}
                      </CheckRow>
                    ))}
                  </View>
                ) : null}

                {plan.spendingPlan.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: MODULE_COLORS.finance }]}>{t.monthly_plan}</Text>
                    {plan.spendingPlan.map((item, i) => (
                      <CheckRow key={`p${i}`} checked={spendingSel.has(i)} onToggle={() => toggle(spendingSel, i, setSpendingSel)} onEdit={() => openSpendingSuggestion(item, i)} accent={MODULE_COLORS.finance}>
                        <Text style={[styles.itemTitle, { color: theme.text.primary }]}>{item.name}</Text>
                        <Text style={[styles.itemMeta, { color: theme.text.muted }]}>
                          {item.kind === 'income' ? t.income : t.expense} Â· {formatAmount(item.amount_cents, item.currency, language)} Â· {item.recurrence === 'monthly' ? t.plan_monthly_hint : t.plan_once_hint}
                        </Text>
                        {item.why ? <Text style={[styles.itemWhy, { color: theme.text.muted }]}>{item.why}</Text> : null}
                      </CheckRow>
                    ))}
                  </View>
                ) : null}

                {plan.spendingAdvice.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: MODULE_COLORS.finance }]}>{t.goal_coach_spending}</Text>
                    <View style={[styles.adviceCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                      {plan.spendingAdvice.map((s, i) => (
                        <View key={`s${i}`} style={styles.adviceRow}>
                          <Feather name="circle" size={6} color={MODULE_COLORS.finance} style={{ marginTop: 7 }} />
                          <Text style={[styles.adviceText, { color: theme.text.secondary }]}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {plan.journalDraft ? (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: MODULE_COLORS.journal }]}>{t.goal_coach_journal}</Text>
                    <CheckRow checked={journalSel} onToggle={() => setJournalSel((v) => !v)} onEdit={openJournalSuggestion} accent={MODULE_COLORS.journal}>
                      <Text style={[styles.itemWhy, { color: theme.text.secondary }]} numberOfLines={6}>{plan.journalDraft.content}</Text>
                    </CheckRow>
                  </View>
                ) : null}
              </ScrollView>

              <Pressable
                onPress={onApply}
                disabled={applying}
                style={[styles.applyBtn, { backgroundColor: applying ? theme.text.muted : MODULE_COLORS.analysis }]}
              >
                {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyText}>{persistBeforeApply ? t.goal_coach_create_apply : t.goal_coach_apply}</Text>}
              </Pressable>
            </>
          ) : (
            <View style={styles.center}>
              <Text style={[styles.muted, { color: theme.text.muted }]}>{t.goal_coach_empty}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingBottom: spacing[3] },
  headerIcon: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  closeBtn: { padding: spacing[1] },
  center: { paddingVertical: spacing[8], alignItems: 'center', gap: spacing[3] },
  muted: { fontSize: 14, textAlign: 'center' },
  body: { gap: spacing[4], paddingBottom: spacing[4] },
  summary: { fontSize: 14, lineHeight: 20, fontWeight: '600', borderWidth: 1, borderRadius: radius.md, padding: spacing[3] },
  section: { gap: spacing[2] },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  itemRow: { flexDirection: 'row', gap: spacing[3], borderWidth: 1, borderRadius: radius.md, padding: spacing[3], alignItems: 'flex-start' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  itemBody: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  itemMeta: { fontSize: 12, fontWeight: '600' },
  itemWhy: { fontSize: 13, lineHeight: 19 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  editText: { fontSize: 12, fontWeight: '700' },
  editInput: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: spacing[1], fontSize: 14, fontWeight: '600' },
  editChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  editChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3 },
  editChipText: { fontSize: 12, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stepBtn: { width: 32, height: 32, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 14, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  adviceCard: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], gap: spacing[2] },
  adviceRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  adviceText: { flex: 1, fontSize: 13, lineHeight: 19 },
  applyBtn: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
