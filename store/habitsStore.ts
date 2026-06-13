import { create } from 'zustand'
import * as svc from '@features/habits/services'
import type { Habit, HabitLog, CreateHabitInput, UpdateHabitInput, CreateHabitLogInput } from '@features/habits/types'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type HabitWithStats = Habit & {
  todayCount: number
  streak: number
  strengthScore: number
  dueToday: boolean
}

type HabitsState = {
  habits: HabitWithStats[]
  loadState: LoadState
  lastError: string | null

  loadHabits: () => Promise<void>
  createHabit: (input: CreateHabitInput) => Promise<{ ok: boolean; error?: string }>
  updateHabit: (input: UpdateHabitInput) => Promise<{ ok: boolean; error?: string }>
  deleteHabit: (id: string) => Promise<{ ok: boolean; error?: string }>
  restoreHabit: (id: string) => Promise<{ ok: boolean; error?: string }>
  toggleTodayLog: (habitId: string) => Promise<{ ok: boolean; error?: string }>
  skipToday: (habitId: string) => Promise<{ ok: boolean; error?: string }>
  wipeAll: () => Promise<{ ok: boolean; deleted?: number; error?: string }>
}

async function hydrateStats(habit: Habit): Promise<HabitWithStats> {
  const [todayCount, streak, strengthScore] = await Promise.all([
    svc.getCurrentPeriodLogCount(habit),
    svc.getHabitStreak(habit.id),
    svc.getHabit30DayScore(habit),
  ])
  return { ...habit, todayCount, streak, strengthScore, dueToday: svc.isHabitDueOnDate(habit, new Date()) }
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  loadState: 'idle',
  lastError: null,

  async loadHabits() {
    if (get().loadState === 'loading') return
    set({ loadState: 'loading' })
    const r = await svc.loadHabits()
    if (!r.ok) {
      set({ loadState: 'error', lastError: r.error.message })
      return
    }
    const withStats = await Promise.all(r.value.map(hydrateStats))
    set({ habits: withStats, loadState: 'ready', lastError: null })
  },

  async createHabit(input) {
    const r = await svc.createHabit(input)
    if (!r.ok) return { ok: false, error: r.error.message }
    const withStats = await hydrateStats(r.value)
    set((s) => ({ habits: [...s.habits, withStats] }))
    return { ok: true }
  },

  async updateHabit(input) {
    const r = await svc.updateHabit(input)
    if (!r.ok) return { ok: false, error: r.error.message }
    const withStats = await hydrateStats(r.value)
    set((s) => ({ habits: s.habits.map((h) => h.id === withStats.id ? withStats : h) }))
    return { ok: true }
  },

  async deleteHabit(id) {
    const r = await svc.deleteHabit(id)
    if (!r.ok) return { ok: false, error: r.error.message }
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }))
    return { ok: true }
  },

  async restoreHabit(id) {
    const r = await svc.restoreHabit(id)
    if (!r.ok) return { ok: false, error: r.error.message }
    const withStats = await hydrateStats(r.value)
    set((s) => ({ habits: [...s.habits, withStats].sort((a, b) => a.created_at.localeCompare(b.created_at)) }))
    return { ok: true }
  },

  async toggleTodayLog(habitId) {
    const habit = get().habits.find((h) => h.id === habitId)
    if (!habit) return { ok: false, error: 'Habit not found' }
    const period = svc.getHabitPeriodRange(habit)

    let r: { ok: boolean; error?: string }
    if (habit.todayCount >= habit.target_per_period) {
      // Already done — unlog
      const res = await svc.unlogHabit(habitId, {
        fromIso: period.from.toISOString(),
        toIso: period.to.toISOString(),
      })
      r = res.ok ? { ok: true } : { ok: false, error: res.error.message }
    } else {
      // Log it
      const res = await svc.logHabit({
        habit_id: habitId,
        occurred_at: new Date().toISOString(),
      })
      r = res.ok ? { ok: true } : { ok: false, error: res.error.message }
    }
    if (!r.ok) return r

    // Refresh stats for this habit
    const base = get().habits.find((h) => h.id === habitId)
    if (base) {
      const withStats = await hydrateStats(base)
      set((s) => ({ habits: s.habits.map((h) => h.id === habitId ? withStats : h) }))
    }
    return { ok: true }
  },

  async skipToday(habitId) {
    const dateStr = svc.getLocalDateString()
    const res = await svc.skipHabit(habitId, dateStr)
    if (!res.ok) return { ok: false, error: res.error.message }
    const base = get().habits.find((h) => h.id === habitId)
    if (base) {
      const withStats = await hydrateStats(base)
      set((s) => ({ habits: s.habits.map((h) => h.id === habitId ? withStats : h) }))
    }
    return { ok: true }
  },

  async wipeAll() {
    const r = await svc.wipeAllHabits()
    if (!r.ok) return { ok: false, error: r.error.message }
    set({ habits: [] })
    return { ok: true, deleted: r.value.deleted }
  },
}))
