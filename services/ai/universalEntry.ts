import { chatCompletion } from './openai'
import { centsToDisplay, getAILanguage, getAICurrency } from './aiLanguage'
import { extractAmount, hasMultipleAmounts } from './smartEntry'
import { extractDateFromText } from '@services/dateParser'
import { logger } from '@services/logger'
import type { DebtDirection, PlanItemRecurrence } from '@features/finance/types'

const MODULE = 'universalEntry'

// The real reason the last parse failed (provider 429/401, "AI not configured",
// network, malformed AI output), so the UI can show it instead of the generic
// "couldn't understand" message. null means the AI responded fine but the input
// simply produced no candidates — that IS the "try rephrasing" case.
let lastParseError: string | null = null
export function getLastUniversalParseError(): string | null {
  return lastParseError
}

export type UniversalModule = 'finance' | 'finance_plan' | 'finance_debt' | 'reminder' | 'habits' | 'journal' | 'goals'

export type FinanceEntry = {
  module: 'finance'
  amount_cents: number
  direction: 'expense' | 'income'
  category_hint: string
  merchant: string
  note: string
  occurred_at: string
}

export type DebtEntry = {
  module: 'finance_debt'
  amount_cents: number
  debt_direction: DebtDirection
  counterparty: string
  due_at: string | null
  occurred_at: string
  note: string
}

export type FinancePlanEntry = {
  module: 'finance_plan'
  amount_cents: number
  kind: 'expense' | 'income'
  name: string
  category_hint: string
  due_day: number
  recurrence: PlanItemRecurrence
  note: string
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
  target_per_period: number
}

export type JournalEntry = {
  module: 'journal'
  content: string
  occurred_at: string
  mood?: number | null
}

export type GoalEntry = {
  module: 'goals'
  title: string
  description: string
  source: 'finance' | 'habits' | 'journals' | 'reminders'
  source_hint: string
  target_value: number
  start_date: string
  due_date: string | null
}

export type UniversalEntry = FinanceEntry | FinancePlanEntry | DebtEntry | ReminderEntry | HabitsEntry | JournalEntry | GoalEntry

// Fields the parse could not extract: the entry carries a sensible default
// instead (or stays empty for counterparty), and the UI must tell the user
// before saving — never silently drop the candidate or error out.
export type MissingField = 'category' | 'date' | 'due_date' | 'counterparty' | 'title' | 'target'

export type UniversalCandidate = {
  id: string
  entry: UniversalEntry
  confidence: number
  reason: string
  selectedByDefault: boolean
  missing: MissingField[]
}

type NormalizedEntry = { entry: UniversalEntry; missing: MissingField[] }

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

function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function textHasJournalEmotion(text: string): boolean {
  const t = foldText(text)
  return /\b(vui|buon|hanh phuc|tu hao|cam thay|toi thay|cam xuc|cang thang|lo lang|biet on|met moi|that vong|phan khoi|happy|sad|proud|grateful|stressed|anxious|excited|tired)\b/.test(t)
}

function inferJournalMood(text: string): number | null {
  const t = foldText(text)
  if (/\b(tuyet voi|hanh phuc|phan khoi|rat vui|very happy|excited|amazing)\b/.test(t)) return 5
  if (/\b(vui|tu hao|biet on|happy|proud|grateful|glad)\b/.test(t)) return 4
  if (/\b(rat buon|tuyet vong|khung khiep|very sad|devastated)\b/.test(t)) return 1
  if (/\b(buon|met moi|cang thang|lo lang|that vong|sad|tired|stressed|anxious|disappointed)\b/.test(t)) return 2
  return null
}

function textHasAmountToken(text: string): boolean {
  const t = foldText(text)
  return /\b\d+(?:[.,]\d+)?\s*(?:d|dong|vnd|k|ngan|nghin|trieu|tr|m|usd|\$)\b/.test(t)
}

function textHasIncomeSignal(text: string): boolean {
  const t = foldText(text)
  return /\b(thu|nhan|luong|lam ra|kiem|doanh thu|income|earned|received|salary|revenue)\b/.test(t)
}

