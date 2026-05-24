import { create } from 'zustand'
import { AppState } from 'react-native'
import * as Linking from 'expo-linking'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@services/supabase'
import { logger } from '@services/logger'
import { track } from '@services/analytics'
import { getTranslations } from '@services/i18n'
import { localizeAuthError } from '@services/authErrors'
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
  recoveryMode: boolean // a password-recovery link is being completed (overrides routing)

  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ ok: boolean }>
  signUp: (email: string, password: string) => Promise<{ ok: boolean; needsConfirm?: boolean }>
  resetPassword: (email: string) => Promise<{ ok: boolean }>
  // Recovery link → establish the temporary session, then force a new password.
  enterRecovery: (accessToken: string, refreshToken: string) => Promise<{ ok: boolean }>
  updatePassword: (newPassword: string) => Promise<{ ok: boolean }>
  exitRecovery: () => Promise<void>
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
  recoveryMode: false,

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
      } else if (event === 'PASSWORD_RECOVERY') {
        // Fired by Supabase when a recovery link auto-detects a session (web).
        // On native we drive this via the deep-link handler + enterRecovery.
        set({ recoveryMode: true })
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
      set({ busy: false, error: localizeAuthError(error, getTranslations()) })
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
      set({ busy: false, error: localizeAuthError(error, getTranslations()) })
      return { ok: false }
    }
    track('auth_signup')
    set({ busy: false })
    // No session means email confirmation is required before sign-in.
    return { ok: true, needsConfirm: !data.session }
  },

  async resetPassword(email) {
    if (!supabase) return { ok: false }
    set({ busy: true, error: null })
    // The recovery email link must deep-link back into the app so the user can
    // set a new password. This URL MUST be in Supabase → Auth → URL Configuration
    // → Redirect URLs (see docs/security.md#password-recovery).
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('reset-password'),
    })
    if (error) {
      set({ busy: false, error: localizeAuthError(error, getTranslations()) })
      return { ok: false }
    }
    set({ busy: false })
    return { ok: true }
  },

  // Establish the temporary session carried by a recovery link's tokens, then
  // flag recoveryMode so routing shows the "set new password" screen instead of
  // dropping the user straight into the app.
  async enterRecovery(accessToken, refreshToken) {
    if (!supabase) return { ok: false }
    set({ busy: true, error: null })
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) {
      logger.error(MODULE, 'enterRecovery setSession failed', { error: error.message })
      set({ busy: false, error: localizeAuthError(error, getTranslations()) })
      return { ok: false }
    }
    set({ busy: false, recoveryMode: true })
    return { ok: true }
  },

  async updatePassword(newPassword) {
    if (!supabase) return { ok: false }
    set({ busy: true, error: null })
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      set({ busy: false, error: localizeAuthError(error, getTranslations()) })
      return { ok: false }
    }
    track('auth_password_reset')
    // Session is already valid → clearing recoveryMode drops the user into the app.
    set({ busy: false, recoveryMode: false })
    return { ok: true }
  },

  // User backed out of the recovery flow without setting a password. The link
  // already authenticated them, so sign out to return to a clean login state.
  async exitRecovery() {
    set({ recoveryMode: false, error: null })
    if (supabase) await supabase.auth.signOut()
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
