jest.mock('../services/ai/openai', () => ({
  chatCompletion: jest.fn(),
}))

import { chatCompletion } from '../services/ai/openai'
import { answerAppGuideQuestion, getPresetAppGuideAnswer } from '../services/appGuide'

const mockChat = chatCompletion as jest.Mock

describe('appGuide', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('answers common Vietnamese app questions from presets', async () => {
    await expect(answerAppGuideQuestion('App làm được gì?', 'vi')).resolves.toContain('trợ lý đời sống')
    await expect(answerAppGuideQuestion('Setup app cần làm gì?', 'vi')).resolves.toContain('Setup cơ bản')
    await expect(answerAppGuideQuestion('API key hoạt động thế nào?', 'vi')).resolves.toContain('Supabase Edge Function Secrets')

    expect(mockChat).not.toHaveBeenCalled()
  })

  it('matches sync/offline questions with a preset answer', () => {
    expect(getPresetAppGuideAnswer('Dữ liệu có đồng bộ Supabase không?', 'vi')).toContain('offline')
  })

  it('falls back to AI for non-preset app questions', async () => {
    mockChat.mockResolvedValueOnce('Fallback answer')

    await expect(answerAppGuideQuestion('Dark mode đổi ở đâu?', 'vi')).resolves.toBe('Fallback answer')

    expect(mockChat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: 'Dark mode đổi ở đâu?' }),
      ]),
      expect.objectContaining({ temperature: 0.2, max_tokens: 500 })
    )
  })
})
