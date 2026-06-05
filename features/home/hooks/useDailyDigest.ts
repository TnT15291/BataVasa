import { useCallback, useEffect, useMemo, useState } from 'react'
import { startOfDay, endOfDay } from 'date-fns'
import { useSettingsStore } from '@store/settingsStore'
import { useFinanceBootstrap, useTransactions } from '@features/finance/hooks/useFinance'
import { useRemindersBootstrap, useReminders } from '@features/reminders/hooks/useReminders'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { useJournalsBootstrap, useJournals } from '@features/journals/hooks/useJournals'
import { useFinanceStore } from '@store/financeStore'
import { useRemindersStore } from '@store/remindersStore'
import { useHabitsStore } from '@store/habitsStore'
import { useJournalsStore } from '@store/journalsStore'
import { convertMinorAmount, getRates } from '@services/fx'

export type DailyTimelineItem = {
  id: string
  kind: 'finance' | 'task' | 'habit' | 'journal'
  occurredAt: Date
  title: string
  subtitle?: string
  route: '/finance' | '/reminders' | '/habits' | '/journals'
  status?: 'done' | 'pending'
  amount?: number
  currency?: string
  emoji?: string
}

export type DailyDigestData = {
  // Finance
  todayExpense: number
  todayExpenseCurrency: string
  // Reminders
  nextReminder: ReturnType<typeof useReminders>[number] | null
  nextFutureReminder: ReturnType<typeof useReminders>[number] | null
  // Habits
  habitsDoneCount: number
  habitsTotal: number
  habitProgress: number
  nextHabit: ReturnType<typeof useHabits>[number] | null
  // Journals
  todayJournalCount: number
  // Unified today feed
  timelineItems: DailyTimelineItem[]
  // Refresh
  refreshing: boolean
  onRefresh: () => Promise<void>
}

export function useDailyDigest(): DailyDigestData {
  useFinanceBootstrap()
  useRemindersBootstrap()
  useHabitsBootstrap()
  useJournalsBootstrap()

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

  const [refreshing, setRefreshing] = useState(false)
  const [fxRates, setFxRates] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    getRates(displayCurrency).then(setFxRates)
  }, [displayCurrency])

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  const todayExpense = useMemo(() => {
    return txs
      .filter((tx) => tx.amount_cents < 0)
      .filter((tx) => { const d = new Date(tx.occurred_at); return d >= todayStart && d <= todayEnd })
      .reduce((sum, tx) => {
        if (tx.currency === displayCurrency) return sum + Math.abs(tx.amount_cents)
        if (fxRates) {
          const converted = convertMinorAmount(tx.amount_cents, tx.currency, displayCurrency, fxRates)
          return sum + (converted === null ? 0 : Math.abs(converted))
        }
        if (tx.currency === currency) return sum + Math.abs(tx.amount_cents)
        return sum
      }, 0)
  }, [txs, currency, displayCurrency, fxRates, todayStart, todayEnd])

  const todayExpenseCurrency = fxRates ? displayCurrency : currency

  const todayJournalCount = useMemo(() => {
    return journals.filter((j) => {
      const d = new Date(j.occurred_at)
      return d >= todayStart && d <= todayEnd
    }).length
  }, [journals, todayStart, todayEnd])

  const nextReminder = useMemo(() => {
    return reminders
      .filter((r) => r.completed === 0)
      .filter((r) => { const d = new Date(r.remind_at); return d >= todayStart && d <= todayEnd })
      .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())[0] ?? null
  }, [reminders, todayStart, todayEnd])

  const nextFutureReminder = useMemo(() => {
    if (nextReminder) return null
    return reminders
      .filter((r) => r.completed === 0 && new Date(r.remind_at) > now)
      .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())[0] ?? null
  }, [reminders, nextReminder, now])

  const habitsDoneCount = habits.filter((h) => h.todayCount >= h.target_per_period).length
  const habitsTotal = habits.length
  const habitProgress = habitsTotal === 0 ? 0 : Math.round((habitsDoneCount / habitsTotal) * 100)
  const nextHabit = habits.find((h) => h.todayCount < h.target_per_period) ?? null

  const timelineItems = useMemo<DailyTimelineItem[]>(() => {
    const items: DailyTimelineItem[] = []

    for (const tx of txs) {
      const occurredAt = new Date(tx.occurred_at)
      if (occurredAt < todayStart || occurredAt > todayEnd) continue
      const amount = tx.currency === displayCurrency
        ? tx.amount_cents
        : fxRates
          ? convertMinorAmount(tx.amount_cents, tx.currency, displayCurrency, fxRates)
          : tx.currency === currency
            ? tx.amount_cents
            : null
      items.push({
        id: `finance-${tx.id}`,
        kind: 'finance',
        occurredAt,
        title: tx.merchant || tx.note || 'Transaction',
        subtitle: tx.amount_cents < 0 ? 'Expense' : 'Income',
        route: '/finance',
        amount: amount ?? tx.amount_cents,
        currency: amount === null ? tx.currency : (fxRates ? displayCurrency : currency),
      })
    }

    for (const reminder of reminders) {
      if (reminder.completed === 1 || (reminder.is_inbox ?? 0) === 1) continue
      const occurredAt = new Date(reminder.remind_at)
      if (occurredAt < todayStart || occurredAt > todayEnd) continue
      items.push({
        id: `task-${reminder.id}`,
        kind: 'task',
        occurredAt,
        title: reminder.title,
        subtitle: reminder.priority === 'high' ? 'High priority' : undefined,
        route: '/reminders',
        status: 'pending',
      })
    }

    for (const journal of journals) {
      const occurredAt = new Date(journal.occurred_at)
      if (occurredAt < todayStart || occurredAt > todayEnd) continue
      items.push({
        id: `journal-${journal.id}`,
        kind: 'journal',
        occurredAt,
        title: journal.content.slice(0, 80).replace(/\n/g, ' '),
        subtitle: journal.mood ? `Mood ${journal.mood}/5` : undefined,
        route: '/journals',
      })
    }

    const habitBaseTime = new Date(todayStart)
    habitBaseTime.setHours(7, 0, 0, 0)
    habits
      .filter((habit) => habit.dueToday !== false)
      .slice(0, 4)
      .forEach((habit, index) => {
        const occurredAt = new Date(habitBaseTime.getTime() + index * 10 * 60 * 1000)
        const done = habit.todayCount >= habit.target_per_period
        items.push({
          id: `habit-${habit.id}`,
          kind: 'habit',
          occurredAt,
          title: habit.name,
          subtitle: `${habit.todayCount}/${habit.target_per_period}`,
          route: '/habits',
          status: done ? 'done' : 'pending',
          emoji: habit.icon && (habit.icon.codePointAt(0) ?? 0) > 127 ? habit.icon : undefined,
        })
      })

    return items
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      .slice(0, 8)
  }, [txs, reminders, habits, journals, todayStart, todayEnd, currency, displayCurrency, fxRates])

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

  return {
    todayExpense,
    todayExpenseCurrency,
    nextReminder,
    nextFutureReminder,
    habitsDoneCount,
    habitsTotal,
    habitProgress,
    nextHabit,
    todayJournalCount,
    timelineItems,
    refreshing,
    onRefresh,
  }
}
