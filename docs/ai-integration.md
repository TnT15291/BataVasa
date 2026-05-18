# AI Integration

> Multi-provider AI (OpenAI-compatible), prompt design, and AI features.

## Architecture

```
User data (SQLite) → Prompt builder → chatCompletion() → Provider API → Parser → Store / UI
```

## Provider abstraction (`services/ai/openai.ts`)

BataVasa uses a **multi-provider** AI layer — not locked to OpenAI. All providers expose an OpenAI-compatible chat completions endpoint.

```ts
export async function chatCompletion(
  messages: Message[],
  options?: { temperature?, max_tokens? }
): Promise<string>
```

Supported providers (configured in `services/ai/providers.ts`):
| Provider | Model | Key prefix | Notes |
|---|---|---|---|
| OpenAI | gpt-4o-mini (default) | `sk-` | Original provider |
| Groq | llama-3.3-70b | — | Free tier, fast |
| Gemini | gemini-pro | `AIza` | Free tier 15 req/min |
| Ollama | local model | — | Self-hosted |

Active provider stored in `settingsStore.aiProvider`. Keys stored in `expo-secure-store` per provider. Settings UI: `app/ai-settings.tsx` → `AISettingsScreen`.

## Mandatory prompt contract (Cross-Module Rules 2 + 4)

Every AI call MUST include in system prompt:

1. **Language directive** — `Respond in ${getAILanguage()}.` — `services/ai/aiLanguage.ts:getAILanguage()` translates user setting (`vi`/`en`/`ja`/`ko`/`fr`/`zh`) to model-friendly name ("Vietnamese", etc). All AI output appears in user's language.
2. **Local datetime + timezone** — `Current local time: ${localISO}` and `User timezone: UTC+07:00`. So relative phrases resolve correctly AND returned datetimes use local offset, not UTC. Critical: AI returning `"18:00Z"` for Vietnam → JavaScript parses as next-day `01:00` — the prompt must prevent this.
3. **Currency** — `Currency: ${getAICurrency()}` for finance-related prompts.

Use `services/ai/aiLanguage.ts` helpers: `getAILanguage()`, `getAICurrency()`.

Both language and timezone are non-negotiable — encode in the prompt builder per feature, never skip.

## Universal Add flow — implemented (Cross-Module Rules 3 + 5)

Pipeline (`features/home/components/UniversalAddSheet.tsx` + `services/ai/universalEntry.ts`):

```
user types text
   ↓
extractAmount() — services/ai/smartEntry.ts   ← deterministic amount extraction
   ↓
parseUniversalEntry(text) — services/ai/universalEntry.ts
  • builds prompt with language + local datetime + timezone offset
  • chatCompletion() at temperature: 0.1
  • returns typed UniversalEntry (finance | reminder | habits | journal)
  • post-processes: fixReminderTimezone() reinterprets Z-suffix datetimes as local
   ↓
UniversalAddSheet Step 2 — confirm card (module icon, parsed fields)
   ↓
Save → module store action (createTransaction / createReminder / …)
   ↓
SQLite write [→ sync_queue when sync engine built]
```

Rules:
- **Deterministic > AI** for amount: if AI result diverges ≥10× from `extractAmount()` → enforce pre-parsed value
- **Timezone correction**: `parseUniversalEntry` includes `UTC+HH:MM` offset in prompt AND post-processes UTC Z-suffix times to local wall-clock time
- Habits/Journal from sheet → planned: currently shows "coming soon" alert; full CRUD via dedicated screens

## Prompt Templates

Prompt builders live in `services/ai/`. Each file owns its own prompt construction inline (no shared `ai/prompts/` directory yet — consolidation is a future refactor).

### Weekly Finance Report

**System:** "You are a calm, non-judgmental financial coach. Analyze the user's week. Be specific, actionable, and brief. Never moralize."

**User input vars:**
- `period_start`, `period_end`
- `transactions[]` — anonymized: `{ amount_cents, category, kind, occurred_at, mood? }`
- `baseline` — last 4-week averages per category
- `user_goals` — from `ai_memory`

