import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency, getAmountRule } from './aiLanguage'
import type { Category, DebtDirection, PlanItemKind } from '@features/finance/types'

export type ParsedTransactionEntry = {
  intent: 'transaction'
  amount_cents: number
  direction: 'expense' | 'income'
  category_hint: string
  merchant: string
  note: string
}

export type ParsedPlanItemEntry = {
  intent: 'plan_item'
  amount_cents: number
  kind: PlanItemKind
  name: string
  category_hint: string
  due_day: number
  note: string
}

export type ParsedDebtEntry = {
  intent: 'debt'
  amount_cents: number
  debt_direction: DebtDirection
  counterparty: string
  due_at: string | null
  note: string
}

export type ParsedEntry = (ParsedTransactionEntry | ParsedPlanItemEntry | ParsedDebtEntry) & {
  direction?: 'expense' | 'income'
  category_hint?: string
  merchant?: string
}

const clampDueDay = (n: unknown): number => {
  const day = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : new Date().getDate()
  return Math.min(31, Math.max(1, day))
}

const stripDiacritics = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')

const normalizedText = (s: string): string => stripDiacritics(s).toLowerCase()

function hasMonthlyPlanIntent(text: string): boolean {
  const t = normalizedText(text)
  return /\b(hang thang|moi thang|dinh ky|lap lai|monthly|recurring)\b/.test(t)
}

function hasDebtIntent(text: string): boolean {
  const t = normalizedText(text)
  return /\b(vay cua|di vay|muon cua|borrowed from|borrow from|cho .+ vay|lend|lent)\b/.test(t) ||
    /\bvay\s+(?!cua\b)(?=[^\d]{1,80}\d)/.test(t)
}

function debtDirectionFromText(text: string): DebtDirection {
  const t = normalizedText(text)
  if (/\b(vay cua|di vay|muon cua|borrowed from|borrow from)\b/.test(t) || /\bvay\s+(?!cua\b)(?=[^\d]{1,80}\d)/.test(t)) return 'borrowed'
  return 'lent'
}

function sanitizeCategoryHintForDirection(
  direction: 'expense' | 'income',
  hint: string,
  categories: Category[]
): string {
  const trimmed = hint.trim()
  if (!trimmed) return ''
  const matched = categories.find((c) => c.name === trimmed)
  if (!matched) return trimmed
  const compatible = direction === 'income' ? matched.kind === 'income' : matched.kind !== 'income'
  if (compatible) return trimmed
  const fallback = direction === 'income'
    ? categories.find((c) => c.kind === 'income')
    : categories.find((c) => c.name === 'Shopping') ?? categories.find((c) => c.kind !== 'income')
  return fallback?.name ?? ''
}

function extractCounterpartyFromText(text: string): string {
  const amountStart = text.search(/\d/)
  const beforeAmount = amountStart >= 0 ? text.slice(0, amountStart) : text
  const normalizedBeforeAmount = normalizedText(beforeAmount)
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
  return /^(vay|cho vay|di vay|muon|cua)$/.test(normalizedText(candidate)) ? '' : candidate
}

