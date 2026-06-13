import { useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useTheme, getCardStyle } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
import { useTranslation, type Translations } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { shouldWarnAboutWebSQLitePersistence } from '@services/webPersistence'
import { formatAmount } from '@features/finance/services'
import { useDailyDigest } from '../hooks/useDailyDigest'
import type { DailyTimelineItem, ReviewInboxItem } from '../hooks/useDailyDigest'
import { CircularProgress } from '@components/CircularProgress'
import { FAB } from '@components/FAB'
import { SkeletonDailyDigest } from '@components/SkeletonBox'
import { UniversalAddSheet } from '../components/UniversalAddSheet'
import { OnboardingModal } from '../components/OnboardingModal'
import { ScreenTransition } from '@components/ScreenTransition'

type IconName = keyof typeof Feather.glyphMap

function greeting(t: Translations): string {
  const h = new Date().getHours()
  if (h < 12) return t.greeting_morning
  if (h < 18) return t.greeting_afternoon
  return t.greeting_evening
}

// ─── SummaryChip ──────────────────────────────────────────────────────────────

type SummaryChipProps = {
  icon: IconName
  label: string
  value: string
  color: string
}

function SummaryChip({ icon, label, value, color }: SummaryChipProps) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.summaryChip,
        { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle },
      ]}
    >
      <View style={[styles.summaryIcon, { backgroundColor: color + '18' }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <View style={styles.summaryText}>
        <Text style={[styles.summaryValue, { color: theme.text.primary }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={[styles.summaryLabel, { color: theme.text.muted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  )
}

// ─── ReviewInboxRow ───────────────────────────────────────────────────────────

function ReviewInboxRow({ item, onPress }: { item: ReviewInboxItem; onPress: () => void }) {
  const theme = useTheme()
  const { t } = useTranslation()
  const meta: Record<ReviewInboxItem['kind'], { icon: IconName; color: string }> = {
    finance: { icon: 'alert-circle', color: MODULE_COLORS.finance },
    task: { icon: 'bell', color: MODULE_COLORS.tasks },
    habit: { icon: 'check-circle', color: MODULE_COLORS.habits },
    journal: { icon: 'star', color: MODULE_COLORS.journal },
  }
  const severityMeta: Record<ReviewInboxItem['severity'], { icon: IconName; color: string }> = {
    high:   { icon: 'alert-circle',   color: theme.semantic.warning },
    medium: { icon: 'alert-triangle', color: theme.brand.primary },
    low:    { icon: 'info',           color: theme.text.muted },
  }
  const m = meta[item.kind]
  const sv = severityMeta[item.severity]
  const moduleLabels: Record<ReviewInboxItem['kind'], string> = {
    finance: t.nav_finance,
    task: t.nav_reminders,
    habit: t.habits,
    journal: t.nav_journal,
  }
  const subtitle = {
    financeReview: t.review_item_finance,
    taskOverdue: t.review_item_overdue,
    taskPriority: t.review_item_priority,
    taskSchedule: t.review_item_schedule,
    habitPending: item.progressText
      ? t.review_item_habit_progress.replace('{{progress}}', item.progressText)
      : t.review_item_habit,
    journalImportant: t.review_item_journal,
  }[item.subtitleKey].replace('{{count}}', String(item.count))
  const title = item.title || moduleLabels[item.kind]

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${subtitle}`}
      style={({ pressed }) => [
        styles.reviewRow,
        { backgroundColor: pressed ? theme.bg.primary : theme.bg.secondary },
      ]}
    >
      <View style={[styles.reviewIconWrap, { backgroundColor: m.color + '18' }]}>
        <Feather name={m.icon} size={15} color={m.color} />
      </View>
      <View style={styles.reviewBody}>
        <Text style={[styles.reviewTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.reviewSubtitle, { color: theme.text.muted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Feather name={sv.icon} size={14} color={sv.color} />
      <Feather name="chevron-right" size={16} color={theme.text.muted} />
    </Pressable>
  )
}

// ─── TimelineRow ──────────────────────────────────────────────────────────────

function TimelineRow({ item, onPress }: { item: DailyTimelineItem; onPress: () => void }) {
  const theme = useTheme()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)
  const meta: Record<DailyTimelineItem['kind'], { icon: IconName; color: string; label: string }> = {
    finance: { icon: 'dollar-sign', color: MODULE_COLORS.finance, label: t.nav_finance },
    task: { icon: 'check-square', color: MODULE_COLORS.tasks, label: t.nav_reminders },
    habit: { icon: 'check-circle', color: MODULE_COLORS.habits, label: t.habits },
    journal: { icon: 'book-open', color: MODULE_COLORS.journal, label: t.nav_journal },
  }
  const m = meta[item.kind]
  const amountText =
    item.amount !== undefined && item.currency
      ? `${item.amount < 0 ? '- ' : '+ '}${formatAmount(item.amount, item.currency, language)}`
      : null

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => [
        styles.timelineRow,
        { backgroundColor: pressed ? theme.bg.primary : theme.bg.secondary },
      ]}
    >
      <Text style={[styles.timelineTime, { color: theme.text.muted }]}>
        {format(item.occurredAt, 'HH:mm', { locale })}
      </Text>
      <View style={[styles.timelineIconWrap, { backgroundColor: m.color + '18' }]}>
        {item.emoji ? (
          <Text style={styles.timelineEmoji}>{item.emoji}</Text>
        ) : (
          <Feather name={m.icon} size={14} color={m.color} />
        )}
      </View>
      <View style={styles.timelineBody}>
        <View style={styles.timelineTitleRow}>
          <Text style={[styles.timelineTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.status === 'done' ? (
            <Feather name="check" size={13} color={theme.semantic.success} />
          ) : null}
        </View>
        <Text style={[styles.timelineMeta, { color: theme.text.muted }]} numberOfLines={1}>
          {[m.label, item.subtitle].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {amountText ? (
        <Text
          style={[
            styles.timelineAmount,
            { color: item.amount! < 0 ? theme.finance.expense : theme.finance.income },
          ]}
        >
          {amountText}
        </Text>
      ) : (
        <Feather name="chevron-right" size={16} color={theme.text.muted} />
      )}
    </Pressable>
  )
}

// ─── ActionStrip ──────────────────────────────────────────────────────────────

type ActionStripProps = {
  icon: IconName
  iconColor: string
  title: string
  subtitle?: string
  onPress: () => void
  accessibilityLabel?: string
}

function ActionStrip({ icon, iconColor, title, subtitle, onPress, accessibilityLabel }: ActionStripProps) {
  const theme = useTheme()
  const cardSt = getCardStyle(theme)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.actionStrip,
        cardSt,
        { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
      ]}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: iconColor + '18' }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, { color: theme.text.primary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.actionSubtitle, { color: theme.text.muted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={16} color={theme.text.muted} />
    </Pressable>
  )
}

// ─── DailyDigestScreen ────────────────────────────────────────────────────────

export function DailyDigestScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding)
  const [showAdd, setShowAdd] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const {
    todayExpense,
    todayExpenseCurrency,
    nextReminder,
    habitsDoneCount,
    habitsTotal,
    habitProgress,
    todayJournalCount,
    timelineItems,
    reviewItems,
    reviewCount,
    isLoading,
    refreshing,
    onRefresh,
  } = useDailyDigest()

  const locale = getDateFnsLocale(language)
  const now = new Date()
  const dateStr = format(now, 'EEEE, dd MMMM', { locale })
  const cardSt = getCardStyle(theme)

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
        contentContainerStyle={[styles.content, { backgroundColor: theme.bg.primary }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand.primary}
            colors={[theme.brand.primary]}
          />
        }
      >
        {shouldWarnAboutWebSQLitePersistence() ? (
          <View
            style={[
              styles.persistenceBanner,
              cardSt,
              { backgroundColor: theme.bg.elevated, borderColor: theme.semantic.warning },
            ]}
          >
            <Text style={[styles.persistenceTitle, { color: theme.text.primary }]}>
              {t.web_persistence_warning_title}
            </Text>
            <Text style={[styles.persistenceText, { color: theme.text.muted }]}>
              {t.web_persistence_warning_msg}
            </Text>
          </View>
        ) : null}

        {/* ── Hero ── */}
        <View
          style={[
            styles.hero,
            cardSt,
            { backgroundColor: theme.bg.elevated },
          ]}
        >
          <View style={styles.heroHeader}>
            <View style={styles.heroDateBlock}>
              <Text style={[styles.commandLabel, { color: theme.brand.primary }]}>
                {t.home_command_center}
              </Text>
              <Text style={[styles.greeting, { color: theme.text.muted }]}>{greeting(t)}</Text>
              <Text style={[styles.dateStr, { color: theme.text.primary }]}>{dateStr}</Text>
              <View
                style={[
                  styles.heroStatusPill,
                  {
                    backgroundColor: reviewCount > 0
                      ? theme.semantic.warning + '18'
                      : theme.semantic.success + '18',
                  },
                ]}
              >
                <Feather
                  name={reviewCount > 0 ? 'inbox' : 'check-circle'}
                  size={12}
                  color={reviewCount > 0 ? theme.semantic.warning : theme.semantic.success}
                />
                <Text
                  style={[
                    styles.heroStatusText,
                    { color: reviewCount > 0 ? theme.semantic.warning : theme.semantic.success },
                  ]}
                >
                  {reviewCount > 0
                    ? t.review_inbox_count.replace('{{count}}', String(reviewCount))
                    : t.review_inbox_empty}
                </Text>
              </View>
            </View>
            <CircularProgress
              progress={habitProgress}
              size={64}
              strokeWidth={3}
              color={theme.brand.primary}
              trackColor={theme.border.subtle}
            >
              <Text style={[styles.progressValue, { color: theme.text.primary }]}>{habitProgress}%</Text>
              <Text style={[styles.progressLabel, { color: theme.text.muted }]}>{t.habits}</Text>
            </CircularProgress>
          </View>

          <Pressable
            onPress={() => setShowDetails((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDetails }}
            style={[styles.heroDetailsToggle, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}
          >
            <Text style={[styles.heroDetailsText, { color: theme.brand.primary }]}>
              {showDetails ? t.home_hide_details : t.home_show_details}
            </Text>
            <Feather name={showDetails ? 'chevron-up' : 'chevron-down'} size={16} color={theme.text.muted} />
          </Pressable>

          {showDetails ? (
            <>
              <View
                style={[
                  styles.heroMetricBlock,
                  {
                    backgroundColor: theme.bg.secondary,
                    borderColor: theme.border.subtle,
                  },
                ]}
              >
                <View style={styles.heroMetricText}>
                  <Text style={[styles.heroMetricLabel, { color: theme.text.muted }]}>{t.today_spent}</Text>
                  <Text
                    style={[
                      styles.heroMetricValue,
                      { color: todayExpense > 0 ? theme.finance.expense : theme.text.primary },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {formatAmount(todayExpense, todayExpenseCurrency, language)}
                  </Text>
                </View>
                <View style={[styles.heroMetricIcon, { backgroundColor: theme.bg.elevated }]}>
                  <Feather
                    name={todayExpense > 0 ? 'trending-up' : 'check-circle'}
                    size={22}
                    color={todayExpense > 0 ? theme.finance.expense : theme.semantic.success}
                  />
                </View>
              </View>

              <View style={styles.summaryStrip}>
                <SummaryChip
                  icon="check-square"
                  label={t.nav_reminders}
                  value={nextReminder ? format(new Date(nextReminder.remind_at), 'HH:mm', { locale }) : '-'}
                  color={MODULE_COLORS.tasks}
                />
                <SummaryChip
                  icon="check-circle"
                  label={t.habits}
                  value={habitsTotal === 0 ? '-' : `${habitsDoneCount}/${habitsTotal}`}
                  color={MODULE_COLORS.habits}
                />
                <SummaryChip
                  icon="book-open"
                  label={t.nav_journal}
                  value={todayJournalCount > 0 ? String(todayJournalCount) : '-'}
                  color={MODULE_COLORS.journal}
                />
              </View>
            </>
          ) : null}
        </View>

        {/* ── Review panel — only when items exist ── */}
        {reviewCount > 0 ? (
          <View
            style={[
              styles.reviewPanel,
              cardSt,
              {
                backgroundColor: theme.bg.elevated,
                borderColor: theme.semantic.warning + '4D',
              },
            ]}
          >
            <View style={styles.reviewPanelHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
                {t.review_inbox_title}
              </Text>
              <View style={[styles.reviewBadge, { backgroundColor: theme.semantic.warning + '18' }]}>
                <Feather name="inbox" size={13} color={theme.semantic.warning} />
                <Text style={[styles.reviewBadgeText, { color: theme.semantic.warning }]}>
                  {reviewCount}
                </Text>
              </View>
            </View>
            <View style={styles.reviewList}>
              {reviewItems.map((item) => (
                <ReviewInboxRow
                  key={item.id}
                  item={item}
                  onPress={() => router.push(item.route as any)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Timeline ── */}
        <View style={[styles.timelinePanel, cardSt, { backgroundColor: theme.bg.elevated }]}>
          <View style={styles.timelineHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{t.today_timeline}</Text>
            {timelineItems.length > 0 ? (
              <Text style={[styles.timelineCount, { color: theme.text.muted }]}>
                {timelineItems.length}
              </Text>
            ) : null}
          </View>
          {timelineItems.length > 0 ? (
            <View style={styles.timelineList}>
              {timelineItems.map((item) => (
                <TimelineRow
                  key={item.id}
                  item={item}
                  onPress={() => router.push(item.route as any)}
                />
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.timelineEmpty,
                { backgroundColor: theme.bg.secondary, borderRadius: radius.md },
              ]}
            >
              <View style={[styles.timelineEmptyIcon, { backgroundColor: theme.brand.primary + '18' }]}>
                <Feather name="clock" size={20} color={theme.brand.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.timelineEmptyText, { color: theme.text.primary }]}>
                  {t.today_timeline_empty}
                </Text>
                <Text style={[styles.timelineEmptyHint, { color: theme.text.muted }]}>
                  {t.tap_to_add}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Action strips ── */}
        <ActionStrip
          icon="bar-chart-2"
          iconColor={MODULE_COLORS.analysis}
          title={t.analysis_title}
          subtitle={t.analysis_subtitle}
          onPress={() => router.push('/analysis')}
        />
        <ActionStrip
          icon="message-circle"
          iconColor={theme.brand.primary}
          title={t.nav_chat}
          onPress={() => router.push('/chat')}
        />
      </ScrollView>

      <FAB
        onPress={() => setShowAdd(true)}
        accessibilityLabel={t.universal_add_title}
        style={[styles.fab, { backgroundColor: theme.brand.primary, bottom: spacing[5] }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </FAB>

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
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: 128 },

  // ── Hero
  hero: {
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[3],
  },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4] },
  heroDateBlock: { flex: 1, gap: 3 },
  commandLabel: { fontSize: 12, fontWeight: '700' },
  greeting: { fontSize: 13, fontWeight: '500' },
  dateStr: { fontSize: 22, fontWeight: '700' },
  heroStatusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  heroStatusText: { fontSize: 12, fontWeight: '600' },
  progressValue: { fontSize: 16, fontWeight: '700' },
  progressLabel: { fontSize: 12, fontWeight: '500' },
  heroMetricBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  heroMetricText: { flex: 1 },
  heroMetricLabel: { fontSize: 13, fontWeight: '500' },
  heroMetricValue: { fontSize: 26, fontWeight: '700', marginTop: 2 },
  heroMetricIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDetailsToggle: {
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  heroDetailsText: { fontSize: 13, fontWeight: '700' },

  // ── Summary chips
  summaryStrip: { flexDirection: 'row', gap: spacing[2] },
  summaryChip: {
    flex: 1,
    minHeight: 60,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: { flex: 1, minWidth: 0 },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  summaryLabel: { fontSize: 12, fontWeight: '500' },

  // ── Review panel
  reviewPanel: {
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
  },
  reviewPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing[2],
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  reviewBadgeText: { fontSize: 13, fontWeight: '700' },
  reviewList: { gap: spacing[1] },
  reviewRow: {
    minHeight: 56,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  reviewIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBody: { flex: 1, gap: 2 },
  reviewTitle: { fontSize: 14, fontWeight: '700' },
  reviewSubtitle: { fontSize: 12 },

  // ── Timeline
  timelinePanel: {
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[2],
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineCount: { fontSize: 12, fontWeight: '600' },
  timelineList: { gap: spacing[1] },
  timelineRow: {
    minHeight: 54,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  timelineTime: { width: 42, fontSize: 12, fontWeight: '700' },
  timelineEmoji: { fontSize: 14 },
  timelineIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBody: { flex: 1, gap: 2 },
  timelineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  timelineTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  timelineMeta: { fontSize: 12 },
  timelineAmount: { fontSize: 13, fontWeight: '700' },
  timelineEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    minHeight: 72,
  },
  timelineEmptyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineEmptyText: { fontSize: 13, fontWeight: '600' },
  timelineEmptyHint: { fontSize: 12 },

  // ── Misc
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  persistenceBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    gap: spacing[1],
  },
  persistenceTitle: { fontSize: 14, fontWeight: '700' },
  persistenceText: { fontSize: 13, lineHeight: 18 },

  // ── ActionStrip
  actionStrip: {
    minHeight: 64,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, gap: 2 },
  actionTitle: { fontSize: 15, fontWeight: '700' },
  actionSubtitle: { fontSize: 13, lineHeight: 18 },

  // ── FAB
  fab: {
    position: 'absolute',
    right: spacing[6],
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
})