**Expected output (JSON):**
```ts
{
  summary: string                          // 1-2 sentences
  total_spent_cents: number
  total_income_cents: number
  top_categories: { name, amount_cents, vs_baseline_pct }[]  // top 3
  patterns: { kind: 'overspend'|'subscription'|'mood_link'|'new_merchant', description: string, evidence: string[] }[]
  recommendations: { action: string, why: string }[]         // max 3
}
```

### Habit Insight

**System:** "You're a behavior-design coach. Spot completion patterns, identify likely friction, suggest one small adjustment."

**User input vars:** `habit`, `logs[]` (last 30 days), `cadence`, `target_per_period`

**Expected output:**
```ts
{
  completion_rate: number              // 0–1
  streak_current: number
  streak_longest: number
  pattern: string                      // e.g. "Misses on Mondays"
  suggestion: { action: string, why: string }
}
```

### Journal Reflection

**System:** "You are a thoughtful, gentle reflection partner. Find themes across entries. Never diagnose. Never prescribe medical/clinical action."

**User input vars:** `entries[]` (last N, decrypted client-side then anonymized), `period`, `mood_distribution`

**Expected output:**
```ts
{
  themes: string[]                     // 2–4
  mood_summary: string                 // 1 sentence
  recurring_questions: string[]        // things user keeps revisiting
  gentle_prompt: string                // suggested next-entry question
}
```

### Cross-Module Pattern (V2)

Correlate finance × journal × habit. Only enabled when user opts in. Strict anonymization.

## AI Memory

Persistent context the AI needs across sessions:
- User's financial goals
- Previously identified patterns (to avoid repetition)
- User preferences (tone, detail level, language)

Storage: `database/ai_memory/` table, scoped by user + module.

## Cost & Token Management

- Cache insights — don't regenerate if data hasn't changed
- Use streaming for long responses
- Prefer smaller models (gpt-4o-mini) for classification, larger for synthesis

**Budget caps (per user):**
- Free tier: 10 insight generations / month
- Paid tier: 100 / month, then degraded model
- Per-call hard cap: 4k input tokens (truncate transactions/entries oldest-first)

**Fallback strategy:**
1. Try primary model (gpt-4o or successor)
2. On timeout (>20s) or 5xx: retry once with gpt-4o-mini
3. On second failure: return last cached insight + `stale: true` flag
4. If no cache: return canned summary built from raw aggregates (no AI)

**Caching key:** `(user_id, module, kind, period_start, data_hash)`. Invalidate when source data hash changes.

## Feature gating — no AI buttons without a key

Any UI surface that requires the AI provider MUST hide or disable itself when no API key is configured:

- Smart Entry button (in QuickAdd) → hide entirely if `getKeysStatus()` shows all providers empty
- AI Insights / Reports / Chat home-row buttons → render but tap shows `Alert` linking to `/ai-settings`
- Generate / Refresh buttons inside AI screens → disabled state with "Setup API key" CTA

Rationale: dangling buttons that fail after a 1-second loading state feel broken. Better to surface the setup affordance directly.

## API key validation

`saveProviderKey()` MUST perform a lightweight test call before persisting:

```ts
async function saveProviderKey(provider, key) {
  const ok = await testProviderKey(provider, key) // tiny "ping" chat completion
  if (!ok) throw new Error('INVALID_KEY')
  await setSecure(AI_PROVIDERS[provider].keyStore, key.trim())
}
```

- Test endpoint: smallest possible chat completion (e.g. `[{role:'user', content:'ping'}]`, max_tokens=1)
- Timeout: 10s; on timeout → show "Couldn't verify, save anyway?" prompt
- Pre-validation prevents silent failure later when user actually uses Smart Entry / Insight

## Privacy

- **Anonymize before prompting**: strip names, exact merchant identifiers if not needed
- No raw bank account/card numbers in prompts ever
- User can opt out per-module
