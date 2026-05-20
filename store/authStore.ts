import { create } from 'zustand'
import { AppState } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@services/supabase'
import { logger } from '@services/logger'
import { track } from '@services/analytics'
import { useFinanceStore } from './financeStore'
import { useRemindersStore } from './remindersStore'
import { useHabitsStore } from './habitsStore'
import { useJournalsStore } from './journalsStore'

const MODULE = 'auth.store'

// Reload module caches from SQLite after sign-in (auth state change → re-load,
// per docs/security.md#authentication).
function reloadAllStores() {
  void useFinanceStore.getState().loadCategories()
  void useFinanceStore.getState().loadTransactions()
  void useRemindersStore.getState().loadReminders()
  void useHabitsStore.getState().loadHabits()
  void useJournalsStore.getState().loadJournals()
}

// Sign-out clears in-memory state but NEVER touches SQLite (data stays for next
// sign-in on this device; explicit "Delete all data" is the only hard delete).
function clearAllStores() {
  useFinanceStore.setState({ transactions: [], categories: [] })
  useRemindersStore.setState({ reminders: [] })
  useHabitsStore.setState({ habits: [] })
  useJournalsStore.setState({ journals: [] })
}

type AuthState = {
  session: Session | null
  configured: boolean   // Supabase env keys present
  initialized: boolean  // finished checking for an existing session
  busy: boolean         // a sign-in/up/out request is in flight
  error: string | null

  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ ok: boolean }>
  signUp: (email: string, password: string) => Promise<{ ok: boolean; needsConfirm?: boolean }>
  signOut: () => Promise<void>
  clearError: () => void
}

let started = false

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  configured: isSupabaseConfigured,
  initialized: false,
  busy: false,
  error: null,

  async init() {
    if (started) return
    started = true

    if (!supabase) {
      set({ configured: false, initialized: true })
      return
    }
    // Local const so TS keeps the non-null narrowing inside deferred callbacks.
    const client = supabase

    try {
      const { data } = await client.auth.getSession()
      set({ session: data.session })
    } catch (e) {
      logger.error(MODULE, 'getSession failed', { error: String(e) })
    }

    client.auth.onAuthStateChange((event, session) => {
      set({ session })
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) reloadAllStores()
      } else if (event === 'SIGNED_OUT') {
        clearAllStores()
      }
    })

    // Keep the access token fresh only while the app is foregrounded.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh()
      else client.auth.stopAutoRefresh()
    })
    client.auth.startAutoRefresh()

    set({ initialized: true })
  },

  async signIn(email, password) {
    if (!supabase) return { ok: false }
    set({ busy: true, error: null })
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      set({ busy: false, error: error.message })
      return { ok: false }
    }
    track('auth_login')
    set({ busy: false })
    return { ok: true }
  },

  async signUp(email, password) {
    if (!supabase) return { ok: false }
    set({ busy: true, error: null })
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })
    if (error) {
      set({ busy: false, error: error.message })
      return { ok: false }
    }
    track('auth_signup')
    set({ busy: false })
    // No session means email confirmation is required before sign-in.
    return { ok: true, needsConfirm: !data.session }
  },

  async signOut() {
    if (!supabase) return
    set({ busy: true })
    await supabase.auth.signOut()
    track('auth_logout')
    set({ busy: false, session: null })
  },

  clearError() {
    set({ error: null })
  },
}))
