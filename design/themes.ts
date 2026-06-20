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
  text: { primary: '#E7E2D0', secondary: '#C8C2AE', muted: '#92A39C', danger: '#E28B87' },
  semantic: { success: '#78A98A', warning: '#B79A5A', danger: '#E28B87', info: '#77A5BA' },
  finance: { expense: '#D98782', income: '#78A98A' },
  border: { subtle: '#2B5055', strong: '#41656A', card: '#385D62' },
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
      bg: { primary: '#123942', secondary: '#1A444C', elevated: '#22505A' },
      brand: { primary: '#88B8B1', accent: '#B5A36F' },
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
      bg: { primary: '#1A332D', secondary: '#243E37', elevated: '#2D4A42' },
      brand: { primary: '#9ABAA3', accent: '#B9A575' },
      border: { subtle: '#38564D', strong: '#496A5F', card: '#415F56' },
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
      bg: { primary: '#153944', secondary: '#204650', elevated: '#2A535E' },
      brand: { primary: '#95C0C9', accent: '#8CB9B0' },
      border: { subtle: '#385964', strong: '#4B6D78', card: '#43656F' },
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
      bg: { primary: '#342A23', secondary: '#40342B', elevated: '#4C4035' },
      brand: { primary: '#D09D7F', accent: '#C7B175' },
      border: { subtle: '#5C4C3E', strong: '#705D4B', card: '#665545' },
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
      bg: { primary: '#2A2735', secondary: '#343044', elevated: '#403B51' },
      brand: { primary: '#B9A9D0', accent: '#D0A2B6' },
      border: { subtle: '#514B63', strong: '#665F78', card: '#5C566D' },
    },
  },
}

export const THEME_SWATCHES: Array<{
  name: ThemeName
  light: string
  dark: string
}> = [
  { name: 'default', light: '#197C92', dark: '#88B8B1' },
  { name: 'sage', light: '#2F735B', dark: '#9ABAA3' },
  { name: 'ocean', light: '#176B87', dark: '#95C0C9' },
  { name: 'sunset', light: '#B85C38', dark: '#D09D7F' },
  { name: 'midnight', light: '#6653A6', dark: '#B9A9D0' },
]
