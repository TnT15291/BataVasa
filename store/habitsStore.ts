import { create } from 'zustand'
import * as svc from '@features/habits/services'
import type { Habit, HabitLog, CreateHabitInput, UpdateHabitInput, CreateHabitLogInput } from '@features/habits/types'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type HabitWithStats = Habit & {
  todayCount: number
  streak: number
  strengthScore: number
  dueToday: boolean
  /** Scheduled yesterday but left undone (not skipped) — drives the "never miss twice" nudge. */
  missedYesterday: boolean
  /** Skipped (rested) for today — resolves the entry without counting as done. */
  skippedToday: boolean
}

type HabitsState = {
  habits: HabitWithStats[]
  loadState: LoadState
  lastError: string | null

  loadHabits: () => Promise<void>
  createHabit: (input: CreateHabitInput) => Promise<{ ok: boolean; id?: string; error?: string }>
  updateHabit: (input: UpdateHabitInput) => Promise<{ ok: boolean; error?: string }>
  deleteHabit: (id: string) => Promise<{ ok: boolean; error?: string }>
  restoreHabit: (id: string) => Promise<{ ok: boolean; error?: string }>
  toggleTodayLog: (habitId: string) => Promise<{ ok: boolean; error?: string }>
  skipToday: (habitId: string) => Promise<{ ok: boolean; error?: string }>
  wipeAll: () => Promise<{ ok: boolean; deleted?: number; error?: string }>
}

// One DB query → all five stats (was 4–5 queries via Promise.all). The batched
// loadHabits path uses loadHabitsWithStats; this is the single-habit refresh.
async function hydrateStats(habit: Habit): Promise<HabitWithStats> {
  const stats = await svc.getHabitStats(habit)
  return { ...habit, ...stats }
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  loadState: 'idle',
  lastError: null,

  async loadHabits() {
    if (get().loadState === 'loading') return
    set({ loadState: 'loading' })
    const r = await svc.loadHabitsWithStats()
    if (!r.ok) {
      set({ loadState: 'error', lastError: r.error.message })
      return
    }
    // Keep habits created locally while this load was in flight: the DB snapshot
    // can pre-date their insert, so a plain overwrite would drop a just-created
    // habit (e.g. one added from the goal screen's metric picker). Limited to
    // recently-created rows so a habit deleted elsewhere (sync) isn't resurrected.
    const fetchedIds = new Set(r.value.map((h) => h.id))
    const cutoff = Date.now() - 60_000
    const localOnly = get().habits.filter((h) => !fetchedIds.has(h.id) && new Date(h.created_at).getTime() > cutoff)
    set({ habits: [...r.value, ...localOnly], loadState: 'ready', lastError: null })
  },

  async createHabit(input) {
    const r = await svc.createHabit(input)
    if (!r.ok) return { ok: false, error: r.error.message }
    const withStats = await hydrateStats(r.value)
    set((s) => ({ habits: [...s.habits, withStats] }))
    return { ok: true, id: withStats.id }
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
