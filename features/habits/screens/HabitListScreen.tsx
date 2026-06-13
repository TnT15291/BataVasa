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
import { rescheduleAllHabitNotifications } from '../services'
import { MODULE_COLORS } from '@design/moduleColors'
import { CircularProgress } from '@components/CircularProgress'
import { FAB } from '@components/FAB'
import { ScreenTransition } from '@components/ScreenTransition'
import * as Haptics from 'expo-haptics'
import { toast } from '@store/toastStore'

function HabitRow({
  habit,
  onToggle,
  onSkip,
  onEdit,
}: {
  habit: ReturnType<typeof useHabits>[number]
  onToggle: () => void
  onSkip: () => void
  onEdit: () => void
}) {
  const theme = useTheme()
  const { t } = useTranslation()
  const done = habit.todayCount >= habit.target_per_period
  const dueToday = habit.dueToday !== false

  return (
    <Pressable
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
      <View style={[styles.rowIconWrap, { backgroundColor: habit.color + '1F' }]}>
        {(habit.icon?.codePointAt(0) ?? 0) > 127
          ? <Text style={styles.rowEmoji}>{habit.icon}</Text>
          : <Feather name="check-circle" size={20} color={habit.color} />
        }
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowNameRow}>
          <Text style={[styles.rowName, { color: theme.text.primary }]}>{habit.name}</Text>
          {habit.notification_times ? (
            <Feather name="bell" size={11} color={theme.text.muted} />
          ) : null}
        </View>
        <View style={styles.rowMetaRow}>
          {dueToday && habit.streak > 0 ? (
            <Feather name="trending-up" size={12} color={habit.color} />
          ) : null}
          <Text style={[styles.rowMeta, { color: theme.text.muted }]}>
            {!dueToday ? t.habit_not_scheduled : done
              ? `${t.habit_done_today} · ${habit.streak}d`
              : `${habit.todayCount}/${habit.target_per_period} · ${habit.streak}d`}
          </Text>
        </View>
      </View>
      <View style={[styles.checkCircle, {
        backgroundColor: done ? habit.color : 'transparent',
        borderColor: done ? habit.color : theme.border.strong,
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
        <Pressable onPress={onSkip} hitSlop={8} style={[styles.skipBtn, { borderColor: theme.border.subtle }]}>
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
      Alert.alert(t.habit_streak_milestone.replace('{{n}}', String(newStreak)))
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }

  const doneCount = habits.filter((h) => h.dueToday !== false && h.todayCount >= h.target_per_period).length
  const totalCount = habits.filter((h) => h.dueToday !== false).length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const { pendingHabits, doneHabits, laterHabits, bestStreak, avgStrength } = useMemo(() => {
    const pendingHabits = habits.filter((h) => h.dueToday !== false && h.todayCount < h.target_per_period)
    const doneHabits = habits.filter((h) => h.dueToday !== false && h.todayCount >= h.target_per_period)
    const laterHabits = habits.filter((h) => h.dueToday === false)
    const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0)
    const avgStrength = habits.length > 0
      ? Math.round(habits.reduce((s, h) => s + h.strengthScore, 0) / habits.length)
      : 0
    return { pendingHabits, doneHabits, laterHabits, bestStreak, avgStrength }
  }, [habits])

  const renderGroup = (title: string, items: typeof habits) => {
    if (items.length === 0) return null
    return (
      <View style={styles.group}>
        <View style={styles.groupTitleRow}>
          <Text style={[styles.groupTitle, { color: theme.text.primary }]}>{title}</Text>
          <Text style={[styles.groupCount, { color: theme.text.muted }]}>{items.length}</Text>
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
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.brand.primary + '1F' }]}>
            <Feather name="check-circle" size={34} color={theme.brand.primary} />
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
            <Text style={styles.emptyBtnText}>{t.new_habit}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={[styles.hero, { backgroundColor: MODULE_COLORS.habits + '14', borderColor: MODULE_COLORS.habits + '44' }]}>
            <View style={styles.heroTop}>
              <View style={styles.heroText}>
                <Text style={[styles.heroKicker, { color: theme.text.muted }]}>{t.habits}</Text>
                <Text style={[styles.heroTitle, { color: theme.text.primary }]}>
                  {t.habits_done_today.replace('{{done}}', String(doneCount)).replace('{{total}}', String(totalCount))}
                </Text>
                <Text style={[styles.heroSubtitle, { color: theme.text.muted }]}>
                  {pendingHabits[0]?.name ?? t.habit_done_today}
                </Text>
              </View>
              <CircularProgress
                progress={progress}
                size={64}
                strokeWidth={3}
                color={doneCount === totalCount ? theme.semantic.success : MODULE_COLORS.habits}
                trackColor={theme.border.subtle}
              >
                <Text style={[styles.progressValue, { color: theme.text.primary }]}>{progress}%</Text>
                <Text style={[styles.progressLabel, { color: theme.text.muted }]}>{t.today}</Text>
              </CircularProgress>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.border.subtle }]}>
              <View style={[styles.progressFill, {
                backgroundColor: doneCount === totalCount ? theme.semantic.success : MODULE_COLORS.habits,
                width: `${progress}%`,
              }]} />
            </View>
            <Pressable
              onPress={() => setShowDetails((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showDetails }}
              style={[styles.detailToggle, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}
            >
              <Text style={[styles.detailToggleText, { color: MODULE_COLORS.habits }]}>
                {showDetails ? t.home_hide_details : t.home_show_details}
              </Text>
              <Feather name={showDetails ? 'chevron-up' : 'chevron-down'} size={16} color={theme.text.muted} />
            </Pressable>
            {showDetails ? (
            <View style={styles.statGrid}>
              <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
                <Text style={[styles.statValue, { color: MODULE_COLORS.habits }]}>{pendingHabits.length}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.reminder_upcoming}</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
                <Text style={[styles.statValue, { color: theme.semantic.success }]}>{doneHabits.length}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.habit_done_today}</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
                <Text style={[styles.statValue, { color: theme.text.primary }]}>{bestStreak}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.report_current_streak}</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
                <Text style={[styles.statValue, { color: avgStrength >= 70 ? theme.semantic.success : avgStrength >= 40 ? theme.brand.primary : theme.semantic.warning }]}>
                  {avgStrength}%
                </Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.habit_strength_score}</Text>
              </View>
            </View>
            ) : null}
          </View>

          <View style={styles.analysisRow}>
            {[
              { label: t.nav_reports, icon: 'bar-chart-2' as const, route: '/habits-report', bg: MODULE_COLORS.habits },
              { label: t.nav_insights, icon: 'cpu' as const, route: '/habits-insights', bg: theme.brand.primary },
            ].map((item) => (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => [styles.analysisBtn, { backgroundColor: pressed ? item.bg + 'CC' : item.bg }]}
              >
                <Feather name={item.icon} size={17} color="#fff" />
                <Text style={styles.analysisBtnText} numberOfLines={1}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.swipeHint, { color: theme.text.muted }]}>{t.swipe_delete_hint}</Text>

          {renderGroup(t.reminder_upcoming, pendingHabits)}
          {renderGroup(t.habit_not_scheduled, laterHabits)}
          {renderGroup(t.habit_done_today, doneHabits)}
        </ScrollView>
      )}

      <FAB
        onPress={() => router.push('/habit')}
        accessibilityLabel={t.new_habit}
        style={[styles.fab, { backgroundColor: theme.brand.primary, bottom: spacing[5] }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </FAB>

    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
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
  groupTitle: { fontSize: 15, fontWeight: '700' },
  groupCount: { fontSize: 12, fontWeight: '700' },
  listStack: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[3],
  },
  rowBody: { flex: 1, paddingVertical: spacing[3], gap: 3 },
  rowEmoji: { fontSize: 18 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowMeta: { fontSize: 12 },
  checkCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: spacing[3] },
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
    width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  analysisRow: { flexDirection: 'row', gap: spacing[2] },
  analysisBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: radius.md,
  },
  analysisBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  swipeDelete: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
})
