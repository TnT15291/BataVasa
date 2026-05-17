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

export async function parseSmartEntry(
  text: string,
  categories: Category[]
): Promise<ParsedEntry | null> {
  const language = getAILanguage()
  const currency = getAICurrency()
  const amountRule = getAmountRule(currency)
  const catList = categories.map((c) => c.name).join(', ')

  const content = `Parse this financial transaction and return JSON:
"${text}"

Available categories: ${catList}
Active currency: ${currency}
Amount rule: ${amountRule}

Return ONLY valid JSON, no other text:
{"amount_cents":<positive integer>,"direction":"<expense|income>","category_hint":"<category name>","merchant":"<store name or empty>","note":"<note or empty>"}

Default direction is expense unless clearly stated otherwise.`

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
    return parsed
  } catch {
    return null
  }
}
