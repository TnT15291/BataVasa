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
  text: { primary: '#F2EEDB', secondary: '#D6D2BC', muted: '#9FB1AA', danger: '#FF9A9A' },
  semantic: { success: '#6BBF8F', warning: '#D9A441', danger: '#FF9A9A', info: '#78B7D8' },
  finance: { expense: '#FF9A9A', income: '#6BBF8F' },
  border: { subtle: '#164955', strong: '#2D6570', card: '#1E5560' },
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
      bg: { primary: '#073642', secondary: '#0B3A44', elevated: '#10424D' },
      brand: { primary: '#2AA198', accent: '#B58900' },
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
      bg: { primary: '#102D26', secondary: '#173A31', elevated: '#20483E' },
      brand: { primary: '#7FB996', accent: '#C4A165' },
      border: { subtle: '#245043', strong: '#356A59', card: '#2C5C4E' },
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
      bg: { primary: '#073040', secondary: '#0D4052', elevated: '#145164' },
      brand: { primary: '#5EC5DD', accent: '#58C3B7' },
      border: { subtle: '#1A5366', strong: '#2C6A7C', card: '#235D70' },
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
      bg: { primary: '#2F2118', secondary: '#3D2A1D', elevated: '#4B3526' },
      brand: { primary: '#FF9A62', accent: '#E7C65A' },
      border: { subtle: '#5A3D2B', strong: '#6D4B36', card: '#60442F' },
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
      bg: { primary: '#221E35', secondary: '#2D2845', elevated: '#393255' },
      brand: { primary: '#C6A1FF', accent: '#F2A6C4' },
      border: { subtle: '#433B60', strong: '#574D78', card: '#4B436B' },
    },
  },
}

export const THEME_SWATCHES: Array<{
  name: ThemeName
  light: string
  dark: string
}> = [
  { name: 'default', light: '#197C92', dark: '#2AA198' },
  { name: 'sage', light: '#2F735B', dark: '#6DA882' },
  { name: 'ocean', light: '#176B87', dark: '#4DB8D8' },
  { name: 'sunset', light: '#B85C38', dark: '#FF8A50' },
  { name: 'midnight', light: '#6653A6', dark: '#BB86FC' },
]
