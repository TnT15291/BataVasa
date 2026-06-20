import { create } from 'zustand'
import * as svc from '@features/context/services'
import { setUserContextCache } from '@services/ai/userContextPrompt'
import type { CreateContextInput, UpdateContextInput, UserContextEntry } from '@features/context/types'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type ContextState = {
  entries: UserContextEntry[]
  loadState: LoadState
  lastError: string | null
  loadContext: () => Promise<void>
  createEntry: (input: CreateContextInput) => Promise<{ ok: boolean; id?: string; error?: string }>
  updateEntry: (input: UpdateContextInput) => Promise<{ ok: boolean; error?: string }>
  deleteEntry: (id: string) => Promise<{ ok: boolean; error?: string }>
  wipeAll: () => Promise<{ ok: boolean; deleted?: number; error?: string }>
}

export const useContextStore = create<ContextState>((set, get) => ({
  entries: [],
  loadState: 'idle',
  lastError: null,

  async loadContext() {
    if (get().loadState === 'loading') return
    set({ loadState: 'loading' })
    const r = await svc.loadContext()
    if (!r.ok) {
      set({ loadState: 'error', lastError: r.error.message })
      return
    }
    set({ entries: r.value, loadState: 'ready', lastError: null })
  },

  async createEntry(input) {
    const r = await svc.createContext(input)
    if (!r.ok) return { ok: false, error: r.error.message }
    set((s) => ({ entries: sortEntries([r.value, ...s.entries]) }))
    return { ok: true, id: r.value.id }
  },

  async updateEntry(input) {
    const r = await svc.updateContext(input)
    if (!r.ok) return { ok: false, error: r.error.message }
    set((s) => ({ entries: sortEntries(s.entries.map((e) => (e.id === r.value.id ? r.value : e))) }))
    return { ok: true }
  },

  async deleteEntry(id) {
    const r = await svc.deleteContext(id)
    if (!r.ok) return { ok: false, error: r.error.message }
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
    return { ok: true }
  },

  async wipeAll() {
    const r = await svc.wipeAllContext()
    if (!r.ok) return { ok: false, error: r.error.message }
    set({ entries: [] })
    return { ok: true, deleted: r.value.deleted }
  },
}))

function sortEntries(entries: UserContextEntry[]): UserContextEntry[] {
  return [...entries].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned
    return b.updated_at.localeCompare(a.updated_at)
  })
}

// Keep the AI prompt cache mirroring the store so userContextPromptBlock()
// always reflects the latest memories without importing the DB layer.
useContextStore.subscribe((state) => setUserContextCache(state.entries))
