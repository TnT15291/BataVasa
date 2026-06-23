# Design System

> Calm UI · fast interaction · low friction. See product principles in CLAUDE.md.

## UI1 "Personal OS Console" — design rules (source of truth)

Extracted from `UI test/UI1.png`. These govern **every module** (Finance, Habits,
Journal, Reminders, Insights, Settings). Codified in `design/tokens.ts`,
`design/themes.ts`, `design/moduleColors.ts`, and the primitives in
`components/ui/` — compose screens from those, don't re-implement.

- **Canvas:** near-white, flat, calm. Light `bg.primary` ≈ `#FBFBFC`, surfaces pure
  white. Separate sections with **whitespace**, not heavy rules or nested cards.
  Elevation is barely-there: hairline borders + spacing over drop shadows.
- **Header (`AppHeader`):** circular brand mark + "BataVasa" + "AI Personal OS"
  subtitle, ghost search/settings icons right. No shadow.
- **Command bar (`CommandBar`) — identity element:** dark inverted "console"
  surface (`theme.command`), monospace `>_` prompt, `⌘K` hint, mic. It launches the
  assistant; the mic opens voice capture.
- **Section header (`SectionHeader`):** small UPPERCASE label + optional
  count + optional right action ("View all"). A consistent *functional* list-section
  system — not a marketing eyebrow.
- **List row (`ListRow`):** tinted module-color icon chip · title · context subtitle
  · trailing meta. Whole row taps to detail/edit (Cross-Module Rule 7).
- **Status pill / chip (`StatusPill`, `Chip`):** full-round, tinted bg + bold colored
  text for status ("On Track" = success); quiet neutral chips for tags.
- **Signals timeline (`SignalsTimeline`):** one calm lane per module on a shared time
  axis, each lane keyed by its module-color icon (not a tiny text label — language-proof
  + consistent with `ListRow`), module-colored dots, a "now" marker. Thin, never a heavy chart.
- **AI insight (`AIInsightCard`):** "AI INSIGHT" label + one grounded sentence +
  quiet rationale tags. Inline, never a modal.
- **Quick actions (`QuickActionRow`):** evenly distributed ghost actions (Capture ·
  Plan · Review · Sync) under a hairline rule.
- **Module colors (`MODULE_COLORS`):** Finance = blue `#4B7CF3`, Habits = green
  `#28B985`, Journal = amber `#F09A2F`, Reminders = soft teal `#0EA5A8`, Analysis =
  indigo `#5F62D9`. Accent = action/selection/state only, never decoration.
- **Type:** one sans for all UI + mono only for `>_` / `⌘K` / command hints. Fixed
  scale, floor 12px, max weight 700. Letter spacing stays at 0 for readability.
- **Shape (`radius`):** rows/cards 12–16 (`md`/`lg`), command bar `lg`, pills `full`.
- **Motion:** 150–250ms ease-out, conveys state only (tab underline, now marker,
  press feedback). Always honor reduced motion.
- **Navigation (IA):** bottom nav Home · Modules · `[>_ command]` · Insights · You;
  Console home carries the top `ModuleTabBar` switcher + command bar.

## Design Tokens

Defined in `design/tokens.ts`. Two themes: `light` and `dark` (system preference + manual toggle).

```ts
// shape — values are illustrative, tune to brand
export const colors = {
  light: {
    bg:     { primary: '#FAFAF7', secondary: '#F2F1EC', elevated: '#FFFFFF' },
    text:   { primary: '#1A1A1A', secondary: '#4A4A4A', muted: '#8A8A8A', danger: '#B3261E' },
    brand:  { primary: '#3B6FB5', accent: '#7FB069' },
    semantic: { success: '#2E7D32', warning: '#ED6C02', danger: '#B3261E', info: '#0288D1' },
    finance:  { expense: '#B3261E', income: '#2E7D32' },
    border:   { subtle: '#E5E4DF', strong: '#CFCEC8' },
  },
  dark: {
    bg:     { primary: '#121212', secondary: '#1E1E1E', elevated: '#262626' },
    text:   { primary: '#F2F2F2', secondary: '#BDBDBD', muted: '#8A8A8A', danger: '#F2B8B5' },
    brand:  { primary: '#7DA7DD', accent: '#A8CC8F' },
    semantic: { success: '#81C784', warning: '#FFB74D', danger: '#F2B8B5', info: '#4FC3F7' },
    finance:  { expense: '#F2B8B5', income: '#81C784' },
    border:   { subtle: '#2A2A2A', strong: '#3A3A3A' },
  },
}

export const typography = {
  family:   { sans: 'Inter', mono: 'JetBrainsMono' },
  size:     { xs: 12, sm: 14, base: 16, lg: 18, xl: 22, '2xl': 28, '3xl': 34 },
  weight:   { regular: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeight: { tight: 1.2, normal: 1.4, relaxed: 1.6 },
}

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 }
export const radius  = { sm: 6, md: 10, lg: 16, full: 9999 }
export const shadow  = {
  sm: { elevation: 1, shadowOpacity: 0.05, shadowRadius: 2,  shadowOffset: { width: 0, height: 1 } },
  md: { elevation: 3, shadowOpacity: 0.08, shadowRadius: 6,  shadowOffset: { width: 0, height: 2 } },
  lg: { elevation: 6, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
}
```

Access via `useTheme()` hook — never import tokens directly into components.

## Components

Location: `components/` (shared) and `features/<module>/components/` (module-specific).

