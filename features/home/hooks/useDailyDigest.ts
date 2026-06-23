import { useCallback, useEffect, useMemo, useState } from 'react'
import { startOfDay, endOfDay } from 'date-fns'
import { useSettingsStore } from '@store/settingsStore'
import { useFinanceBootstrap, useTransactions, useCategories, usePlanItems, useDebts } from '@features/finance/hooks/useFinance'
import { useRemindersBootstrap, useReminders } from '@features/reminders/hooks/useReminders'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { useJournalsBootstrap, useJournals } from '@features/journals/hooks/useJournals'
import { useFinanceStore } from '@store/financeStore'
import { useRemindersStore } from '@store/remindersStore'
import { useHabitsStore } from '@store/habitsStore'
import { useJournalsStore } from '@store/journalsStore'
import { convertMinorAmount, getRates } from '@services/fx'
import { calculateSafeToSpend } from '@features/finance/services'
import { listRecentLogs } from '@features/habits/services'
import type { HabitLog } from '@features/habits/types'

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

export type ReviewInboxItem = {
  id: string
  kind: 'finance' | 'task' | 'habit' | 'journal'
  title: string
  route: '/finance' | '/reminders' | '/habits' | '/journals'
  severity: 'high' | 'medium' | 'low'
  subtitleKey: 'financeReview' | 'taskOverdue' | 'taskPriority' | 'taskSchedule' | 'habitPending' | 'journalImportant'
  count: number
  progressText?: string
  /** ISO timestamp of the underlying item, for relative-time meta on the row. */
  at?: string
}

export type DailyDigestData = {
  // Finance
  todayExpense: number
  todayExpenseCurrency: string
  safeToSpend: number
  safeToSpendCurrency: string
  // How far this cycle's spending has overrun the spendable pool, as a percent
  // (e.g. 18 → "over by 18%"). null when not overspent or the pool is unknown.
  overspendPercent: number | null
  // What's left to spend today: remaining safe-to-spend / days left in the
  // cycle (today included). 0 when already overspent. Answers "how much can I
  // spend today?" instead of dumping the whole-cycle figure.
  dailySafeToSpend: number
  // Reminders
  nextReminder: ReturnType<typeof useReminders>[number] | null
  nextFutureReminder: ReturnType<typeof useReminders>[number] | null
  // Habits
  habitsDoneCount: number
  habitsTotal: number
  habitProgress: number
  nextHabit: ReturnType<typeof useHabits>[number] | null
  pendingHabitNames: string[]
  // Journals
  todayJournalCount: number
  recentMoodAvg: number | null
  // The due habit that has gone un-done the longest (>= 2 days). null when no
  // pending habit has slipped that far.
  worstHabitMissed: { name: string; days: number } | null
  // Unified today feed
  timelineItems: DailyTimelineItem[]
  // Cross-module decisions
  reviewItems: ReviewInboxItem[]
  reviewCount: number
  todayTaskCount: number
  overdueTaskCount: number
  highPriorityTaskCount: number
  openTaskTitles: string[]
  // Loading / Refresh
  isLoading: boolean
  refreshing: boolean
  onRefresh: () => Promise<void>
}