function textHasFinanceSignal(text: string): boolean {
  const t = foldText(text)
  return textHasIncomeSignal(text) || /\b(chi|mua|tieu|tra|thanh toan|ban hang|ban duoc|spent|bought|paid|sold|sell)\b/.test(t)
}

function hasMonthlyPlanIntent(text: string): boolean {
  const t = foldText(text)
  return /\b(thang nay|hang thang|moi thang|dinh ky|lap lai|monthly|recurring|budget|ngan sach)\b/.test(t)
}

function inferPlanRecurrence(text: string): PlanItemRecurrence {
  const t = foldText(text)
  if (/\b(thang nay|this month|current month)\b/.test(t)) return 'once'
  return /\b(hang thang|moi thang|dinh ky|lap lai|recurring|repeats?|every month)\b/.test(t) ? 'monthly' : 'once'
}

function hasGoalIntent(text: string): boolean {
  const t = foldText(text)
  return /\b(goal|target|muc tieu|dat muc|phan dau|save|saving|tiet kiem|hoan thanh)\b/.test(t)
}

function hasDebtIntent(text: string): boolean {
  const t = foldText(text)
  return /\b(vay cua|di vay|muon cua|borrowed from|borrow from|cho .+ vay|lend|lent)\b/.test(t) ||
    /\bvay\s+(?!cua\b)(?=[^\d]{1,80}\d)/.test(t)
}

function debtDirectionFromText(text: string): DebtDirection {
  const t = foldText(text)
  if (/\b(vay cua|di vay|muon cua|borrowed from|borrow from)\b/.test(t) || /\bvay\s+(?!cua\b)(?=[^\d]{1,80}\d)/.test(t)) return 'borrowed'
  return 'lent'
}

function sanitizeFinanceCategoryHint(direction: 'expense' | 'income', hint: string): string {
  const trimmed = hint.trim()
  if (!trimmed) return direction === 'income' ? 'Other Income' : 'Shopping'

  const folded = foldText(trimmed)
  const incomeCategoryHints = new Set(['salary', 'freelance', 'other income', 'borrowing'])
  if (direction === 'expense' && incomeCategoryHints.has(folded)) return 'Shopping'
  return trimmed
}

function extractCounterpartyFromDebtText(text: string): string {
  const amountStart = text.search(/\d/)
  const beforeAmount = amountStart >= 0 ? text.slice(0, amountStart) : text
  const normalizedBeforeAmount = foldText(beforeAmount)
  let candidate: string
  if (/^\s*vay\s+/.test(normalizedBeforeAmount)) {
    const offset = normalizedBeforeAmount.indexOf('vay') + 3
    candidate = beforeAmount.slice(offset).replace(/^\s+của\s+/i, '').replace(/^\s+cua\s+/i, '').trim()
  } else {
    candidate = beforeAmount
      .replace(/^\s*(vay\s+của|vay\s+cua|đi\s+vay|di\s+vay|mượn\s+của|muon\s+cua|cho)\s+/i, '')
      .replace(/\s+vay\s*$/i, '')
      .trim()
  }
  // "cho vay 500k" leaves only the verb behind — that's no name at all.
  return /^(vay|cho vay|di vay|muon|cua)$/.test(foldText(candidate)) ? '' : candidate
}

function extractDebtDueAt(text: string, now: Date): string | null {
  const t = foldText(text)
  const nextMonth = t.match(/\b(?:ngay\s+)?([1-9]|[12]\d|3[01])\s+thang\s+sau\b/)
  const target = new Date(now)
  if (nextMonth) {
    target.setMonth(now.getMonth() + 1, Number(nextMonth[1]))
  } else {
    const dayOnly = t.match(/\b(?:ngay\s+)?([1-9]|[12]\d|3[01])\s*(?:tra|thanh toan|repay|pay back)\b/)
    if (!dayOnly) return null
    target.setDate(Number(dayOnly[1]))
    if (target < now) target.setMonth(target.getMonth() + 1)
  }
  target.setHours(9, 0, 0, 0)
  return target.toISOString()
}

