// AI response parsers: deterministic post-processing of chatCompletion output.
// We mock the LLM call and feed valid + malformed fixture JSON.
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('../database/settings/queries', () => ({ getAllSettings: jest.fn().mockResolvedValue({}) }))
jest.mock('../services/ai/openai', () => ({ chatCompletion: jest.fn() }))
jest.mock('../services/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

import { chatCompletion } from '../services/ai/openai'
import { parseReminderEntry } from '../services/ai/reminderParser'
import { parseHabitLog } from '../services/ai/habitParser'
import { parseJournalEntry } from '../services/ai/journalParser'

const mockChat = chatCompletion as jest.MockedFunction<typeof chatCompletion>

beforeEach(() => mockChat.mockReset())

describe('parseReminderEntry', () => {
  it('parses a full valid reminder', async () => {
    mockChat.mockResolvedValue(JSON.stringify({
      title: 'Họp team',
      note: 'phòng A',
      remind_at: '2026-05-21T09:00:00.000Z',
      advance_minutes: 30,
      recurrence: 'weekly',
    }))
    const r = await parseReminderEntry('nhắc họp team mai 9h, trước 30 phút')
    expect(r).toEqual({
      title: 'Họp team',
      note: 'phòng A',
      remind_at: '2026-05-21T09:00:00.000Z',
      advance_minutes: 30,
      recurrence: 'weekly',
    })
  })

  it('extracts JSON embedded in surrounding prose', async () => {
    mockChat.mockResolvedValue('Sure! {"title":"Uống thuốc","remind_at":"2026-05-21T20:00:00Z"} done')
    const r = await parseReminderEntry('uống thuốc 8h tối')
    expect(r?.title).toBe('Uống thuốc')
    expect(r?.advance_minutes).toBe(0)
    expect(r?.recurrence).toBe('none')
  })

  it('clamps negative advance_minutes to 0', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ title: 'X', remind_at: '2026-05-21T09:00:00Z', advance_minutes: -5 }))
    expect((await parseReminderEntry('x'))?.advance_minutes).toBe(0)
  })

  it('coerces non-numeric advance_minutes to 0', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ title: 'X', remind_at: '2026-05-21T09:00:00Z', advance_minutes: 'soon' }))
    expect((await parseReminderEntry('x'))?.advance_minutes).toBe(0)
  })

  it('defaults an invalid recurrence to "none"', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ title: 'X', remind_at: '2026-05-21T09:00:00Z', recurrence: 'yearly' }))
    expect((await parseReminderEntry('x'))?.recurrence).toBe('none')
  })

  it('returns null when title is missing', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ remind_at: '2026-05-21T09:00:00Z' }))
    expect(await parseReminderEntry('x')).toBeNull()
  })

  it('returns null when remind_at is missing', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ title: 'X' }))
    expect(await parseReminderEntry('x')).toBeNull()
  })

  it('returns null for output containing no JSON object', async () => {
    mockChat.mockResolvedValue('I could not understand that request.')
    expect(await parseReminderEntry('x')).toBeNull()
  })

  it('returns null for malformed JSON', async () => {
    mockChat.mockResolvedValue('{title: "X", remind_at: }')
    expect(await parseReminderEntry('x')).toBeNull()
  })
})

describe('parseHabitLog', () => {
  it('parses a matched habit log', async () => {
    mockChat.mockResolvedValue(JSON.stringify({
      matched_habit_id: 'h1',
      matched_habit_name: 'Morning run',
      occurred_at: '2026-05-20T08:00:00Z',
      note: '5km',
    }))
    const r = await parseHabitLog('chạy bộ sáng nay 5km', [])
    expect(r).toEqual({
      matched_habit_id: 'h1',
      matched_habit_name: 'Morning run',
      occurred_at: '2026-05-20T08:00:00Z',
      note: '5km',
    })
  })

  it('preserves null matched_habit_id and defaults empty note', async () => {
    mockChat.mockResolvedValue(JSON.stringify({
      matched_habit_id: null,
      matched_habit_name: 'Reading',
      occurred_at: '2026-05-20T08:00:00Z',
    }))
    const r = await parseHabitLog('read', [])
    expect(r?.matched_habit_id).toBeNull()
    expect(r?.note).toBe('')
  })

  it('returns null when matched_habit_name is missing', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ occurred_at: '2026-05-20T08:00:00Z' }))
    expect(await parseHabitLog('x', [])).toBeNull()
  })

  it('returns null when occurred_at is missing', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ matched_habit_name: 'Run' }))
    expect(await parseHabitLog('x', [])).toBeNull()
  })

  it('returns null for malformed JSON', async () => {
    mockChat.mockResolvedValue('not json at all')
    expect(await parseHabitLog('x', [])).toBeNull()
  })
})

describe('parseJournalEntry', () => {
  it('parses content with an in-range mood', async () => {
    mockChat.mockResolvedValue(JSON.stringify({
      content: 'Hôm nay mệt nhưng ổn',
      mood: 3,
      is_important: 0,
      occurred_at: '2026-05-20T21:00:00Z',
    }))
    const r = await parseJournalEntry('hôm nay mệt')
    expect(r).toEqual({
      content: 'Hôm nay mệt nhưng ổn',
      mood: 3,
      is_important: 0,
      occurred_at: '2026-05-20T21:00:00Z',
    })
  })

  it('rounds a fractional mood', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ content: 'ok', mood: 4.4, occurred_at: '2026-05-20T21:00:00Z' }))
    expect((await parseJournalEntry('x'))?.mood).toBe(4)
  })

  it('nulls a mood outside the 1-5 range', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ content: 'ok', mood: 9, occurred_at: '2026-05-20T21:00:00Z' }))
    expect((await parseJournalEntry('x'))?.mood).toBeNull()
  })

  it('keeps mood null when omitted', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ content: 'ok', occurred_at: '2026-05-20T21:00:00Z' }))
    expect((await parseJournalEntry('x'))?.mood).toBeNull()
  })

  it('returns null when content is missing', async () => {
    mockChat.mockResolvedValue(JSON.stringify({ occurred_at: '2026-05-20T21:00:00Z' }))
    expect(await parseJournalEntry('x')).toBeNull()
  })

  it('returns null for malformed JSON', async () => {
    mockChat.mockResolvedValue('{ broken')
    expect(await parseJournalEntry('x')).toBeNull()
  })
})
