import { useEffect } from 'react'
import { useHabitsStore } from '@store/habitsStore'

export function useHabitsBootstrap() {
  const loadState = useHabitsStore((s) => s.loadState)
  const loadHabits = useHabitsStore((s) => s.loadHabits)
  useEffect(() => {
    if (loadState === 'idle') loadHabits()
  }, [loadState, loadHabits])
  return loadState !== 'ready'
}

export function useHabits() {
  return useHabitsStore((s) => s.habits)
}

export function useHabitActions() {
  const createHabit = useHabitsStore((s) => s.createHabit)
  const updateHabit = useHabitsStore((s) => s.updateHabit)
  const deleteHabit = useHabitsStore((s) => s.deleteHabit)
  const restoreHabit = useHabitsStore((s) => s.restoreHabit)
  const toggleTodayLog = useHabitsStore((s) => s.toggleTodayLog)
  const skipToday = useHabitsStore((s) => s.skipToday)
  return { createHabit, updateHabit, deleteHabit, restoreHabit, toggleTodayLog, skipToday }
}
