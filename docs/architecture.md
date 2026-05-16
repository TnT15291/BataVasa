# Architecture

## System Overview

```
┌─────────────────────────────────────────┐
│  React Native (Expo) UI                 │
├─────────────────────────────────────────┤
│  Hooks (React state, business glue)     │
├─────────────────────────────────────────┤
│  Services (pure business logic)         │
├─────────────────────────────────────────┤
│  Database (SQLite) ↔ Sync ↔ Supabase    │
│  AI Services (OpenAI)                   │
└─────────────────────────────────────────┘
```

## Design Principles

- **Feature-modular** — each domain (finance, habits, journals) is self-contained
- **Offline-first** — SQLite is source of truth, Supabase is mirror
- **Separation of concerns** — UI never imports DB directly

## Module Map

Each module follows the same shape:

```
features/<module>/
  screens/             ← React Native screens
  components/          ← module-specific components
  hooks/               ← state + glue hooks

store/<module>Store.ts ← Zustand/Redux store

database/<module>/
  schema.ts            ← SQLite table defs
  queries.ts           ← typed query functions
  sync.ts              ← Supabase mirror logic

ai/<module>Insight.ts  ← AI analysis for this module
```

### Current Modules

- **Finance** — UI: `features/finance/screens/` · Store: `store/financeStore.ts` · DB: `database/finance/` · AI: `ai/financeInsight.ts`
- **Habit** — UI: `features/habit/screens/` · Store: `store/habitStore.ts` · DB: `database/habit/` · AI: `ai/habitInsight.ts`
- **Journal** — UI: `features/journal/screens/` · Store: `store/journalStore.ts` · DB: `database/journal/` · AI: `ai/journalInsight.ts`
- **Reminder** — UI: `features/reminder/screens/` · Store: `store/reminderStore.ts` · DB: `database/reminder/` · AI: _(none — pure CRUD)_

## Data Flow

1. User action → UI component
2. UI calls a hook (`useFinanceCreate()`)
3. Hook calls service (`financeService.create()`)
4. Service writes to SQLite (sync) + queues Supabase sync (async)
5. AI insights regenerated via `ai/<module>Insight.ts` on schedule or event

## Cross-cutting Concerns

### State Management

- **Zustand** for module stores — one store per feature (`financeStore`, `habitStore`, …)
- Stores hold **derived/cached state only** — SQLite remains source of truth
- Store actions call services, never DB directly
- Persist UI preferences (theme, last-viewed tab) via `zustand/middleware/persist` → AsyncStorage
- Never persist domain data in Zustand — it lives in SQLite

### Error Handling

- **Boundary:** `<ErrorBoundary>` wraps each tab navigator → fallback screen + "report" button
- **Service layer:** all services return `Result<T, AppError>` (discriminated union, no thrown errors across module boundaries)
- **Sync errors:** never bubble to UI — logged + retried (see `docs/sync-offline.md`)
- **AI failures:** degrade gracefully — show last cached insight + "couldn't refresh" hint

### Logging

- **Dev:** `console.log` allowed, gated by `__DEV__`
- **Prod:** Sentry breadcrumbs only; never `console.log` PII
- Use `services/logger.ts` wrapper — strips PII, tags by module
- Levels: `debug` (dev only) · `info` · `warn` · `error` (auto-reports to Sentry)
