# Design System

> Calm UI · fast interaction · low friction. See product principles in CLAUDE.md.

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
- `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg">`
- `<Input>` — text input with label, error, helper
- `<Card>` — elevated container
- `<Icon name="...">` — sprite from icon set (Lucide/Feather)
- `<Pressable>` — Native Pressable + haptic feedback wrapper
- `<Sheet>` — bottom sheet
- `<Toast>` — non-blocking notifications
- `<Skeleton>` — loading placeholder
- `<EmptyState image, title, body, cta>` — empty list placeholder
- `<Badge variant="success|warning|danger|neutral">`
- `<Divider>`

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

## Finance UI Patterns

- Amounts: locale-aware formatting, color by direction (red expense / green income)
- Lists: virtualized for >50 items
- Charts: lazy-load chart libs, show skeleton while loading

## Anti-patterns

- No modal stacking > 2 deep
- No blocking spinners on top of usable UI
- Don't auto-focus inputs on screen mount (annoying with software keyboard)
