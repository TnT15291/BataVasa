# API Contracts

> Supabase REST/RPC + custom endpoints. Document every endpoint here.

## Conventions

- Routes: `/<module>/<action>` (e.g. `/finance/create`)
- All requests authenticated via Supabase JWT
- Responses always `{ success: boolean, data?: T, error?: string }`
- Validation: zod schemas in `services/<module>/schemas.ts`

## Endpoints

### POST /finance/create

**Request:**
```ts
{
  amount_cents: number       // signed: negative = expense, positive = income
  currency?: string          // default 'VND'
  category_id: string
  merchant?: string
  note?: string
  occurred_at: string        // ISO 8601
  mood?: 'great' | 'good' | 'neutral' | 'low' | 'bad'
  source: 'manual' | 'ocr' | 'voice' | 'import'
}
```

**Response:**
```ts
{ success: true, data: { id: string } }
| { success: false, error: { code: string, message: string } }
```

### GET /finance/transactions

Query params: `from`, `to` (ISO dates), `category_id?`, `cursor?`, `limit=50`

**Response:** paginated list `{ items: Transaction[], next_cursor: string | null }`

### PATCH /finance/:id

Partial update. Same field shape as create.

### DELETE /finance/:id

Soft delete (sets `deleted_at`).

### POST /ai/insight/generate

**Request:** `{ module: 'finance'|'habit'|'journal', kind: 'weekly'|'monthly', period_start: string }`

**Response:** `{ success: true, data: { insight_id: string, content: object } }`

### GET /sync/pull

Pull server-side changes since `since` cursor. Used after reconnect.

**Request:** `{ since: string /* ISO */ }`
**Response:** `{ changes: SyncChange[], next_cursor: string }`

### POST /sync/push

Push local changes batch.

**Request:** `{ ops: SyncOp[] }`
**Response:** `{ accepted: string[], conflicts: ConflictReport[] }`

## Error Codes

| Code | Meaning | HTTP |
|---|---|---|
| `AUTH_REQUIRED` | No/invalid JWT | 401 |
| `AUTH_FORBIDDEN` | Authenticated but not allowed (RLS denied) | 403 |
| `VALIDATION_FAILED` | Request body failed schema | 400 |
| `NOT_FOUND` | Resource missing | 404 |
| `CONFLICT` | Sync conflict, client should resolve | 409 |
| `RATE_LIMITED` | Too many requests | 429 |
| `AI_BUDGET_EXCEEDED` | User exceeded AI quota for period | 429 |
| `UPSTREAM_AI_ERROR` | OpenAI failed | 502 |
| `INTERNAL` | Unhandled server error | 500 |

## Rate Limits

| Endpoint family | Limit | Window |
|---|---|---|
| `/finance/*` writes | 60 | 1 min |
| `/finance/*` reads | 300 | 1 min |
| `/ai/insight/generate` | 10 | 1 hour (per user) |
| `/sync/*` | 30 | 1 min |

429 responses include `Retry-After` header.
