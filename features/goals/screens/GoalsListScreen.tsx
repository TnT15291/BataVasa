import { useEffect } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useGoalsStore } from '@store/goalsStore'
import { ScreenTransition } from '@components/ScreenTransition'
import { FAB } from '@components/FAB'
import { AppHeader, EmptyState, ListRow, ModuleOverview, SectionHeader, StatusPill } from '@components/ui'
import { toast } from '@store/toastStore'

export function GoalsListScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const goals = useGoalsStore((s) => s.goals)
  const loadGoals = useGoalsStore((s) => s.loadGoals)
  const deleteGoal = useGoalsStore((s) => s.deleteGoal)
  const restoreGoal = useGoalsStore((s) => s.restoreGoal)

  useEffect(() => { void loadGoals() }, [loadGoals])

  const active = goals.filter((g) => g.status === 'active')
  const done = goals.filter((g) => g.status === 'done')
  const avg = active.length > 0 ? Math.round(active.reduce((sum, g) => sum + g.progress.percent, 0) / active.length) : 0

  const confirmDelete = (id: string) => {
    Alert.alert(t.delete, t.goal_delete_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await deleteGoal(id)
            if (!r.ok) {
              Alert.alert(t.could_not_save, r.error ?? '')
              return
            }
            toast.undo(t.toast_deleted, t.undo, () => { void restoreGoal(id) })
          })()
        },
      },
    ])
  }

  return (
    <ScreenTransition style={{ backgroundColor: theme.bg.primary }}>
      {goals.length === 0 ? (
        <View style={[styles.empty, { paddingTop: insets.top + spacing[6] }]}>
          <EmptyState
            icon="target"
            accent={MODULE_COLORS.analysis}
            title={t.goal_empty}
            body={t.goal_empty_hint}
            cta={{ label: t.new_goal, onPress: () => router.push('/goal') }}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[2] }]}>
          <AppHeader title={t.nav_goals} subtitle={t.goal_auto_progress} onSearch={() => router.push('/search')} onSettings={() => router.push('/settings')} />
          <ModuleOverview
            eyebrow={t.goals}
            value={`${avg}%`}
            subtitle={active[0]?.title ?? t.goal_done}
            icon="target"
            accent={MODULE_COLORS.analysis}
            stats={[
              { key: 'active', label: t.goal_active, value: String(active.length), color: MODULE_COLORS.analysis },
              { key: 'done', label: t.goal_done, value: String(done.length), color: theme.semantic.success },
              { key: 'total', label: t.data_records, value: String(goals.length) },
            ]}
          />
          <View style={styles.block}>
            <SectionHeader label={t.goal_active} count={active.length} />
            <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              {(active.length > 0 ? active : done).map((goal) => (
                <ListRow
                  key={goal.id}
                  icon={goal.binding?.module === 'finance' ? 'trending-up' : 'check-circle'}
                  color={goal.binding?.module === 'finance' ? MODULE_COLORS.finance : MODULE_COLORS.habits}
                  title={goal.title}
                  subtitle={`${goal.progress.label} · ${goal.progress.sourceLabel}`}
                  meta={`${goal.progress.percent}%`}
                  metaColor={goal.progress.percent >= 100 ? theme.semantic.success : MODULE_COLORS.analysis}
                  onPress={() => router.push({ pathname: '/goal-detail', params: { id: goal.id } })}
                  onLongPress={() => confirmDelete(goal.id)}
                />
              ))}
            </View>
          </View>
          {done.length > 0 && active.length > 0 ? (
            <View style={styles.block}>
              <SectionHeader label={t.goal_done} count={done.length} />
              <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                {done.map((goal) => (
                  <ListRow
                    key={goal.id}
                    icon="check"
                    color={theme.semantic.success}
                    title={goal.title}
                    subtitle={goal.progress.label}
                    right={<StatusPill label={t.goal_done} tone="success" />}
                    onPress={() => router.push({ pathname: '/goal-detail', params: { id: goal.id } })}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
      <FAB
        onPress={() => router.push('/goal')}
        accessibilityLabel={t.new_goal}
        style={[styles.fab, { backgroundColor: MODULE_COLORS.analysis }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </FAB>
    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], paddingBottom: 112, gap: spacing[3] },
  empty: { flex: 1, padding: spacing[4], justifyContent: 'center' },
  block: { gap: spacing[2] },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing[2], gap: spacing[1] },
  fab: {
    position: 'absolute',
    right: spacing[6],
    bottom: spacing[5],
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
