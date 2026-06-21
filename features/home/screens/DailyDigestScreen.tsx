import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { useGoalsStore } from '@store/goalsStore'
import { getDateFnsLocale } from '@services/locale'
import { useDailyDigest } from '../hooks/useDailyDigest'
import type { ReviewInboxItem } from '../hooks/useDailyDigest'
import { SkeletonDailyDigest } from '@components/SkeletonBox'
import { UniversalAddSheet } from '../components/UniversalAddSheet'
import { OnboardingModal } from '../components/OnboardingModal'
import { ScreenTransition } from '@components/ScreenTransition'
import {
  AppHeader,
  CommandBar,
  SectionHeader,
  ListRow,
  StatusPill,
  Chip,
  SignalsTimeline,
  AIInsightCard,
  QuickActionRow,
  type SignalLane,
} from '@components/ui'

type IconName = keyof typeof Feather.glyphMap

// Module identity used across Console rows + tabs + signal lanes.
// Review-row icons tuned to the UI1.png reference (transaction card, activity,
// pencil, bell) — each in its module identity color.
const KIND_META: Record<ReviewInboxItem['kind'], { icon: IconName; color: string }> = {
  finance: { icon: MODULE_ICONS.finance, color: MODULE_COLORS.finance },
  task:    { icon: 'bell',        color: MODULE_COLORS.tasks },
  habit:   { icon: 'check-circle',color: MODULE_COLORS.habits },
  journal: { icon: 'book-open',   color: MODULE_COLORS.journal },
}

// Day window for the signals axis: 6 AM → 9 PM, ticks every 3h (6 even labels).
const DAY_START = 6
const DAY_SPAN = 15
const frac = (d: Date) =>
  Math.min(Math.max((d.getHours() + d.getMinutes() / 60 - DAY_START) / DAY_SPAN, 0), 1)

