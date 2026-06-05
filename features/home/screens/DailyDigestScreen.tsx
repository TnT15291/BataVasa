import { useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
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
import { UniversalAddSheet } from '../components/UniversalAddSheet'
import { OnboardingModal } from '../components/OnboardingModal'

type IconName = keyof typeof Feather.glyphMap

function greeting(t: Translations): string {
  const h = new Date().getHours()
  if (h < 12) return t.greeting_morning
  if (h < 18) return t.greeting_afternoon
  return t.greeting_evening
}

type CardProps = {
  icon: IconName
  title: string
  subtitle: string
  hint?: string
  accentColor: string
  onPress: () => void
}

function ModuleCard({ icon, title, subtitle, hint, accentColor, onPress }: CardProps) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
      ]}
    >
      <View style={styles.cardContent}>
        <View style={[styles.cardIconWrap, { backgroundColor: accentColor + '1F' }]}>
          <Feather name={icon} size={20} color={accentColor} />
        </View>
        <Text style={[styles.cardTitle, { color: theme.text.primary }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.cardSubtitle, { color: theme.text.muted }]} numberOfLines={2}>{subtitle}</Text>
        {hint ? <Text style={[styles.cardHint, { color: theme.text.muted }]}>{hint}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={theme.text.muted} style={styles.cardChevron} />
    </Pressable>
  )
}

type SummaryChipProps = {
  icon: IconName
  label: string
  value: string
  color: string
}

