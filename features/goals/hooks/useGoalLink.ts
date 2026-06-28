import { useEffect, useMemo } from 'react'
import { useGoalsStore } from '@store/goalsStore'

export type GoalLink = {
  goalId: string
  percent: number
  reached: boolean
  done: boolean
}

/** Loads goals once if they have not been fetched yet (guarded by load state). */
export function useGoalsBootstrap(): void {
  const loadState = useGoalsStore((s) => s.loadState)
  const loadGoals = useGoalsStore((s) => s.loadGoals)
  useEffect(() => {
    if (loadState === 'idle') void loadGoals()
  }, [loadState, loadGoals])
}

/**
 * The first non-archived goal that measures the given habit/category, with that
 * measure's own progress. Powers the 🎯 badge on habit/category rows and the
 * "set as goal" entry point. Returns null when nothing tracks it yet.
 */
export function useGoalLink(module: 'finance' | 'habits', id: string | null | undefined): GoalLink | null {
  useGoalsBootstrap()
  const goals = useGoalsStore((s) => s.goals)
  return useMemo(() => {
    if (!id) return null
    for (const g of goals) {
      if (g.status === 'archived') continue
      const mp = g.measureProgress.find((m) =>
        (module === 'finance' && m.binding.module === 'finance' && m.binding.category_id === id) ||
        (module === 'habits' && m.binding.module === 'habits' && m.binding.habit_id === id)
      )
      if (mp) return { goalId: g.id, percent: mp.progress.percent, reached: mp.progress.status === 'reached', done: g.status === 'done' }
    }
    return null
  }, [goals, module, id])
}
