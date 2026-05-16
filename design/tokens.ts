export const colors = {
  light: {
    bg: { primary: '#FAFAF7', secondary: '#F2F1EC', elevated: '#FFFFFF' },
    text: { primary: '#1A1A1A', secondary: '#4A4A4A', muted: '#8A8A8A', danger: '#B3261E' },
    brand: { primary: '#3B6FB5', accent: '#7FB069' },
    semantic: { success: '#2E7D32', warning: '#ED6C02', danger: '#B3261E', info: '#0288D1' },
    finance: { expense: '#B3261E', income: '#2E7D32' },
    border: { subtle: '#E5E4DF', strong: '#CFCEC8' },
  },
  dark: {
    bg: { primary: '#121212', secondary: '#1E1E1E', elevated: '#262626' },
    text: { primary: '#F2F2F2', secondary: '#BDBDBD', muted: '#8A8A8A', danger: '#F2B8B5' },
    brand: { primary: '#7DA7DD', accent: '#A8CC8F' },
    semantic: { success: '#81C784', warning: '#FFB74D', danger: '#F2B8B5', info: '#4FC3F7' },
    finance: { expense: '#F2B8B5', income: '#81C784' },
    border: { subtle: '#2A2A2A', strong: '#3A3A3A' },
  },
} as const

export const typography = {
  family: { sans: 'System', mono: 'Courier' },
  size: { xs: 12, sm: 14, base: 16, lg: 18, xl: 22, '2xl': 28, '3xl': 34 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeight: { tight: 1.2, normal: 1.4, relaxed: 1.6 },
} as const

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const

export const radius = { sm: 6, md: 10, lg: 16, full: 9999 } as const

export type ThemeMode = 'light' | 'dark'
export type Theme = (typeof colors)[ThemeMode]
