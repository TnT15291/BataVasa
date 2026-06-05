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
import { useHabitsBootstrap, useHabits, useHabitActions } from '../hooks/useHabits'
import { useHabitsStore } from '@store/habitsStore'
import { rescheduleAllHabitNotifications } from '../services'
import { MODULE_COLORS } from '@design/moduleColors'
import { CircularProgress } from '@components/CircularProgress'
import { FAB } from '@components/FAB'
import * as Haptics from 'expo-haptics'

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
            <Text style={styles.flameIcon}>🔥</Text>
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
  const { toggleTodayLog, skipToday } = useHabitActions()
  const language = useSettingsStore((s) => s.language)
  const isFirstRender = useRef(true)
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
  const { pendingHabits, doneHabits, laterHabits, bestStreak } = useMemo(() => {
    const pendingHabits = habits.filter((h) => h.dueToday !== false && h.todayCount < h.target_per_period)
    const doneHabits = habits.filter((h) => h.dueToday !== false && h.todayCount >= h.target_per_period)
    const laterHabits = habits.filter((h) => h.dueToday === false)
    const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0)
    return { pendingHabits, doneHabits, laterHabits, bestStreak }
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
            <HabitRow
              key={habit.id}
              habit={habit}
              onToggle={() => handleToggleWithMilestone(habit.id)}
              onSkip={() => skipToday(habit.id)}
              onEdit={() => router.push({ pathname: '/habit', params: { id: habit.id } })}
            />
          ))}
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
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
            </View>
          </View>

          {renderGroup(t.reminder_upcoming, pendingHabits)}
          {renderGroup(t.habit_not_scheduled, laterHabits)}
          {renderGroup(t.habit_done_today, doneHabits)}
        </ScrollView>
      )}

      {habits.length > 0 ? (
        <Pressable
          onPress={() => router.push('/habits-report')}
          accessibilityRole="button"
          accessibilityLabel={t.habits_report_title}
          style={[styles.reportFab, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle, bottom: spacing[5] }]}
        >
          <Feather name="bar-chart-2" size={20} color={theme.text.secondary} />
        </Pressable>
      ) : null}

      <FAB
        onPress={() => router.push('/habit')}
        accessibilityLabel={t.new_habit}
        style={[styles.fab, { backgroundColor: theme.brand.primary, bottom: spacing[5] }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </FAB>

    </View>
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
  heroKicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  heroSubtitle: { fontSize: 13, lineHeight: 18 },
  progressValue: { fontSize: 17, fontWeight: '800' },
  progressLabel: { fontSize: 10, fontWeight: '700' },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  statGrid: { flexDirection: 'row', gap: spacing[2] },
  statChip: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  list: { padding: spacing[4], paddingBottom: 112, gap: spacing[3] },
  group: { gap: spacing[2] },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontSize: 15, fontWeight: '800' },
  groupCount: { fontSize: 12, fontWeight: '700' },
  listStack: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  rowAccent: { width: 4, alignSelf: 'stretch' },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[1],
  },
  rowBody: { flex: 1, paddingVertical: spacing[3], gap: 3 },
  rowEmoji: { fontSize: 18 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flameIcon: { fontSize: 12, lineHeight: 16 },
  rowMeta: { fontSize: 12 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: spacing[3] },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[1],
  },
  skipBtn: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 4, marginRight: spacing[2] },
  skipText: { fontSize: 11, fontWeight: '700' },
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
  emptySample: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 12 },
  emptyBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fab: {
    position: 'absolute', right: spacing[6],
    width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  reportFab: {
    position: 'absolute', left: spacing[6],
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 3, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
})
