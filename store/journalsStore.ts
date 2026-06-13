import { create } from 'zustand'
import * as svc from '@features/journals/services'
import type { Journal, CreateJournalInput, UpdateJournalInput } from '@features/journals/types'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type JournalsState = {
  journals: Journal[]
  loadState: LoadState
  lastError: string | null

  loadJournals: () => Promise<void>
  createJournal: (input: CreateJournalInput) => Promise<{ ok: boolean; journal?: Journal; error?: string }>
  updateJournal: (input: UpdateJournalInput) => Promise<{ ok: boolean; journal?: Journal; error?: string }>
  deleteJournal: (id: string) => Promise<{ ok: boolean; error?: string }>
  restoreJournal: (id: string) => Promise<{ ok: boolean; error?: string }>
  wipeAll: () => Promise<{ ok: boolean; deleted?: number; error?: string }>
}

export const useJournalsStore = create<JournalsState>((set, get) => ({
  journals: [],
  loadState: 'idle',
  lastError: null,

  async loadJournals() {
    if (get().loadState === 'loading') return
    set({ loadState: 'loading' })
    const r = await svc.loadJournals()
    if (r.ok) {
      set({ journals: r.value, loadState: 'ready', lastError: null })
    } else {
      set({ loadState: 'error', lastError: r.error.message })
    }
  },

  async createJournal(input) {
    const r = await svc.createJournal(input)
    if (r.ok) {
      set((s) => ({ journals: [r.value, ...s.journals] }))
      return { ok: true, journal: r.value }
    }
    return { ok: false, error: r.error.message }
  },

  async updateJournal(input) {
    const r = await svc.updateJournal(input)
    if (r.ok) {
      set((s) => ({
        journals: s.journals.map((j) => j.id === r.value.id ? r.value : j),
      }))
      return { ok: true, journal: r.value }
    }
    return { ok: false, error: r.error.message }
  },

  async deleteJournal(id) {
    const r = await svc.deleteJournal(id)
    if (r.ok) {
      set((s) => ({ journals: s.journals.filter((j) => j.id !== id) }))
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async restoreJournal(id) {
    const r = await svc.restoreJournal(id)
    if (r.ok) {
      set((s) => ({
        journals: [r.value, ...s.journals].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()),
      }))
      return { ok: true }
    }
    return { ok: false, error: r.error.message }
  },

  async wipeAll() {
    const r = await svc.wipeAllJournals()
    if (r.ok) {
      set({ journals: [] })
      return { ok: true, deleted: r.value.deleted }
    }
    return { ok: false, error: r.error.message }
  },
}))