// Short relative-time meta for review rows (UI1: "10m" / "2h" / "3d").
const relShort = (iso: string | undefined, now: Date): string | undefined => {
  if (!iso) return undefined
  const m = Math.round(Math.abs(now.getTime() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`
}

export function DailyDigestScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding)
  const goals = useGoalsStore((s) => s.goals)
  const loadGoals = useGoalsStore((s) => s.loadGoals)
  const [showAdd, setShowAdd] = useState(false)

  const {
    nextReminder,
    nextFutureReminder,
    nextHabit,
    habitsDoneCount,
    habitsTotal,
    timelineItems,
    reviewItems,
    reviewCount,
    isLoading,
    refreshing,
    onRefresh,
  } = useDailyDigest()

  const locale = getDateFnsLocale(language)
  const now = new Date()

  useEffect(() => { void loadGoals() }, [loadGoals])

  if (isLoading) {
    return (
      <ScreenTransition style={{ backgroundColor: theme.bg.primary }}>
        <SkeletonDailyDigest />
      </ScreenTransition>
    )
  }

  // ── Top module switcher (Console is current) ──
  // ── Today Priority — your main forward-looking task ──
  const priorityReminder = nextReminder ?? nextFutureReminder
  const priorityTitle = priorityReminder?.title ?? nextHabit?.name ?? null
  const priorityDone = priorityReminder
    ? priorityReminder.completed === 1
    : nextHabit
      ? nextHabit.todayCount >= nextHabit.target_per_period
      : false
  const prioritySubtitle = priorityReminder
    ? (priorityReminder.remind_at ? format(new Date(priorityReminder.remind_at), 'EEEE · HH:mm', { locale }) : t.nav_reminders)
    : nextHabit
      ? t.habits
      : null

  // ── Signals lanes ──
  const laneFor = (kind: ReviewInboxItem['kind']) =>
    timelineItems.filter((i) => i.kind === kind).map((i) => frac(i.occurredAt))
  const lanes: SignalLane[] = [
    { key: 'finance',   label: t.nav_finance,   icon: MODULE_ICONS.finance, color: MODULE_COLORS.finance,  marks: laneFor('finance') },
    { key: 'habits',    label: t.habits,        icon: 'check-circle', color: MODULE_COLORS.habits,   marks: laneFor('habit') },
    { key: 'journal',   label: t.nav_journal,   icon: 'book-open',    color: MODULE_COLORS.journal,  marks: laneFor('journal') },
    { key: 'reminders', label: t.nav_reminders, icon: 'bell',         color: MODULE_COLORS.tasks,    marks: laneFor('task') },
  ]
  const axisLabels = ['6', '9', '12', '15', '18', '21']

  const insightText = reviewCount > 0
    ? t.home_ai_tip_review.replace('{{count}}', String(reviewCount))
    : habitsTotal > 0
      ? t.home_ai_tip_habits.replace('{{done}}', String(habitsDoneCount)).replace('{{total}}', String(habitsTotal))
      : t.home_ai_tip_empty
  const focusGoal = goals.find((g) => g.status === 'active') ?? null
  const focusColor = focusGoal?.binding?.module === 'finance'
    ? MODULE_COLORS.finance
    : focusGoal?.binding?.module === 'journals'
    ? MODULE_COLORS.journal
    : focusGoal?.binding?.module === 'reminders'
    ? MODULE_COLORS.tasks
    : MODULE_COLORS.habits
  const focusIcon = focusGoal?.binding?.module === 'finance'
    ? MODULE_ICONS.finance
    : focusGoal?.binding?.module === 'journals'
    ? MODULE_ICONS.journal
    : focusGoal?.binding?.module === 'reminders'
    ? MODULE_ICONS.tasks
    : MODULE_ICONS.habits

  return (
    <ScreenTransition style={{ backgroundColor: theme.bg.primary }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[2] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand.primary}
            colors={[theme.brand.primary]}
          />
        }
      >
        <AppHeader
          onSearch={() => router.push('/quick-batavasa')}
          searchIcon="help-circle"
          searchLabel={t.command_placeholder}
          onSettings={() => router.push('/settings')}
        />

        <CommandBar
          placeholder={t.nav_search}
          onPress={() => router.push('/search')}
        />

        {/* ── Today Priority ── */}
        {priorityTitle ? (
          <View style={styles.block}>
            <SectionHeader label={t.today_priority} />
            <View style={[styles.priorityCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <View style={[styles.priorityIcon, { backgroundColor: MODULE_COLORS.tasks }]}>
                <Feather name="flag" size={16} color="#fff" />
              </View>
              <View style={styles.priorityBody}>
                <Text style={[styles.priorityTitle, { color: theme.text.primary }]} numberOfLines={2}>
                  {priorityTitle}
                </Text>
                <View style={styles.priorityMetaRow}>
                  <Chip label={t.priority_item} icon="flag" />
                  {prioritySubtitle ? (
                    <Text style={[styles.prioritySub, { color: theme.text.muted }]} numberOfLines={1}>
                      {prioritySubtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
              <StatusPill
                label={priorityDone ? t.priority_done : t.priority_not_done}
                tone={priorityDone ? 'success' : 'warning'}
                icon={priorityDone ? 'check-circle' : 'clock'}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <SectionHeader
            label={t.weekly_review_focus}
            actionLabel={focusGoal ? t.view_all : t.new_goal}
            onAction={() => router.push(focusGoal ? '/goals' : '/goal')}
          />
          {focusGoal ? (
            <Pressable
              onPress={() => router.push({ pathname: '/goal-detail', params: { id: focusGoal.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${focusGoal.title}: ${focusGoal.progress.label}`}
              style={({ pressed }) => [
                styles.focusCard,
                {
                  backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
                  borderColor: theme.border.subtle,
                },
              ]}
            >
              <View style={[styles.focusIcon, { backgroundColor: focusColor }]}>
                <Feather name={focusIcon} size={15} color="#fff" />
              </View>
              <View style={styles.focusBody}>
                <Text style={[styles.focusTitle, { color: theme.text.primary }]} numberOfLines={1}>{focusGoal.title}</Text>
                <Text style={[styles.focusSub, { color: theme.text.muted }]} numberOfLines={1}>{focusGoal.progress.label}</Text>
                <View style={[styles.focusTrack, { backgroundColor: theme.bg.secondary }]}>
                  <View style={[styles.focusFill, { width: `${focusGoal.progress.percent}%`, backgroundColor: focusColor }]} />
                </View>
              </View>
              <Text style={[styles.focusPct, { color: focusColor }]}>{focusGoal.progress.percent}%</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/goal')}
              accessibilityRole="button"
              accessibilityLabel={t.new_goal}
              style={({ pressed }) => [
                styles.focusCard,
                {
                  backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
                  borderColor: theme.border.subtle,
                },
              ]}
            >
              <View style={[styles.focusIcon, { backgroundColor: MODULE_COLORS.analysis }]}>
                <Feather name={MODULE_ICONS.goals} size={15} color="#fff" />
              </View>
              <View style={styles.focusBody}>
                <Text style={[styles.focusTitle, { color: theme.text.primary }]} numberOfLines={1}>{t.nav_goals}</Text>
                <Text style={[styles.focusSub, { color: theme.text.muted }]} numberOfLines={2}>{t.goal_module_hint}</Text>
              </View>
              <Feather name="plus" size={16} color={MODULE_COLORS.analysis} />
            </Pressable>
          )}
        </View>

        {/* ── Review Queue ── */}
        {reviewCount > 0 ? (
          <View style={styles.block}>
            <SectionHeader
              label={t.review_inbox_title}
              count={reviewCount}
              actionLabel={t.view_all}
              onAction={() => router.push('/timeline')}
            />
            <View style={styles.list}>
              {reviewItems.map((item) => {
                const m = KIND_META[item.kind]
                const moduleLabel = { finance: t.nav_finance, task: t.nav_reminders, habit: t.habits, journal: t.nav_journal }[item.kind]
                return (
                  <ListRow
                    key={item.id}
                    icon={m.icon}
                    color={m.color}
                    title={item.title || moduleLabel}
                    subtitle={moduleLabel}
                    meta={relShort(item.at, now)}
                    hideChevron
                    onPress={() => router.push(item.route as any)}
                  />
                )
              })}
            </View>
          </View>
        ) : null}

        {/* ── Today Signals ── */}
        <View style={styles.block}>
          <SectionHeader label={t.today_signals} count={timelineItems.length} />
          <View style={[styles.signalsCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <SignalsTimeline
              lanes={lanes}
              axisLabels={axisLabels}
              nowFraction={frac(now)}
              nowLabel={format(now, 'HH:mm', { locale })}
            />
          </View>
        </View>

        {/* ── AI Insight ── */}
        <AIInsightCard
          label={t.ai_insights}
          text={insightText}
          actionLabel={t.nav_insights}
          onAction={() => router.push('/analysis')}
        />

        {/* ── Quick actions ── */}
        <QuickActionRow
          actions={[
            { key: 'assistant', icon: 'message-circle', label: t.quick_assistant, color: theme.brand.primary, onPress: () => router.push('/chat') },
            { key: 'reports',   icon: MODULE_ICONS.analysis, label: t.quick_reports, color: MODULE_COLORS.analysis, onPress: () => router.push('/weekly-review') },
          ]}
        />
      </ScrollView>

      <View style={[styles.quickAddGroup, { bottom: insets.bottom + spacing[4] }]}> 
        <Text style={[styles.quickAddLabel, { color: theme.text.secondary }]}>{t.quick_capture}</Text>
        <Pressable
          onPress={() => setShowAdd(true)}
          accessibilityRole="button"
          accessibilityLabel={t.quick_capture}
          style={({ pressed }) => [
            styles.quickAddFab,
            {
              backgroundColor: theme.brand.primary,
              borderColor: theme.bg.elevated,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <Feather name="plus" size={26} color="#fff" />
        </Pressable>
      </View>

      <UniversalAddSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        initialText=""
        autoAnalyzeToken={0}
      />
      <OnboardingModal visible={!hasSeenOnboarding} />
    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[1],
    paddingBottom: 86,
    gap: spacing[2],
  },
  block: { gap: spacing[1] },
  list: { gap: 2 },

  // Today Priority
  priorityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: 8,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  priorityIcon: {
    width: 28, height: 28, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  priorityBody: { flex: 1, gap: 4 },
  priorityTitle: { fontSize: 14, fontWeight: '700' },
  priorityMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  prioritySub: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
  focusCard: {
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  focusIcon: { width: 30, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  focusBody: { flex: 1, gap: 4 },
  focusTitle: { fontSize: 14, fontWeight: '700' },
  focusSub: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  focusTrack: { height: 5, borderRadius: radius.full, overflow: 'hidden' },
  focusFill: { height: '100%', borderRadius: radius.full },
  focusPct: { fontSize: 15, fontWeight: '800' },

  // Signals
  signalsCard: {
    padding: 8,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickAddGroup: {
    position: 'absolute',
    right: spacing[5],
    bottom: 58,
    alignItems: 'center',
  },
  quickAddFab: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  quickAddLabel: {
    marginBottom: spacing[2],
    fontSize: 12,
    fontWeight: '700',
  },
})
