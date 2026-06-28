import { userContextPromptBlock, withUserContext, setUserContextCache } from '../services/ai/userContextPrompt'
import type { UserContextEntry } from '../features/context/types'

function entry(partial: Partial<UserContextEntry>): UserContextEntry {
  return {
    id: partial.id ?? 'id',
    user_id: 'u1',
    kind: partial.kind ?? 'fact',
    content: partial.content ?? '',
    pinned: partial.pinned ?? 0,
    created_at: '2026-06-20T00:00:00.000Z',
    updated_at: '2026-06-20T00:00:00.000Z',
    deleted_at: partial.deleted_at ?? null,
    synced_at: null,
  }
}

describe('user context prompt block', () => {
  afterEach(() => {
    setUserContextCache([])
  })

  it('returns an empty string when there are no memories', () => {
    setUserContextCache([])
    expect(userContextPromptBlock()).toBe('')
  })

  it('leaves a system prompt unchanged when no memories exist', () => {
    setUserContextCache([])
    expect(withUserContext('SYSTEM')).toBe('SYSTEM')
  })

  it('formats memories with kind labels and a heading', () => {
    setUserContextCache([
      entry({ id: 'g', kind: 'goal', content: 'Save 50M this year' }),
      entry({ id: 'p', kind: 'preference', content: 'Reply briefly' }),
      entry({ id: 'f', kind: 'fact', content: 'I work night shifts' }),
    ])

    const block = userContextPromptBlock()
    expect(block).toContain('USER MEMORY')
    expect(block).toContain('- Goal: Save 50M this year')
    expect(block).toContain('- Preference: Reply briefly')
    expect(block).toContain('- Fact: I work night shifts')
  })

  it('appends the block to a system prompt when memories exist', () => {
    setUserContextCache([entry({ id: 'g', kind: 'goal', content: 'Save more' })])
    const merged = withUserContext('SYSTEM')
    expect(merged.startsWith('SYSTEM')).toBe(true)
    expect(merged).toContain('- Goal: Save more')
  })

  it('skips soft-deleted and blank entries', () => {
    setUserContextCache([
      entry({ id: 'd', kind: 'fact', content: 'gone', deleted_at: '2026-06-20T00:00:00.000Z' }),
      entry({ id: 'b', kind: 'fact', content: '   ' }),
    ])
    expect(userContextPromptBlock()).toBe('')
  })

  it('selects relevant memories for the current question', () => {
    setUserContextCache([
      entry({ id: 'g', kind: 'goal', content: 'Save 50M for a laptop' }),
      entry({ id: 'f', kind: 'fact', content: 'I work night shifts' }),
      entry({ id: 'p', kind: 'preference', content: 'Reply briefly' }),
      entry({ id: 'x', kind: 'fact', content: 'I want to practice guitar' }),
    ])

    const block = userContextPromptBlock({ query: 'How is my spending and budget?', maxEntries: 3 })
    expect(block).toContain('Save 50M for a laptop')
    expect(block).toContain('I work night shifts')
    expect(block).toContain('Reply briefly')
    expect(block).not.toContain('practice guitar')
  })

  it('keeps pinned memories even when the question is about another domain', () => {
    setUserContextCache([
      entry({ id: 'pinned', kind: 'fact', content: 'Avoid advice after 10pm', pinned: 1 }),
      entry({ id: 'x', kind: 'fact', content: 'I want to practice guitar' }),
    ])

    const block = userContextPromptBlock({ query: 'Review my finance budget', maxEntries: 1 })
    expect(block).toContain('Avoid advice after 10pm')
    expect(block).not.toContain('practice guitar')
  })
})
