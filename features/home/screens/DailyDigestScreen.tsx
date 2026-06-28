import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius, textStyles } from '@design/tokens'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { useGoalsStore } from '@store/goalsStore'
import { getDateFnsLocale } from '@services/locale'
import { formatAmount } from '@features/finance/services'
import { buildHomeStoryFallback, generateHomeStoryLine, type HomeStorySnapshot } from '@services/ai/homeStory'
import { useDailyDigest } from '../hooks/useDailyDigest'
import type { ReviewInboxItem } from '../hooks/useDailyDigest'
import { SkeletonDailyDigest } from '@components/SkeletonBox'
import { UniversalAddSheet } from '../components/UniversalAddSheet'
import { OnboardingModal } from '../components/OnboardingModal'
import { ScreenTransition } from '@components/ScreenTransition'
import {
  AppHeader,
  SectionHeader,
  ListRow,
  StatusPill,
  Chip,
  QuickActionRow,
  SignalsTimeline,
  type SignalLane,
} from '@components/ui'

type IconName = keyof typeof Feather.glyphMap

// Module identity used across Console rows, review items, and story entries.
// Review-row icons tuned to the UI1.png reference (transaction card, activity,
// pencil, bell) — each in its module identity color.
const KIND_META: Record<ReviewInboxItem['kind'], { icon: IconName; color: string }> = {
  finance: { icon: MODULE_ICONS.finance, color: MODULE_COLORS.finance },
  task:    { icon: 'bell',        color: MODULE_COLORS.tasks },
  habit:   { icon: 'check-circle',color: MODULE_COLORS.habits },
  journal: { icon: 'book-open',   color: MODULE_COLORS.journal },
}

// Short relative-time meta for review rows (UI1: "10m" / "2h" / "3d").
// Direction matters here: a review item can be overdue (past) or upcoming
// (future remind_at), so past stays terse ("2h" = ago) while future is prefixed
// ("+2h" = due in) — abs alone would render "due in 2h" and "2h overdue" alike.
const relShort = (iso: string | undefined, now: Date): string | undefined => {
  if (!iso) return undefined
  const diffMs = new Date(iso).getTime() - now.getTime() // > 0 = future/upcoming
  const m = Math.round(Math.abs(diffMs) / 60000)
  let mag: string
  if (m < 60) mag = `${m}m`
  else {
    const h = Math.round(m / 60)
    mag = h < 24 ? `${h}h` : `${Math.round(h / 24)}d`
  }
  return diffMs > 0 ? `+${mag}` : mag
}

// Day-rhythm window for the timeline visual: 6 AM → 9 PM, ticks every 3h.
// Events are placed as a fraction along this window so the day reads as a
// shape, not a list. Anything before/after the window clamps to the edges.
const DAY_START_HOUR = 6
const DAY_END_HOUR = 21
const DAY_AXIS = ['6', '9', '12', '15', '18', '21']
const dayFraction = (d: Date): number => {
  const h = d.getHours() + d.getMinutes() / 60
  return Math.min(Math.max((h - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR), 0), 1)
}

// Cache the AI home line per snapshot signature (module-level so it survives
// screen remounts within a session). Opening the home screen then no longer
// fires a fresh AI call every time — only when the underlying data actually
// changes — which keeps the provider's per-minute token budget for real work.
let homeStoryCache: { key: string; line: string } | null = null

