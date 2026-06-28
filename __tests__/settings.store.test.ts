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
  locationAccess: false,
  aiAutoConfirm: true,
  syncFinance: true,
  syncReminders: true,
  syncHabits: true,
  syncJournals: true,
  syncGoals: true,
  syncContext: true,
  hasSeenOnboarding: false,
  biometricLock: false,
  hideJournals: false,
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
      location_access: 'true',
      ai_auto_confirm: 'false',
      sync_finance: 'false',
      sync_reminders: 'false',
      sync_habits: 'true',
      sync_journals: 'false',
      sync_goals: 'false',
      sync_context: 'false',
      has_seen_onboarding: 'true',
      biometric_lock: 'true',
      hide_journals: 'true',
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
      syncGoals: false,
      syncContext: false,
      hasSeenOnboarding: true,
      biometricLock: true,
      hideJournals: true,
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

  it('persists hidden journal privacy mode', async () => {
    const useSettingsStore = loadStore()
    useSettingsStore.setState(defaults)

    await useSettingsStore.getState().setHideJournals(true)

    expect(useSettingsStore.getState().hideJournals).toBe(true)
    expect(mockQueries.setSetting).toHaveBeenCalledWith('hide_journals', 'true')
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

  it('keeps an explicit currency choice when the language changes', async () => {
    const useSettingsStore = loadStore()
    useSettingsStore.setState(defaults)

    // User deliberately picks a currency that is not the language default…
    await useSettingsStore.getState().setCurrency('USD')
    jest.clearAllMocks()

    // …then switches language. Currency must survive.
    await useSettingsStore.getState().setLanguage('ja')

    expect(useSettingsStore.getState()).toEqual(expect.objectContaining({
      language: 'ja',
      currency: 'USD',
      displayCurrency: 'VND',
    }))
    expect(mockQueries.setSetting).toHaveBeenCalledWith('language', 'ja')
    expect(mockQueries.setSetting).not.toHaveBeenCalledWith('currency', 'JPY')
    expect(mockQueries.setSetting).not.toHaveBeenCalledWith('display_currency', 'JPY')
  })

  it('treats currency diverging from the language default as explicit on load', async () => {
    const useSettingsStore = loadStore()
    useSettingsStore.setState(defaults)
    mockQueries.getAllSettings.mockResolvedValueOnce({
      language: 'en',
      currency: 'VND',
    })

    await useSettingsStore.getState().loadSettings()
    jest.clearAllMocks()
    await useSettingsStore.getState().setLanguage('ja')

    // Loaded currency (VND) ≠ language default (USD) → inferred explicit → not clobbered.
    expect(useSettingsStore.getState().currency).toBe('VND')
    expect(mockQueries.setSetting).not.toHaveBeenCalledWith('currency', 'JPY')
  })
})
