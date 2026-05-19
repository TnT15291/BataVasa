jest.mock('@sentry/react-native', () => ({ addBreadcrumb: jest.fn() }))
jest.mock('../services/logger', () => ({ logger: { warn: jest.fn() } }))

import * as Sentry from '@sentry/react-native'
import { sanitizeAnalyticsProps, setAnalyticsTransport, track } from '../services/analytics'

describe('analytics', () => {
  afterEach(() => {
    setAnalyticsTransport(null)
    jest.clearAllMocks()
  })

  it('keeps only allow-listed event properties', () => {
    expect(sanitizeAnalyticsProps('transaction_created', {
      category_kind: 'essential',
      source: 'voice',
      extra: 'drop',
    })).toEqual({ category_kind: 'essential', source: 'voice' })
  })

  it('drops PII-shaped keys even if passed by mistake', () => {
    expect(sanitizeAnalyticsProps('feature_used', {
      feature_name: 'voice',
      email: 'user@example.com',
      merchant: 'Cafe',
      amount_cents: 50000,
      location_lat: 10.1,
    })).toEqual({ feature_name: 'voice' })
  })

  it('tracks via breadcrumb and configured transport', () => {
    const transport = jest.fn()
    setAnalyticsTransport(transport)

    track('sync_failed', { table: 'finance_transaction', error_code: 'TIMEOUT' })

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
      category: 'analytics',
      message: 'sync_failed',
      data: { table: 'finance_transaction', error_code: 'TIMEOUT' },
    }))
    expect(transport).toHaveBeenCalledWith('sync_failed', {
      table: 'finance_transaction',
      error_code: 'TIMEOUT',
    })
  })
})
