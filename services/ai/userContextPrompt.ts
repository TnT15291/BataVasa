import type { ContextKind, UserContextEntry } from '@features/context/types'

const KIND_LABEL: Record<ContextKind, string> = {
  goal: 'Goal',
  preference: 'Preference',
  fact: 'Fact',
}

// Cap how many memories enter a prompt: keep token cost bounded and avoid
// drowning the actual data context. Pinned entries already sort first.
const MAX_ENTRIES = 25

// Lightweight in-memory cache of the user's AI memory, kept in sync by the
// context store (see store/contextStore.ts). Deliberately decoupled from the
// store/service/DB layer so this module — imported by every generative AI
// builder — never drags the SQLite chain into AI prompt code or its tests.
let cached: UserContextEntry[] = []

/** Replace the cached AI memory. Called by the store whenever entries change. */
export function setUserContextCache(entries: UserContextEntry[]): void {
  cached = entries
}

/**
 * The AI memory block: stable goals/preferences/facts the user asked the
 * assistant to remember. Returns '' when there is nothing to inject so callers
 * can append unconditionally. Reads the cache populated at app start and on
 * every context mutation.
 */
export function userContextPromptBlock(): string {
  const entries = cached.filter((e) => !e.deleted_at && e.content.trim())
  if (entries.length === 0) return ''

  const lines = entries
    .slice(0, MAX_ENTRIES)
    .map((e) => `- ${KIND_LABEL[e.kind]}: ${e.content.trim()}`)

  return `USER MEMORY (stable facts, goals, and preferences the user told you to remember; honor them and never contradict them; do not invent new ones):\n${lines.join('\n')}`
}

/**
 * Append the user-memory block to a generative AI system prompt. No-op when the
 * user has no saved memories. Use only for generative surfaces (insights,
 * reports, review, chat, coach) — never for deterministic parsers.
 */
export function withUserContext(systemPrompt: string): string {
  const block = userContextPromptBlock()
  return block ? `${systemPrompt}\n\n${block}` : systemPrompt
}
