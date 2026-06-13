import { create } from 'zustand'
import * as svc from '@features/reminders/services'
import type { Reminder, CreateReminderInput, UpdateReminderInput } from '@features/reminders/types'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type RemindersState = {
  reminders: Reminder[]
  loadState: LoadState
  lastError: string | null

  loadReminders: () => Promise<void>
  createReminder: (input: CreateReminderInput) => Promise<{ ok: boolean; error?: string }>
  updateReminder: (input: UpdateReminderInput) => Promise<{ ok: boolean; error?: string }>
  skipReminder: (id: string) => Promise<{ ok: boolean; error?: string }>
  deleteReminder: (id: string) => Promise<{ ok: boolean; error?: string }>
  restoreReminder: (id: string) => Promise<{ ok: boolean; error?: string }>
  wipeAll: () => Promise<{ ok: boolean; deleted?: number; error?: string }>
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
  reminders: [],
  loadState: 'idle',
  lastError: null,

  async loadReminders() {
    if (get().loadState === 'loading') return
    set({ loadState: 'loading' })
    const r = await svc.loadReminders()
    if (r.ok) {
      set({ reminders: r.value, loadState: 'ready', lastError: null })
    } else {
      set({ loadState: 'error', lastError: r.error.message })
    }
  },

  async createReminder(input) {
    const r = await svc.createReminder(input)
    if (r.ok) {
      set((s) => ({ reminders: [...s.reminders, r.value] }))
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async updateReminder(input) {
    const r = await svc.updateReminder(input)
    if (r.ok) {
      set((s) => ({
        reminders: s.reminders.map((rem) => rem.id === r.value.id ? r.value : rem),
      }))
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async skipReminder(id) {
    const r = await svc.skipReminder(id)
    if (r.ok) {
      set((s) => ({
        reminders: s.reminders.map((rem) => rem.id === r.value.id ? r.value : rem),
      }))
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async deleteReminder(id) {
    const r = await svc.deleteReminder(id)
    if (r.ok) {
      set((s) => ({ reminders: s.reminders.filter((rem) => rem.id !== id) }))
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async restoreReminder(id) {
    const r = await svc.restoreReminder(id)
    if (r.ok) {
      set((s) => ({
        reminders: [...s.reminders, r.value].sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()),
      }))
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async wipeAll() {
    const r = await svc.wipeAllReminders()
    if (r.ok) {
      set({ reminders: [] })
      return { ok: true, deleted: r.value.deleted }
    }
    return { ok: false, error: r.error.message }
  },
}))
