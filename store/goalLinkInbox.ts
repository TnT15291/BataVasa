import { create } from 'zustand'

// A one-shot hand-off used when the user creates a habit/category from the goal
// form via the full editor screen: the editor drops the new row's id here, and
// the still-mounted goal form picks it up and adds it as a measure, then clears.
export type PendingMeasure = { kind: 'finance' | 'habits'; id: string }

type GoalLinkInbox = {
  pending: PendingMeasure | null
  push: (measure: PendingMeasure) => void
  clear: () => void
}

export const useGoalLinkInbox = create<GoalLinkInbox>((set) => ({
  pending: null,
  push: (measure) => set({ pending: measure }),
  clear: () => set({ pending: null }),
}))
