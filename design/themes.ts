import type { ThemeName, ColorMode } from '@store/settingsStore'

export type { ThemeName, ColorMode }

export type ThemeColors = {
  bg: { primary: string; secondary: string; elevated: string }
  text: { primary: string; secondary: string; muted: string; danger: string }
  brand: { primary: string; accent: string }
  semantic: { success: string; warning: string; danger: string; info: string }
  finance: { expense: string; income: string }
  border: { subtle: string; strong: string }
}

const baseLight = {
  text: { primary: '#1A1A1A', secondary: '#4A4A4A', muted: '#8A8A8A', danger: '#B3261E' },
  semantic: { success: '#2E7D32', warning: '#ED6C02', danger: '#B3261E', info: '#0288D1' },
  finance: { expense: '#B3261E', income: '#2E7D32' },
  border: { subtle: '#E5E4DF', strong: '#CFCEC8' },
}

const baseDark = {
  text: { primary: '#F2F2F2', secondary: '#BDBDBD', muted: '#8A8A8A', danger: '#F2B8B5' },
  semantic: { success: '#81C784', warning: '#FFB74D', danger: '#F2B8B5', info: '#4FC3F7' },
  finance: { expense: '#F2B8B5', income: '#81C784' },
  border: { subtle: '#2A2A2A', strong: '#3A3A3A' },
}

type ThemeDef = { light: ThemeColors; dark: ThemeColors }

export const themes: Record<ThemeName, ThemeDef> = {
  default: {
    light: {
      ...baseLight,
      bg: { primary: '#FAFAF7', secondary: '#F2F1EC', elevated: '#FFFFFF' },
      brand: { primary: '#3B6FB5', accent: '#7FB069' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#121212', secondary: '#1E1E1E', elevated: '#262626' },
      brand: { primary: '#7DA7DD', accent: '#A8CC8F' },
    },
  },

  sage: {
    light: {
      ...baseLight,
      bg: { primary: '#F7FAF6', secondary: '#EBF3E8', elevated: '#FFFFFF' },
      brand: { primary: '#3D6B52', accent: '#7B5E2A' },
      border: { subtle: '#DDE8D9', strong: '#C5D9BF' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#0C160A', secondary: '#152812', elevated: '#1E3A1A' },
      brand: { primary: '#6DA882', accent: '#C4A165' },
      border: { subtle: '#1C2E18', strong: '#28401F' },
    },
  },

  ocean: {
    light: {
      ...baseLight,
      bg: { primary: '#F0F9FC', secondary: '#E0F2F7', elevated: '#FFFFFF' },
      brand: { primary: '#0077A8', accent: '#00796B' },
      border: { subtle: '#D0EBF5', strong: '#A8D5E8' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#051822', secondary: '#092A3F', elevated: '#0E3C58' },
      brand: { primary: '#4DB8D8', accent: '#4DBDB4' },
      border: { subtle: '#0D2E40', strong: '#174055' },
    },
  },

  sunset: {
    light: {
      ...baseLight,
      bg: { primary: '#FFF8F3', secondary: '#FFEDE0', elevated: '#FFFFFF' },
      brand: { primary: '#D4541A', accent: '#B07800' },
      border: { subtle: '#F5DDD0', strong: '#E8C5AD' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#1E0800', secondary: '#2D1200', elevated: '#3D1C06' },
      brand: { primary: '#FF8A50', accent: '#FFD740' },
      border: { subtle: '#2E1400', strong: '#402210' },
    },
  },

  midnight: {
    light: {
      ...baseLight,
      bg: { primary: '#F9F5FF', secondary: '#EDE7F6', elevated: '#FFFFFF' },
      brand: { primary: '#6B3FA0', accent: '#C2185B' },
      border: { subtle: '#E2D5F5', strong: '#C9B8E8' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#120828', secondary: '#1D1040', elevated: '#271854' },
      brand: { primary: '#BB86FC', accent: '#F48FB1' },
      border: { subtle: '#1E1035', strong: '#2E1858' },
    },
  },
}

export const THEME_SWATCHES: Array<{
  name: ThemeName
  light: string
  dark: string
}> = [
  { name: 'default', light: '#3B6FB5', dark: '#7DA7DD' },
  { name: 'sage', light: '#3D6B52', dark: '#6DA882' },
  { name: 'ocean', light: '#0077A8', dark: '#4DB8D8' },
  { name: 'sunset', light: '#D4541A', dark: '#FF8A50' },
  { name: 'midnight', light: '#6B3FA0', dark: '#BB86FC' },
]
