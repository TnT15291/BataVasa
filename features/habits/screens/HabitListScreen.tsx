import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useHabitsBootstrap, useHabits, useHabitActions } from '../hooks/useHabits'

const CADENCE_COLORS: Record<string, string> = {
  daily: '#4CAF50',
  weekdays: '#2196F3',
  weekly: '#9C27B0',
}

function HabitRow({
  habit,
  onToggle,
  onEdit,
}: {
  habit: ReturnType<typeof useHabits>[number]
  onToggle: () => void
  onEdit: () => void
}) {
  const theme = useTheme()
  const { t } = useTranslation()
  const done = habit.todayCount >= habit.target_per_period

  return (
    <Pressable
      onLongPress={onEdit}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={habit.name}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
          borderColor: done ? habit.color + '66' : theme.border.subtle,
        },
      ]}
    >
      <View style={[styles.rowAccent, { backgroundColor: habit.color }]} />
      <Text style={styles.rowIcon}>{habit.icon}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: theme.text.primary }]}>{habit.name}</Text>
        <Text style={[styles.rowMeta, { color: theme.text.muted }]}>
          {done
            ? `✓ ${t.habit_done_today}  ·  🔥 ${habit.streak}`
            : `○ ${habit.todayCount}/${habit.target_per_period}  ·  🔥 ${habit.streak}`}
        </Text>
      </View>
      <View style={[styles.checkCircle, {
        backgroundColor: done ? habit.color : 'transparent',
        borderColor: done ? habit.color : theme.border.strong,
      }]}>
        {done ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
    </Pressable>
  )
}

export function HabitListScreen() {
  useHabitsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const habits = useHabits()
  const { toggleTodayLog } = useHabitActions()

  if (habits.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.bg.primary }]}>
        <Text style={styles.emptyIcon}>💪</Text>
        <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_habits}</Text>
        <Text style={[styles.emptyMsg, { color: theme.text.muted }]}>{t.no_habits_msg}</Text>
        <Pressable
          onPress={() => router.push('/habit' as any)}
          style={[styles.emptyBtn, { backgroundColor: theme.brand.primary }]}
        >
          <Text style={styles.emptyBtnText}>{t.new_habit}</Text>
        </Pressable>
      </View>
    )
  }

  const doneCount = habits.filter((h) => h.todayCount >= h.target_per_period).length
  const totalCount = habits.length

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      {/* Summary bar */}
      <View style={[styles.summary, { backgroundColor: theme.bg.elevated, borderBottomColor: theme.border.subtle }]}>
        <Text style={[styles.summaryText, { color: theme.text.muted }]}>
          {t.habits_done_today.replace('{{done}}', String(doneCount)).replace('{{total}}', String(totalCount))}
        </Text>
        <View style={[styles.progressBar, { backgroundColor: theme.border.subtle }]}>
          <View style={[styles.progressFill, {
            backgroundColor: doneCount === totalCount ? '#4CAF50' : theme.brand.primary,
            width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`,
          }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            onToggle={() => toggleTodayLog(habit.id)}
            onEdit={() => router.push({ pathname: '/habit', params: { id: habit.id } } as any)}
          />
        ))}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/habit' as any)}
        accessibilityRole="button"
        accessibilityLabel={t.new_habit}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  summary: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  summaryText: { fontSize: 13, fontWeight: '500' },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  list: { padding: spacing[4], paddingBottom: 100, gap: spacing[2] },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden',
  },
  rowAccent: { width: 4, alignSelf: 'stretch' },
  rowIcon: { fontSize: 22, marginLeft: spacing[1] },
  rowBody: { flex: 1, paddingVertical: spacing[3], gap: 3 },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowMeta: { fontSize: 12 },
  checkCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing[3],
  },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center' },
  emptyBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fab: {
    position: 'absolute', right: spacing[6], bottom: spacing[8],
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  fabIcon: { color: '#fff', fontSize: 30, fontWeight: '600', lineHeight: 32 },
})