function extractPlanNameFromText(text: string): string {
  return text
    .replace(/\d+(?:[.,]\d+)?\s*(?:triệu|trieu|tr|m|k|ngàn|ngan|nghìn|nghin)?/gi, '')
    .replace(/\b(thêm|them|khoản|khoan|chi tiêu|chi tieu|hằng tháng|hang thang|mỗi tháng|moi thang|định kỳ|dinh ky|monthly|recurring|expense|income)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractDebtDueAt(text: string): string | null {
  const t = normalizedText(text)
  const nextMonth = t.match(/\b(?:ngay\s+)?([1-9]|[12]\d|3[01])\s+thang\s+sau\b/)
  const now = new Date()
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

// Returns true if the text contains 2+ distinct amount tokens (e.g. "15k và 20k").
// Used to skip single-amount override when a multi-transaction input is detected.
export function hasMultipleAmounts(text: string): boolean {
  const t = text.toLowerCase()
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:triệu|trieu)\b/g,
    /(\d+(?:\.\d+)?)\s*tr\b/g,
    /(\d+(?:\.\d+)?)\s*k\b(?!\w)/g,
    /(\d+(?:\.\d+)?)\s*ng[aà]n\b/g,
    /(\d+(?:\.\d+)?)\s*ngh[ìi]n\b/g,
    /(\d+(?:\.\d+)?)\s*m\b(?!in|s|d)/g,
  ]
  for (const re of patterns) {
    if ([...t.matchAll(re)].length >= 2) return true
  }
  return false
}

// Deterministic amount extractor — AI is unreliable at arithmetic.
// Handles: "50k", "1.5k", "1tr", "2 triệu", "1M", raw "50000".
// Returns amount in the smallest currency unit appropriate to context.
export function extractAmount(text: string, currency: string): number | null {
  const t = text.toLowerCase().replace(/[,\s]+/g, (m) => (m.includes(',') ? '.' : ' '))

  // Priority: most specific suffix first
  const patterns: { re: RegExp; mul: number }[] = [
    { re: /(\d+(?:\.\d+)?)\s*(?:triệu|trieu)\b/, mul: 1_000_000 },
    { re: /(\d+(?:\.\d+)?)\s*tr\b/, mul: 1_000_000 },
    { re: /(\d+(?:\.\d+)?)\s*m\b(?!in|s|d)/, mul: 1_000_000 }, // "2M" but not "2min", "2ms"
    { re: /(\d+(?:\.\d+)?)\s*ng[aà]n\b/, mul: 1_000 },
    { re: /(\d+(?:\.\d+)?)\s*ngh[ìi]n\b/, mul: 1_000 },
    { re: /(\d+(?:\.\d+)?)\s*k\b(?!\w)/, mul: 1_000 },
    { re: /(\d{1,3}(?:\.\d{3})+)\b/, mul: 1 },
    { re: /(\d{3,})\b/, mul: 1 }, // raw number ≥100
  ]

  for (const { re, mul } of patterns) {
    const m = t.match(re)
    if (m && m[1]) {
      const token = m[1]
      const num = mul === 1 && token.includes('.') ? parseInt(token.replace(/\./g, ''), 10) : parseFloat(token)
      if (!isFinite(num) || num <= 0) continue
      const raw = Math.round(num * mul)
      // Convert to "amount_cents" per active currency rule
      if (currency === 'VND') return raw // VND has no minor unit; we store raw
      if (currency === 'JPY' || currency === 'KRW') return raw * 100
      return raw * 100 // USD/EUR/... → cents
    }
  }
  return null
}

export async function parseSmartEntry(
  text: string,
  categories: Category[]
): Promise<ParsedEntry | null> {
  const language = getAILanguage()
  const currency = getAICurrency()
  const amountRule = getAmountRule(currency)
  const catList = categories.map((c) => c.name).join(', ')
  const localAmount = extractAmount(text, currency)

  const today = new Date().toISOString().split('T')[0]
  const content = `Parse this finance input and return JSON:
"${text}"

Today's date: ${today}
Active currency: ${currency}
Amount rule: ${amountRule}
${localAmount !== null ? `Pre-computed amount_cents: ${localAmount} — USE THIS VALUE.` : ''}
Available categories (copy EXACTLY, do not translate): ${catList}

Return ONLY valid JSON, no other text. Choose exactly one intent:
1) Normal one-time transaction:
{"intent":"transaction","amount_cents":<positive integer>,"direction":"<expense|income>","category_hint":"<must be one of the listed category names>","merchant":"<store name or empty>","note":"<note or empty>"}
2) Monthly recurring plan item, not a transaction:
{"intent":"plan_item","amount_cents":<positive integer>,"kind":"<expense|income>","name":"<short recurring item name>","category_hint":"<must be one of the listed category names or empty>","due_day":<1-31>,"note":"<note or empty>"}
3) Debt book item:
{"intent":"debt","amount_cents":<positive integer>,"debt_direction":"<lent|borrowed>","counterparty":"<person name>","due_at":"<ISO datetime or null>","note":"<note or empty>"}

Rules:
- Default direction is expense unless income is clearly stated.
- If the input says monthly / recurring / hang thang / moi thang / dinh ky, return intent "plan_item". Do NOT return a transaction for it.
- If the input says the user borrowed money from someone (Vietnamese: "vay cua", "vay anh Hung", "di vay", "muon cua"), return intent "debt" with debt_direction "borrowed". This is money coming in, not an expense.
- If the input says the user lent money to someone (Vietnamese: "cho ... vay"), return intent "debt" with debt_direction "lent". This is money going out.
- For debt due dates like "ngay 10 thang sau" or "ngay 19 tra", set due_at to the repayment date at 09:00 local time in ISO format. Do not use repayment dates as transaction occurred_at.
- category_hint MUST be copied verbatim from the Available categories list above.
- For expense transactions or expense plan items, never use an income category such as Salary, Freelance, Borrowing, or Other Income. If unsure, use Shopping.
- merchant and note MUST be copied VERBATIM from the user input — do NOT rephrase or change any characters including Vietnamese tone marks. If unsure, use empty string.
- Treat investment, learning, and emergency fund mentions as ordinary expense categories when those categories exist.
- Examples (VND): "50k cafe" → 50000. "1.5tr xe" → 1500000. "2 triệu" → 2000000.`

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a JSON-only finance parser. The user writes in ${language}. Always return valid JSON, nothing else. Copy extracted text fields verbatim from the user input without modifying any characters.`,
        },
        { role: 'user', content },
      ],
      { temperature: 0.1, max_tokens: 300 }
    )
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) return null
    const parsed = JSON.parse(jsonStr) as Partial<ParsedEntry> & {
      amount_cents: number
      direction?: 'expense' | 'income'
      category_hint?: string
      merchant?: string
      note?: string
      kind?: PlanItemKind
      name?: string
      due_day?: number
      debt_direction?: DebtDirection
      counterparty?: string
      due_at?: string | null
    }
    if (localAmount !== null && (!parsed.amount_cents || parsed.amount_cents <= 0)) {
      parsed.amount_cents = localAmount
    }
    if (!parsed.amount_cents || parsed.amount_cents <= 0) return null
    // Safety net: if our deterministic extractor disagrees by ≥10×, trust ours
    if (localAmount !== null) {
      const ratio = parsed.amount_cents / localAmount
      if (ratio >= 10 || ratio <= 0.1) parsed.amount_cents = localAmount
    }
    if (parsed.intent === 'debt' || hasDebtIntent(text)) {
      const forcedDirection = hasDebtIntent(text) ? debtDirectionFromText(text) : parsed.debt_direction ?? debtDirectionFromText(text)
      return {
        intent: 'debt',
        amount_cents: parsed.amount_cents,
        debt_direction: forcedDirection,
        counterparty: parsed.counterparty?.trim() || extractCounterpartyFromText(text),
        due_at: parsed.due_at ?? extractDebtDueAt(text),
        note: parsed.note ?? '',
      }
    }
    if (parsed.intent === 'plan_item' || hasMonthlyPlanIntent(text)) {
      const kind = parsed.kind ?? (parsed.direction === 'income' ? 'income' : 'expense')
      return {
        intent: 'plan_item',
        amount_cents: parsed.amount_cents,
        kind,
        name: parsed.name?.trim() || extractPlanNameFromText(text),
        category_hint: sanitizeCategoryHintForDirection(kind, parsed.category_hint ?? '', categories),
        due_day: clampDueDay(parsed.due_day),
        note: parsed.note ?? '',
      }
    }
    // Restore merchant/note from original text to guard against AI diacritic corruption.
    // If the AI output doesn't appear verbatim in the original: merchant → '' (optional),
    // note → keep AI value (may be a valid extraction of a longer phrase).
    if (parsed.merchant) {
      const m = parsed.merchant
      if (!text.includes(m)) {
        const lower = text.toLowerCase()
        if (lower.includes(m.toLowerCase())) {
          const idx = lower.indexOf(m.toLowerCase())
          parsed.merchant = text.slice(idx, idx + m.length)
        } else {
          parsed.merchant = ''
        }
      }
    }
    return {
      intent: 'transaction',
      amount_cents: parsed.amount_cents,
      direction: parsed.direction ?? 'expense',
      category_hint: sanitizeCategoryHintForDirection(parsed.direction ?? 'expense', parsed.category_hint ?? '', categories),
      merchant: parsed.merchant ?? '',
      note: parsed.note ?? '',
    }
  } catch {
    return null
  }
}
