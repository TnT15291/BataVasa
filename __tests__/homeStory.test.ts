import { buildHomeStoryFallback, type HomeStorySnapshot } from '../services/ai/homeStory'

const base: HomeStorySnapshot = {
  language: 'vi',
  focus: 'Today: pay rent',
  money: 'Safe-to-spend: 800k',
  habits: 'All habits done',
  tasks: 'No tasks waiting',
  journal: 'No journal yet',
  risks: [],
}

describe('buildHomeStoryFallback', () => {
  it('leads with the first risk when one is present', () => {
    const line = buildHomeStoryFallback({ ...base, risks: ['Over by 18%', 'Goal slow'] })
    expect(line.startsWith('Over by 18%')).toBe(true)
    // only the single most pressing risk leads; it is not a dump of all risks
    expect(line).not.toContain('Goal slow')
  })

  it('falls back to focus + goal when there is no risk', () => {
    const line = buildHomeStoryFallback({ ...base, goal: 'Save 50M: 16%' })
    expect(line).toContain('Today: pay rent')
    expect(line).toContain('Save 50M: 16%')
  })

  it('falls back to focus + money when there is neither risk nor goal', () => {
    const line = buildHomeStoryFallback(base)
    expect(line).toContain('Today: pay rent')
    expect(line).toContain('Safe-to-spend: 800k')
  })
})
