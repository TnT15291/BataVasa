import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency, getAmountRule } from './aiLanguage'
import type { Category } from '@features/finance/types'

export type ParsedEntry = {
  amount_cents: number
  direction: 'expense' | 'income'
  category_hint: string
  merchant: string
  note: string
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
  const content = `Parse this financial transaction and return JSON:
"${text}"

Today's date: ${today}
Active currency: ${currency}
Amount rule: ${amountRule}
${localAmount !== null ? `Pre-computed amount_cents: ${localAmount} — USE THIS VALUE.` : ''}
Available categories (copy EXACTLY, do not translate): ${catList}

Return ONLY valid JSON, no other text:
{"amount_cents":<positive integer>,"direction":"<expense|income>","category_hint":"<must be one of the listed category names>","merchant":"<store name or empty>","note":"<note or empty>"}

Rules:
- Default direction is expense unless income is clearly stated.
- category_hint MUST be copied verbatim from the Available categories list above.
- Examples (VND): "50k cafe" → 50000. "1.5tr xe" → 1500000. "2 triệu" → 2000000.`

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a JSON-only financial transaction parser. The user writes in ${language}. Always return valid JSON, nothing else.`,
        },
        { role: 'user', content },
      ],
      { temperature: 0.1, max_tokens: 200 }
    )
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) return null
    const parsed = JSON.parse(jsonStr) as ParsedEntry
    if (!parsed.amount_cents || parsed.amount_cents <= 0) return null
    // Safety net: if our deterministic extractor disagrees by ≥10×, trust ours
    if (localAmount !== null) {
      const ratio = parsed.amount_cents / localAmount
      if (ratio >= 10 || ratio <= 0.1) parsed.amount_cents = localAmount
    }
    return parsed
  } catch {
    return null
  }
}
