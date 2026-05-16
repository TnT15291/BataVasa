# BataVasa — AI-Powered Personal OS

> Foundation context. Auto-loaded every conversation. Keep concise — detail belongs in `docs/`.

## Product

AI-powered personal operating system. Modules:
- **Finance** (primary) — track spending/income, weekly/monthly/yearly reports, AI insights
- **Habits** — daily tracking + AI insights
- **Journals** — write + AI insights
- **Reminders**
- **Behavioral patterns** — cross-module correlations

**Core value:** Transform personal data into meaningful insights.

**Target users:** productivity-focused, self-improvement, ADHD, busy professionals.

**Principles:** calm UI · fast interaction · low friction · AI assists, not overwhelms.

## Finance Vision

Not just an expense tracker. Helps users:
- Understand spending behavior
- Identify unhealthy patterns
- Improve saving habits
- Correlate emotions ↔ spending
- Build long-term financial awareness

**Finance AI goals:** detect overspending, analyze emotional spending, find recurring subscriptions, compare trends, recommend actions.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React Native · Expo · TypeScript |
| Backend | Supabase |
| AI | OpenAI API |
| Storage | SQLite (local) + Supabase (cloud sync) |

## Architecture

- **Feature-based modular** architecture
- **Offline-first** design
- Business logic separated from UI

**Layers:** `UI → Hooks → Services → Database/API`

## Folder Structure

```
features/<module>/screens/   ← UI per feature
store/<module>Store.ts        ← State
database/<module>/            ← Local SQLite layer
ai/<module>Insight.ts         ← AI logic
services/                     ← Shared business logic
docs/                         ← Detailed documentation (read on-demand)
```

## Coding Conventions

- TypeScript strict mode
- Feature folders, not type folders (no `screens/`, `hooks/` at root)
- Hooks for stateful logic, services for pure logic
- Never put DB calls in UI components
- Offline-first: every write goes to SQLite first, sync to Supabase async

## Roadmap

- **MVP** — auth, reminders, habits, journals, AI weekly reports
- **V1** — finance tracking, mood tracking, cloud sync
- **V2** — AI correlations, OCR receipts, voice input, smart notifications

## Detailed Docs (read when relevant)

| Topic | File |
|---|---|
| System design, layers, data flow | `docs/architecture.md` |
| SQLite + Supabase schema, migrations | `docs/database.md` |
| API contracts, endpoints, conventions | `docs/api.md` |
| Finance domain: categories, rules, insights | `docs/finance-domain.md` |
| AI prompts, memory, finance AI features | `docs/ai-integration.md` |
| Sync engine, offline strategy, conflict resolution | `docs/sync-offline.md` |
| Auth, encryption, finance security | `docs/security.md` |
| Design tokens, UI/UX rules, components | `docs/design-system.md` |
| Deploy, env vars, testing, performance, monitoring | `docs/ops.md` |

## Glossary

- **Module** — feature domain (finance, habits, journals, reminders)
- **Insight** — AI-generated analysis of user data
- **Sync** — push local SQLite changes to Supabase cloud
