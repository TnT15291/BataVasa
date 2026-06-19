import { useEffect } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
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
  const accent = goal.binding?.module === 'finance' ? MODULE_COLORS.finance : MODULE_COLORS.habits
  const toggleDone = async () => {
    const r = await updateGoal({ id: goal.id, status: done ? 'active' : 'done' })
    if (!r.ok) Alert.alert(t.could_not_save, r.error ?? '')
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
            <Feather name={goal.binding?.module === 'finance' ? 'trending-up' : 'check-circle'} size={22} color="#fff" />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.title, { color: theme.text.primary }]}>{goal.title}</Text>
            {goal.description ? <Text style={[styles.desc, { color: theme.text.muted }]}>{goal.description}</Text> : null}
          </View>
          <StatusPill label={done ? t.goal_done : t.goal_active} tone={done ? 'success' : 'neutral'} />
        </View>

        <View style={styles.block}>
          <SectionHeader label={t.goal_progress} />
          <View style={[styles.progressCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <View style={styles.progressTop}>
              <Text style={[styles.progressValue, { color: theme.text.primary }]}>{goal.progress.label}</Text>
              <Text style={[styles.progressPercent, { color: accent }]}>{goal.progress.percent}%</Text>
            </View>
            <View style={[styles.bar, { backgroundColor: theme.bg.secondary }]}>
              <View style={[styles.fill, { width: `${goal.progress.percent}%`, backgroundColor: accent }]} />
            </View>
            <Text style={[styles.desc, { color: theme.text.muted }]}>{goal.progress.sourceLabel}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })} style={[styles.action, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Feather name="edit-2" size={16} color={theme.text.secondary} />
            <Text style={[styles.actionText, { color: theme.text.primary }]}>{t.update}</Text>
          </Pressable>
          <Pressable onPress={toggleDone} style={[styles.action, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Feather name={done ? 'rotate-ccw' : 'check'} size={16} color={done ? MODULE_COLORS.analysis : theme.semantic.success} />
            <Text style={[styles.actionText, { color: theme.text.primary }]}>{done ? t.goal_reopen : t.goal_mark_done}</Text>
          </Pressable>
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
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  desc: { fontSize: 13, lineHeight: 18 },
  block: { gap: spacing[2] },
  progressCard: { borderWidth: 1, borderRadius: radius.md, padding: spacing[4], gap: spacing[3] },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[3] },
  progressValue: { flex: 1, fontSize: 18, fontWeight: '800' },
  progressPercent: { fontSize: 22, fontWeight: '800' },
  bar: { height: 10, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  actions: { gap: spacing[2] },
  action: { borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  actionText: { fontSize: 14, fontWeight: '700' },
})