// When the AI returns a merchant/note/title that doesn't appear verbatim in the
// user's original text, the model likely corrupted a diacritic or swapped a vowel
// (e.g. "lý lịch" → "lý lệch"). For optional fields (merchant, note) we can safely
// fall back to `fallback`; for required fields (reminder title) the caller passes
// the AI value as fallback so the entry is still usable.
function restoreVerbatim(original: string, aiValue: string, fallback: string): string {
  if (!aiValue.trim()) return ''
  if (original.includes(aiValue)) return aiValue
  const lower = original.toLowerCase()
  const aiLower = aiValue.toLowerCase()
  if (lower.includes(aiLower)) {
    const idx = lower.indexOf(aiLower)
    return original.slice(idx, idx + aiValue.length)
  }
  return fallback
}

function cleanHabitTitleFromInput(text: string): string | null {
  const cleaned = text
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’.,!?]+$/g, '')
    .replace(/^(?:tạo|tao|thêm|them)\s+(?:thói quen|thoi quen|habit)\s+/i, '')
    .replace(/^(?:thói quen|thoi quen|habit)\s*[:\-]\s*/i, '')
    .trim()

  if (!cleaned) return null
  if (cleaned.length > 48) return null
  if (cleaned.split(/\s+/).length > 6) return null
  if (/\d/.test(cleaned)) return null
  return cleaned
}

function preserveHabitTitleFromInput(text: string, aiTitle: string): string {
  const inputTitle = cleanHabitTitleFromInput(text)
  if (!inputTitle) return aiTitle

  const foldedInput = foldText(inputTitle)
  const foldedAI = foldText(aiTitle).replace(/^u+ong\b/, 'uong')
  const likelySameShortHabit =
    foldedInput === foldedAI ||
    foldedInput.includes(foldedAI) ||
    foldedAI.includes(foldedInput) ||
    (foldedInput.includes('uong') && foldedAI.includes('uong'))

  return likelySameShortHabit ? inputTitle : aiTitle
}

function normalizeHabitTarget(value: unknown, fallback = 1): number {
  const n = Number(value)
  if (!isFinite(n)) return fallback
  return Math.max(1, Math.min(99, Math.round(n)))
}

function normalizeHabitGoalTarget(value: unknown, originalText: string): number {
  const n = Number(value)
  const rounded = Math.round(n)
  const folded = foldText(originalText)
  const hasQuantityUnit = /\b\d+(?:[.,]\d+)?\s*(km|kilometer|kilometre|m|meter|metre|phut|minute|min|gio|hour|h|ngay|day|lan|rep|reps|page|trang)\b/.test(folded)
  if (!isFinite(n) || n <= 0 || rounded < 20 || (hasQuantityUnit && rounded < 50)) return 100
  return Math.min(100, rounded)
}

function clampDueDay(value: unknown): number {
  const n = Number(value)
  if (!isFinite(n)) return new Date().getDate()
  return Math.max(1, Math.min(31, Math.round(n)))
}

function dateOnly(value: unknown, fallback: string): string {
  if (!value) return fallback
  const parsed = new Date(String(value))
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  const raw = String(value).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback
}

