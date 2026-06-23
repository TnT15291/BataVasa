export const MOOD_ICONS = {
  great: '\u{1F604}',
  good: '\u{1F642}',
  neutral: '\u{1F610}',
  low: '\u{1F615}',
  bad: '\u{1F61E}',
} as const

export const FINANCE_MOOD_OPTIONS = [
  { value: 'great', emoji: MOOD_ICONS.great },
  { value: 'good', emoji: MOOD_ICONS.good },
  { value: 'neutral', emoji: MOOD_ICONS.neutral },
  { value: 'low', emoji: MOOD_ICONS.low },
  { value: 'bad', emoji: MOOD_ICONS.bad },
] as const

export const JOURNAL_MOOD_OPTIONS = [
  { value: 1, emoji: MOOD_ICONS.bad },
  { value: 2, emoji: MOOD_ICONS.low },
  { value: 3, emoji: MOOD_ICONS.neutral },
  { value: 4, emoji: MOOD_ICONS.good },
  { value: 5, emoji: MOOD_ICONS.great },
] as const

export const MOOD_EMOJI_BY_SCORE: Record<number, string> = Object.fromEntries(
  JOURNAL_MOOD_OPTIONS.map((m) => [m.value, m.emoji])
)
