# Privacy Policy

Last updated: 2026-07-18

BataVasa is a personal life organization app for finance tracking, reminders,
journals, habits, and AI-assisted entry. This policy explains what data the app
uses and how it is protected.

## Data You Enter

BataVasa stores the data you create in the app, including:

- Transactions, categories, budgets, notes, moods, and optional location labels
- Reminders, reminder notes, recurrence, and notification timing
- Journal entries and optional mood/location metadata
- Habits and habit completion history
- Goals and AI memory entries that you explicitly create
- App settings such as language, currency, sync toggles, theme, and biometric lock

## Local Storage

BataVasa is offline-first. Your app data is stored locally on your device using
SQLite. Authentication tokens are stored using secure device storage where
available. AI provider API keys are not stored in the app.

## Cloud Sync

If cloud sync is enabled and you sign in, BataVasa syncs your module data to the
configured Supabase backend. Row-level security policies are designed so signed-in
users can access only their own rows.

## AI Features

BataVasa sends the text you submit for AI features through authenticated Supabase
Edge Functions to the AI provider configured by the publisher. Depending on the
server configuration, that provider may be OpenAI, Groq, Gemini, DeepSeek,
OpenRouter, or NVIDIA. Voice recordings submitted through voice input are sent
through an authenticated transcription proxy to OpenAI or Groq.

AI requests are metered per signed-in user to enforce hourly request and payload
quotas. Usage records contain counters and time buckets, not prompt or journal
content. Provider processing remains subject to the selected provider's terms
and privacy practices.

You should not enter highly sensitive secrets into AI prompts. BataVasa avoids
analytics capture of sensitive content such as amounts, notes, merchant names,
journal content, email, phone, and location fields.

## Permissions

BataVasa requests permissions only when needed:

- Microphone: for voice input.
- Location: to optionally attach location metadata to entries.
- Notifications: for reminders and future proactive alerts.
- Face ID / biometric authentication: to lock the app after it has been in the
  background.

You can disable permissions in system settings. Location access can also be
disabled in BataVasa settings.

## Analytics and Diagnostics

BataVasa uses privacy-safe event tracking and Sentry breadcrumbs for diagnostics.
Analytics events are allow-listed and scrubbed to avoid sensitive user data.

## Data Export and Deletion

BataVasa includes per-module Data Management screens where you can export module
data as JSON or delete data from the device. The full backup action currently
exports a versioned JSON file; importing or restoring that file is not yet
available. Cloud deletion follows the sync and backend rules configured for your
Supabase project.

## Contact

For privacy questions, contact the BataVasa maintainer through the project
repository:

https://github.com/TnT15291/BataVasa
