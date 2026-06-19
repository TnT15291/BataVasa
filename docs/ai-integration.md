# AI Integration

> Current AI architecture: provider choice **and** API keys are held
> **server-side** as Supabase secrets and used only inside Edge Functions. The app
> never sees a key and no longer lets the user pick a provider; it calls the
> functions with the signed-in user's token. The publisher (you) configures the
> active provider + key in the backend (BYOK and the in-app provider chooser were
> both removed). The only user-facing AI preference is the parse-confirm toggle.

## Provider Layer

Main files:

- `services/ai/openai.ts`: `chatCompletion()` (calls the `ai-chat` Edge Function)
  and `isAiAvailable()`.
- `services/ai/providers.ts`: provider metadata (client-side; now only used for
  the `AIProvider` type + the store default, not a chooser UI).
- `features/settings/screens/AISettingsScreen.tsx`: AI preferences — only the
  parse-confirm toggle (no provider chooser, no key entry).
- `store/settingsStore.ts`: holds `aiProvider` (default `openai`), but it is no
  longer user-editable; the backend `AI_PROVIDER` secret wins.
- `supabase/functions/ai-chat/`: chat-completion proxy (holds the keys).
- `supabase/functions/ai-transcribe/`: Whisper transcription proxy.
- `supabase/functions/_shared/`: CORS helper + server-side provider registry.

Supported providers (OpenAI-compatible chat completions): OpenAI, Gemini, Groq,
DeepSeek. The function resolves the provider via the `AI_PROVIDER` secret (the
client-sent value is only a fallback), looks up that provider's key secret, and
forwards the call. Model is the provider default unless an `AI_MODEL` secret
overrides it.

> `services/ai/openai.ts` still exports a deprecated `getProviderKey()` shim that
> only reports availability (returns a sentinel, never a real key) so legacy
> pre-flight `if (!key)` gates in feature screens keep compiling. New code should
> use `isAiAvailable()`.

## Server Setup (Edge Functions + secrets)

The keys live in Supabase, never in the app bundle. One-time setup:

```bash
# 1. Deploy the two functions (JWT verification is on by default, so only
#    signed-in users can call them; each also re-checks the user inside).
supabase functions deploy ai-chat
supabase functions deploy ai-transcribe

# 2. Choose the active provider (publisher-controlled) + set its key.
#    Set only the provider you actually use; AI_PROVIDER decides which one runs.
supabase secrets set AI_PROVIDER=openai          # openai | gemini | groq | deepseek
supabase secrets set OPENAI_API_KEY=sk-...
# Optional extras / fallbacks:
supabase secrets set GEMINI_API_KEY=...
supabase secrets set GROQ_API_KEY=gsk_...
supabase secrets set DEEPSEEK_API_KEY=sk-...
# Optional: pin a specific model (otherwise the provider default is used).
supabase secrets set AI_MODEL=gpt-4o-mini
```

Notes:

- `SUPABASE_URL` / `SUPABASE_ANON_KEY` are injected into functions automatically —
  do not set them as secrets.
- `AI_PROVIDER` selects the chat provider server-side; the app's stored provider
  value is ignored when this is set. Defaults to `openai` if unset.
- Voice transcription (`ai-transcribe`) reuses `OPENAI_API_KEY` (preferred) or
  falls back to `GROQ_API_KEY`.
- If the active provider's key secret is not set, the function returns 503 and the
  app surfaces a generic AI error.
- **Never** put these keys in `.env.local`, `eas.json`, or any `EXPO_PUBLIC_*`
  variable — those ship to the client bundle and would be extractable.
- Cost control lives at the function boundary: only authenticated users pass, and
  you can add per-user rate limiting inside the function later.

## Prompt Contract

Every AI prompt builder should include:

- response language from `getAILanguage()`;
- local datetime;
- user timezone offset;
- currency from `getAICurrency()` for finance-related prompts.

This is required to avoid language drift and UTC/local-time parsing bugs.

AI insight/report prompts should request concise, non-judgmental markdown
sections with clear headings. Product UI should render those sections through
`components/InsightText.tsx`; do not show raw markdown directly to users.

## Universal Add

Implemented files:

- `features/home/components/UniversalAddSheet.tsx`
- `services/ai/universalEntry.ts`
- `services/ai/smartEntry.ts`

Flow:

1. User enters free text in Universal Add.
2. `extractAmount()` computes a deterministic amount when possible.
3. `parseUniversalCandidates()` asks AI for one or more candidates.
4. The sheet displays selectable cards.
5. Selected candidates dispatch to domain store actions:
   - Finance transaction
   - Reminder
   - Habit
   - Journal

Rules:

- Candidate parsing is preferred over forcing one module.
- Multi-intent text may create multiple selected candidates.
- Deterministic amount extraction overrides obvious AI scale mistakes.
- Reminder datetimes are normalized away from UTC wall-clock mistakes.
- Voice input must always confirm before save.

## Domain AI Features

Implemented or present in code:

- Finance insight: `services/ai/financeInsight.ts`
- Journal insight/reflection: `services/ai/journalInsight.ts`
- Habit insight: `services/ai/habitInsight.ts`
- Cross-module insight prompt/parsing: `services/ai/crossModuleInsight.ts`
- AI insight/report renderer: `components/InsightText.tsx`
- Assistant quick prompts: `features/assistant/screens/AssistantScreen.tsx`
- Module smart parsers:
  - `journalParser.ts`
  - `reminderParser.ts`
  - `habitParser.ts`
  - `universalEntry.ts`

## Privacy Rules

- Do not send raw secrets, account numbers, emails, exact location coordinates, or
  unnecessary PII to AI providers.
- Prefer aggregate or anonymized data for insights.
- Journal content is highly sensitive; only send it for explicit journal insight
  flows.
- Managed AI mode, if introduced later, must update the privacy policy because
  data would route through BataVasa-operated infrastructure.

## Feature Gating

AI-dependent UI should either:

- hide direct smart-entry controls when no provider key is configured; or
- show a clear setup path to AI Settings.

Avoid buttons that start loading and then fail only because no key exists.

Assistant first-use state should include quick prompts for common questions
instead of relying on a blank chat screen. Current quick prompt categories:

- day summary;
- spending status;
- habit improvement;
- recent journal patterns.

## Future Managed AI Mode

Current app model is BYO key. A managed-key subscription model is future work and
must not embed provider secrets in the client.

Required future pieces:

- Supabase Edge Function or equivalent authenticated proxy.
- Usage metering and per-user quotas.
- Abuse protection and prompt caching.
- Updated privacy policy and provider data-processing review.
- Store-compliant subscription/IAP plan if AI access is sold in-app.

## Cost Controls

Recommended rules for future hardening:

- Cache insights by `(user_id, module, kind, period, data_hash)`.
- Truncate old records before prompt construction.
- Use smaller models for classification.
- Retry once on transient provider failure.
- Fall back to rule-based summaries when AI fails.