function extractPlanNameFromText(text: string): string {
  return text
    .replace(/\d+(?:[.,]\d+)?\s*(?:trieu|triá»‡u|tr|m|k|ngan|ngÃ n|nghin|nghÃ¬n)?/gi, '')
    .replace(/\b(them|thÃªm|khoan|khoáº£n|hang thang|hÃ ng thÃ¡ng|moi thang|má»—i thÃ¡ng|dinh ky|Ä‘á»‹nh ká»³|monthly|recurring|budget|ngan sach|ngÃ¢n sÃ¡ch|expense|income)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function inferHabitTargetFromText(text: string): number {
  const folded = foldText(text)
  const match = folded.match(/\b(\d{1,2})\s*(?:lan|x|times?)\s*(?:\/|\s+)?(?:1\s*)?(?:ngay|day|daily)\b/)
  if (!match) return 1
  return normalizeHabitTarget(match[1])
}

function normalizeDebtEntry(entry: any, now: Date, localAmount: number | null, originalText: string): NormalizedEntry | null {
  const amount = Math.abs(Number(entry.amount_cents))
  const amountCents = localAmount ?? Math.round(amount)
  if (!amountCents || amountCents <= 0) return null
  const missing: MissingField[] = []
  const counterparty = String(entry.counterparty || '').trim() || extractCounterpartyFromDebtText(originalText)
  if (!counterparty) missing.push('counterparty')
  const dueAt = entry.due_at ? normalizeAIISOString(entry.due_at, now) : extractDebtDueAt(originalText, now)
  if (!dueAt) missing.push('due_date')
  return {
    entry: {
      module: 'finance_debt',
      amount_cents: amountCents,
      debt_direction: hasDebtIntent(originalText)
        ? debtDirectionFromText(originalText)
        : entry.debt_direction === 'lent' ? 'lent' : 'borrowed',
      counterparty,
      due_at: dueAt,
      occurred_at: extractDateFromText(originalText).toISOString(),
      note: restoreVerbatim(originalText, String(entry.note || ''), String(entry.note || '')),
    },
    missing,
  }
}

function normalizeFinancePlanEntry(entry: any, localAmount: number | null, originalText: string): NormalizedEntry | null {
  const amount = localAmount ?? Math.round(Math.abs(Number(entry.amount_cents)))
  if (!amount || amount <= 0) return null
  const kind = entry.kind === 'income' || entry.direction === 'income' ? 'income' : 'expense'
  return {
    entry: {
      module: 'finance_plan',
      amount_cents: amount,
      kind,
      name: String(entry.name || '').trim() || extractPlanNameFromText(originalText) || (kind === 'income' ? 'Monthly income' : 'Monthly expense'),
      category_hint: String(entry.category_hint || '').trim(),
      due_day: clampDueDay(entry.due_day),
      recurrence: entry.recurrence === 'monthly' ? 'monthly' : inferPlanRecurrence(originalText),
      note: String(entry.note || '').trim(),
    },
    missing: [],
  }
}

function normalizeGoalEntry(entry: any, now: Date, localAmount: number | null, originalText: string, currency: string): NormalizedEntry | null {
  const missing: MissingField[] = []
  const title = String(entry.title || '').trim() || originalText.trim().slice(0, 120)
  if (!entry.title) missing.push('title')
  if (!title) return null
  const source = ['finance', 'habits', 'journals', 'reminders'].includes(entry.source)
    ? entry.source as GoalEntry['source']
    : localAmount !== null ? 'finance' : 'habits'
  let target = Number(entry.target_value)
  if ((!isFinite(target) || target <= 0) && localAmount !== null && source === 'finance') {
    target = centsToDisplay(localAmount, currency)
  }
  if (!isFinite(target) || target <= 0) {
    target = source === 'habits' ? 100 : 1
    missing.push('target')
  }
  const today = now.toISOString().slice(0, 10)
  return {
    entry: {
      module: 'goals',
      title,
      description: String(entry.description || '').trim(),
      source,
      source_hint: String(entry.source_hint || '').trim(),
      target_value: source === 'habits' ? normalizeHabitGoalTarget(target, originalText) : target,
      start_date: dateOnly(entry.start_date, today),
      due_date: entry.due_date ? dateOnly(entry.due_date, today) : null,
    },
    missing,
  }
}

function normalizeEntry(entry: any, now: Date, localAmount: number | null, originalText: string, currency: string): NormalizedEntry | null {
  if (!entry?.module) return null

  if (entry.module === 'finance') {
    const amount = Math.abs(Number(entry.amount_cents))
    // Without an amount there is no transaction to record — not a finance candidate at all.
    if (!amount || amount <= 0) return null
    if (localAmount === null && !textHasAmountToken(originalText) && !textHasFinanceSignal(originalText)) return null
    if (hasDebtIntent(originalText)) return normalizeDebtEntry(entry, now, localAmount, originalText)
    if (hasMonthlyPlanIntent(originalText)) return normalizeFinancePlanEntry(entry, localAmount, originalText)
    const missing: MissingField[] = []
    if (!String(entry.category_hint || '').trim()) missing.push('category')
    if (!entry.occurred_at) missing.push('date')
    const aiMerchant = String(entry.merchant || '')
    const aiNote = String(entry.note || '')
    const direction = entry.direction === 'income' ? 'income' : 'expense'
    const normalized: FinanceEntry = {
      module: 'finance',
      amount_cents: Math.round(amount),
      direction,
      category_hint: sanitizeFinanceCategoryHint(direction, String(entry.category_hint || '')),
      // Restore verbatim from original to prevent AI diacritic corruption (e.g. lý lịch→lý lệch).
      // merchant falls back to '' (optional); note falls back to AI value (may be valid paraphrase).
      merchant: restoreVerbatim(originalText, aiMerchant, ''),
      note: restoreVerbatim(originalText, aiNote, aiNote),
      occurred_at: normalizeAIISOString(entry.occurred_at, now),
    }
    if (localAmount !== null) {
      const ratio = normalized.amount_cents / localAmount
      if (ratio >= 10 || ratio <= 0.1) normalized.amount_cents = localAmount
    }
    return { entry: normalized, missing }
  }

  if (entry.module === 'finance_plan' || entry.intent === 'plan_item') {
    return normalizeFinancePlanEntry(entry, localAmount, originalText)
  }

  if (entry.module === 'finance_debt' || entry.intent === 'debt') {
    return normalizeDebtEntry(entry, now, localAmount, originalText)
  }

  if (entry.module === 'reminder') {
    const missing: MissingField[] = []
    const aiTitle = String(entry.title || '')
    // Missing title: the user's own words are the best default.
    const title = aiTitle ? restoreVerbatim(originalText, aiTitle, aiTitle) : originalText.trim().slice(0, 200)
    if (!aiTitle) missing.push('title')
    if (!title) return null
    const remindAt = fixReminderTimezone(String(entry.remind_at || ''))
    if (!entry.remind_at || isNaN(remindAt.getTime())) missing.push('date')
    const fallback = new Date(now)
    fallback.setDate(fallback.getDate() + 1)
    fallback.setHours(9, 0, 0, 0)
    const aiNote = String(entry.note || '')
    const normalized: ReminderEntry = {
      module: 'reminder',
      title,
      remind_at: isNaN(remindAt.getTime()) || remindAt < now ? fallback.toISOString() : remindAt.toISOString(),
      recurrence: ['none', 'daily', 'weekly', 'monthly'].includes(entry.recurrence) ? entry.recurrence : 'none',
      note: restoreVerbatim(originalText, aiNote, aiNote),
    }
    return { entry: normalized, missing }
  }

  if (entry.module === 'habits') {
    const missing: MissingField[] = []
    // Missing title: derive one from the user's text instead of dropping the candidate.
    const title = String(entry.title || '') || cleanHabitTitleFromInput(originalText) || originalText.trim().slice(0, 100)
    if (!entry.title) missing.push('title')
    if (!title) return null
    if (!isFinite(Number(entry.target_per_period)) && inferHabitTargetFromText(originalText) <= 1) {
      missing.push('target')
    }
    return {
      entry: {
        module: 'habits',
        title,
        frequency: String(entry.frequency || 'daily'),
        target_per_period: normalizeHabitTarget(entry.target_per_period),
      },
      missing,
    }
  }

  if (entry.module === 'journal') {
    const content = String(entry.content || '').trim() || originalText.trim()
    if (!content) return null
    return { entry: { module: 'journal', content, occurred_at: extractDateFromText(originalText).toISOString(), mood: inferJournalMood(originalText) }, missing: [] }
  }

  if (entry.module === 'goals') {
    return normalizeGoalEntry(entry, now, localAmount, originalText, currency)
  }

  return null
}

function candidateId(entry: UniversalEntry): string {
  if (entry.module === 'finance') return `finance:${entry.direction}:${entry.amount_cents}:${entry.merchant}`
  if (entry.module === 'finance_plan') return `finance_plan:${entry.kind}:${entry.amount_cents}:${entry.name}`
  if (entry.module === 'finance_debt') return `finance_debt:${entry.debt_direction}:${entry.amount_cents}:${entry.counterparty}`
  if (entry.module === 'reminder') return `reminder:${entry.title}:${entry.remind_at}`
  if (entry.module === 'habits') return `habits:${entry.title}`
  if (entry.module === 'goals') return `goals:${entry.title}:${entry.source}:${entry.target_value}`
  return `journal:${entry.content.slice(0, 48)}`
}

function dedupeCandidates(candidates: UniversalCandidate[]): UniversalCandidate[] {
  const seenModules = new Set<string>()
  const seenIds = new Set<string>()
  const result: UniversalCandidate[] = []
  for (const c of candidates) {
    if (c.entry.module === 'finance' || c.entry.module === 'finance_plan' || c.entry.module === 'finance_debt') {
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

export async function parseUniversalCandidates(text: string, priorContext?: string): Promise<UniversalCandidate[]> {
  lastParseError = null
  const language = getAILanguage()
  const currency = getAICurrency()
  const now = new Date()
  const localNow = toLocalISOString(now)
  const tzOffset = getLocalTzOffset()
  const multiAmounts = hasMultipleAmounts(text)
  // When the input has multiple amounts (multiple transactions), skip per-entry localAmount
  // override to avoid applying the first extracted amount to all entries.
  const localAmount = multiAmounts ? null : extractAmount(text, currency)

  const contextBlock = priorContext?.trim()
    ? `\nAlready captured in this session — the user is ADDING to these, not replacing them. Treat the new input as a follow-up: link it to the most relevant existing item (an advance-notice time, a note, or a related task) and compute any relative times against them (e.g. "remind me 30 min before" a 09:00 task -> 08:30). Only return candidates for the NEW input.\n${priorContext.trim()}\n`
    : ''

  const prompt = `Classify the user input and extract candidate entries. Return ONLY valid JSON.

User input: "${text}"
${contextBlock}Current local time: ${localNow}
User timezone: UTC${tzOffset}
Language: ${language}
Currency: ${currency}
${localAmount !== null ? `Pre-computed amount: ${localAmount} ${currency} - use this for amount_cents` : ''}

IMPORTANT: All datetime values MUST use the user's timezone offset (UTC${tzOffset}), NOT UTC. Example: "18:00" in the user's time -> "2026-05-18T18:00:00${tzOffset}"

Classification rules:
- finance: mentions one-time money/amount/spent/bought/received/sold/chi/mua/tieu/thu. Do not invent an amount; if the user did not write a money amount or clear finance intent, do not return finance.
- finance_plan: this-cycle budgets, planned income/expense, recurring bills, safe-to-spend planning (thang nay, hang thang, moi thang, dinh ky, monthly, recurring, budget)
- finance_debt: mentions borrowing or lending money (Vietnamese: vay cua, vay anh Hung, cho ... vay, di vay, muon cua)
- reminder: mentions future time/date + task/meeting/appointment/hop/nhac/lich/remind
- habits: recurring behavior goal without specific time (exercise/eat/sleep/read/thoi quen/tap/uong)
- journal: reflection/diary/memory/feeling without action items (vui/buon/cam thay/toi thay/nho/cam xuc/ghi lai/ky niem). Feeling text without money is journal, not finance.
- goals: explicit personal target/goal with a desired outcome over time (muc tieu, dat muc, phan dau, goal, target, save X by date)
- For goals.source="habits", target_value is completion-rate percent, usually 100 for a completed goal. Never use distance/time/quantity literals like 5km, 30 min, or 10 pages as target_value.
- MULTIPLE TRANSACTIONS: If the input contains multiple separate finance events (e.g. "ăn cơm 15k và uống nước 20k", "coffee 30k and taxi 50k"), return ONE finance candidate PER transaction, each with its own amount_cents, category_hint, and merchant. Do NOT merge them or pick only the first.
- If the input clearly contains both a financial event and a personal feeling/reflection, also add a journal candidate.
- For finance expense entries, never use Salary, Freelance, Borrowing, or Other Income. If unsure, use Shopping.
- If the input is ambiguous between modules, return multiple candidates with confidence scores.
- Do not create duplicate candidates for non-finance modules.

CRITICAL: merchant, note, and title fields MUST be copied VERBATIM from the user input — do NOT rephrase, translate, or change any characters including Vietnamese tone marks and vowel forms. If you cannot copy verbatim, use an empty string.

Return this JSON shape:
{"candidates":[{"confidence":0.0-1.0,"reason":"short reason","selectedByDefault":true|false,"entry":<one entry>}]}

Finance entry: {"module":"finance","amount_cents":<positive int>,"direction":"expense|income","category_hint":"<english category name>","merchant":"<verbatim from input, or ''>","note":"<verbatim from input, or ''>","occurred_at":"<ISO datetime with UTC${tzOffset} offset>"}
Finance plan entry: {"module":"finance_plan","amount_cents":<positive int>,"kind":"expense|income","name":"<short planned item name>","category_hint":"<english category name or ''>","due_day":<1-31>,"recurrence":"once|monthly","note":"<verbatim from input, or ''>"}
Debt entry: {"module":"finance_debt","amount_cents":<positive int>,"debt_direction":"lent|borrowed","counterparty":"<person name>","due_at":"<ISO datetime with UTC${tzOffset} offset or null>","note":"<verbatim from input, or ''>"}
Reminder entry: {"module":"reminder","title":"<verbatim from input, or short extracted task>","remind_at":"<ISO datetime with UTC${tzOffset} offset>","recurrence":"none|daily|weekly|monthly","note":"<verbatim from input, or ''>"}
Habits entry: {"module":"habits","title":"<habit name>","frequency":"daily|weekly|custom","target_per_period":<integer 1-99, e.g. 5 for "5 times per day">}
Journal entry: {"module":"journal","content":"<full text>","mood":<integer 1-5 inferred from emotion, or null>}
Goal entry: {"module":"goals","title":"<short goal title>","description":"<optional detail or ''>","source":"finance|habits|journals|reminders","source_hint":"<category, habit, journal tag, or ''>","target_value":<number; finance uses display amount, habits uses percent, journals/reminders uses count>,"start_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD or null"}

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
      { temperature: 0.1, max_tokens: 900 }
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
      const normalized = normalizeEntry(rawCandidate.entry ?? rawCandidate, now, localAmount, text, currency)
      if (!normalized) continue
      const { entry, missing } = normalized
      // Journal content must always equal the user's exact original text — AI output
      // often corrupts tonal-language diacritics (e.g. Vietnamese ấ→á, ồ→ổ) when
      // paraphrasing, and the raw input is always the correct source of truth here.
      if (entry.module === 'journal') entry.content = text
      if (entry.module === 'habits') {
        entry.title = preserveHabitTitleFromInput(text, entry.title)
        const inferredTarget = inferHabitTargetFromText(text)
        entry.target_per_period = inferredTarget > 1
          ? inferredTarget
          : normalizeHabitTarget(entry.target_per_period)
      }
      candidates.push({
        id: candidateId(entry),
        entry,
        confidence: normalizeConfidence(rawCandidate.confidence, 0.7),
        reason: String(rawCandidate.reason || ''),
        selectedByDefault: rawCandidate.selectedByDefault !== false,
        missing,
      })
    }

    const hasFinance = candidates.some((c) => c.entry.module === 'finance')
    const hasJournal = candidates.some((c) => c.entry.module === 'journal')
    const hasDebt = candidates.some((c) => c.entry.module === 'finance_debt')
    const hasPlan = candidates.some((c) => c.entry.module === 'finance_plan')
    const hasGoal = candidates.some((c) => c.entry.module === 'goals')

    if (localAmount !== null && hasMonthlyPlanIntent(text) && !hasPlan) {
      const normalized = normalizeFinancePlanEntry({ kind: textHasIncomeSignal(text) ? 'income' : 'expense' }, localAmount, text)
      if (normalized) {
        candidates.push({
          id: candidateId(normalized.entry),
          entry: normalized.entry,
          confidence: 0.84,
          reason: 'Detected monthly finance plan',
          selectedByDefault: true,
          missing: normalized.missing,
        })
      }
    }

    if (localAmount !== null && hasDebtIntent(text) && !hasDebt) {
      const entry: DebtEntry = {
        module: 'finance_debt',
        amount_cents: localAmount,
        debt_direction: debtDirectionFromText(text),
        counterparty: extractCounterpartyFromDebtText(text),
        due_at: extractDebtDueAt(text, now),
        occurred_at: extractDateFromText(text).toISOString(),
        note: '',
      }
      const missing: MissingField[] = []
      if (!entry.counterparty) missing.push('counterparty')
      if (!entry.due_at) missing.push('due_date')
      candidates.push({ id: candidateId(entry), entry, confidence: 0.86, reason: 'Detected debt book entry', selectedByDefault: true, missing })
    }

    if (localAmount !== null && textHasFinanceSignal(text) && !hasFinance && textHasIncomeSignal(text)) {
      const entry: FinanceEntry = {
        module: 'finance',
        amount_cents: localAmount,
        direction: 'income',
        category_hint: /lương|salary/i.test(text) ? 'Salary' : 'Other Income',
        merchant: '',
        note: text,
        occurred_at: now.toISOString(),
      }
      candidates.push({ id: candidateId(entry), entry, confidence: 0.75, reason: 'Detected income amount', selectedByDefault: true, missing: [] })
    }

    const hasFinanceAfterGuard = candidates.some((c) => c.entry.module === 'finance')
    if (textHasJournalEmotion(text) && !hasJournal) {
      const entry: JournalEntry = {
        module: 'journal',
        content: text,
        occurred_at: extractDateFromText(text).toISOString(),
        mood: inferJournalMood(text),
      }
      candidates.push({
        id: candidateId(entry),
        entry,
        confidence: hasFinanceAfterGuard ? 0.72 : 0.86,
        reason: hasFinanceAfterGuard ? 'Detected personal feeling with financial event' : 'Detected personal feeling',
        selectedByDefault: true,
        missing: [],
      })
    }

    if (hasGoalIntent(text) && !hasGoal) {
      const source: GoalEntry['source'] = localAmount !== null ? 'finance' : 'habits'
      const entry: GoalEntry = {
        module: 'goals',
        title: text.trim().slice(0, 120),
        description: '',
        source,
        source_hint: source === 'finance' ? 'Emergency Fund' : '',
        target_value: localAmount !== null && source === 'finance' ? centsToDisplay(localAmount, currency) : 100,
        start_date: now.toISOString().slice(0, 10),
        due_date: null,
      }
      candidates.push({
        id: candidateId(entry),
        entry,
        confidence: 0.78,
        reason: 'Detected personal goal',
        selectedByDefault: candidates.length === 0,
        missing: localAmount === null ? ['target'] : [],
      })
    }

    return dedupeCandidates(candidates)
  } catch (e) {
    lastParseError = (e as Error)?.message?.trim() || 'AI request failed'
    logger.error(MODULE, 'parseUniversalCandidates failed', { error: lastParseError })
    return []
  }
}

export async function parseUniversalEntry(text: string): Promise<UniversalEntry | null> {
  const candidates = await parseUniversalCandidates(text)
  return candidates[0]?.entry ?? null
}
