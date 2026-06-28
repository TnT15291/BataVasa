import { useEffect } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useGoalsStore } from '@store/goalsStore'
import { ScreenTransition } from '@components/ScreenTransition'
import { SectionHeader, StatusPill } from '@components/ui'

export function GoalDetailScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === 'string' ? params.id : ''
  const goal = useGoalsStore((s) => s.selectedGoal)
  const loadGoal = useGoalsStore((s) => s.loadGoal)
  const updateGoal = useGoalsStore((s) => s.updateGoal)
  const deleteGoal = useGoalsStore((s) => s.deleteGoal)

  useEffect(() => { if (id) void loadGoal(id) }, [id, loadGoal])

  if (!goal) {
    return <View style={{ flex: 1, backgroundColor: theme.bg.primary }} />
  }

  const done = goal.status === 'done'
  const paused = goal.status === 'paused'
  const moduleMeta = {
    finance:   { color: MODULE_COLORS.finance, icon: MODULE_ICONS.finance, help: t.goal_updates_from_finance,  route: '/finance' },
    habits:    { color: MODULE_COLORS.habits,  icon: MODULE_ICONS.habits,  help: t.goal_updates_from_habit,    route: '/habits' },
    journals:  { color: MODULE_COLORS.journal, icon: MODULE_ICONS.journal, help: t.goal_updates_from_journal,  route: '/journals' },
    reminders: { color: MODULE_COLORS.tasks,   icon: MODULE_ICONS.tasks,   help: t.goal_updates_from_reminder, route: '/reminders' },
  } as const
  const meta = moduleMeta[goal.binding?.module ?? 'finance']
  const accent = meta.color
  const sourceIcon = meta.icon
  const sourceHelp = goal.binding?.module === 'finance' ? t.goal_finance_semantics : meta.help
  const sourceRoute = meta.route
  // A 'cap' goal exceeding its ceiling is a failure, not progress — show it red.
  const over = goal.progress.status === 'over'
  const barColor = over ? theme.semantic.danger : accent
  const weakestPercent = goal.measureProgress.length > 0
    ? Math.min(...goal.measureProgress.map((mp) => mp.progress.percent))
    : goal.progress.percent
  const shouldConfirmManualDone = !done && goal.measureProgress.some((mp) => mp.progress.direction === 'reach' && mp.progress.status !== 'reached')
  const submitDoneToggle = async () => {
    const r = await updateGoal({ id: goal.id, status: done ? 'active' : 'done' })
    if (!r.ok) Alert.alert(t.could_not_save, r.error ?? '')
  }
  const togglePaused = async () => {
    const r = await updateGoal({ id: goal.id, status: paused ? 'active' : 'paused' })
    if (!r.ok) Alert.alert(t.could_not_save, r.error ?? '')
  }
  const toggleDone = () => {
    if (shouldConfirmManualDone) {
      Alert.alert(t.goal_mark_done_incomplete_title, t.goal_mark_done_incomplete_msg, [
        { text: t.cancel, style: 'cancel' },
        { text: t.goal_mark_done, onPress: () => { void submitDoneToggle() } },
      ])
      return
    }
    void submitDoneToggle()
  }
  const renderMeasureRow = (mp: typeof goal.measureProgress[number], i: number) => {
    const mm = moduleMeta[mp.binding.module]
    const mOver = mp.progress.status === 'over'
    const mBar = mOver ? theme.semantic.danger : mm.color
    const needsFocus = mOver || (mp.progress.percent === weakestPercent && mp.progress.status !== 'reached')
    return (
      <View key={i} style={[styles.measureCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={styles.measureTop}>
          <View style={[styles.measureChip, { backgroundColor: mm.color + '1F' }]}>
            <Feather name={mm.icon} size={15} color={mm.color} />
          </View>
          <Text style={[styles.measureSource, { color: theme.text.primary }]} numberOfLines={1}>{mp.progress.sourceLabel}</Text>
          {needsFocus ? (
            <View style={[styles.focusPill, { backgroundColor: mBar + '1F', borderColor: mBar + '55' }]}>
              <Text style={[styles.focusText, { color: mBar }]}>{t.goal_needs_focus}</Text>
            </View>
          ) : null}
          <Text style={[styles.measurePct, { color: mBar }]}>{mp.progress.percent}%</Text>
        </View>
        <View style={[styles.bar, { backgroundColor: theme.bg.secondary }]}>
          <View style={[styles.fill, { width: `${mp.progress.percent}%`, backgroundColor: mBar }]} />
        </View>
        <Text style={[styles.measureLabel, { color: theme.text.muted }]}>{mp.progress.label}</Text>
        {mp.progress.direction === 'cap' ? (
          <Text style={[styles.measureLabel, { color: mOver ? theme.semantic.danger : theme.semantic.success, fontWeight: '700' }]}>
            {mOver ? t.goal_over_target : t.goal_cap_doing_well.replace('{{source}}', mp.progress.sourceLabel)}
          </Text>
        ) : null}
        {mp.progress.note ? <Text style={[styles.measureLabel, { color: mm.color, fontWeight: '700' }]}>{mp.progress.note}</Text> : null}
      </View>
    )
  }

  const onDelete = () => {
    Alert.alert(t.delete, t.goal_delete_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await deleteGoal(goal.id)
            if (!r.ok) Alert.alert(t.could_not_save, r.error ?? '')
            else router.back()
          })()
        },
      },
    ])
  }

  return (
    <ScreenTransition style={{ backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.hero, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={[styles.iconWrap, { backgroundColor: accent }]}>
            <Feather name={sourceIcon} size={22} color="#fff" />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.title, { color: theme.text.primary }]}>{goal.title}</Text>
            {goal.description ? <Text style={[styles.desc, { color: theme.text.muted }]}>{goal.description}</Text> : null}
          </View>
          <StatusPill
            label={done ? t.goal_done : paused ? t.goal_paused : t.goal_active}
            tone={done ? 'success' : paused ? 'warning' : 'neutral'}
          />
        </View>

        <View style={styles.block}>
          <SectionHeader label={t.goal_progress} />
          <View style={[styles.progressCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <View style={styles.progressTop}>
              <Text style={[styles.progressValue, { color: theme.text.primary }]}>{goal.progress.label}</Text>
              <Text style={[styles.progressPercent, { color: barColor }]}>{goal.progress.percent}%</Text>
            </View>
            <View style={[styles.bar, { backgroundColor: theme.bg.secondary }]}>
              <View style={[styles.fill, { width: `${goal.progress.percent}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[styles.desc, { color: theme.text.muted }]}>{goal.progress.sourceLabel}</Text>
            {goal.progress.direction === 'cap' ? (
              <Text style={[styles.desc, { color: over ? theme.semantic.danger : theme.semantic.success, fontWeight: '700' }]}>
                {over ? t.goal_over_target : t.goal_cap_doing_well.replace('{{source}}', goal.progress.sourceLabel)}
              </Text>
            ) : null}
            {goal.progress.note ? (
              <Text style={[styles.desc, { color: accent, fontWeight: '700' }]}>{goal.progress.note}</Text>
            ) : null}
          </View>
        </View>

        {goal.measureProgress.length > 1 ? (
          <View style={styles.block}>
            <SectionHeader label={t.goal_measures} />
            <Text style={[styles.measuresHint, { color: theme.text.muted }]}>{t.goal_overall_slowest}</Text>
            {goal.measureProgress.map(renderMeasureRow)}
          </View>
        ) : (
          <View style={styles.block}>
            <SectionHeader label={t.goal_primary_metric} />
            <View style={[styles.sourceCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <View style={[styles.sourceIcon, { backgroundColor: accent + '1F' }]}>
                <Feather name={sourceIcon} size={16} color={accent} />
              </View>
              <View style={styles.sourceText}>
                <Text style={[styles.sourceTitle, { color: theme.text.primary }]}>{goal.progress.sourceLabel}</Text>
                <Text style={[styles.sourceHint, { color: theme.text.muted }]}>{t.goal_primary_metric_hint}</Text>
                <Text style={[styles.desc, { color: theme.text.muted }]}>{sourceHelp}</Text>
              </View>
              <Pressable onPress={() => router.push(sourceRoute as any)} hitSlop={8} style={[styles.openSource, { borderColor: accent }]}>
                <Feather name="arrow-right" size={15} color={accent} />
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })} style={[styles.action, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Feather name="edit-2" size={16} color={theme.text.secondary} />
            <Text style={[styles.actionText, { color: theme.text.primary }]}>{t.update}</Text>
          </Pressable>
          <Pressable onPress={toggleDone} style={[styles.action, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Feather name={done ? 'rotate-ccw' : 'check'} size={16} color={done ? MODULE_COLORS.analysis : theme.semantic.success} />
            <Text style={[styles.actionText, { color: theme.text.primary }]}>{done ? t.goal_reopen : t.goal_mark_done}</Text>
          </Pressable>
          {!done ? (
            <Pressable onPress={() => { void togglePaused() }} style={[styles.action, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <Feather name={paused ? 'play-circle' : 'pause-circle'} size={16} color={MODULE_COLORS.analysis} />
              <Text style={[styles.actionText, { color: theme.text.primary }]}>{paused ? t.goal_resume : t.goal_pause}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onDelete} style={[styles.action, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Feather name="trash-2" size={16} color={theme.semantic.danger} />
            <Text style={[styles.actionText, { color: theme.semantic.danger }]}>{t.delete}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3] },
  hero: { borderWidth: 1, borderRadius: radius.md, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconWrap: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, gap: spacing[1] },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  desc: { fontSize: 13, lineHeight: 18 },
  block: { gap: spacing[2] },
  progressCard: { borderWidth: 1, borderRadius: radius.md, padding: spacing[4], gap: spacing[3] },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[3] },
  progressValue: { flex: 1, fontSize: 18, fontWeight: '700' },
  progressPercent: { fontSize: 22, fontWeight: '700' },
  bar: { height: 10, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  measureCard: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], gap: spacing[2] },
  measureTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  measureChip: { width: 30, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  measureSource: { flex: 1, fontSize: 14, fontWeight: '700' },
  measurePct: { fontSize: 16, fontWeight: '700' },
  measureLabel: { fontSize: 12, lineHeight: 17 },
  measuresHint: { fontSize: 12, lineHeight: 17 },
  focusPill: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3 },
  focusText: { fontSize: 10, lineHeight: 13, fontWeight: '700' },
  sourceCard: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  sourceIcon: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  sourceText: { flex: 1, gap: 2 },
  sourceTitle: { fontSize: 14, fontWeight: '700' },
  sourceHint: { fontSize: 12, lineHeight: 17 },
  openSource: { width: 34, height: 34, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spacing[2] },
  action: { borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  actionText: { fontSize: 14, fontWeight: '700' },
})
