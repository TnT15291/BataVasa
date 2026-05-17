# AI Integration

> OpenAI API usage, prompt design, memory, and finance-specific AI features.

## Architecture

```
User data (SQLite) → Anonymizer → Prompt builder → OpenAI → Parser → Insight store
```

## Mandatory prompt contract (Cross-Module Rules 2 + 4)

Every AI call MUST include in system prompt:

1. **Language directive** — `Respond in ${getAILanguage()}.` Translates user setting (`vi`/`en`/`ja`/`ko`/`fr`/`zh`) to model-friendly name ("Vietnamese", etc). All AI output (insights, reports, chat, parsed summaries) appears in user's language.
2. **Today's date** — `Today is ${YYYY-MM-DD} (${weekday}).` So relative phrases like "hôm qua" / "tomorrow" / "tuần trước" resolve correctly. Pair with deterministic `services/dateParser.ts` — never trust the model alone with dates.

Both are non-negotiable defaults — encode in a shared `buildSystemPrompt()` helper, never inline per-feature.

## Smart-Entry / Add-Activity flow (Cross-Module Rules 3 + 5)

Universal entry pipeline lives at `services/ai/`:

```
raw text/voice
   ↓
preParse (regex)         ← amount, date, intent hints
   ↓
intentClassifier (AI)    ← { module, confidence, fields }
   ↓
[confidence < 0.6?] → chip selector (user picks module)
   ↓
ConfirmEntrySheet        ← UNLESS settingsStore.aiAutoConfirm === false
   ↓
<module>.create service
   ↓
SQLite + sync_queue
```

Rules:
- **Voice always confirms** even if `aiAutoConfirm === false` (STT errors common)
- **Deterministic > AI** for: amount math, date parsing, currency conversion. AI only does semantic classification + free-text fields.
- If pre-parser disagrees with AI by ≥10× on amount → override with pre-parsed value (pattern from `smartEntry.ts`)

## Prompt Templates

All prompts live in `ai/prompts/`. Each exports `{ system, buildUser(input), responseSchema }`.

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