export function DailyDigestScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding)
  const hideJournals = useSettingsStore((s) => s.hideJournals)
  const goals = useGoalsStore((s) => s.goals)
  const loadGoals = useGoalsStore((s) => s.loadGoals)
  const [showAdd, setShowAdd] = useState(false)
  const [coachLine, setCoachLine] = useState('')

  const {
    nextReminder,
    nextFutureReminder,
    nextHabit,
    todayExpense,
    todayExpenseCurrency,
    safeToSpend,
    safeToSpendCurrency,
    overspendPercent,
    dailySafeToSpend,
    cycleDaysRemaining,
    habitsTotal,
    pendingHabitNames,
    worstHabitMissed,
    timelineItems,
    reviewItems,
    reviewCount,
    overdueTaskCount,
    dueTaskCount,
    highPriorityTaskCount,
    openTaskTitles,
    todayJournalCount,
    recentMoodAvg,
    isLoading,
    refreshing,
    onRefresh,
  } = useDailyDigest()

  const locale = getDateFnsLocale(language)
  const now = new Date()

  useEffect(() => { void loadGoals() }, [loadGoals])

  const priorityReminder = nextReminder ?? nextFutureReminder
  const priorityTitle = priorityReminder?.title ?? nextHabit?.name ?? null
  // The priority is always the next *open* item (reminders/habits are filtered to
  // incomplete upstream), so a "done" state is unreachable. Surface what's
  // actually useful instead: whether that reminder is already overdue.
  const priorityOverdue = priorityReminder?.remind_at
    ? new Date(priorityReminder.remind_at) < now
    : false
  const prioritySubtitle = priorityReminder
    ? (priorityReminder.remind_at ? format(new Date(priorityReminder.remind_at), 'EEEE · HH:mm', { locale }) : t.nav_reminders)
    : nextHabit
      ? t.habits
      : null

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

  const moneyLine = safeToSpend < 0
    ? `${t.home_risk_overspend.replace('{{amount}}', formatAmount(Math.abs(safeToSpend), safeToSpendCurrency, language))}${overspendPercent !== null ? ` (${overspendPercent}%)` : ''}`
    : t.home_money_daily
        .replace('{{amount}}', formatAmount(dailySafeToSpend, safeToSpendCurrency, language))
        .replace('{{spent}}', formatAmount(todayExpense, todayExpenseCurrency, language))

  // Hero shows the whole-cycle figure framed as "X to spend over N days" — the
  // total you have and how long it must last — instead of a per-day average.
  const heroAmountText = safeToSpend < 0
    ? `- ${formatAmount(Math.abs(safeToSpend), safeToSpendCurrency, language)}`
    : formatAmount(safeToSpend, safeToSpendCurrency, language)
  const heroDaysText = t.home_safe_over_days.replace('{{days}}', String(cycleDaysRemaining))
  const habitLine = pendingHabitNames.length > 0
    ? t.home_habits_pending.replace('{{count}}', String(pendingHabitNames.length)).replace('{{names}}', pendingHabitNames.join(', '))
    : habitsTotal > 0 ? t.home_habits_all_done : t.no_habits
  const taskLine = openTaskTitles.length > 0
    ? t.home_tasks_due.replace('{{count}}', String(dueTaskCount)).replace('{{names}}', openTaskTitles.join(', '))
    : t.home_tasks_none
  const journalLine = todayJournalCount === 0
    ? t.home_journal_invite
    : hideJournals
      ? t.hide_journals_locked_count.replace('{{count}}', String(todayJournalCount))
    : recentMoodAvg !== null
      ? t.home_journal_mood.replace('{{mood}}', recentMoodAvg.toFixed(1)).replace('{{count}}', String(todayJournalCount))
      : t.journal_card_subtitle
  const goalLine = focusGoal ? `${focusGoal.title}: ${focusGoal.progress.label}` : t.home_goal_none

  const riskLines = useMemo(() => {
    const lines: string[] = []
    if (safeToSpend < 0) {
      const base = t.home_risk_overspend.replace('{{amount}}', formatAmount(Math.abs(safeToSpend), safeToSpendCurrency, language))
      lines.push(overspendPercent !== null ? `${base} (${overspendPercent}%)` : base)
    }
    if (overdueTaskCount > 0) lines.push(t.review_item_overdue.replace('{{count}}', String(overdueTaskCount)))
    // Prefer the specific "missed for N days" signal over a generic open-count.
    if (worstHabitMissed) {
      lines.push(t.home_risk_habit_missed.replace('{{name}}', worstHabitMissed.name).replace('{{days}}', String(worstHabitMissed.days)))
    } else if (pendingHabitNames.length > 0 && habitsTotal > 0) {
      lines.push(t.review_item_habit.replace('{{count}}', String(pendingHabitNames.length)))
    }
    if (highPriorityTaskCount > 0) lines.push(t.review_item_priority.replace('{{count}}', String(highPriorityTaskCount)))
    if (focusGoal && focusGoal.progress.percent < 50) lines.push(t.home_risk_goal_slow.replace('{{goal}}', focusGoal.title))
    return lines.slice(0, 3)
  }, [safeToSpend, safeToSpendCurrency, language, overspendPercent, overdueTaskCount, highPriorityTaskCount, pendingHabitNames.length, habitsTotal, worstHabitMissed, focusGoal, t])

  const storySnapshot = useMemo<HomeStorySnapshot>(() => ({
    language,
    focus: priorityTitle ? `${t.today_priority}: ${priorityTitle}` : t.home_story_default,
    money: moneyLine,
    habits: habitLine,
    tasks: taskLine,
    journal: journalLine,
    goal: focusGoal ? goalLine : undefined,
    risks: riskLines,
  }), [language, priorityTitle, t, moneyLine, habitLine, taskLine, journalLine, focusGoal, goalLine, riskLines])

  useEffect(() => {
    let cancelled = false
    const sig = JSON.stringify(storySnapshot)
    if (homeStoryCache && homeStoryCache.key === sig) {
      setCoachLine(homeStoryCache.line)
      return
    }
    setCoachLine(buildHomeStoryFallback(storySnapshot))
    generateHomeStoryLine(storySnapshot)
      .then((line) => { if (!cancelled) { homeStoryCache = { key: sig, line }; setCoachLine(line) } })
      .catch(() => { if (!cancelled) setCoachLine(buildHomeStoryFallback(storySnapshot)) })
    return () => { cancelled = true }
  }, [storySnapshot])

  const rhythmLanes = useMemo<SignalLane[]>(() => {
    const order: ReviewInboxItem['kind'][] = ['finance', 'habit', 'task', 'journal']
    const moduleLabel: Record<ReviewInboxItem['kind'], string> = {
      finance: t.nav_finance, task: t.nav_reminders, habit: t.habits, journal: t.nav_journal,
    }
    return order
      .map((kind): SignalLane | null => {
        const marks = timelineItems.filter((it) => it.kind === kind).map((it) => dayFraction(it.occurredAt))
        if (marks.length === 0) return null
        const m = KIND_META[kind]
        return { key: kind, label: moduleLabel[kind], icon: m.icon, color: m.color, marks }
      })
      .filter((l): l is SignalLane => l !== null)
  }, [timelineItems, t])

  if (isLoading) {
    return (
      <ScreenTransition style={{ backgroundColor: theme.bg.primary }}>
        <SkeletonDailyDigest />
      </ScreenTransition>
    )
  }

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
          onSearch={() => router.push('/search')}
          onSettings={() => router.push('/settings')}
        />

        {/* ── Today brief: a single AI coach line (the narrative). Per-module
            detail lives in each tab + the cards below, so nothing is repeated. */}
        <View style={[styles.storyCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.storyHeader}>
            <View style={[styles.storyIcon, { backgroundColor: theme.brand.primary }]}>
              <Feather name="message-circle" size={17} color={theme.brand.onPrimary} />
            </View>
            <Text style={[styles.storyLabel, { color: theme.text.muted }]}>{t.home_story_title}</Text>
          </View>
          <Text style={[styles.storyText, { color: theme.text.primary }]}>{coachLine || t.home_story_default}</Text>
        </View>

        {/* ── Safe To Spend: the number users open the app for (product §6) ── */}
        <Pressable
          onPress={() => router.push('/finance')}
          accessibilityRole="button"
          accessibilityLabel={`${t.safe_to_spend}: ${heroAmountText}${safeToSpend >= 0 ? `. ${heroDaysText}` : ''}`}
          style={({ pressed }) => [
            styles.heroCard,
            { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
          ]}
        >
          <View style={styles.heroLabelRow}>
            <View style={[styles.heroIcon, { backgroundColor: MODULE_COLORS.finance + '1A' }]}>
              <Feather name={MODULE_ICONS.finance} size={15} color={MODULE_COLORS.finance} />
            </View>
            <Text style={[styles.heroLabel, { color: theme.text.muted }]}>{t.safe_to_spend}</Text>
            {safeToSpend < 0 && overspendPercent !== null ? (
              <StatusPill label={`${overspendPercent}%`} tone="danger" icon="alert-triangle" />
            ) : null}
          </View>
          <Text
            style={[styles.heroAmount, { color: safeToSpend < 0 ? theme.semantic.danger : theme.text.primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {heroAmountText}
          </Text>
          {safeToSpend >= 0 ? (
            <Text style={[styles.heroSub, { color: theme.text.secondary, fontWeight: '600' }]} numberOfLines={1}>
              {heroDaysText}
            </Text>
          ) : null}
          <Text style={[styles.heroSub, { color: theme.text.muted }]} numberOfLines={1}>
            {t.home_spent_today.replace('{{amount}}', formatAmount(todayExpense, todayExpenseCurrency, language))}
          </Text>
        </Pressable>

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
                label={priorityOverdue ? t.report_overdue : t.priority_not_done}
                tone={priorityOverdue ? 'danger' : 'warning'}
                icon={priorityOverdue ? 'alert-circle' : 'clock'}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <SectionHeader
            label={t.weekly_review_focus}
            actionLabel={focusGoal ? t.view_all : t.new_goal}
            onAction={() => router.push(focusGoal ? '/goals' : '/goal')}
            onAdd={focusGoal ? () => router.push('/goal') : undefined}
            addLabel={t.new_goal}
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
                // Use the reason + count the hook already computed (was dropped
                // before, leaving "Finance / Finance"). Journal stays masked when
                // privacy is on so the count never leaks.
                const subtitleTpl =
                  item.subtitleKey === 'financeReview' ? t.review_item_finance
                  : item.subtitleKey === 'taskOverdue' ? t.review_item_overdue
                  : item.subtitleKey === 'taskPriority' ? t.review_item_priority
                  : item.subtitleKey === 'taskSchedule' ? t.review_item_schedule
                  : item.subtitleKey === 'habitPending' ? t.review_item_habit
                  : t.review_item_journal
                const subtitle = item.kind === 'journal' && hideJournals
                  ? t.hide_journals_locked
                  : subtitleTpl.replace('{{count}}', String(item.count))
                return (
                  <ListRow
                    key={item.id}
                    icon={m.icon}
                    color={m.color}
                    title={item.title || moduleLabel}
                    subtitle={subtitle}
                    meta={relShort(item.at, now)}
                    hideChevron
                    onPress={() => router.push(item.route as any)}
                  />
                )
              })}
            </View>
          </View>
        ) : null}

        {/* ── Day rhythm: the shape of today across modules, not a list ── */}
        <View style={styles.block}>
          <SectionHeader label={t.home_daily_thread} />
          {rhythmLanes.length > 0 ? (
            <View style={[styles.signalsCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <SignalsTimeline
                lanes={rhythmLanes}
                axisLabels={DAY_AXIS}
                nowFraction={dayFraction(now)}
                nowLabel={format(now, 'HH:mm', { locale })}
              />
            </View>
          ) : (
            <View style={[styles.emptyThread, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
              <Text style={[styles.needText, { color: theme.text.muted }]}>{t.today_timeline_empty}</Text>
            </View>
          )}
        </View>

        <QuickActionRow
          actions={[
            { key: 'assistant', icon: 'message-circle', label: t.quick_assistant, color: MODULE_COLORS.analysis, onPress: () => router.push('/chat') },
            { key: 'analysis',  icon: MODULE_ICONS.analysis, label: t.nav_insights, color: MODULE_COLORS.analysis, onPress: () => router.push('/analysis') },
            { key: 'reports',   icon: 'clipboard' as const, label: t.quick_reports, color: MODULE_COLORS.analysis, onPress: () => router.push('/weekly-review') },
          ]}
        />
      </ScrollView>

      {/* Opaque backdrop behind the translucent status bar so scrolled content
          doesn't collide with the system clock (the home screen has no fixed header). */}
      <View
        pointerEvents="none"
        style={[styles.statusScrim, { height: insets.top, backgroundColor: theme.bg.primary }]}
      />

      <View style={[styles.quickAddGroup, { bottom: insets.bottom + spacing[4] }]}>
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
          <Feather name="plus" size={26} color={theme.brand.onPrimary} />
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
  storyCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[2],
  },
  storyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  storyIcon: { width: 30, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  storyLabel: textStyles.eyebrow,
  storyText: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  needText: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  heroCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[1],
  },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  heroIcon: { width: 26, height: 26, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  heroLabel: { ...textStyles.eyebrow, flex: 1 },
  heroAmount: { fontSize: 30, fontWeight: '800', marginTop: 2 },
  heroSub: { fontSize: 13, fontWeight: '500' },
  emptyThread: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
  },

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
    // `bottom` is set inline from safe-area insets at the call site.
    position: 'absolute',
    right: spacing[5],
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
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
})
