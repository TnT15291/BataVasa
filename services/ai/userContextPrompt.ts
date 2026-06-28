import type { ContextKind, UserContextEntry } from '@features/context/types'

const KIND_LABEL: Record<ContextKind, string> = {
  goal: 'Goal',
  preference: 'Preference',
  fact: 'Fact',
}

export type UserMemoryDomain = 'finance' | 'habits' | 'journals' | 'tasks' | 'goals' | 'profile'

export type UserContextPromptOptions = {
  /** The user's current question or a compact surface-specific context. */
  query?: string
  /** Domain hints for screens that know what kind of advice they are asking for. */
  domains?: UserMemoryDomain[]
  /** Keep token cost bounded for short surfaces such as home cards. */
  maxEntries?: number
}

const DOMAIN_KEYWORDS: Record<UserMemoryDomain, string[]> = {
  finance: [
    'finance', 'money', 'spend', 'spending', 'expense', 'income', 'budget', 'saving', 'save', 'debt', 'bill', 'salary',
    'tai chinh', 'tien', 'chi', 'thu', 'tieu', 'ngan sach', 'tiet kiem', 'no', 'hoa don', 'luong',
  ],
  habits: [
    'habit', 'habits', 'routine', 'streak', 'sleep', 'workout', 'gym', 'exercise',
    'thoi quen', 'chuoi', 'ngu', 'tap', 'the duc',
  ],
  journals: [
    'journal', 'journals', 'mood', 'feeling', 'emotion', 'stress', 'reflect', 'diary',
    'nhat ky', 'tam trang', 'cam xuc', 'cang thang', 'suy nghi',
  ],
  tasks: [
    'task', 'tasks', 'reminder', 'reminders', 'deadline', 'due', 'overdue', 'priority', 'work',
    'cong viec', 'nhiem vu', 'nhac', 'qua han', 'uu tien',
  ],
  goals: [
    'goal', 'goals', 'target', 'objective', 'progress', 'plan', 'improve',
    'muc tieu', 'ke hoach', 'tien do', 'cai thien',
  ],
  profile: [
    'preference', 'prefer', 'tone', 'style', 'fact', 'profile', 'schedule', 'shift', 'family', 'work', 'life',
    'so thich', 'thich', 'phong cach', 'lich', 'ca dem', 'gia dinh', 'cuoc song',
  ],
}

// Legacy upper bound for broad prompts. Selective callers should pass a smaller
// maxEntries value so memory stays helpful without dominating the prompt.
const MAX_ENTRIES = 25
const DEFAULT_RETRIEVAL_MAX = 8

// Lightweight in-memory cache of the user's AI memory, kept in sync by the
// context store (see store/contextStore.ts). Deliberately decoupled from the
// store/service/DB layer so this module never drags SQLite into prompt builders.
let cached: UserContextEntry[] = []

/** Replace the cached AI memory. Called by the store whenever entries change. */
export function setUserContextCache(entries: UserContextEntry[]): void {
  cached = entries
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  return Array.from(new Set(normalize(text).split(/\s+/).filter((w) => w.length >= 3)))
}

function scoreEntry(entry: UserContextEntry, tokens: string[], domains: UserMemoryDomain[]): number {
  let score = entry.pinned ? 12 : 0
  if (entry.kind === 'preference') score += 3
  if (entry.kind === 'goal' && domains.includes('goals')) score += 4

  const text = normalize(entry.content)
  for (const token of tokens) {
    if (text.includes(token)) score += 3
  }

  for (const domain of domains) {
    for (const raw of DOMAIN_KEYWORDS[domain]) {
      const keyword = normalize(raw)
      if (keyword && text.includes(keyword)) score += 2
    }
  }

  return score
}

function inferDomains(query: string): UserMemoryDomain[] {
  const text = normalize(query)
  const inferred = (Object.keys(DOMAIN_KEYWORDS) as UserMemoryDomain[]).filter((domain) =>
    DOMAIN_KEYWORDS[domain].some((raw) => {
      const keyword = normalize(raw)
      return keyword && text.includes(keyword)
    })
  )

  if (!inferred.includes('goals')) inferred.push('goals')
  if (!inferred.includes('profile')) inferred.push('profile')
  return inferred
}

function selectEntries(entries: UserContextEntry[], options: UserContextPromptOptions): UserContextEntry[] {
  const active = entries.filter((e) => !e.deleted_at && e.content.trim())
  if (active.length === 0) return []

  const hasRetrieval = !!options.query?.trim() || !!options.domains?.length || options.maxEntries !== undefined
  const maxEntries = Math.max(1, Math.min(options.maxEntries ?? (hasRetrieval ? DEFAULT_RETRIEVAL_MAX : MAX_ENTRIES), MAX_ENTRIES))
  const domains = options.domains ?? (options.query?.trim() ? inferDomains(options.query) : [])
  const tokens = tokenize([
    options.query ?? '',
    ...domains.flatMap((domain) => DOMAIN_KEYWORDS[domain]),
  ].join(' '))

  if (!hasRetrieval || (tokens.length === 0 && domains.length === 0)) {
    return active.slice(0, maxEntries)
  }

  return active
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens, domains) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (a.entry.pinned !== b.entry.pinned) return b.entry.pinned - a.entry.pinned
      return b.entry.updated_at.localeCompare(a.entry.updated_at)
    })
    .slice(0, maxEntries)
    .map(({ entry }) => entry)
}

/**
 * The AI memory block: stable goals/preferences/facts the user asked the
 * assistant to remember. Returns '' when there is nothing relevant to inject.
 */
export function userContextPromptBlock(options: UserContextPromptOptions = {}): string {
  const entries = selectEntries(cached, options)
  if (entries.length === 0) return ''

  const lines = entries.map((e) => `- ${KIND_LABEL[e.kind]}: ${e.content.trim()}`)

  return `USER MEMORY (stable facts, goals, and preferences the user told you to remember; honor them and never contradict them; do not invent new ones):\n${lines.join('\n')}`
}

/**
 * Append the user-memory block to a generative AI system prompt. No-op when the
 * user has no relevant saved memories. Use only for generative surfaces
 * (insights, reports, review, chat, coach), never for deterministic parsers.
 */
export function withUserContext(systemPrompt: string, options: UserContextPromptOptions = {}): string {
  const block = userContextPromptBlock(options)
  return block ? `${systemPrompt}\n\n${block}` : systemPrompt
}
