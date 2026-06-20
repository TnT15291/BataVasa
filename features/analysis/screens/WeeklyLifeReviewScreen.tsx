import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme, getCardStyle, type Theme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { useGoalsStore } from '@store/goalsStore'
import { getProviderKey } from '@services/ai/openai'
import { buildWeeklyLifeReviewSnapshot, generateWeeklyLifeReview } from '@services/ai/weeklyLifeReview'
import { formatAmount } from '@features/finance/services'
import { convertMinorAmount, getRates } from '@services/fx'
import { useFinanceBootstrap, useTransactions, useCategories } from '@features/finance/hooks/useFinance'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { listRecentLogs } from '@features/habits/services'
import type { HabitLog } from '@features/habits/types'
import { useJournalsBootstrap, useJournals } from '@features/journals/hooks/useJournals'
import { useRemindersBootstrap, useReminders } from '@features/reminders/hooks/useReminders'
import { AppHeader, ModuleOverview, SectionHeader, EmptyState, Sparkle } from '@components/ui'
import { InsightText } from '@/components/InsightText'

export function WeeklyLifeReviewScreen() {
  useFinanceBootstrap()
  useHabitsBootstrap()
  useJournalsBootstrap()
  useRemindersBootstrap()

  const theme = useTheme()
  const cardStyle = getCardStyle(theme)
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, language } = useTranslation()
  const aiProvider = useSettingsStore((s) => s.aiProvider)
  const currency = useSettingsStore((s) => s.currency)
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)

  const transactions = useTransactions()
  const categories = useCategories()
  const habits = useHabits()
  const journals = useJournals()
  const reminders = useReminders()
  const goals = useGoalsStore((s) => s.goals)
  const loadGoals = useGoalsStore((s) => s.loadGoals)

  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  const [fxRates, setFxRates] = useState<Record<string, number> | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { void loadGoals() }, [loadGoals])
  useEffect(() => { getRates(displayCurrency).then(setFxRates) }, [displayCurrency])
  useEffect(() => {
    listRecentLogs(14).then((r) => setHabitLogs(r.ok ? r.value : []))
  }, [])

  const reportCurrency = fxRates ? displayCurrency : currency
  const amountInReportCurrency = useCallback((amount: number, txCurrency: string) => {
    if (txCurrency === reportCurrency) return amount
    if (fxRates) return convertMinorAmount(amount, txCurrency, reportCurrency, fxRates)
    if (txCurrency === currency) return amount
    return null
  }, [currency, reportCurrency, fxRates])

  const snapshot = useMemo(() => buildWeeklyLifeReviewSnapshot({
    transactions,
    categories,
    habits,
    habitLogs,
    journals,
    reminders,
    goals,
    currency: reportCurrency,
    amountInCurrency: amountInReportCurrency,
  }), [transactions, categories, habits, habitLogs, journals, reminders, goals, reportCurrency, amountInReportCurrency])

  const hasData = transactions.length > 0 || habits.length > 0 || journals.length > 0 || reminders.length > 0 || goals.length > 0

  const run = useCallback(async () => {
    const key = await getProviderKey(aiProvider)
    if (!key) {
      Alert.alert(t.no_api_key, t.no_api_key_msg, [
        { text: t.go_to_settings, onPress: () => router.push('/ai-settings') },
        { text: t.cancel, style: 'cancel' },
      ])
      return
    }
    setLoading(true)
    setResult(null)
    try {
      setResult(await generateWeeklyLifeReview(snapshot, reportCurrency))
    } catch (e: any) {
      Alert.alert(t.ai_error, e?.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [aiProvider, t, router, snapshot, reportCurrency])

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[2], paddingBottom: spacing[10] + insets.bottom }]}>
        <AppHeader subtitle={t.weekly_life_review} onSettings={() => router.push('/settings')} />
        <ModuleOverview
          eyebrow={t.weekly_life_review}
          value={snapshot.rangeLabel}
          subtitle={t.weekly_life_review_subtitle}
          icon="compass"
          accent={MODULE_COLORS.analysis}
          stats={[
            { key: 'goals', label: t.nav_goals, value: `${snapshot.goals.onTrack}/${Math.max(snapshot.goals.active, 1)}`, color: MODULE_COLORS.analysis },
            { key: 'money', label: t.expense, value: formatAmount(snapshot.finance.expense, reportCurrency, language), color: MODULE_COLORS.finance },
            { key: 'tasks', label: t.nav_reminders, value: snapshot.reminders.completionRate === null ? '-' : `${snapshot.reminders.completionRate}%`, color: MODULE_COLORS.tasks },
          ]}
        />

        {!hasData ? (
          <EmptyState icon="compass" accent={MODULE_COLORS.analysis} title={t.weekly_life_review} body={t.analysis_no_data_msg} />
        ) : (
          <>
            <SectionHeader label={t.weekly_review_snapshot} />
            <View style={styles.grid}>
              <MetricCard icon="target" label={t.nav_goals} value={`${snapshot.goals.onTrack}/${snapshot.goals.active}`} hint={t.weekly_review_on_track} color={MODULE_COLORS.analysis} theme={theme} />
              <MetricCard icon="trending-down" label={t.expense} value={formatAmount(snapshot.finance.expense, reportCurrency, language)} hint={snapshot.finance.expenseDeltaPercent === null ? t.weekly_review_no_previous : `${snapshot.finance.expenseDeltaPercent > 0 ? '+' : ''}${snapshot.finance.expenseDeltaPercent}%`} color={MODULE_COLORS.finance} theme={theme} />
              <MetricCard icon="check-circle" label={t.nav_habits} value={String(snapshot.habits.completions)} hint={`${snapshot.habits.skips} ${t.report_skipped}`} color={MODULE_COLORS.habits} theme={theme} />
              <MetricCard icon="book-open" label={t.nav_journal} value={String(snapshot.journals.entries)} hint={snapshot.journals.avgMood === null ? t.report_avg_mood : `${snapshot.journals.avgMood.toFixed(1)}/5`} color={MODULE_COLORS.journal} theme={theme} />
            </View>

            <View style={[styles.card, cardStyle, { backgroundColor: theme.bg.elevated }]}>
              <SectionHeader label={t.weekly_review_focus} />
              {snapshot.goals.top.length > 0 ? snapshot.goals.top.map((goal) => (
                <ProgressRow key={goal.title} title={goal.title} subtitle={goal.label} percent={goal.percent} theme={theme} />
              )) : (
                <Text style={[styles.muted, { color: theme.text.muted }]}>{t.nav_goals}</Text>
              )}
            </View>

            <View style={[styles.card, cardStyle, { backgroundColor: theme.bg.elevated }]}>
              <SectionHeader label={t.weekly_review_signals} />
              <SignalLine icon={MODULE_ICONS.finance} text={snapshot.finance.topCategories.length > 0 ? snapshot.finance.topCategories.map((c) => c.name).join(', ') : t.report_no_data} color={MODULE_COLORS.finance} theme={theme} />
              <SignalLine icon="activity" text={snapshot.habits.topHabits.length > 0 ? snapshot.habits.topHabits.map((h) => `${h.name} ${h.count}`).join(', ') : t.report_no_data} color={MODULE_COLORS.habits} theme={theme} />
              <SignalLine icon="tag" text={snapshot.journals.tags.length > 0 ? snapshot.journals.tags.map((tag) => tag.tag).join(', ') : t.report_no_data} color={MODULE_COLORS.journal} theme={theme} />
              <SignalLine icon="bell" text={`${snapshot.reminders.completed}/${snapshot.reminders.due} ${t.reminder_completed}`} color={MODULE_COLORS.tasks} theme={theme} />
            </View>

            {result ? (
              <View style={[styles.card, cardStyle, { backgroundColor: theme.bg.elevated }]}>
                <View style={styles.aiHeader}>
                  <Sparkle size={12} color={MODULE_COLORS.analysis} />
                  <Text style={[styles.aiLabel, { color: theme.text.muted }]}>{t.ai_insights}</Text>
                </View>
                <InsightText text={result} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {hasData ? (
        <View style={[styles.footer, { borderTopColor: theme.border.subtle, backgroundColor: theme.bg.elevated, paddingBottom: spacing[4] + insets.bottom }]}>
          <Pressable
            onPress={run}
            disabled={loading}
            style={({ pressed }) => [styles.btn, { backgroundColor: loading ? theme.text.muted : MODULE_COLORS.analysis, opacity: pressed ? 0.82 : 1 }]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{result ? t.refresh : t.weekly_review_generate}</Text>}
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

function MetricCard({ icon, label, value, hint, color, theme }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; hint: string; color: string; theme: Theme }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
      <View style={[styles.metricIcon, { backgroundColor: color + '1F' }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.metricValue, { color: theme.text.primary }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.text.muted }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.metricHint, { color: theme.text.muted }]} numberOfLines={1}>{hint}</Text>
    </View>
  )
}

function ProgressRow({ title, subtitle, percent, theme }: { title: string; subtitle: string; percent: number; theme: Theme }) {
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressText}>
        <Text style={[styles.progressTitle, { color: theme.text.primary }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.muted, { color: theme.text.muted }]} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text style={[styles.progressPct, { color: MODULE_COLORS.analysis }]}>{percent}%</Text>
    </View>
  )
}

function SignalLine({ icon, text, color, theme }: { icon: keyof typeof Feather.glyphMap; text: string; color: string; theme: Theme }) {
  return (
    <View style={styles.signalLine}>
      <Feather name={icon} size={16} color={color} />
      <Text style={[styles.signalText, { color: theme.text.secondary }]} numberOfLines={2}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[4], gap: spacing[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  metricCard: {
    width: '48%',
    minHeight: 128,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[1],
  },
  metricIcon: { width: 30, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1] },
  metricValue: { fontSize: 17, fontWeight: '800' },
  metricLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  metricHint: { fontSize: 12, fontWeight: '500' },
  card: { borderRadius: radius.md, padding: spacing[3], gap: spacing[3] },
  muted: { fontSize: 12, fontWeight: '500' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  progressText: { flex: 1, gap: 2 },
  progressTitle: { fontSize: 14, fontWeight: '700' },
  progressPct: { fontSize: 15, fontWeight: '800' },
  signalLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  signalText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  aiLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  btn: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
})
