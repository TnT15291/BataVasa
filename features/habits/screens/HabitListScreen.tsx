import { useMemo, useState, useEffect, useRef } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet, Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { useHabitsBootstrap, useHabits, useHabitActions } from '../hooks/useHabits'
import { useHabitsStore } from '@store/habitsStore'
import { GoalBadge } from '@features/goals/components/GoalBadge'
import { rescheduleAllHabitNotifications } from '../services'
import { MODULE_COLORS } from '@design/moduleColors'
import { FAB } from '@components/FAB'
import { ScreenTransition } from '@components/ScreenTransition'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader, ModuleOverview } from '@components/ui'
import * as Haptics from 'expo-haptics'
import { toast } from '@store/toastStore'

const GROUP_COLORS = {
  pending: MODULE_COLORS.finance,
  later: MODULE_COLORS.tasks,
  done: MODULE_COLORS.habits,
  skipped: MODULE_COLORS.analysis,
}

const capitalizeFirst = (text: string) => text ? text.charAt(0).toUpperCase() + text.slice(1) : text

function HabitRow({
  habit,
  onToggle,
  onSkip,
  onEdit,
  accent,
  compact,
}: {
  habit: ReturnType<typeof useHabits>[number]
  onToggle: () => void
  onSkip: () => void
  onEdit: () => void
  accent: string
  compact?: boolean
}) {
  const theme = useTheme()
  const { t } = useTranslation()
  const done = habit.todayCount >= habit.target_per_period
  const dueToday = habit.dueToday !== false
  // The habit's own colour wins; the group accent is only a fallback for habits
  // without one. (Previously `accent` came first, so every row took its group's colour.)
  const color = habit.color || accent || MODULE_COLORS.habits
  // Atomic Habits "never miss twice": gentle nudge when due today, not yet done,
  // and yesterday was left undone — keep a one-day slip from becoming two.
  const showNudge = dueToday && !done && habit.missedYesterday === true

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={habit.name}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
          borderColor: done ? color + '3D' : theme.border.subtle,
        },
      ]}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: color + '16', borderColor: color + '33' }]}>
        <Text style={styles.rowEmoji}>{habit.icon}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowNameRow}>
          <Text
            style={[styles.rowName, compact && styles.rowNameCompact, { color: done ? theme.text.secondary : theme.text.primary }]}
            numberOfLines={1}
          >
            {capitalizeFirst(habit.name)}
          </Text>
          {habit.notification_times ? (
            <Feather name="bell" size={11} color={theme.text.muted} />
          ) : null}
        </View>
        <View style={styles.rowMetaRow}>
          {dueToday && habit.streak > 0 ? (
            <Feather name="trending-up" size={12} color={color} />
          ) : null}
          <Text style={[styles.rowMeta, { color: theme.text.muted }]}>
            {!dueToday ? t.habit_not_scheduled : done
              ? `${t.habit_done_today} · ${habit.streak}d`
              : `${habit.todayCount}/${habit.target_per_period} · ${habit.streak}d`}
          </Text>
          <GoalBadge variant="chip" module="habits" id={habit.id} />
        </View>
        {showNudge ? (
          <View style={[styles.nudgePill, { backgroundColor: color + '18' }]}>
            <Feather name="rotate-ccw" size={10} color={color} />
            <Text style={[styles.nudgeText, { color }]} numberOfLines={1}>{t.habit_dont_miss_twice}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.checkCircle, {
        backgroundColor: done ? color : 'transparent',
        borderColor: done ? color : theme.border.strong,
      }]}>
        {done ? <Feather name="check" size={14} color="#fff" /> : null}
      </View>
      <Pressable
        onPress={(e) => { e.stopPropagation(); onEdit() }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t.update}
        style={[styles.editBtn, { borderColor: theme.border.subtle, backgroundColor: theme.bg.secondary }]}
      >
        <Feather name="edit-2" size={14} color={theme.text.secondary} />
      </Pressable>
      {dueToday && !done ? (
        <Pressable
          onPress={(e) => { e.stopPropagation(); onSkip() }}
          hitSlop={8}
          style={[styles.skipBtn, { borderColor: theme.border.subtle }]}
        >
          <Text style={[styles.skipText, { color: theme.text.muted }]}>{t.reminder_skip}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  )
}