export function useDailyDigest(): DailyDigestData {
  const isLoading = useFinanceBootstrap()
  useRemindersBootstrap()
  useHabitsBootstrap()
  useJournalsBootstrap()

  const currency = useSettingsStore((s) => s.currency)
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const cycleStartDay = useSettingsStore((s) => s.financeCycleStartDay)
  const countPlannedIncome = useSettingsStore((s) => s.safeToSpendCountPlannedIncome)
  const countCarryOver = useSettingsStore((s) => s.safeToSpendCarryOver)
  const txs = useTransactions()
  const categories = useCategories()
  const planItems = usePlanItems()
  const debts = useDebts()
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
  const [recentLogs, setRecentLogs] = useState<HabitLog[]>([])

  useEffect(() => {
    getRates(displayCurrency).then(setFxRates)
  }, [displayCurrency])

  // 30-day habit log history, loaded once, used to tell how long a due habit has
  // gone un-done. Deterministic (CLAUDE Rule 3) — no AI in this calculation.
  useEffect(() => {
    let cancelled = false
    listRecentLogs(30).then((res) => {
      if (!cancelled && res.ok) setRecentLogs(res.value)
    })
    return () => { cancelled = true }
  }, [habits.length])

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
  const safeToSpendCurrency = fxRates ? displayCurrency : currency
  const safeToSpendSummary = useMemo(
    () => calculateSafeToSpend({
      transactions: txs,
      categories,
      planItems,
      debts,
      currency: safeToSpendCurrency,
      fxRates,
      cycleStartDay,
      countPlannedIncome,
      countCarryOver,
    }),
    [txs, categories, planItems, debts, safeToSpendCurrency, fxRates, cycleStartDay, countPlannedIncome, countCarryOver]
  )

  const overspendPercent = useMemo<number | null>(() => {
    const s = safeToSpendSummary
    const pool = s.carryOver + s.income + (countPlannedIncome ? s.plannedIncome : 0)
    if (s.safeToSpend >= 0 || pool <= 0) return null
    return Math.round((Math.abs(s.safeToSpend) / pool) * 100)
  }, [safeToSpendSummary, countPlannedIncome])

  // Days left in the cycle, today included (cycleTo is the exclusive next-cycle
  // start). At least 1 so the daily figure never divides by zero on the last day.
  const cycleDaysRemaining = useMemo(
    () => Math.max(1, Math.ceil((safeToSpendSummary.cycleTo.getTime() - todayStart.getTime()) / 86400000)),
    [safeToSpendSummary.cycleTo, todayStart]
  )
  const dailySafeToSpend = safeToSpendSummary.safeToSpend > 0
    ? Math.floor(safeToSpendSummary.safeToSpend / cycleDaysRemaining)
    : 0

  const todayJournalCount = useMemo(() => {
    return journals.filter((j) => {
      const d = new Date(j.occurred_at)
      return d >= todayStart && d <= todayEnd
    }).length
  }, [journals, todayStart, todayEnd])

  const recentMoodAvg = useMemo(() => {
    const since = new Date(todayStart)
    since.setDate(since.getDate() - 6)
    const moodEntries = journals.filter((j) => {
      if (typeof j.mood !== 'number') return false
      const d = new Date(j.occurred_at)
      return d >= since && d <= todayEnd
    })
    if (moodEntries.length === 0) return null
    return moodEntries.reduce((sum, j) => sum + (j.mood ?? 0), 0) / moodEntries.length
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
  const pendingHabitNames = habits
    .filter((h) => h.dueToday !== false && h.todayCount < h.target_per_period)
    .map((h) => h.name)
    .slice(0, 4)

  const worstHabitMissed = useMemo<{ name: string; days: number } | null>(() => {
    if (recentLogs.length === 0) return null
    // Latest non-skipped completion per habit (logs are sorted desc by occurred_at,
    // so the first row seen for a habit is its most recent completion).
    const lastDone = new Map<string, number>()
    for (const log of recentLogs) {
      if ((log.skipped ?? 0) === 1) continue
      if (lastDone.has(log.habit_id)) continue
      lastDone.set(log.habit_id, startOfDay(new Date(log.occurred_at)).getTime())
    }
    let worst: { name: string; days: number } | null = null
    for (const habit of habits) {
      if (habit.dueToday === false || habit.todayCount >= habit.target_per_period) continue
      const last = lastDone.get(habit.id)
      if (last === undefined) continue
      const days = Math.round((todayStart.getTime() - last) / 86400000)
      if (days >= 2 && (!worst || days > worst.days)) worst = { name: habit.name, days }
    }
    return worst
  }, [recentLogs, habits, todayStart])

  const openTaskSummary = useMemo(() => {
    const open = reminders.filter((r) => r.completed === 0)
    const timed = open.filter((r) => (r.is_inbox ?? 0) !== 1)
    const overdue = timed.filter((r) => new Date(r.remind_at) < now)
    const today = timed.filter((r) => {
      const d = new Date(r.remind_at)
      return d >= todayStart && d <= todayEnd
    })
    const highPriorityToday = today.filter((r) => r.priority === 'high')
    const openTaskTitles = [...overdue, ...highPriorityToday, ...today]
      .map((r) => r.title)
      .filter((title, index, arr) => arr.indexOf(title) === index)
      .slice(0, 4)
    return {
      todayTaskCount: today.length,
      overdueTaskCount: overdue.length,
      highPriorityTaskCount: highPriorityToday.length,
      openTaskTitles,
    }
  }, [reminders, now, todayStart, todayEnd])

  const reviewItems = useMemo<ReviewInboxItem[]>(() => {
    const items: ReviewInboxItem[] = []

    const reviewTxs = txs
      .filter((tx) => tx.needs_review === 1)
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

    if (reviewTxs.length > 0) {
      const first = reviewTxs[0]
      items.push({
        id: 'finance-review',
        kind: 'finance',
        title: first.merchant || first.note || '',
        route: '/finance',
        severity: 'high',
        subtitleKey: 'financeReview',
        count: reviewTxs.length,
        at: first.occurred_at,
      })
    }

    const openReminders = reminders.filter((r) => r.completed === 0)
    const overdueReminders = openReminders
      .filter((r) => (r.is_inbox ?? 0) !== 1 && new Date(r.remind_at) < now)
      .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())
    const inboxReminders = openReminders
      .filter((r) => (r.is_inbox ?? 0) === 1)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const highPriorityToday = openReminders
      .filter((r) => r.priority === 'high' && (r.is_inbox ?? 0) !== 1)
      .filter((r) => { const d = new Date(r.remind_at); return d >= todayStart && d <= todayEnd })
      .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())

    if (overdueReminders.length > 0) {
      items.push({
        id: 'task-overdue',
        kind: 'task',
        title: overdueReminders[0].title,
        route: '/reminders',
        severity: 'high',
        subtitleKey: 'taskOverdue',
        count: overdueReminders.length,
        at: overdueReminders[0].remind_at,
      })
    } else if (highPriorityToday.length > 0) {
      items.push({
        id: 'task-priority',
        kind: 'task',
        title: highPriorityToday[0].title,
        route: '/reminders',
        severity: 'medium',
        subtitleKey: 'taskPriority',
        count: highPriorityToday.length,
        at: highPriorityToday[0].remind_at,
      })
    }

    if (inboxReminders.length > 0) {
      items.push({
        id: 'task-inbox',
        kind: 'task',
        title: inboxReminders[0].title,
        route: '/reminders',
        severity: 'medium',
        subtitleKey: 'taskSchedule',
        count: inboxReminders.length,
        at: inboxReminders[0].created_at,
      })
    }

    const pendingHabits = habits
      .filter((habit) => habit.dueToday !== false && habit.todayCount < habit.target_per_period)
      .sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0))

    if (pendingHabits.length > 0) {
      const first = pendingHabits[0]
      items.push({
        id: 'habit-pending',
        kind: 'habit',
        title: first.name,
        route: '/habits',
        severity: 'medium',
        subtitleKey: 'habitPending',
        count: pendingHabits.length,
        progressText: `${first.todayCount}/${first.target_per_period}`,
      })
    }

    const importantJournals = journals
      .filter((journal) => journal.is_important === 1)
      .filter((journal) => {
        const d = new Date(journal.occurred_at)
        const age = now.getTime() - d.getTime()
        return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000
      })
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

    if (importantJournals.length > 0) {
      items.push({
        id: 'journal-important',
        kind: 'journal',
        title: importantJournals[0].content.slice(0, 80).replace(/\n/g, ' '),
        route: '/journals',
        severity: 'low',
        subtitleKey: 'journalImportant',
        count: importantJournals.length,
        at: importantJournals[0].occurred_at,
      })
    }

    const score = { high: 0, medium: 1, low: 2 }
    return items.sort((a, b) => score[a.severity] - score[b.severity]).slice(0, 5)
  }, [txs, reminders, habits, journals, now, todayStart, todayEnd])

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
      const [, , , , , logs] = await Promise.all([
        loadCategories(),
        loadTransactions(),
        loadReminders(),
        loadHabits(),
        loadJournals(),
        listRecentLogs(30),
      ])
      if (logs.ok) setRecentLogs(logs.value)
    } finally {
      setRefreshing(false)
    }
  }, [loadCategories, loadTransactions, loadReminders, loadHabits, loadJournals])

  return {
    todayExpense,
    todayExpenseCurrency,
    safeToSpend: safeToSpendSummary.safeToSpend,
    safeToSpendCurrency,
    overspendPercent,
    dailySafeToSpend,
    nextReminder,
    nextFutureReminder,
    habitsDoneCount,
    habitsTotal,
    habitProgress,
    nextHabit,
    pendingHabitNames,
    todayJournalCount,
    recentMoodAvg,
    worstHabitMissed,
    timelineItems,
    reviewItems,
    reviewCount: reviewItems.length,
    todayTaskCount: openTaskSummary.todayTaskCount,
    overdueTaskCount: openTaskSummary.overdueTaskCount,
    highPriorityTaskCount: openTaskSummary.highPriorityTaskCount,
    openTaskTitles: openTaskSummary.openTaskTitles,
    isLoading,
    refreshing,
    onRefresh,
  }
}
