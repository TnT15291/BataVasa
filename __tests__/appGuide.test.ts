jest.mock('../services/ai/openai', () => ({
  chatCompletion: jest.fn(),
}))

import { chatCompletion } from '../services/ai/openai'
import { answerAppGuideQuestion, getAppGuideSamples, getPresetAppGuideAnswer } from '../services/appGuide'

const mockChat = chatCompletion as jest.Mock

describe('appGuide', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('offers user-facing samples instead of technical setup/API prompts', () => {
    const samples = getAppGuideSamples('vi').map((s) => s.question)

    expect(samples).toEqual(expect.arrayContaining([
      'Tinh thần của app là gì?',
      'Dữ liệu cá nhân của tôi có bị lộ không?',
      'App giúp tôi tốt hơn như thế nào?',
      'Tôi dùng các chức năng chính thế nào?',
      'Weekly Review dùng để làm gì?',
    ]))
    expect(samples.join(' ')).not.toMatch(/API|key|Setup/i)
  })

  it('answers common Vietnamese product questions from presets', async () => {
    await expect(answerAppGuideQuestion('Tinh thần của app là gì?', 'vi')).resolves.toContain('bình tĩnh')
    await expect(answerAppGuideQuestion('Dữ liệu cá nhân của tôi có bị lộ không?', 'vi')).resolves.toContain('dữ liệu thuộc về bạn')
    await expect(answerAppGuideQuestion('App giúp tôi tốt hơn như thế nào?', 'vi')).resolves.toContain('better version')

    expect(mockChat).not.toHaveBeenCalled()
  })

  it('still answers technical questions when the user asks them directly', () => {
    expect(getPresetAppGuideAnswer('API key hoạt động thế nào?', 'vi')).toContain('Supabase Edge Function Secrets')
    expect(getPresetAppGuideAnswer('Dữ liệu có đồng bộ Supabase không?', 'vi')).toContain('offline')
  })

  it('answers feature-usage questions from presets before falling back to AI', () => {
    expect(getPresetAppGuideAnswer('Tôi dùng các chức năng chính thế nào?', 'vi')).toContain('Finance')
    expect(getPresetAppGuideAnswer('Dùng tài chính thế nào?', 'vi')).toContain('cà phê 35k')
    expect(getPresetAppGuideAnswer('Weekly Review dùng để làm gì?', 'vi')).toContain('bức tranh tuần')
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