export function HabitListScreen() {
  useHabitsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const habits = useHabits()
  const { toggleTodayLog, skipToday, deleteHabit, restoreHabit } = useHabitActions()
  const language = useSettingsStore((s) => s.language)
  const isFirstRender = useRef(true)
  const [showDetails, setShowDetails] = useState(false)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    void rescheduleAllHabitNotifications()
  }, [language])

  const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100]

  const handleToggleWithMilestone = async (habitId: string) => {
    const oldStreak = useHabitsStore.getState().habits.find((h) => h.id === habitId)?.streak ?? 0
    await toggleTodayLog(habitId)
    const newStreak = useHabitsStore.getState().habits.find((h) => h.id === habitId)?.streak ?? 0
    if (newStreak > oldStreak && STREAK_MILESTONES.includes(newStreak)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // Atomic Habits: each milestone is a "vote" for the identity the user chose.
      const habit = useHabitsStore.getState().habits.find((h) => h.id === habitId)
      const identityValue = habit?.identity?.trim()
      Alert.alert(
        t.habit_streak_milestone.replace('{{n}}', String(newStreak)),
        identityValue ? t.habit_identity_vote.replace('{{identity}}', identityValue) : undefined
      )
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }

  const doneCount = habits.filter((h) => h.dueToday !== false && h.todayCount >= h.target_per_period).length
  const totalCount = habits.filter((h) => h.dueToday !== false).length
  const { pendingHabits, doneHabits, skippedHabits, laterHabits, bestStreak, avgStrength } = useMemo(() => {
    const pendingHabits = habits.filter((h) => h.dueToday !== false && !h.skippedToday && h.todayCount < h.target_per_period)
    const doneHabits = habits.filter((h) => h.dueToday !== false && !h.skippedToday && h.todayCount >= h.target_per_period)
    const skippedHabits = habits.filter((h) => h.dueToday !== false && h.skippedToday)
    const laterHabits = habits.filter((h) => h.dueToday === false)
    const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0)
    const avgStrength = habits.length > 0
      ? Math.round(habits.reduce((s, h) => s + h.strengthScore, 0) / habits.length)
      : 0
    return { pendingHabits, doneHabits, skippedHabits, laterHabits, bestStreak, avgStrength }
  }, [habits])

  const renderGroup = (title: string, items: typeof habits, accent: string, compact = false) => {
    if (items.length === 0) return null
    return (
      <View style={styles.group}>
        <View style={styles.groupTitleRow}>
          <View style={styles.groupTitleLeft}>
            <View style={[styles.groupDot, { backgroundColor: accent }]} />
            <Text style={[styles.groupTitle, { color: theme.text.primary }]}>{capitalizeFirst(title)}</Text>
          </View>
          <Text style={[styles.groupCount, { color: accent, backgroundColor: accent + '14' }]}>{items.length}</Text>
        </View>
        <View style={styles.listStack}>
          {items.map((habit) => (
            (() => {
              const confirmDelete = () => Alert.alert(t.delete, t.confirm_delete_item, [
                { text: t.cancel, style: 'cancel' },
                {
                  text: t.delete,
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      const result = await deleteHabit(habit.id)
                      if (!result.ok) {
                        Alert.alert(t.could_not_save, result.error ?? '')
                        return
                      }
                      toast.undo(t.toast_deleted, t.undo, () => { void restoreHabit(habit.id) })
                    })()
                  },
                },
              ])
              return (
            <ReanimatedSwipeable
              key={habit.id}
              renderRightActions={(_p, _d, swipeable) => (
                <Pressable
                  onPress={() => {
                    swipeable.close()
                    confirmDelete()
                  }}
                  style={[styles.swipeDelete, { backgroundColor: theme.semantic.danger }]}
                >
                  <Feather name="trash-2" size={20} color="#fff" />
                </Pressable>
              )}
              overshootRight={false}
            >
              <HabitRow
                habit={habit}
                onToggle={() => handleToggleWithMilestone(habit.id)}
                onSkip={() => skipToday(habit.id)}
                onEdit={() => router.push({ pathname: '/habit', params: { id: habit.id } })}
                accent={accent}
                compact={compact}
              />
            </ReanimatedSwipeable>
              )
            })()
          ))}
        </View>
      </View>
    )
  }

  return (
    <ScreenTransition style={{ backgroundColor: theme.bg.primary }}>
      {habits.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: MODULE_COLORS.habits + '1F' }]}>
            <Feather name="check-circle" size={34} color={MODULE_COLORS.habits} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_habits}</Text>
          <Text style={[styles.emptyMsg, { color: theme.text.muted }]}>{t.no_habits_msg}</Text>
          <View style={styles.emptySamples}>
            {[t.habit_sample_water, t.habit_sample_exercise, t.habit_sample_read].map((sample) => (
              <Text
                key={sample}
                style={[styles.emptySample, { color: theme.text.secondary, backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
              >
                {sample}
              </Text>
            ))}
          </View>
          <Pressable
            onPress={() => router.push('/habit')}
            style={[styles.emptyBtn, { backgroundColor: theme.brand.primary }]}
          >
            <Text style={[styles.emptyBtnText, { color: theme.brand.onPrimary }]}>{t.new_habit}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingTop: insets.top + spacing[2] }]}>
          <AppHeader subtitle={t.habits} onSettings={() => router.push('/settings')} />
          <ModuleOverview
            eyebrow={t.today}
            value={`${doneCount}/${totalCount}`}
            subtitle={pendingHabits[0]?.name ?? t.habit_done_today}
            icon="check-circle"
            accent={MODULE_COLORS.habits}
            stats={[
              { key: 'pending', label: t.reminder_upcoming, value: String(pendingHabits.length), color: MODULE_COLORS.habits },
              { key: 'done', label: t.habit_done_today, value: String(doneHabits.length), color: theme.semantic.success },
              { key: 'streak', label: t.report_current_streak, value: String(bestStreak) },
              {
                key: 'strength',
                label: t.habit_strength_score,
                value: `${avgStrength}%`,
                color: avgStrength >= 70 ? theme.semantic.success : avgStrength >= 40 ? MODULE_COLORS.habits : theme.semantic.warning,
              },
            ]}
          />

          <View style={styles.analysisRow}>
            {[
              { label: t.nav_reports, icon: 'bar-chart-2' as const, route: '/habits-report', bg: MODULE_COLORS.habits },
              { label: t.nav_insights, icon: 'cpu' as const, route: '/habits-insights', bg: MODULE_COLORS.analysis },
            ].map((item) => (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => [
                  styles.analysisBtn,
                  {
                    backgroundColor: pressed ? item.bg + '12' : theme.bg.elevated,
                    borderColor: item.bg + '66',
                  },
                ]}
              >
                <Feather name={item.icon} size={16} color={item.bg} />
                <Text style={[styles.analysisBtnText, { color: item.bg }]} numberOfLines={1}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          {renderGroup(t.reminder_upcoming, pendingHabits, GROUP_COLORS.pending)}
          {renderGroup(t.habit_not_scheduled, laterHabits, GROUP_COLORS.later)}
          {renderGroup(t.habit_skipped_today, skippedHabits, GROUP_COLORS.skipped, true)}
          {renderGroup(t.habit_done_today, doneHabits, GROUP_COLORS.done, true)}
        </ScrollView>
      )}

      <FAB
        onPress={() => router.push('/habit')}
        accessibilityLabel={t.new_habit}
        style={[styles.fab, { backgroundColor: theme.brand.primary, bottom: spacing[5] }]}
      >
        <Feather name="plus" size={28} color={theme.brand.onPrimary} />
      </FAB>

    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
  radarStats: { gap: spacing[2] },
  radarMetricRow: { flexDirection: 'row', gap: spacing[2] },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[4],
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  heroText: { flex: 1, gap: spacing[1] },
  heroKicker: { fontSize: 12, fontWeight: '500' },
  heroTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  heroSubtitle: { fontSize: 13, lineHeight: 18 },
  progressValue: { fontSize: 17, fontWeight: '700' },
  progressLabel: { fontSize: 12, fontWeight: '500' },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  detailToggle: {
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailToggleText: { fontSize: 13, fontWeight: '700' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  statChip: {
    width: '48%',
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  list: { padding: spacing[4], paddingBottom: 112, gap: spacing[3] },
  group: { gap: spacing[2] },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  groupDot: { width: 8, height: 8, borderRadius: radius.full },
  groupTitle: { fontSize: 13, fontWeight: '600' },
  groupCount: { minWidth: 22, overflow: 'hidden', borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  listStack: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[3],
  },
  rowBody: { flex: 1, paddingVertical: spacing[3], gap: 3 },
  rowEmoji: { fontSize: 18 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  rowName: { fontSize: 14, fontWeight: '600' },
  rowNameCompact: { fontSize: 13, fontWeight: '500' },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowMeta: { fontSize: 11, fontWeight: '500' },
  nudgePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2, marginTop: 3 },
  nudgeText: { fontSize: 11, fontWeight: '700' },
  checkCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: spacing[3] },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[1],
  },
  skipBtn: { minHeight: 36, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6, marginRight: spacing[2], justifyContent: 'center' },
  skipText: { fontSize: 12, fontWeight: '700' },
  swipeHint: { fontSize: 12, lineHeight: 16, paddingHorizontal: spacing[1] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center' },
  emptySamples: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[2], marginTop: spacing[1] },
  emptySample: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 12 },
  emptyBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fab: {
    position: 'absolute', right: spacing[6],
    width: 56, height: 56, borderRadius: radius.lg, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 5, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  analysisRow: { flexDirection: 'row', gap: spacing[2] },
  analysisBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  analysisBtnText: { fontSize: 12, fontWeight: '600' },
  swipeDelete: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
})
