jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}))

import * as Sentry from '@sentry/react-native'
import { logger } from '../services/logger'

describe('logger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('logs info and redacts PII metadata', () => {
    logger.info('finance', 'created', { merchant: 'Cafe', category: 'food' })

    expect(console.log).toHaveBeenCalledWith('[finance]', 'created', {
      merchant: '[redacted]',
      category: 'food',
    })
  })

  it('sends warn breadcrumbs to Sentry', () => {
    logger.warn('sync', 'retry', { email: 'a@example.com', retry: 1 })

    expect(console.warn).toHaveBeenCalledWith('[sync]', 'retry', {
      email: '[redacted]',
      retry: 1,
    })
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warning',
      message: '[sync] retry',
      data: { email: '[redacted]', retry: 1 },
    }))
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('sends error breadcrumbs and messages to Sentry', () => {
    logger.error('sync', 'failed')

    expect(console.error).toHaveBeenCalledWith('[sync]', 'failed', '')
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      message: '[sync] failed',
      data: undefined,
    }))
    expect(Sentry.captureMessage).toHaveBeenCalledWith('[sync] failed', 'error')
  })
})
