import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency } from './aiLanguage'
import { extractAmount, hasMultipleAmounts } from './smartEntry'

export type UniversalModule = 'finance' | 'reminder' | 'habits' | 'journal'

export type FinanceEntry = {
  module: 'finance'
  amount_cents: number
  direction: 'expense' | 'income'
  category_hint: string
  merchant: string
  note: string
  occurred_at: string
}

export type ReminderEntry = {
  module: 'reminder'
  title: string
  remind_at: string
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  note: string
}

export type HabitsEntry = {
  module: 'habits'
  title: string
  frequency: string
}

export type JournalEntry = {
  module: 'journal'
  content: string
}

export type UniversalEntry = FinanceEntry | ReminderEntry | HabitsEntry | JournalEntry

export type UniversalCandidate = {
  id: string
  entry: UniversalEntry
  confidence: number
  reason: string
  selectedByDefault: boolean
}

function getLocalTzOffset(): string {
  const offsetMin = -new Date().getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

function toLocalISOString(d: Date): string {
  const tzOffset = getLocalTzOffset()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tzOffset}`
  )
}

function fixReminderTimezone(isoStr: string): Date {
  if (isoStr.endsWith('Z') || isoStr.endsWith('z')) {
    const utc = new Date(isoStr)
    const wallStr = isoStr.replace(/Z$/i, getLocalTzOffset())
    const local = new Date(wallStr)
    if (!isNaN(local.getTime())) return local
    return utc
  }
  return new Date(isoStr)
}

function normalizeAIISOString(isoStr: string | undefined, fallback: Date): string {
  if (!isoStr) return fallback.toISOString()
  const d = new Date(isoStr)
  return isNaN(d.getTime()) ? fallback.toISOString() : d.toISOString()
}

function extractJson(raw: string): unknown | null {
  const objectStart = raw.indexOf('{')
  const arrayStart = raw.indexOf('[')
  const starts = [objectStart, arrayStart].filter((n) => n >= 0)
  if (starts.length === 0) return null
  const start = Math.min(...starts)
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'))
  if (end <= start) return null
  return JSON.parse(raw.slice(start, end + 1))
}

function textHasEmotion(text: string): boolean {
  return /\b(vui|buồn|hạnh phúc|tự hào|cảm thấy|cảm xúc|căng thẳng|lo lắng|biết ơn|happy|sad|proud|grateful|stressed|anxious)\b/i.test(text)
}

function textHasIncomeIntent(text: string): boolean {
  return /\b(thu|nhận|lương|làm ra|kiếm|doanh thu|income|earned|received|salary|revenue)\b/i.test(text)
}

function textHasFinanceIntent(text: string): boolean {
  return textHasIncomeIntent(text) || /\b(chi|mua|tiêu|trả|bán|spent|bought|paid|sold)\b/i.test(text)
}

function normalizeConfidence(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!isFinite(n)) return fallback
  return Math.max(0, Math.min(1, n))
}

function normalizeEntry(entry: any, now: Date, localAmount: number | null): UniversalEntry | null {
  if (!entry?.module) return null

  if (entry.module === 'finance') {
    const amount = Math.abs(Number(entry.amount_cents))
    if (!amount || amount <= 0) return null
    const normalized: FinanceEntry = {
      module: 'finance',
      amount_cents: Math.round(amount),
      direction: entry.direction === 'income' ? 'income' : 'expense',
      category_hint: String(entry.category_hint || (entry.direction === 'income' ? 'Other Income' : 'Shopping')),
      merchant: String(entry.merchant || ''),
      note: String(entry.note || ''),
      occurred_at: normalizeAIISOString(entry.occurred_at, now),
    }
    if (localAmount !== null) {
      const ratio = normalized.amount_cents / localAmount
      if (ratio >= 10 || ratio <= 0.1) normalized.amount_cents = localAmount
    }
    return normalized
  }

  if (entry.module === 'reminder') {
    if (!entry.title) return null
    const remindAt = fixReminderTimezone(String(entry.remind_at || ''))
    const fallback = new Date(now)
    fallback.setDate(fallback.getDate() + 1)
    fallback.setHours(9, 0, 0, 0)
    const normalized: ReminderEntry = {
      module: 'reminder',
      title: String(entry.title),
      remind_at: isNaN(remindAt.getTime()) || remindAt < now ? fallback.toISOString() : remindAt.toISOString(),
      recurrence: ['none', 'daily', 'weekly', 'monthly'].includes(entry.recurrence) ? entry.recurrence : 'none',
      note: String(entry.note || ''),
    }
    return normalized
  }

  if (entry.module === 'habits') {
    if (!entry.title) return null
    return {
      module: 'habits',
      title: String(entry.title),
      frequency: String(entry.frequency || 'daily'),
    }
  }

  if (entry.module === 'journal') {
    const content = String(entry.content || '').trim()
    if (!content) return null
    return { module: 'journal', content }
  }

  return null
}

function candidateId(entry: UniversalEntry): string {
  if (entry.module === 'finance') return `finance:${entry.direction}:${entry.amount_cents}:${entry.merchant}`
  if (entry.module === 'reminder') return `reminder:${entry.title}:${entry.remind_at}`
  if (entry.module === 'habits') return `habits:${entry.title}`
  return `journal:${entry.content.slice(0, 48)}`
}

function dedupeCandidates(candidates: UniversalCandidate[]): UniversalCandidate[] {
  const seenModules = new Set<string>()
  const seenIds = new Set<string>()
  const result: UniversalCandidate[] = []
  for (const c of candidates) {
    if (c.entry.module === 'finance') {
      // Finance allows multiple entries (different transactions); dedupe by id only
      if (seenIds.has(c.id)) continue
      seenIds.add(c.id)
    } else {
      if (seenModules.has(c.entry.module)) continue
      seenModules.add(c.entry.module)
    }
    result.push(c)
  }
  return result.sort((a, b) => b.confidence - a.confidence)
}

export async function parseUniversalCandidates(text: string): Promise<UniversalCandidate[]> {
  const language = getAILanguage()
  const currency = getAICurrency()
  const now = new Date()
  const localNow = toLocalISOString(now)
  const tzOffset = getLocalTzOffset()
  const multiAmounts = hasMultipleAmounts(text)
  // When the input has multiple amounts (multiple transactions), skip per-entry localAmount
  // override to avoid applying the first extracted amount to all entries.
  const localAmount = multiAmounts ? null : extractAmount(text, currency)

  const prompt = `Classify the user input and extract candidate entries. Return ONLY valid JSON.

User input: "${text}"
Current local time: ${localNow}
User timezone: UTC${tzOffset}
Language: ${language}
Currency: ${currency}
${localAmount !== null ? `Pre-computed amount: ${localAmount} ${currency} - use this for amount_cents` : ''}

IMPORTANT: All datetime values MUST use the user's timezone offset (UTC${tzOffset}), NOT UTC. Example: "18:00" in the user's time -> "2026-05-18T18:00:00${tzOffset}"

Classification rules:
- finance: mentions money/amount/spent/bought/received/sold/chi/mua/tieu/thu
- reminder: mentions future time/date + task/meeting/appointment/hop/nhac/lich/remind
- habits: recurring behavior goal without specific time (exercise/eat/sleep/read/thoi quen/tap/uong)
- journal: reflection/diary/memory/feeling without action items (nho/cam xuc/ghi lai/ky niem)
- MULTIPLE TRANSACTIONS: If the input contains multiple separate finance events (e.g. "ăn cơm 15k và uống nước 20k", "coffee 30k and taxi 50k"), return ONE finance candidate PER transaction, each with its own amount_cents, category_hint, and merchant. Do NOT merge them or pick only the first.
- If the input clearly contains both a financial event and a personal feeling/reflection, also add a journal candidate.
- If the input is ambiguous between modules, return multiple candidates with confidence scores.
- Do not create duplicate candidates for non-finance modules.

Return this JSON shape:
{"candidates":[{"confidence":0.0-1.0,"reason":"short reason","selectedByDefault":true|false,"entry":<one entry>}]}

Finance entry: {"module":"finance","amount_cents":<positive int>,"direction":"expense|income","category_hint":"<english category name>","merchant":"<store or empty string>","note":"<note or empty string>","occurred_at":"<ISO datetime with UTC${tzOffset} offset>"}
Reminder entry: {"module":"reminder","title":"<short task title>","remind_at":"<ISO datetime with UTC${tzOffset} offset>","recurrence":"none|daily|weekly|monthly","note":"<note or empty string>"}
Habits entry: {"module":"habits","title":"<habit name>","frequency":"daily|weekly|custom"}
Journal entry: {"module":"journal","content":"<full text>"}

Common finance categories: Food & Groceries, Transport, Housing, Utilities, Healthcare, Dining Out, Entertainment, Shopping, Subscriptions, Salary, Freelance, Other Income, Emergency Fund, Investments`

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a JSON-only intent classifier. The user writes in ${language}. Return ONLY valid JSON, nothing else. Never add explanation. Always use UTC${tzOffset} for datetime values.`,
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.1, max_tokens: 700 }
    )

    const parsed = extractJson(raw) as any
    if (!parsed) return []

    const rawCandidates = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.candidates)
      ? parsed.candidates
      : [parsed]

    const candidates: UniversalCandidate[] = []
    for (const rawCandidate of rawCandidates) {
      const entry = normalizeEntry(rawCandidate.entry ?? rawCandidate, now, localAmount)
      if (!entry) continue
      // Journal content must always equal the user's exact original text — AI output
      // often corrupts tonal-language diacritics (e.g. Vietnamese ấ→á, ồ→ổ) when
      // paraphrasing, and the raw input is always the correct source of truth here.
      if (entry.module === 'journal') entry.content = text
      candidates.push({
        id: candidateId(entry),
        entry,
        confidence: normalizeConfidence(rawCandidate.confidence, 0.7),
        reason: String(rawCandidate.reason || ''),
        selectedByDefault: rawCandidate.selectedByDefault !== false,
      })
    }

    const hasFinance = candidates.some((c) => c.entry.module === 'finance')
    const hasJournal = candidates.some((c) => c.entry.module === 'journal')

    if (localAmount !== null && textHasFinanceIntent(text) && !hasFinance && textHasIncomeIntent(text)) {
      const entry: FinanceEntry = {
        module: 'finance',
        amount_cents: localAmount,
        direction: 'income',
        category_hint: /lương|salary/i.test(text) ? 'Salary' : 'Other Income',
        merchant: '',
        note: text,
        occurred_at: now.toISOString(),
      }
      candidates.push({ id: candidateId(entry), entry, confidence: 0.75, reason: 'Detected income amount', selectedByDefault: true })
    }

    const hasFinanceAfterGuard = candidates.some((c) => c.entry.module === 'finance')
    if (localAmount !== null && textHasEmotion(text) && hasFinanceAfterGuard && !hasJournal) {
      const entry: JournalEntry = { module: 'journal', content: text }
      candidates.push({ id: candidateId(entry), entry, confidence: 0.72, reason: 'Detected personal feeling with financial event', selectedByDefault: true })
    }

    return dedupeCandidates(candidates)
  } catch {
    return []
  }
}

export async function parseUniversalEntry(text: string): Promise<UniversalEntry | null> {
  const candidates = await parseUniversalCandidates(text)
  return candidates[0]?.entry ?? null
}
