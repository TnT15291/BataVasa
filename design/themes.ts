import type { ThemeName, ColorMode } from '@store/settingsStore'

export type { ThemeName, ColorMode }

export type ThemeColors = {
  bg: { primary: string; secondary: string; elevated: string }
  text: { primary: string; secondary: string; muted: string; danger: string }
  brand: { primary: string; accent: string }
  semantic: { success: string; warning: string; danger: string; info: string }
  finance: { expense: string; income: string }
  border: { subtle: string; strong: string; card: string }
  // Command surface for the quick BataVasa help entry.
  command: { bg: string; surface: string; text: string; placeholder: string; border: string }
  shadow: {
    color: string
    offset: { width: number; height: number }
    opacity: number
    radius: number
    elevation: number
  }
}

// UI1 console = calm, flat, whitespace-led. Shadows are barely-there; structure
// comes from hairline borders + spacing, never heavy drop shadows.
const shadowLight = {
  color: '#0B1220',
  offset: { width: 0, height: 1 },
  opacity: 0.05,
  radius: 3,
  elevation: 1,
}

const shadowDark = {
  color: '#000000',
  offset: { width: 0, height: 2 },
  opacity: 0.32,
  radius: 8,
  elevation: 3,
}

const baseLight = {
  text: { primary: '#181B20', secondary: '#3D444D', muted: '#6B7280', danger: '#B4232E' },
  semantic: { success: '#1A7A46', warning: '#B26A00', danger: '#B4232E', info: '#2E63C8' },
  finance: { expense: '#B4232E', income: '#1A7A46' },
  border: { subtle: '#ECEEF1', strong: '#CDD2D9', card: '#E6E8EC' },
  command: { bg: '#FFFFFF', surface: '#F5F6F8', text: '#181B20', placeholder: '#5F6874', border: '#E3E6EA' },
  shadow: shadowLight,
}

const baseDark = {
  text: { primary: '#F3F7FA', secondary: '#C3CCD5', muted: '#8B97A2', danger: '#FF9A9A' },
  semantic: { success: '#5FC792', warning: '#F0B45F', danger: '#FF9A9A', info: '#7FB0F5' },
  finance: { expense: '#FF9A9A', income: '#5FC792' },
  border: { subtle: '#222A32', strong: '#39444E', card: '#2A333C' },
  command: { bg: '#F7F8FA', surface: '#FFFFFF', text: '#181B20', placeholder: '#5F6874', border: '#E3E6EA' },
  shadow: shadowDark,
}

type ThemeDef = { light: ThemeColors; dark: ThemeColors }

export const themes: Record<ThemeName, ThemeDef> = {
  default: {
    light: {
      ...baseLight,
      bg: { primary: '#FBFBFC', secondary: '#F1F3F6', elevated: '#FFFFFF' },
      brand: { primary: '#197C92', accent: '#7B5BB3' },
    },
    dark: {
      ...baseDark,
      bg: { primary: '#0C1117', secondary: '#141B22', elevated: '#1A222B' },
      brand: { primary: '#5FD0E3', accent: '#B9A0FF' },
    },
  },

  sage: {
    light: {
      ...baseLight,
      bg: { primary: '#FAFBFA', secondary: '#EEF3EF', elevated: '#FFFFFF' },
      brand: { primary: '#2F735B', accent: '#7A6E2F' },
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
      bg: { primary: '#FAFCFD', secondary: '#EDF3F7', elevated: '#FFFFFF' },
      brand: { primary: '#176B87', accent: '#2D7C72' },
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
      bg: { primary: '#FCFBFA', secondary: '#F4EFEB', elevated: '#FFFFFF' },
      brand: { primary: '#B85C38', accent: '#8B6A2A' },
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
      bg: { primary: '#FBFAFD', secondary: '#F1EEF7', elevated: '#FFFFFF' },
      brand: { primary: '#6653A6', accent: '#A84870' },
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
  { name: 'default', light: '#197C92', dark: '#5FD0E3' },
  { name: 'sage', light: '#2F735B', dark: '#6DA882' },
  { name: 'ocean', light: '#176B87', dark: '#4DB8D8' },
  { name: 'sunset', light: '#B85C38', dark: '#FF8A50' },
  { name: 'midnight', light: '#6653A6', dark: '#BB86FC' },
]
