// Mock module chain: smartEntry → aiLanguage → settingsStore → expo-sqlite
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('../database/core/db', () => ({ nowIso: () => '', getDB: jest.fn() }))
jest.mock('../database/settings/queries', () => ({ getAllSettings: jest.fn().mockResolvedValue({}) }))
jest.mock('../services/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

import { extractAmount } from '../services/ai/smartEntry'

describe('extractAmount — VND', () => {
  const vnd = 'VND'

  it('parses "50k"', () => expect(extractAmount('Cafe 50k', vnd)).toBe(50_000))
  it('parses "1.5k"', () => expect(extractAmount('taxi 1.5k', vnd)).toBe(1_500))
  it('parses "2tr"', () => expect(extractAmount('2tr tiền nhà', vnd)).toBe(2_000_000))
  it('parses "2 triệu"', () => expect(extractAmount('2 triệu tiền nhà', vnd)).toBe(2_000_000))
  it('parses "1.5 triệu"', () => expect(extractAmount('1.5 triệu', vnd)).toBe(1_500_000))
  it('parses "2M"', () => expect(extractAmount('2M vnd', vnd)).toBe(2_000_000))
  it('parses raw number ≥100', () => expect(extractAmount('50000 đ cơm', vnd)).toBe(50_000))
  it('parses "1 ngàn"', () => expect(extractAmount('nước 1 ngàn', vnd)).toBe(1_000))
  it('returns null for text with no amount', () => expect(extractAmount('mua đồ', vnd)).toBeNull())
  it('returns null for zero amount "0k"', () => expect(extractAmount('0k', vnd)).toBeNull())
})

describe('extractAmount — USD', () => {
  const usd = 'USD'

  // raw number needs ≥3 digits; "50" (2 digits) doesn't match
  it('returns null for "50" (too short for raw match)', () => expect(extractAmount('coffee 50', usd)).toBeNull())
  it('parses "500" → 50000 cents', () => expect(extractAmount('dinner 500', usd)).toBe(50_000))
  it('parses "1k" → 100000 cents', () => expect(extractAmount('rent 1k', usd)).toBe(100_000))
  it('parses "2.5k" → 250000 cents', () => expect(extractAmount('2.5k groceries', usd)).toBe(250_000))
})

describe('extractAmount — JPY', () => {
  const jpy = 'JPY'

  it('parses "500" → 50000 cents (×100)', () => expect(extractAmount('lunch 500', jpy)).toBe(50_000))
  it('parses "1k" → 100000 cents', () => expect(extractAmount('taxi 1k yen', jpy)).toBe(100_000))
})
