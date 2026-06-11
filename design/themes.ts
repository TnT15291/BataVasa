import type { ThemeName, ColorMode } from '@store/settingsStore'

export type { ThemeName, ColorMode }

export type ThemeColors = {
  bg: { primary: string; secondary: string; elevated: string }
  text: { primary: string; secondary: string; muted: string; danger: string }
  brand: { primary: string; accent: string }
  semantic: { success: string; warning: string; danger: string; info: string }
  finance: { expense: string; income: string }
  border: { subtle: string; strong: string; card: string }
  shadow: {
    color: string
    offset: { width: number; height: number }
    opacity: number
    radius: number
    elevation: number
  }
}

const shadowLight = {
  color: '#000000',
  offset: { width: 0, height: 1 },
  opacity: 0.025,
  radius: 3,
  elevation: 1,
}

const shadowDark = {
  color: '#000000',
  offset: { width: 0, height: 2 },
  opacity: 0.28,
  radius: 6,
  elevation: 3,
}

const baseLight = {
  text: { primary: '#20201D', secondary: '#4D493F', muted: '#6F6A60', danger: '#A33A32' },
  semantic: { success: '#3E7C59', warning: '#B87521', danger: '#A33A32', info: '#4C6F91' },
  finance: { expense: '#A33A32', income: '#3E7C59' },
  border: { subtle: '#DDD5C8', strong: '#BEB2A2', card: '#D7CCBA' },
  shadow: shadowLight,
}

const baseDark = {
  text: { primary: '#F6F0E7', secondary: '#D2C8B8', muted: '#A99D8C', danger: '#E19A94' },
  semantic: { success: '#8FBE9D', warning: '#E0AD63', danger: '#E19A94', info: '#8FAFCA' },
  finance: { expense: '#E19A94', income: '#8FBE9D' },
  border: { subtle: '#352F27', strong: '#51483A', card: '#4A4034' },
  shadow: shadowDark,
}

type ThemeDef = { light: ThemeColors; dark: ThemeColors }

export const themes: Record<ThemeName, ThemeDef> = {
  default: {
    light: {
      ...baseLight,
      bg: { primary: '#F7F4EE', secondary: '#EDE7DC', elevated: '#FFFDF8' },
      brand: { primary: '#2F6F73', accent: '#C9853E' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#15130F', secondary: '#211E18', elevated: '#2B261F' },
      brand: { primary: '#79B8B6', accent: '#D9A15C' },
    },
  },

  sage: {
    light: {
      ...baseLight,
      bg: { primary: '#F7FAF6', secondary: '#EBF3E8', elevated: '#FFFFFF' },
      brand: { primary: '#527B63', accent: '#947449' },
      border: { subtle: '#DDE8D9', strong: '#C5D9BF', card: '#E3ECDD' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#0C160A', secondary: '#152812', elevated: '#1E3A1A' },
      brand: { primary: '#6DA882', accent: '#C4A165' },
      border: { subtle: '#1C2E18', strong: '#28401F', card: '#2C4826' },
    },
  },

  ocean: {
    light: {
      ...baseLight,
      bg: { primary: '#F0F9FC', secondary: '#E0F2F7', elevated: '#FFFFFF' },
      brand: { primary: '#2388AD', accent: '#258A7D' },
      border: { subtle: '#D0EBF5', strong: '#A8D5E8', card: '#D9EDF5' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#051822', secondary: '#092A3F', elevated: '#0E3C58' },
      brand: { primary: '#4DB8D8', accent: '#4DBDB4' },
      border: { subtle: '#0D2E40', strong: '#174055', card: '#184A65' },
    },
  },

  sunset: {
    light: {
      ...baseLight,
      bg: { primary: '#FFF8F3', secondary: '#FFEDE0', elevated: '#FFFFFF' },
      brand: { primary: '#DD6A38', accent: '#C08A24' },
      border: { subtle: '#F5DDD0', strong: '#E8C5AD', card: '#F1D8C8' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#1E0800', secondary: '#2D1200', elevated: '#3D1C06' },
      brand: { primary: '#FF8A50', accent: '#FFD740' },
      border: { subtle: '#2E1400', strong: '#402210', card: '#4A2810' },
    },
  },

  midnight: {
    light: {
      ...baseLight,
      bg: { primary: '#F9F5FF', secondary: '#EDE7F6', elevated: '#FFFFFF' },
      brand: { primary: '#7B55AD', accent: '#CF3C73' },
      border: { subtle: '#E2D5F5', strong: '#C9B8E8', card: '#E5D9F5' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#120828', secondary: '#1D1040', elevated: '#271854' },
      brand: { primary: '#BB86FC', accent: '#F48FB1' },
      border: { subtle: '#1E1035', strong: '#2E1858', card: '#32206A' },
    },
  },
}

export const THEME_SWATCHES: Array<{
  name: ThemeName
  light: string
  dark: string
}> = [
  { name: 'default', light: '#2F6F73', dark: '#79B8B6' },
  { name: 'sage', light: '#527B63', dark: '#6DA882' },
  { name: 'ocean', light: '#2388AD', dark: '#4DB8D8' },
  { name: 'sunset', light: '#DD6A38', dark: '#FF8A50' },
  { name: 'midnight', light: '#7B55AD', dark: '#BB86FC' },
]
