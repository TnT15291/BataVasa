# API Contracts

> Current status: there is no custom backend REST API implemented in the app.
> The client uses Supabase Auth plus direct Supabase table mirroring from the
> local sync worker.

## Implemented External Interfaces

### Supabase Auth

Used by:

- `services/supabase.ts`
- `store/authStore.ts`
- `features/auth/`

Auth currently supports email/password flows, session restore, sign out, and
password recovery.

### Supabase Table Mirror

Used by:

- `services/sync.ts`
- `database/sync/queue.ts`

The sync worker reads local `sync_queue` rows and writes directly to Supabase
tables.

Implemented queue operations:

- `upsert`: fetch the local row and `upsert` it to the matching Supabase table.
- `wipe`: delete all rows for the signed-in user from the target Supabase table.

Supabase schema and RLS are documented in `docs/supabase-setup.sql`.

## Not Implemented Yet

These endpoint families are product/backend roadmap items, not current app
contracts:

- `POST /finance/create`
- `GET /finance/transactions`
- `PATCH /finance/:id`
- `DELETE /finance/:id`
- `POST /ai/insight/generate`
- `GET /sync/pull`
- `POST /sync/push`

Do not build client code against those routes unless a backend service or
Supabase Edge Function is added first.

## Future Backend Shape

If BataVasa moves from direct table mirroring to server-mediated sync or managed
AI keys, prefer Supabase Edge Functions with this response shape:

```ts
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }
```

Recommended future endpoint groups:

- `/sync/push`: batch local operations, server validates and applies conflicts.
- `/sync/pull`: pull changes since a cursor.
- `/ai/*`: managed AI proxy with auth, quotas, metering, prompt caching, and PII
  scrubbing.
- `/account/delete`: service-role-only account deletion and data purge.

## Error Codes For Future APIs

| Code | Meaning | HTTP |
|---|---|---|
| `AUTH_REQUIRED` | Missing or invalid JWT | 401 |
| `AUTH_FORBIDDEN` | Authenticated but not authorized | 403 |
| `VALIDATION_FAILED` | Invalid request | 400 |
| `NOT_FOUND` | Resource missing | 404 |
| `CONFLICT` | Sync conflict | 409 |
| `RATE_LIMITED` | Too many requests | 429 |
| `AI_BUDGET_EXCEEDED` | AI quota exceeded | 429 |
| `UPSTREAM_AI_ERROR` | AI provider failed | 502 |
| `INTERNAL` | Unhandled server error | 500 |
