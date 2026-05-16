# Finance Domain

> Core domain knowledge for the finance module. The primary product surface.

## Categories

System defaults seeded on first launch. Users can disable, rename, add custom — never edit system rows directly (mark `user_id` on copy).

**Essential** (`kind: essential`)
- Food & Groceries
- Transport (fuel, ride-hail, public)
- Housing (rent, mortgage)
- Utilities (electric, water, internet, phone)
- Healthcare
- Insurance
- Education

**Discretionary** (`kind: discretionary`)
- Dining Out
- Entertainment
- Shopping
- Travel
- Subscriptions
- Gifts
- Personal Care

**Income** (`kind: income`)
- Salary
- Freelance
- Investment Returns
- Gifts Received
- Other Income

**Savings / Investments** (`kind: savings`)
- Emergency Fund
- Retirement
- Stocks / Funds
- Crypto
- Goal Savings

**Rules:**
- Hierarchy max depth = 2 (parent + child)
- Customization: rename, recolor, reicon, reorder, disable; system rows never deleted (soft-hide via user pref)
- New custom category requires `name` + `kind` + `icon`

## Business Rules

- **Amount:** non-zero integer cents. Sign encodes direction (negative=expense, positive=income). UI may display unsigned + direction badge.
- **Date:** `occurred_at` ≤ now + 24h (allow tz drift). Future-dated → reject with `VALIDATION_FAILED`.
- **Category required.** No "uncategorized" bucket in domain — UI must prompt.
- **Currency:** default from user profile; per-transaction override allowed. No FX conversion at write time (store native, convert at report time).
- **Edit window:** any time (soft-delete + new row for audit, OR in-place edit with `updated_at` bump — current choice: in-place).
- **Soft delete only.** Hard delete restricted to account-deletion flow.
- **Mood link:** optional but encouraged for emotional-spending analysis. UI surfaces mood selector for discretionary categories.
- **Duplicate detection:** on create, warn if same `amount_cents` + `merchant` + within 60s of last entry.

## Insights & Analytics

What the AI/analytics layer should detect:
- Overspending vs. historical baseline
- Recurring subscriptions (same merchant, similar amount, monthly cadence)
- Emotional spending (correlate with journal mood)
- Category drift (this month vs. avg of last 3)
- Saving rate trends

## Smart Features

- **OCR receipts** (V2) — extract amount/merchant/date from photo
- **Voice input** (V2) — "I spent 50k on lunch"
- **Auto-categorization** — ML-based on merchant + history
- **Budget alerts** — proactive notifications when approaching limit

## Anti-patterns (Finance-specific)

- Never silently drop a transaction on sync failure → queue + retry
- Never round amounts in storage (store as integer cents, format at UI)
- Never expose raw account data to AI prompts — anonymize first
