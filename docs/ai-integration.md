# AI Integration

> Current AI architecture: bring-your-own provider key on the client, with a
> multi-provider OpenAI-compatible chat abstraction.

## Provider Layer

Main files:

- `services/ai/openai.ts`: `chatCompletion()`.
- `services/ai/providers.ts`: provider metadata.
- `features/settings/screens/AISettingsScreen.tsx`: provider/key settings UI.
- `store/settingsStore.ts`: active provider setting.

Supported provider family:

- OpenAI-compatible chat completions.
- OpenAI.
- Groq.
- Gemini.
- Ollama/self-hosted where configured.

Provider keys are stored with the secure storage wrapper, not in AsyncStorage.

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
