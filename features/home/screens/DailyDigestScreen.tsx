import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { format, startOfDay, endOfDay } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { shouldWarnAboutWebSQLitePersistence } from '@services/webPersistence'
import { useFinanceBootstrap, useTransactions } from '@features/finance/hooks/useFinance'
import { useRemindersBootstrap, useReminders } from '@features/reminders/hooks/useReminders'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { useJournalsBootstrap, useJournals } from '@features/journals/hooks/useJournals'
import { useFinanceStore } from '@store/financeStore'
import { useRemindersStore } from '@store/remindersStore'
import { useHabitsStore } from '@store/habitsStore'
import { useJournalsStore } from '@store/journalsStore'
import { formatAmount } from '@features/finance/services'
import { convertMinorAmount, getRates } from '@services/fx'
import { UniversalAddSheet } from '../components/UniversalAddSheet'
import { OnboardingModal } from '../components/OnboardingModal'

type IconName = keyof typeof Feather.glyphMap

function greeting(t: any): string {
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

export function DailyDigestScreen() {
  useFinanceBootstrap()
  useRemindersBootstrap()
  useHabitsBootstrap()
  useJournalsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const currency = useSettingsStore((s) => s.currency)
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const txs = useTransactions()
  const reminders = useReminders()
  const habits = useHabits()
  const journals = useJournals()
  const loadCategories = useFinanceStore((s) => s.loadCategories)
  const loadTransactions = useFinanceStore((s) => s.loadTransactions)
  const loadReminders = useRemindersStore((s) => s.loadReminders)
  const loadHabits = useHabitsStore((s) => s.loadHabits)
  const loadJournals = useJournalsStore((s) => s.loadJournals)
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding)
  const [showAdd, setShowAdd] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [fxRates, setFxRates] = useState<Record<string, number> | null>(null)

  const locale = getDateFnsLocale(language)
  const now = new Date()
  const dateStr = format(now, 'EEEE, dd MMMM', { locale })

  useEffect(() => {
    getRates(displayCurrency).then(setFxRates)
  }, [displayCurrency])

  const todayExpense = useMemo(() => {
    const from = startOfDay(now)
    const to = endOfDay(now)
    return txs
      .filter((tx) => tx.amount_cents < 0)
      .filter((tx) => { const d = new Date(tx.occurred_at); return d >= from && d <= to })
      .reduce((sum, tx) => {
        if (tx.currency === displayCurrency) return sum + Math.abs(tx.amount_cents)
        if (fxRates) {
          const converted = convertMinorAmount(tx.amount_cents, tx.currency, displayCurrency, fxRates)
          return sum + (converted === null ? 0 : Math.abs(converted))
        }
        if (tx.currency === currency) return sum + Math.abs(tx.amount_cents)
        return sum
      }, 0)
  }, [txs, currency, displayCurrency, fxRates, now])

  const todayExpenseCurrency = fxRates ? displayCurrency : currency

  const todayJournals = useMemo(() => {
    const from = startOfDay(now)
    const to = endOfDay(now)
    return journals.filter((j) => {
      const d = new Date(j.occurred_at)
      return d >= from && d <= to
    }).length
  }, [journals, now])

  const nextReminder = useMemo(() => {
    const from = startOfDay(now)
    const to = endOfDay(now)
    return reminders
      .filter((r) => r.completed === 0)
      .filter((r) => { const d = new Date(r.remind_at); return d >= from && d <= to })
      .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())[0] ?? null
  }, [reminders, now])

  const nextFutureReminder = useMemo(() => {
    if (nextReminder) return null
    return reminders
      .filter((r) => r.completed === 0 && new Date(r.remind_at) > now)
      .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())[0] ?? null
  }, [reminders, nextReminder, now])

  const financeSubtitle = todayExpense > 0
    ? `${t.today_spent} ${formatAmount(todayExpense, todayExpenseCurrency, language)}`
    : t.today_no_spending

  const reminderSubtitle = nextReminder
    ? `${nextReminder.title} - ${format(new Date(nextReminder.remind_at), 'HH:mm', { locale })}`
    : nextFutureReminder
      ? `${nextFutureReminder.title} - ${format(new Date(nextFutureReminder.remind_at), 'dd/MM HH:mm', { locale })}`
      : t.reminder_today_none

  const reminderHint = !nextReminder && !nextFutureReminder ? t.reminder_add_hint : undefined

  const habitsDoneCount = habits.filter((h) => h.todayCount >= h.target_per_period).length
  const habitsTotal = habits.length
  const nextHabit = habits.find((h) => h.todayCount < h.target_per_period) ?? null
  const habitProgress = habitsTotal === 0 ? 0 : Math.round((habitsDoneCount / habitsTotal) * 100)
  const habitsSubtitle = habitsTotal === 0
    ? t.habits_card_subtitle
    : t.habits_done_today.replace('{{done}}', String(habitsDoneCount)).replace('{{total}}', String(habitsTotal))
  const journalSubtitle = todayJournals > 0 ? `${todayJournals} ${t.today}` : t.journal_card_subtitle

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        loadCategories(),
        loadTransactions(),
        loadReminders(),
        loadHabits(),
        loadJournals(),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [loadCategories, loadTransactions, loadReminders, loadHabits, loadJournals])

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
              <Text style={[styles.greeting, { color: theme.text.muted }]}>{greeting(t)}</Text>
              <Text style={[styles.dateStr, { color: theme.text.primary }]}>{dateStr}</Text>
            </View>
            <View style={[styles.progressDial, { borderColor: theme.brand.primary }]}>
              <Text style={[styles.progressValue, { color: theme.text.primary }]}>{habitProgress}%</Text>
              <Text style={[styles.progressLabel, { color: theme.text.muted }]}>{t.habits}</Text>
            </View>
          </View>

          <View style={styles.heroMetric}>
            <View style={styles.heroMetricText}>
              <Text style={[styles.heroMetricLabel, { color: theme.text.muted }]}>{t.today_spent}</Text>
              <Text style={[styles.heroMetricValue, { color: theme.finance.expense }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatAmount(todayExpense, todayExpenseCurrency, language)}
              </Text>
            </View>
            <View style={[styles.heroMetricIcon, { backgroundColor: theme.finance.expense + '1F' }]}>
              <Feather name="trending-down" size={22} color={theme.finance.expense} />
            </View>
          </View>

          <View style={styles.summaryStrip}>
            <SummaryChip
              icon="bell"
              label={t.nav_reminders}
              value={nextReminder ? format(new Date(nextReminder.remind_at), 'HH:mm', { locale }) : '-'}
              color="#2196F3"
            />
            <SummaryChip
              icon="check-circle"
              label={t.habits}
              value={habitsTotal === 0 ? '-' : `${habitsDoneCount}/${habitsTotal}`}
              color="#FF9800"
            />
            <SummaryChip
              icon="book-open"
              label={t.nav_journal}
              value={todayJournals > 0 ? String(todayJournals) : '-'}
              color="#9C27B0"
            />
          </View>
        </View>

        {(nextReminder || nextHabit) ? (
          <View style={[styles.todayPanel, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{t.today}</Text>
            {nextReminder ? (
              <Pressable onPress={() => router.push('/reminders' as any)} style={styles.actionItem}>
                <Feather name="bell" size={18} color="#2196F3" />
                <View style={styles.actionText}>
                  <Text style={[styles.actionTitle, { color: theme.text.primary }]} numberOfLines={1}>{nextReminder.title}</Text>
                  <Text style={[styles.actionSubtitle, { color: theme.text.muted }]}>
                    {format(new Date(nextReminder.remind_at), 'HH:mm', { locale })}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={theme.text.muted} />
              </Pressable>
            ) : null}
            {nextHabit ? (
              <Pressable onPress={() => router.push('/habits' as any)} style={styles.actionItem}>
                <Feather name="check-circle" size={18} color="#FF9800" />
                <View style={styles.actionText}>
                  <Text style={[styles.actionTitle, { color: theme.text.primary }]} numberOfLines={1}>{nextHabit.name}</Text>
                  <Text style={[styles.actionSubtitle, { color: theme.text.muted }]}>
                    {nextHabit.todayCount}/{nextHabit.target_per_period}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={theme.text.muted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.moduleGrid}>
          <ModuleCard
            icon="dollar-sign"
            title={t.nav_finance}
            subtitle={financeSubtitle}
            hint={todayExpense === 0 ? t.finance_add_hint : undefined}
            accentColor={theme.finance.expense}
            onPress={() => router.push('/finance' as any)}
          />

          <ModuleCard
            icon="bell"
            title={t.nav_reminders}
            subtitle={reminderSubtitle}
            hint={reminderHint}
            accentColor="#2196F3"
            onPress={() => router.push('/reminders' as any)}
          />

          <ModuleCard
            icon="book-open"
            title={t.nav_journal}
            subtitle={journalSubtitle}
            accentColor="#9C27B0"
            onPress={() => router.push('/journals' as any)}
          />

          <ModuleCard
            icon="check-circle"
            title={t.habits}
            subtitle={habitsSubtitle}
            accentColor="#FF9800"
            onPress={() => router.push('/habits' as any)}
          />
        </View>

        <Pressable
          onPress={() => router.push('/analysis' as any)}
          accessibilityRole="button"
          accessibilityLabel={t.analysis_title}
          style={({ pressed }) => [
            styles.analysisStrip,
            {
              backgroundColor: pressed ? theme.bg.secondary : '#607D8B14',
              borderColor: '#607D8B44',
            },
          ]}
        >
          <View style={[styles.analysisIcon, { backgroundColor: '#607D8B1F' }]}>
            <Feather name="bar-chart-2" size={20} color="#607D8B" />
          </View>
          <View style={styles.analysisText}>
            <Text style={[styles.analysisTitle, { color: theme.text.primary }]}>{t.analysis_title}</Text>
            <Text style={[styles.analysisSubtitle, { color: theme.text.muted }]} numberOfLines={2}>
              {t.analysis_subtitle}
            </Text>
          </View>
          <Feather name="arrow-right" size={20} color="#607D8B" />
        </Pressable>
      </ScrollView>

      <Pressable
        onPress={() => setShowAdd(true)}
        accessibilityRole="button"
        accessibilityLabel={t.universal_add_title}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </Pressable>

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
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: 100 },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[5],
    gap: spacing[4],
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  heroText: { flex: 1, gap: 2 },
  progressDial: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressValue: { fontSize: 16, fontWeight: '800' },
  progressLabel: { fontSize: 10, fontWeight: '700' },
  heroMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  heroMetricText: { flex: 1 },
  heroMetricLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroMetricValue: { fontSize: 30, fontWeight: '800', marginTop: 2 },
  heroMetricIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryStrip: { flexDirection: 'row', gap: spacing[2] },
  summaryChip: {
    flex: 1,
    minHeight: 74,
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
  summaryValue: { fontSize: 15, fontWeight: '800' },
  summaryLabel: { fontSize: 10, fontWeight: '700' },
  todayPanel: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[2],
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 44 },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600' },
  actionSubtitle: { fontSize: 12, marginTop: 2 },
  persistenceBanner: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[1],
  },
  persistenceTitle: { fontSize: 14, fontWeight: '700' },
  persistenceText: { fontSize: 13, lineHeight: 18 },
  greeting: { fontSize: 14, fontWeight: '500' },
  dateStr: { fontSize: 24, fontWeight: '800' },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  card: {
    width: '48%',
    minHeight: 146,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
  },
  cardContent: { flex: 1, gap: spacing[2] },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardSubtitle: { fontSize: 13, lineHeight: 18 },
  cardHint: { fontSize: 12, lineHeight: 16 },
  cardChevron: { position: 'absolute', right: spacing[3], top: spacing[3] },
  analysisStrip: {
    minHeight: 88,
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
  analysisTitle: { fontSize: 15, fontWeight: '800' },
  analysisSubtitle: { fontSize: 13, lineHeight: 18 },
  fab: {
    position: 'absolute', right: spacing[6], bottom: spacing[8],
    width: 56, height: 56, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
})
