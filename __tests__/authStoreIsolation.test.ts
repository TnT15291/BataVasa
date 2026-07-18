jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
  Platform: { OS: 'android' },
}))
jest.mock('expo-web-browser', () => ({}))
jest.mock('../services/supabase', () => ({ supabase: null, isSupabaseConfigured: false }))
jest.mock('../services/googleAuth', () => ({
  isNativeGoogleAvailable: jest.fn(() => false),
  configureGoogleSignin: jest.fn(),
  nativeGoogleSignIn: jest.fn(),
  nativeGoogleSignOut: jest.fn(),
}))
jest.mock('../services/expoGo', () => ({ isExpoGo: jest.fn(() => false) }))
jest.mock('../services/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('../services/analytics', () => ({ track: jest.fn() }))
jest.mock('../services/i18n', () => ({ getTranslations: () => ({}) }))
jest.mock('../services/authErrors', () => ({ localizeAuthError: (error: Error) => error.message }))
jest.mock('../services/authDeepLinks', () => ({
  extractAuthParams: jest.fn(),
  getGoogleAuthRedirectTo: jest.fn(),
  getPasswordRecoveryRedirectTo: jest.fn(),
}))

jest.mock('../store/financeStore', () => { const state = { loadCategories: jest.fn(), loadTransactions: jest.fn() }; return { useFinanceStore: { getState: () => state, setState: jest.fn() } } })
jest.mock('../store/remindersStore', () => { const state = { loadReminders: jest.fn() }; return { useRemindersStore: { getState: () => state, setState: jest.fn() } } })
jest.mock('../store/habitsStore', () => { const state = { loadHabits: jest.fn() }; return { useHabitsStore: { getState: () => state, setState: jest.fn() } } })
jest.mock('../store/journalsStore', () => { const state = { loadJournals: jest.fn() }; return { useJournalsStore: { getState: () => state, setState: jest.fn() } } })
jest.mock('../store/goalsStore', () => { const state = { loadGoals: jest.fn() }; return { useGoalsStore: { getState: () => state, setState: jest.fn() } } })
jest.mock('../store/contextStore', () => { const state = { loadContext: jest.fn() }; return { useContextStore: { getState: () => state, setState: jest.fn() } } })

import { clearAllStores, reloadAllStores } from '../store/authStore'
import { useFinanceStore } from '../store/financeStore'
import { useRemindersStore } from '../store/remindersStore'
import { useHabitsStore } from '../store/habitsStore'
import { useJournalsStore } from '../store/journalsStore'
import { useGoalsStore } from '../store/goalsStore'
import { useContextStore } from '../store/contextStore'

describe('auth store account isolation', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reloads every user-scoped store after sign-in', () => {
    reloadAllStores()
    expect(useFinanceStore.getState().loadCategories).toHaveBeenCalled()
    expect(useFinanceStore.getState().loadTransactions).toHaveBeenCalled()
    expect(useRemindersStore.getState().loadReminders).toHaveBeenCalled()
    expect(useHabitsStore.getState().loadHabits).toHaveBeenCalled()
    expect(useJournalsStore.getState().loadJournals).toHaveBeenCalled()
    expect(useGoalsStore.getState().loadGoals).toHaveBeenCalled()
    expect(useContextStore.getState().loadContext).toHaveBeenCalled()
  })

  it('clears goals and AI context on sign-out', () => {
    clearAllStores()
    expect(useGoalsStore.setState).toHaveBeenCalledWith({ goals: [], selectedGoal: null, loadState: 'idle', lastError: null })
    expect(useContextStore.setState).toHaveBeenCalledWith({ entries: [], loadState: 'idle', lastError: null })
  })
})
