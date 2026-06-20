import { useEffect, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator, Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import { notifySaved } from '@store/toastStore'
import { hapticSaveSuccess } from '@services/haptics'
import type { GoalWithProgress } from '../types'

type Props = {
  visible: boolean
  goal: GoalWithProgress
  onClose: () => void
}

function CheckRow({
  checked, onToggle, accent, children,
}: { checked: boolean; onToggle: () => void; accent: string; children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.itemRow, { backgroundColor: theme.bg.elevated, borderColor: checked ? accent + '66' : theme.border.subtle }]}
    >
      <View style={[styles.checkbox, { borderColor: checked ? accent : theme.border.strong, backgroundColor: checked ? accent : 'transparent' }]}>
        {checked ? <Feather name="check" size={13} color="#fff" /> : null}
      </View>
      <View style={styles.itemBody}>{children}</View>
    </Pressable>
  )
}

export function GoalCoachSheet({ visible, goal, onClose }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)

  const createHabit = useHabitsStore((s) => s.createHabit)
  const createReminder = useRemindersStore((s) => s.createReminder)
  const createJournal = useJournalsStore((s) => s.createJournal)
  const syncFinance = useSettingsStore((s) => s.syncFinance)

  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<GoalCoachPlan | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [applying, setApplying] = useState(false)
  const [habitSel, setHabitSel] = useState<Set<number>>(new Set())
  const [taskSel, setTaskSel] = useState<Set<number>>(new Set())
  const [journalSel, setJournalSel] = useState(true)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setPlan(null)
    setUnavailable(false)
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

  const onApply = async () => {
    if (!plan) return
    setApplying(true)
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
                      <CheckRow key={`h${i}`} checked={habitSel.has(i)} onToggle={() => toggle(habitSel, i, setHabitSel)} accent={MODULE_COLORS.habits}>
                        <Text style={[styles.itemTitle, { color: theme.text.primary }]}>{h.title}</Text>
                        <Text style={[styles.itemMeta, { color: theme.text.muted }]}>
                          {h.target_per_period}× · {cadenceLabel(h.cadence)}
                        </Text>
                        {h.why ? <Text style={[styles.itemWhy, { color: theme.text.muted }]}>{h.why}</Text> : null}
                      </CheckRow>
                    ))}
                  </View>
                ) : null}

                {plan.tasks.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: MODULE_COLORS.tasks }]}>{t.goal_coach_tasks}</Text>
                    {plan.tasks.map((task, i) => (
                      <CheckRow key={`t${i}`} checked={taskSel.has(i)} onToggle={() => toggle(taskSel, i, setTaskSel)} accent={MODULE_COLORS.tasks}>
                        <Text style={[styles.itemTitle, { color: theme.text.primary }]}>{task.title}</Text>
                        <Text style={[styles.itemMeta, { color: theme.text.muted }]}>
                          {format(new Date(task.remind_at), 'EEE dd/MM · HH:mm', { locale })}
                        </Text>
                        {task.why ? <Text style={[styles.itemWhy, { color: theme.text.muted }]}>{task.why}</Text> : null}
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
                    <CheckRow checked={journalSel} onToggle={() => setJournalSel((v) => !v)} accent={MODULE_COLORS.journal}>
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
                {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyText}>{t.goal_coach_apply}</Text>}
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
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 13 },
  closeBtn: { padding: spacing[1] },
  center: { paddingVertical: spacing[8], alignItems: 'center', gap: spacing[3] },
  muted: { fontSize: 14, textAlign: 'center' },
  body: { gap: spacing[4], paddingBottom: spacing[4] },
  summary: { fontSize: 14, lineHeight: 20, fontWeight: '600', borderWidth: 1, borderRadius: radius.md, padding: spacing[3] },
  section: { gap: spacing[2] },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemRow: { flexDirection: 'row', gap: spacing[3], borderWidth: 1, borderRadius: radius.md, padding: spacing[3], alignItems: 'flex-start' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  itemBody: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  itemMeta: { fontSize: 12, fontWeight: '600' },
  itemWhy: { fontSize: 13, lineHeight: 19 },
  adviceCard: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], gap: spacing[2] },
  adviceRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  adviceText: { flex: 1, fontSize: 13, lineHeight: 19 },
  applyBtn: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  applyText: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
