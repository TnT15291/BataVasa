import { useEffect } from 'react'
import { useRemindersStore } from '@store/remindersStore'

export function useRemindersBootstrap() {
  const loadState = useRemindersStore((s) => s.loadState)
  const loadReminders = useRemindersStore((s) => s.loadReminders)
  useEffect(() => {
    if (loadState === 'idle') loadReminders()
  }, [loadState, loadReminders])
  return loadState !== 'ready'
}

export function useReminders() {
  return useRemindersStore((s) => s.reminders)
}

export function useReminderActions() {
  const createReminder = useRemindersStore((s) => s.createReminder)
  const updateReminder = useRemindersStore((s) => s.updateReminder)
  const skipReminder = useRemindersStore((s) => s.skipReminder)
  const deleteReminder = useRemindersStore((s) => s.deleteReminder)
  return { createReminder, updateReminder, skipReminder, deleteReminder }
}
