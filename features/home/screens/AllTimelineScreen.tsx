import { useEffect, useMemo, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { AppHeader, ListRow } from '@components/ui'
import { useTransactions } from '@features/finance/hooks/useFinance'
import { useReminders } from '@features/reminders/hooks/useReminders'
import { useJournals } from '@features/journals/hooks/useJournals'
import { listRecentLogs } from '@features/habits/services'
import type { DailyTimelineItem } from '../hooks/useDailyDigest'
import { format } from 'date-fns'

export function AllTimelineScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()

  const txs = useTransactions()
  const reminders = useReminders()
  const journals = useJournals()
  const [habitLogs, setHabitLogs] = useState<any[]>([])

  useEffect(() => {
    void (async () => {
      const r = await listRecentLogs(30)
      if (r.ok) setHabitLogs(r.value)
    })()
  }, [])

  const items = useMemo(() => {
    const out: DailyTimelineItem[] = []

    for (const tx of txs) {
      out.push({
        id: `finance-${tx.id}`,
        kind: 'finance',
        occurredAt: new Date(tx.occurred_at),
        title: tx.merchant || tx.note || 'Transaction',
        subtitle: tx.amount_cents < 0 ? t.expense : t.income,
        route: '/finance',
        amount: tx.amount_cents,
        currency: tx.currency,
      } as DailyTimelineItem)
    }

    for (const r of reminders) {
      out.push({
        id: `task-${r.id}`,
        kind: 'task',
        occurredAt: new Date(r.remind_at),
        title: r.title,
        subtitle: r.priority === 'high' ? t.priority_high : undefined,
        route: '/reminders',
        status: r.completed === 1 ? 'done' : 'pending',
      } as DailyTimelineItem)
    }

    for (const j of journals) {
      out.push({
        id: `journal-${j.id}`,
        kind: 'journal',
        occurredAt: new Date(j.occurred_at),
        title: (j.content || '').slice(0, 120).replace(/\n/g, ' '),
        subtitle: j.mood ? `${t.report_avg_mood} ${j.mood}/5` : undefined,
        route: '/journals',
      } as DailyTimelineItem)
    }

    for (const log of habitLogs) {
      out.push({
        id: `habitlog-${log.id}`,
        kind: 'habit',
        occurredAt: new Date(log.occurred_at),
        title: log.note ?? 'Habit log',
        subtitle: undefined,
        route: '/habits',
      } as DailyTimelineItem)
    }

    return out
      .filter((i) => i.occurredAt && !Number.isNaN(i.occurredAt.getTime()))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 40)
  }, [txs, reminders, journals, habitLogs, t])

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <AppHeader title={t.view_all} onSettings={() => router.push('/settings')} />
      <ScrollView contentContainerStyle={[styles.content]}>
        {items.map((item) => (
          <ListRow
            key={item.id}
            icon={item.kind === 'finance' ? 'trending-up' : item.kind === 'task' ? 'bell' : item.kind === 'habit' ? 'check-circle' : 'book-open'}
            color={item.kind === 'finance' ? '#2ecc71' : item.kind === 'task' ? '#f39c12' : item.kind === 'habit' ? '#6c5ce7' : '#0984e3'}
            title={item.title}
            subtitle={item.subtitle}
            meta={format(item.occurredAt, 'PP pp')}
            onPress={() => router.push(item.route as any)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], paddingBottom: 120, gap: spacing[2] },
})
