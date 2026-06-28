import { create } from 'zustand'
import * as svc from '@features/goals/services'
import { getTranslations } from '@services/i18n'
import { toast } from '@store/toastStore'
import type { CreateGoalInput, GoalWithProgress, UpdateGoalInput } from '@features/goals/types'

// Celebrate goals that flipped active → done between two snapshots (auto-complete
// on reaching target, or a manual mark-done). First load has an empty `prev`, so
// long-finished goals don't re-toast on app open.
function celebrateNewlyCompleted(prev: GoalWithProgress[], next: GoalWithProgress[]): void {
  const prevStatus = new Map(prev.map((g) => [g.id, g.status]))
  for (const g of next) {
    if (g.status === 'done' && prevStatus.get(g.id) === 'active') {
      toast.success(getTranslations().goal_completed_toast.replace('{{title}}', g.title))
    }
  }
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type GoalsState = {
  goals: GoalWithProgress[]
  selectedGoal: GoalWithProgress | null
  loadState: LoadState
  lastError: string | null
  loadGoals: () => Promise<void>
  loadGoal: (id: string) => Promise<void>
  createGoal: (input: CreateGoalInput) => Promise<{ ok: boolean; id?: string; error?: string }>
  updateGoal: (input: UpdateGoalInput) => Promise<{ ok: boolean; error?: string }>
  deleteGoal: (id: string) => Promise<{ ok: boolean; error?: string }>
  restoreGoal: (id: string) => Promise<{ ok: boolean; error?: string }>
  wipeAll: () => Promise<{ ok: boolean; deleted?: number; error?: string }>
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  selectedGoal: null,
  loadState: 'idle',
  lastError: null,

  async loadGoals() {
    if (get().loadState === 'loading') return
    const prev = get().goals
    set({ loadState: 'loading' })
    const r = await svc.loadGoals()
    if (!r.ok) {
      set({ loadState: 'error', lastError: r.error.message })
      return
    }
    set({ goals: r.value, loadState: 'ready', lastError: null })
    celebrateNewlyCompleted(prev, r.value)
  },

  async loadGoal(id) {
    const r = await svc.getGoal(id)
    if (!r.ok) {
      set({ selectedGoal: null, lastError: r.error.message })
      return
    }
    set({ selectedGoal: r.value, lastError: null })
  },

  async createGoal(input) {
    const r = await svc.createGoal(input)
    if (!r.ok) return { ok: false, error: r.error.message }
    set((s) => ({ goals: [r.value, ...s.goals] }))
    return { ok: true, id: r.value.id }
  },

  async updateGoal(input) {
    const prevStatus = get().goals.find((g) => g.id === input.id)?.status
    const r = await svc.updateGoal(input)
    if (!r.ok) return { ok: false, error: r.error.message }
    set((s) => ({
      goals: s.goals.map((g) => g.id === r.value.id ? r.value : g),
      selectedGoal: s.selectedGoal?.id === r.value.id ? r.value : s.selectedGoal,
    }))
    if (r.value.status === 'done' && prevStatus === 'active') {
      toast.success(getTranslations().goal_completed_toast.replace('{{title}}', r.value.title))
    }
    return { ok: true }
  },

  async deleteGoal(id) {
    const r = await svc.deleteGoal(id)
    if (!r.ok) return { ok: false, error: r.error.message }
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id), selectedGoal: s.selectedGoal?.id === id ? null : s.selectedGoal }))
    return { ok: true }
  },

  async restoreGoal(id) {
    const r = await svc.restoreGoal(id)
    if (!r.ok) return { ok: false, error: r.error.message }
    set((s) => ({ goals: [r.value, ...s.goals] }))
    return { ok: true }
  },

  async wipeAll() {
    const r = await svc.wipeAllGoals()
    if (!r.ok) return { ok: false, error: r.error.message }
    set({ goals: [], selectedGoal: null })
    return { ok: true, deleted: r.value.deleted }
  },
}))