function SummaryChip({ icon, label, value, color }: SummaryChipProps) {
  const theme = useTheme()
  return (
    <View style={[styles.summaryChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
      <View style={[styles.summaryIcon, { backgroundColor: color + '1F' }]}>
        <Feather name={icon} size={15} color={color} />
      </View>
      <Text style={[styles.summaryValue, { color: theme.text.primary }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.summaryLabel, { color: theme.text.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

function ReviewInboxRow({ item, onPress }: { item: ReviewInboxItem; onPress: () => void }) {
  const theme = useTheme()
  const meta: Record<ReviewInboxItem['kind'], { icon: IconName; color: string }> = {
    finance: { icon: 'alert-circle', color: theme.finance.expense },
    task: { icon: 'bell', color: MODULE_COLORS.tasks },
    habit: { icon: 'check-circle', color: MODULE_COLORS.habits },
    journal: { icon: 'star', color: MODULE_COLORS.journal },
  }
  const severityColor = item.severity === 'high'
    ? theme.semantic.warning
    : item.severity === 'medium'
      ? theme.brand.primary
      : theme.text.muted
  const m = meta[item.kind]

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => [
        styles.reviewRow,
        { backgroundColor: pressed ? theme.bg.secondary : 'transparent', borderColor: theme.border.subtle },
      ]}
    >
      <View style={[styles.reviewIcon, { backgroundColor: m.color + '1F' }]}>
        <Feather name={m.icon} size={15} color={m.color} />
      </View>
      <View style={styles.reviewBody}>
        <Text style={[styles.reviewTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.reviewSubtitle, { color: theme.text.muted }]} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <View style={[styles.reviewSeverityDot, { backgroundColor: severityColor }]} />
      <Feather name="chevron-right" size={16} color={theme.text.muted} />
    </Pressable>
  )
}

function TimelineRow({ item, onPress }: { item: DailyTimelineItem; onPress: () => void }) {
  const theme = useTheme()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)
  const meta: Record<DailyTimelineItem['kind'], { icon: IconName; color: string; label: string }> = {
    finance: { icon: 'dollar-sign', color: theme.finance.expense, label: t.nav_finance },
    task: { icon: 'check-square', color: MODULE_COLORS.tasks, label: t.nav_reminders },
    habit: { icon: 'check-circle', color: MODULE_COLORS.habits, label: t.habits },
    journal: { icon: 'book-open', color: MODULE_COLORS.journal, label: t.nav_journal },
  }
  const m = meta[item.kind]
  const amountText = item.amount !== undefined && item.currency
    ? `${item.amount < 0 ? '- ' : '+ '}${formatAmount(item.amount, item.currency, language)}`
    : null
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => [
        styles.timelineRow,
        { backgroundColor: pressed ? theme.bg.secondary : 'transparent', borderColor: theme.border.subtle },
      ]}
    >
      <Text style={[styles.timelineTime, { color: theme.text.muted }]}>
        {format(item.occurredAt, 'HH:mm', { locale })}
      </Text>
      <View style={[styles.timelineIcon, { backgroundColor: m.color + '1F' }]}>
        {item.emoji
          ? <Text style={styles.timelineEmoji}>{item.emoji}</Text>
          : <Feather name={m.icon} size={14} color={m.color} />
        }
      </View>
      <View style={styles.timelineBody}>
        <View style={styles.timelineTitleRow}>
          <Text style={[styles.timelineTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.status === 'done' ? <Feather name="check" size={13} color={theme.semantic.success} /> : null}
        </View>
        <Text style={[styles.timelineMeta, { color: theme.text.muted }]} numberOfLines={1}>
          {[m.label, item.subtitle].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {amountText ? (
        <Text style={[styles.timelineAmount, { color: item.amount! < 0 ? theme.finance.expense : theme.finance.income }]}>
          {amountText}
        </Text>
      ) : (
        <Feather name="chevron-right" size={16} color={theme.text.muted} />
      )}
    </Pressable>
  )
}

export function DailyDigestScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding)
  const [showAdd, setShowAdd] = useState(false)

  const {
    todayExpense,
    todayExpenseCurrency,
    nextReminder,
    nextFutureReminder,
    habitsDoneCount,
    habitsTotal,
    habitProgress,
    todayJournalCount,
    timelineItems,
    reviewItems,
    reviewCount,
    refreshing,
    onRefresh,
  } = useDailyDigest()

  const locale = getDateFnsLocale(language)
  const now = new Date()
  const dateStr = format(now, 'EEEE, dd MMMM', { locale })

  const financeSubtitle = todayExpense > 0
    ? `${t.today_spent} ${formatAmount(todayExpense, todayExpenseCurrency, language)}`
    : t.today_no_spending

  const reminderSubtitle = nextReminder
    ? `${nextReminder.title} - ${format(new Date(nextReminder.remind_at), 'HH:mm', { locale })}`
    : nextFutureReminder
      ? `${nextFutureReminder.title} - ${format(new Date(nextFutureReminder.remind_at), 'dd/MM HH:mm', { locale })}`
      : t.reminder_today_none

  const reminderHint = !nextReminder && !nextFutureReminder ? t.reminder_add_hint : undefined

  const habitsSubtitle = habitsTotal === 0
    ? t.habits_card_subtitle
    : t.habits_done_today.replace('{{done}}', String(habitsDoneCount)).replace('{{total}}', String(habitsTotal))
  const journalSubtitle = todayJournalCount > 0 ? `${todayJournalCount} ${t.today}` : t.journal_card_subtitle

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {shouldWarnAboutWebSQLitePersistence() ? (
          <View style={[styles.persistenceBanner, { backgroundColor: theme.bg.elevated, borderColor: theme.semantic.warning }]}>
            <Text style={[styles.persistenceTitle, { color: theme.text.primary }]}>{t.web_persistence_warning_title}</Text>
            <Text style={[styles.persistenceText, { color: theme.text.muted }]}>{t.web_persistence_warning_msg}</Text>
          </View>
        ) : null}

        <View style={[styles.hero, { backgroundColor: theme.brand.primary + '12', borderColor: theme.brand.primary + '44' }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={[styles.heroKicker, { color: theme.brand.primary }]}>{t.home_command_center}</Text>
              <Text style={[styles.greeting, { color: theme.text.muted }]}>{greeting(t)}</Text>
              <Text style={[styles.dateStr, { color: theme.text.primary }]}>{dateStr}</Text>
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

          <View style={styles.heroMetric}>
            <View style={styles.heroMetricText}>
              <Text style={[styles.heroMetricLabel, { color: theme.text.muted }]}>{t.today_spent}</Text>
              <Text style={[styles.heroMetricValue, { color: todayExpense > 0 ? theme.finance.expense : theme.text.primary }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatAmount(todayExpense, todayExpenseCurrency, language)}
              </Text>
            </View>
            <View style={[styles.heroMetricIcon, { backgroundColor: (todayExpense > 0 ? theme.finance.expense : theme.semantic.success) + '1F' }]}>
              <Feather name={todayExpense > 0 ? 'trending-down' : 'check-circle'} size={22} color={todayExpense > 0 ? theme.finance.expense : theme.semantic.success} />
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
        </View>

        <View style={[styles.reviewPanel, { backgroundColor: theme.bg.elevated, borderColor: reviewCount > 0 ? theme.semantic.warning + '66' : theme.border.subtle }]}>
          <View style={styles.reviewHeader}>
            <View style={styles.reviewHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{t.review_inbox_title}</Text>
              <Text style={[styles.reviewHeaderSubtitle, { color: theme.text.muted }]}>
                {reviewCount > 0
                  ? t.review_inbox_count.replace('{{count}}', String(reviewCount))
                  : t.review_inbox_empty}
              </Text>
            </View>
            <View style={[styles.reviewBadge, { backgroundColor: reviewCount > 0 ? theme.semantic.warning + '22' : theme.semantic.success + '1F' }]}>
              <Feather name={reviewCount > 0 ? 'inbox' : 'check'} size={16} color={reviewCount > 0 ? theme.semantic.warning : theme.semantic.success} />
              <Text style={[styles.reviewBadgeText, { color: reviewCount > 0 ? theme.semantic.warning : theme.semantic.success }]}>
                {reviewCount}
              </Text>
            </View>
          </View>
          {reviewItems.length > 0 ? (
            <View style={styles.reviewList}>
              {reviewItems.map((item) => (
                <ReviewInboxRow key={item.id} item={item} onPress={() => router.push(item.route as any)} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.timelinePanel, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.timelineHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{t.today_timeline}</Text>
            <Text style={[styles.timelineCount, { color: theme.text.muted }]}>{timelineItems.length}</Text>
          </View>
          {timelineItems.length > 0 ? (
            <View style={styles.timelineList}>
              {timelineItems.map((item) => (
                <TimelineRow key={item.id} item={item} onPress={() => router.push(item.route as any)} />
              ))}
            </View>
          ) : (
            <View style={styles.timelineEmpty}>
              <View style={[styles.timelineEmptyIcon, { backgroundColor: theme.brand.primary + '14' }]}>
                <Feather name="clock" size={22} color={theme.brand.primary} />
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

        <View style={styles.moduleGrid}>
          <ModuleCard
            icon="dollar-sign"
            title={t.nav_finance}
            subtitle={financeSubtitle}
            hint={todayExpense === 0 ? t.finance_add_hint : undefined}
            accentColor={theme.finance.expense}
            onPress={() => router.push('/finance')}
          />

          <ModuleCard
            icon="check-square"
            title={t.nav_reminders}
            subtitle={reminderSubtitle}
            hint={reminderHint}
            accentColor={MODULE_COLORS.tasks}
            onPress={() => router.push('/reminders')}
          />

          <ModuleCard
            icon="book-open"
            title={t.nav_journal}
            subtitle={journalSubtitle}
            accentColor={MODULE_COLORS.journal}
            onPress={() => router.push('/journals')}
          />

          <ModuleCard
            icon="check-circle"
            title={t.habits}
            subtitle={habitsSubtitle}
            accentColor={MODULE_COLORS.habits}
            onPress={() => router.push('/habits')}
          />
        </View>

        <Pressable
          onPress={() => router.push('/analysis')}
          accessibilityRole="button"
          accessibilityLabel={t.analysis_title}
          style={({ pressed }) => [
            styles.analysisStrip,
            {
              backgroundColor: pressed ? theme.bg.secondary : MODULE_COLORS.analysis + '14',
              borderColor: MODULE_COLORS.analysis + '44',
            },
          ]}
        >
          <View style={[styles.analysisIcon, { backgroundColor: MODULE_COLORS.analysis + '1F' }]}>
            <Feather name="bar-chart-2" size={20} color={MODULE_COLORS.analysis} />
          </View>
          <View style={styles.analysisText}>
            <Text style={[styles.analysisTitle, { color: theme.text.primary }]}>{t.analysis_title}</Text>
            <Text style={[styles.analysisSubtitle, { color: theme.text.muted }]} numberOfLines={2}>
              {t.analysis_subtitle}
            </Text>
          </View>
          <Feather name="arrow-right" size={20} color={MODULE_COLORS.analysis} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/chat')}
          accessibilityRole="button"
          accessibilityLabel={t.nav_chat}
          style={({ pressed }) => [
            styles.analysisStrip,
            {
              backgroundColor: pressed ? theme.bg.secondary : theme.brand.primary + '12',
              borderColor: theme.brand.primary + '44',
            },
          ]}
        >
          <View style={[styles.analysisIcon, { backgroundColor: theme.brand.primary + '1F' }]}>
            <Feather name="message-circle" size={20} color={theme.brand.primary} />
          </View>
          <View style={styles.analysisText}>
            <Text style={[styles.analysisTitle, { color: theme.text.primary }]}>{t.nav_chat}</Text>
            <Text style={[styles.analysisSubtitle, { color: theme.text.muted }]} numberOfLines={1}>
              {t.assistant_subtitle}
            </Text>
          </View>
          <Feather name="arrow-right" size={20} color={theme.brand.primary} />
        </Pressable>
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
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: 112 },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  heroText: { flex: 1, gap: 2 },
  heroKicker: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressValue: { fontSize: 16, fontWeight: '700' },
  progressLabel: { fontSize: 10, fontWeight: '500' },
  heroMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  heroMetricText: { flex: 1 },
  heroMetricLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroMetricValue: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  heroMetricIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryStrip: { flexDirection: 'row', gap: spacing[2] },
  summaryChip: {
    flex: 1,
    minHeight: 66,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[2],
    gap: spacing[1],
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  summaryLabel: { fontSize: 10, fontWeight: '500' },
  reviewPanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  reviewHeaderText: { flex: 1, gap: 3 },
  reviewHeaderSubtitle: { fontSize: 12, lineHeight: 17 },
  reviewBadge: {
    minWidth: 52,
    height: 34,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  reviewBadgeText: { fontSize: 13, fontWeight: '800' },
  reviewList: { gap: spacing[1] },
  reviewRow: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  reviewIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBody: { flex: 1, gap: 2 },
  reviewTitle: { fontSize: 14, fontWeight: '700' },
  reviewSubtitle: { fontSize: 12 },
  reviewSeverityDot: { width: 8, height: 8, borderRadius: radius.full },
  timelinePanel: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[2],
  },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineCount: { fontSize: 12, fontWeight: '600' },
  timelineList: { gap: spacing[1] },
  timelineRow: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  timelineTime: { width: 42, fontSize: 12, fontWeight: '700' },
  timelineEmoji: { fontSize: 14 },
  timelineIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBody: { flex: 1, gap: 2 },
  timelineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  timelineTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  timelineMeta: { fontSize: 11 },
  timelineAmount: { fontSize: 13, fontWeight: '700' },
  timelineEmpty: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  timelineEmptyIcon: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  timelineEmptyText: { fontSize: 13, fontWeight: '600' },
  timelineEmptyHint: { fontSize: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  persistenceBanner: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[1],
  },
  persistenceTitle: { fontSize: 14, fontWeight: '700' },
  persistenceText: { fontSize: 13, lineHeight: 18 },
  greeting: { fontSize: 14, fontWeight: '500' },
  dateStr: { fontSize: 22, fontWeight: '700' },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 126,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
  },
  cardContent: { flex: 1, gap: spacing[2] },
  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardSubtitle: { fontSize: 12, lineHeight: 17 },
  cardHint: { fontSize: 12, lineHeight: 16 },
  cardChevron: { position: 'absolute', right: spacing[3], top: spacing[3] },
  analysisStrip: {
    minHeight: 76,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  analysisIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisText: { flex: 1, gap: 2 },
  analysisTitle: { fontSize: 15, fontWeight: '700' },
  analysisSubtitle: { fontSize: 13, lineHeight: 18 },
  fab: {
    position: 'absolute', right: spacing[6],
    width: 56, height: 56, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
})
