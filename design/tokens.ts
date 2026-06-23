export const colors = {
  light: {
    bg: { primary: '#EEF3F6', secondary: '#DDE7EC', elevated: '#FAFCFD' },
    text: { primary: '#101820', secondary: '#31414D', muted: '#55636E', danger: '#B4232E' },
    brand: { primary: '#197C92', accent: '#7B5BB3' },
    semantic: { success: '#247A5A', warning: '#B76A24', danger: '#B4232E', info: '#326FB0' },
    finance: { expense: '#B4232E', income: '#247A4D' },
    border: { subtle: '#D7DEE5', strong: '#AAB6C2', card: '#C7D0D9' },
  },
  dark: {
    bg: { primary: '#123942', secondary: '#1A444C', elevated: '#22505A' },
    text: { primary: '#E7E2D0', secondary: '#C8C2AE', muted: '#AEBDB6', danger: '#E28B87' },
    brand: { primary: '#88B8B1', accent: '#B5A36F' },
    semantic: { success: '#78A98A', warning: '#B79A5A', danger: '#E28B87', info: '#77A5BA' },
    finance: { expense: '#D98782', income: '#78A98A' },
    border: { subtle: '#2B5055', strong: '#41656A', card: '#385D62' },
  },
} as const

export const typography = {
  family: { sans: 'System', mono: 'Courier' },
  // Floor: 12px. Never use values below xs in user-facing text.
  size: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 32 },
  // Ceiling: bold (700). Never hardcode '800' — use bold for primary metric values only.
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeight: { tight: 1.2, normal: 1.4, relaxed: 1.6 },
} as const

/**
 * Composable text style presets. Combine with a color from useTheme().
 * Rules baked in: floor 12px, max weight 700, no uppercase transforms.
 *
 * Usage: <Text style={[textStyles.label, { color: theme.text.muted }]}>
 */
export const textStyles = {
  // Metadata, timestamps, sub-labels — minimum readable size
  caption:       { fontSize: 12, fontWeight: '400' } as const,
  captionStrong: { fontSize: 12, fontWeight: '600' } as const,

  // Form labels, section sub-labels, filter counts
  label:         { fontSize: 13, fontWeight: '500' } as const,
  labelStrong:   { fontSize: 13, fontWeight: '600' } as const,

  // Row titles, card body, list content
  body:          { fontSize: 14, fontWeight: '400' } as const,
  bodyStrong:    { fontSize: 14, fontWeight: '600' } as const,
  bodyBold:      { fontSize: 14, fontWeight: '700' } as const,

  // Section headers, card titles
  sectionTitle:  { fontSize: 18, fontWeight: '600' } as const,
  sectionBold:   { fontSize: 18, fontWeight: '700' } as const,

  // Primary metric values (net amount, hero spend)
  metric:        { fontSize: 32, fontWeight: '700' } as const,
  metricSm:      { fontSize: 18, fontWeight: '700' } as const,
} as const

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const

// UI1 console shapes: list rows / cards 12–16, command bar ~14, pills full-round.
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 } as const

export type ThemeMode = 'light' | 'dark'
export type Theme = (typeof colors)[ThemeMode]
