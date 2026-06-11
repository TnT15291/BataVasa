import { useColorScheme } from 'react-native'
import { useSettingsStore } from '@store/settingsStore'
import { themes, type ThemeColors } from './themes'
import { typography, spacing, radius } from './tokens'

export type { ThemeColors as Theme }

export function useTheme(): ThemeColors {
  const scheme = useColorScheme()
  const colorMode = useSettingsStore((s) => s.colorMode)
  const themeName = useSettingsStore((s) => s.themeName)

  const mode = colorMode === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : colorMode
  return themes[themeName][mode]
}

export function useMode(): 'light' | 'dark' {
  const scheme = useColorScheme()
  const colorMode = useSettingsStore((s) => s.colorMode)
  return colorMode === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : colorMode
}

/**
 * Returns shadow + border style for top-level card containers.
 * Inner rows (nested inside a card) should still use border.subtle.
 */
export function getCardStyle(theme: ThemeColors) {
  return {
    borderWidth: 1,
    borderColor: theme.border.card,
    shadowColor: theme.shadow.color,
    shadowOffset: theme.shadow.offset,
    shadowOpacity: theme.shadow.opacity,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  } as const
}

export { typography, spacing, radius }
