const mockQueries = {
  getAllSettings: jest.fn(),
  setSetting: jest.fn(),
}

const defaults = {
  language: 'vi' as const,
  currency: 'VND',
  displayCurrency: 'VND',
  colorMode: 'system' as const,
  themeName: 'default' as const,
  aiProvider: 'openai' as const,
  locationAccess: false,
  aiAutoConfirm: true,
  syncFinance: true,
  syncReminders: true,
  syncHabits: true,
  syncJournals: true,
  hasSeenOnboarding: false,
  biometricLock: false,
  hideMicPermissionPrompt: false,
  loaded: false,
}

function loadStore() {
  jest.resetModules()
  jest.doMock('@db/settings/queries', () => mockQueries)
  jest.doMock('../database/settings/queries', () => mockQueries)
  return require('../store/settingsStore').useSettingsStore as typeof import('../store/settingsStore').useSettingsStore
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('settings store', () => {
  it('loads persisted toggles and privacy preferences', async () => {
    const useSettingsStore = loadStore()
    useSettingsStore.setState(defaults)
    mockQueries.getAllSettings.mockResolvedValueOnce({
      language: 'en',
      currency: 'USD',
      display_currency: 'EUR',
      color_mode: 'dark',
      theme_name: 'ocean',
      ai_provider: 'openai',
      location_access: 'true',
      ai_auto_confirm: 'false',
      sync_finance: 'false',
      sync_reminders: 'false',
      sync_habits: 'true',
      sync_journals: 'false',
      has_seen_onboarding: 'true',
      biometric_lock: 'true',
      hide_mic_permission_prompt: 'true',
    })

    await useSettingsStore.getState().loadSettings()

    expect(useSettingsStore.getState()).toEqual(expect.objectContaining({
      language: 'en',
      currency: 'USD',
      displayCurrency: 'EUR',
      colorMode: 'dark',
      themeName: 'ocean',
      locationAccess: true,
      aiAutoConfirm: false,
      syncFinance: false,
      syncReminders: false,
      syncHabits: true,
      syncJournals: false,
      hasSeenOnboarding: true,
      biometricLock: true,
      hideMicPermissionPrompt: true,
      loaded: true,
    }))
  })

  it('persists microphone prompt dismissal', async () => {
    const useSettingsStore = loadStore()
    useSettingsStore.setState(defaults)

    await useSettingsStore.getState().setHideMicPermissionPrompt(true)

    expect(useSettingsStore.getState().hideMicPermissionPrompt).toBe(true)
    expect(mockQueries.setSetting).toHaveBeenCalledWith('hide_mic_permission_prompt', 'true')
  })

  it('updates locale currency defaults when language changes', async () => {
    const useSettingsStore = loadStore()
    useSettingsStore.setState(defaults)

    await useSettingsStore.getState().setLanguage('ja')

    expect(useSettingsStore.getState()).toEqual(expect.objectContaining({
      language: 'ja',
      currency: 'JPY',
      displayCurrency: 'JPY',
    }))
    expect(mockQueries.setSetting).toHaveBeenCalledWith('language', 'ja')
    expect(mockQueries.setSetting).toHaveBeenCalledWith('currency', 'JPY')
    expect(mockQueries.setSetting).toHaveBeenCalledWith('display_currency', 'JPY')
  })
})
