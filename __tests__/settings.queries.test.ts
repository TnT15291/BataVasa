const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
}

jest.mock('../database/core/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
  nowIso: () => '2026-01-01T00:00:00.000Z',
}))

import { getAllSettings, getSetting, setSetting } from '../database/settings/queries'

beforeEach(() => jest.clearAllMocks())

describe('settings queries', () => {
  it('gets a stored setting or null', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ value: 'vi' }).mockResolvedValueOnce(null)

    await expect(getSetting('language')).resolves.toBe('vi')
    await expect(getSetting('missing')).resolves.toBeNull()

    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      'SELECT value FROM app_settings WHERE key = ?',
      ['language']
    )
  })

  it('persists settings with an updated timestamp', async () => {
    await setSetting('hide_mic_permission_prompt', 'true')

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      ['hide_mic_permission_prompt', 'true', '2026-01-01T00:00:00.000Z']
    )
  })

  it('loads all settings as a key-value object', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { key: 'language', value: 'en' },
      { key: 'sync_reminders', value: 'false' },
    ])

    await expect(getAllSettings()).resolves.toEqual({
      language: 'en',
      sync_reminders: 'false',
    })
    expect(mockDb.getAllAsync).toHaveBeenCalledWith('SELECT key, value FROM app_settings')
  })
})
