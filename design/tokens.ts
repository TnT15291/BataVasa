export const colors = {
  light: {
    bg: { primary: '#F7F4EE', secondary: '#EDE7DC', elevated: '#FFFDF8' },
    text: { primary: '#20201D', secondary: '#4D493F', muted: '#6F6A60', danger: '#A33A32' },
    brand: { primary: '#2F6F73', accent: '#C9853E' },
    semantic: { success: '#3E7C59', warning: '#B87521', danger: '#A33A32', info: '#4C6F91' },
    finance: { expense: '#A33A32', income: '#3E7C59' },
    border: { subtle: '#DDD5C8', strong: '#BEB2A2', card: '#D7CCBA' },
  },
  dark: {
    bg: { primary: '#15130F', secondary: '#211E18', elevated: '#2B261F' },
    text: { primary: '#F6F0E7', secondary: '#D2C8B8', muted: '#A99D8C', danger: '#E19A94' },
    brand: { primary: '#79B8B6', accent: '#D9A15C' },
    semantic: { success: '#8FBE9D', warning: '#E0AD63', danger: '#E19A94', info: '#8FAFCA' },
    finance: { expense: '#E19A94', income: '#8FBE9D' },
    border: { subtle: '#352F27', strong: '#51483A', card: '#4A4034' },
  },
} as const

export const typography = {
  family: { sans: 'System', mono: 'Courier' },
  // Floor: 12px. Never use values below xs in user-facing text.
  size: { xs: 12, sm: 14, base: 16, lg: 18, xl: 22, '2xl': 28, '3xl': 34 },
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
  sectionTitle:  { fontSize: 15, fontWeight: '600' } as const,
  sectionBold:   { fontSize: 15, fontWeight: '700' } as const,

  // Primary metric values (net amount, hero spend)
  metric:        { fontSize: 26, fontWeight: '700' } as const,
  metricSm:      { fontSize: 18, fontWeight: '700' } as const,
} as const

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const

export const radius = { sm: 6, md: 10, lg: 16, full: 9999 } as const

export type ThemeMode = 'light' | 'dark'
export type Theme = (typeof colors)[ThemeMode]
