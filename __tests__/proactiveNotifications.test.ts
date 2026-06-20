const scheduled = [
  { identifier: 'weekly-old', content: { data: { type: 'weekly_review' } } },
  { identifier: 'habit-1', content: { data: { type: 'habit' } } },
]

const mockNotifications = {
  AndroidImportance: { DEFAULT: 'default' },
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}

const mockSettings = {
  proactiveWeeklyReview: true,
  notificationAccess: true,
  proactiveWeeklyDay: 1,
  proactiveWeeklyHour: 9,
}

const mockPermission = jest.fn()

function loadService(platform: 'ios' | 'android' = 'ios') {
  jest.resetModules()
  jest.doMock('expo-notifications', () => mockNotifications)
  jest.doMock('react-native', () => ({ Platform: { OS: platform } }))
  jest.doMock('@services/logger', () => ({ logger: { error: jest.fn() } }))
  jest.doMock('../services/logger', () => ({ logger: { error: jest.fn() } }))
  jest.doMock('@services/i18n', () => ({
    getTranslations: () => ({
      weekly_review_notif_title: 'Your weekly review is ready',
      weekly_review_notif_body: 'See how the week went.',
    }),
  }))
  jest.doMock('../services/i18n', () => ({
    getTranslations: () => ({
      weekly_review_notif_title: 'Your weekly review is ready',
      weekly_review_notif_body: 'See how the week went.',
    }),
  }))
  jest.doMock('@services/notifications', () => ({ requestNotificationPermission: mockPermission }))
  jest.doMock('../services/notifications', () => ({ requestNotificationPermission: mockPermission }))
  jest.doMock('@services/weeklyTeaser', () => ({ buildWeeklyTeaserBody: jest.fn(async () => '') }))
  jest.doMock('../services/weeklyTeaser', () => ({ buildWeeklyTeaserBody: jest.fn(async () => '') }))
  jest.doMock('@store/settingsStore', () => ({
    useSettingsStore: { getState: () => mockSettings },
  }))
  jest.doMock('../store/settingsStore', () => ({
    useSettingsStore: { getState: () => mockSettings },
  }))
  return require('../services/proactiveNotifications') as typeof import('../services/proactiveNotifications')
}

beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(mockSettings, {
    proactiveWeeklyReview: true,
    notificationAccess: true,
    proactiveWeeklyDay: 1,
    proactiveWeeklyHour: 9,
  })
  mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue(scheduled)
  mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined)
  mockNotifications.scheduleNotificationAsync.mockResolvedValue('weekly-new')
  mockNotifications.setNotificationChannelAsync.mockResolvedValue(undefined)
  mockPermission.mockResolvedValue(true)
})

describe('proactive weekly-review notifications', () => {
  it('cancels existing weekly-review notifications without touching other notifications', async () => {
    const { cancelWeeklyReviewNotification } = loadService()

    await cancelWeeklyReviewNotification()

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1)
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weekly-old')
  })

  it('schedules the weekly review when opted in and permission is granted', async () => {
    const { syncWeeklyReviewNotification } = loadService('android')
    mockSettings.proactiveWeeklyDay = 3
    mockSettings.proactiveWeeklyHour = 20

    await expect(syncWeeklyReviewNotification()).resolves.toBe(true)

    expect(mockPermission).toHaveBeenCalled()
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith('weekly-review', expect.objectContaining({
      name: 'Weekly review',
    }))
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weekly-old')
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Your weekly review is ready',
        body: 'See how the week went.',
        data: { type: 'weekly_review' },
      },
      trigger: {
        type: 'weekly',
        weekday: 3,
        hour: 20,
        minute: 0,
        channelId: 'weekly-review',
      },
    })
  })

  it('cancels instead of scheduling when the user has not opted in', async () => {
    const { syncWeeklyReviewNotification } = loadService()
    mockSettings.proactiveWeeklyReview = false

    await expect(syncWeeklyReviewNotification()).resolves.toBe(false)

    expect(mockPermission).not.toHaveBeenCalled()
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weekly-old')
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled()
  })

  it('cancels instead of scheduling when permission is denied', async () => {
    const { syncWeeklyReviewNotification } = loadService()
    mockPermission.mockResolvedValueOnce(false)

    await expect(syncWeeklyReviewNotification()).resolves.toBe(false)

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weekly-old')
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled()
  })
})
