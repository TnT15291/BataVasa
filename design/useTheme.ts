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

export { typography, spacing, radius }
