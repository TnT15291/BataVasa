import { useState, useMemo } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { format, startOfDay, endOfDay } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { shouldWarnAboutWebSQLitePersistence } from '@services/webPersistence'
import { useFinanceBootstrap, useTransactions, useCategories } from '@features/finance/hooks/useFinance'
import { useRemindersBootstrap, useReminders } from '@features/reminders/hooks/useReminders'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { formatAmount } from '@features/finance/services'
import { UniversalAddSheet } from '../components/UniversalAddSheet'

function greeting(t: any): string {
  const h = new Date().getHours()
  if (h < 12) return t.greeting_morning
  if (h < 18) return t.greeting_afternoon
  return t.greeting_evening
}

type CardProps = {
  icon: string
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
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>{icon}</Text>
          <Text style={[styles.cardTitle, { color: theme.text.muted }]}>{title}</Text>
          <Text style={[styles.cardChevron, { color: theme.text.muted }]}>›</Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: theme.text.primary }]}>{subtitle}</Text>
        {hint ? <Text style={[styles.cardHint, { color: theme.text.muted }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  )
}

export function DailyDigestScreen() {
  useFinanceBootstrap()
  useRemindersBootstrap()
  useHabitsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const currency = useSettingsStore((s) => s.currency)
  const txs = useTransactions()
  const cats = useCategories()
  const reminders = useReminders()
  const habits = useHabits()
  const [showAdd, setShowAdd] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const locale = getDateFnsLocale(language)
  const now = new Date()
  const dateStr = format(now, 'EEEE, dd MMMM', { locale })

  // Finance: today's expense
  const todayExpense = useMemo(() => {
    const from = startOfDay(now)
    const to = endOfDay(now)
    return txs
      .filter((tx) => tx.currency === currency && tx.amount_cents < 0)
      .filter((tx) => { const d = new Date(tx.occurred_at); return d >= from && d <= to })
      .reduce((sum, tx) => sum + Math.abs(tx.amount_cents), 0)
  }, [txs, currency, now])

  // Reminders: next upcoming today (include overdue earlier today too)
  const nextReminder = useMemo(() => {
    const from = startOfDay(now)
    const to = endOfDay(now)
    return reminders
      .filter((r) => r.completed === 0)
      .filter((r) => { const d = new Date(r.remind_at); return d >= from && d <= to })
      .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())[0] ?? null
  }, [reminders, now])

  // Upcoming reminder not today
  const nextFutureReminder = useMemo(() => {
    if (nextReminder) return null
    return reminders
      .filter((r) => r.completed === 0 && new Date(r.remind_at) > now)
      .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())[0] ?? null
  }, [reminders, nextReminder, now])

  const financeSubtitle = todayExpense > 0
    ? `${t.today_spent} ${formatAmount(todayExpense, currency, language)}`
    : t.today_no_spending

  const reminderSubtitle = nextReminder
    ? `${nextReminder.title} — ${format(new Date(nextReminder.remind_at), 'HH:mm', { locale })}`
    : nextFutureReminder
      ? `${nextFutureReminder.title} — ${format(new Date(nextFutureReminder.remind_at), 'dd/MM HH:mm', { locale })}`
      : t.reminder_today_none

  const reminderHint = !nextReminder && !nextFutureReminder ? t.reminder_add_hint : undefined

  // Habits: today's progress
  const habitsDoneCount = habits.filter((h) => h.todayCount >= h.target_per_period).length
  const habitsTotal = habits.length
  const habitsSubtitle = habitsTotal === 0
    ? t.habits_card_subtitle
    : t.habits_done_today.replace('{{done}}', String(habitsDoneCount)).replace('{{total}}', String(habitsTotal))

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} />}
      >
        {shouldWarnAboutWebSQLitePersistence() ? (
          <View style={[styles.persistenceBanner, { backgroundColor: theme.bg.elevated, borderColor: theme.semantic.warning }]}>
            <Text style={[styles.persistenceTitle, { color: theme.text.primary }]}>{t.web_persistence_warning_title}</Text>
            <Text style={[styles.persistenceText, { color: theme.text.muted }]}>{t.web_persistence_warning_msg}</Text>
          </View>
        ) : null}

        {/* Date Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: theme.text.muted }]}>{greeting(t)}</Text>
          <Text style={[styles.dateStr, { color: theme.text.primary }]}>{dateStr}</Text>
        </View>

        {/* Finance Card */}
        <ModuleCard
          icon="💰"
          title={t.nav_finance}
          subtitle={financeSubtitle}
          hint={todayExpense === 0 ? t.finance_add_hint : undefined}
          accentColor={theme.finance.expense}
          onPress={() => router.push('/finance' as any)}
        />

        {/* Reminder Card */}
        <ModuleCard
          icon="🔔"
          title={t.nav_reminders}
          subtitle={reminderSubtitle}
          hint={reminderHint}
          accentColor="#2196F3"
          onPress={() => router.push('/reminders' as any)}
        />

        {/* Journal Card */}
        <ModuleCard
          icon="📖"
          title={t.nav_journal}
          subtitle={t.journal_card_subtitle}
          accentColor="#9C27B0"
          onPress={() => router.push('/journals' as any)}
        />

        {/* Habits Card */}
        <ModuleCard
          icon="💪"
          title={t.habits}
          subtitle={habitsSubtitle}
          accentColor="#FF9800"
          onPress={() => router.push('/habits' as any)}
        />

        {/* Cross-module Analysis Card */}
        <ModuleCard
          icon="🔮"
          title={t.analysis_title}
          subtitle={t.analysis_subtitle}
          accentColor="#607D8B"
          onPress={() => router.push('/analysis' as any)}
        />
      </ScrollView>

      {/* Universal Add FAB */}
      <Pressable
        onPress={() => setShowAdd(true)}
        accessibilityRole="button"
        accessibilityLabel={t.universal_add_title}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      <UniversalAddSheet visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: 100 },
  header: { paddingTop: spacing[2], paddingBottom: spacing[2], gap: 2 },
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
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, padding: spacing[4], gap: spacing[1] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardIcon: { fontSize: 18 },
  cardTitle: { flex: 1, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardChevron: { fontSize: 20, lineHeight: 22 },
  cardSubtitle: { fontSize: 16, fontWeight: '500' },
  cardHint: { fontSize: 13 },
  fab: {
    position: 'absolute', right: spacing[6], bottom: spacing[8],
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  fabIcon: { color: '#fff', fontSize: 30, fontWeight: '600', lineHeight: 32 },
})
