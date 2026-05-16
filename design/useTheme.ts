import { useColorScheme } from 'react-native'
import { colors, type Theme, type ThemeMode } from './tokens'

export function useTheme(): Theme {
  const scheme = useColorScheme()
  const mode: ThemeMode = scheme === 'dark' ? 'dark' : 'light'
  return colors[mode]
}