**Shared primitives** (`components/`):
- `<Screen>` — page wrapper with safe area + scroll/keyboard handling
- `<Text variant="title|body|caption|mono">` — typography wrapper, theme-aware
- `<Button variant="primary|secondary|ghost|danger">` — 44pt+ tap target, optional icon/loading/disabled state, optional module `color`
- `<TextField>` — themed text input with 48pt minimum height, border, placeholder color
- `<Card variant="default|outlined|elevated">` — 16px padded module surface
- `<IconBadge size="sm|md|lg">` — standardized circular icon/emoji chip (24/32/40)
- `<SegmentedControl>` — tab/toggle control for compact mutually exclusive choices, with optional Feather icons
- `<Pressable>` — Native Pressable + haptic feedback wrapper
- `<Sheet>` — bottom sheet
- `<Toast>` — non-blocking notifications with optional Undo action (used by AI auto-confirm-off path)
- `<Skeleton>` — loading placeholder
- `<EmptyState icon, accent, title, body, cta>` (`components/ui/EmptyState.tsx`) — console empty state: soft tinted circular module-color icon badge + title + muted body + optional pill CTA. Replaces 48px-emoji empties; used on every AI insight + report screen so secondary screens match the new list-screen look.
- `<Badge variant="success|warning|danger|neutral">`
- `<Divider>`
- `<DateRow value, onChange>` — tappable date/time row used in every module's create/edit screen (Cross-Module Rule 4)
- `<LocationRow value, onChange, autoFetch>` — tappable location row, used in every module's create/edit screen (Cross-Module Rule 6). Auto-fetches current GPS when `autoFetch` is true; clear button blanks the field so save persists `null`.
- `<ConfirmEntrySheet rawInput, parsed, onSave, onEdit, onCancel>` — shown after AI parses input (Cross-Module Rule 5)
- `<InsightText text>` — renders markdown-like AI/report text into compact section cards. Use this for Finance Insights, Finance Reports, and Cross-Module Analysis instead of raw `<Text>{markdown}</Text>`.

**Finance-specific** (`features/finance/components/`):
- `<AmountText cents, currency, signed?>` — locale-aware amount display
- `<CategoryChip>`, `<CategoryPicker>`
- `<TransactionRow>`, `<TransactionList>` (virtualized)
- `<MoodSelector>`
- `<SpendChart>` — lazy-loaded chart wrapper

## UX Rules

- **Tap targets** ≥ 44pt
- **Loading states** — skeleton, not spinners, for content
- **Empty states** — always guide user to next action
- **Animations** — < 200ms for transitions, use native driver
- **Accessibility** — labels on every interactive element
- **No hardcoded strings** (Cross-Module Rule 2) — every user-facing text via `t.<key>` from `useTranslation()`. Adding a new key requires updating all 6 language files in `services/i18n/translations/` in the same commit.
- **Domain labels translate too** — system-seeded names (default categories, habit templates, mood labels) MUST go through per-module `translateX(row, t)` helpers (see `features/finance/i18n.ts`). Never render `row.name` directly for system rows.
- **Locale-sensitive formatters** — date-fns `format()` and `Intl.*` MUST receive a locale derived from `settingsStore.language` (helpers in `services/locale.ts`). Never hardcode `'en-US'` or `'vi-VN'`.
- **Universal "Add" FAB** (Cross-Module Rule 3) — single primary action on every main screen, opens text + voice input that AI routes to the correct module
- **Tap-to-open** (Cross-Module Rule 7) — every list row's primary tap opens detail/edit. Never leave taps inert.
- **Floating actions** — keep one primary floating create action per main screen. Secondary actions such as report, analysis, or reflection belong in the content area or header. Floating buttons and fixed footers must use safe-area bottom spacing.
- **Card density** — summary hero cards should be compact on mobile. Avoid stacking oversized hero + stats + CTA when the screen's main task is repeated daily use.
- **AI output presentation** — sectioned AI output should use compact cards with clear headings and short body text. Do not expose raw markdown markers such as `**`, `##`, or numbered prompt scaffolding in UI.
- **Assistant empty state** — conversational screens should include useful quick prompts so first use is not a blank canvas.

## Accessibility (mandatory)

Every interactive element MUST be reachable by screen reader + keyboard.

- `<Pressable>` / `<Button>` → require `accessibilityLabel` (no emoji-only labels)
- `<Switch>` → `accessibilityLabel` describing what it toggles
- Icons-only buttons → `accessibilityLabel` describing action
- Images → `alt`/`accessibilityLabel` or `accessibilityElementsHidden` if decorative
- Form fields → `accessibilityLabel` matches visible label; group with `accessibilityRole="form"` where useful
- Tap targets ≥ 44pt (already in UX Rules)
- Color contrast ≥ WCAG AA (4.5:1 body, 3:1 large)
- Dynamic Type respected — never lock font sizes

## Loading + empty + error states (mandatory triad)

Every async-bound UI surface MUST handle all four states explicitly:

| State | Pattern |
|---|---|
| Loading (first paint) | `<Skeleton>` matching layout shape — never blocking spinner |
| Loading (refetch) | inline subtle indicator (top spinner, pull-to-refresh) |
| Empty | `<EmptyState>` with title + body + CTA to next action |
| Error | inline error card with retry button — never blank screen (see Rule 8 + ErrorBoundary) |

Anti-patterns:
- Spinner on top of usable UI (blocks interaction)
- Empty list with no message (looks broken)
- Silent error (Result.err logged but not surfaced)

## Finance UI Patterns

- Amounts: locale-aware formatting, color by direction (red expense / green income)
- Sign/category mismatches: if an expense is attached to an income category, show it as an item needing review and preserve the original category in secondary text. Do not make contradictory rows look normal.
- Lists: virtualized for >50 items
- Charts: lazy-load chart libs, show skeleton while loading

## Anti-patterns

- No modal stacking > 2 deep
- No blocking spinners on top of usable UI
- Don't auto-focus inputs on screen mount (annoying with software keyboard)
