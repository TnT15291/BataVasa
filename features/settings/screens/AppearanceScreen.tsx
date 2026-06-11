import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme, useMode, getCardStyle } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore, type ColorMode, type ThemeName } from '@store/settingsStore'
import { THEME_SWATCHES } from '@design/themes'

const COLOR_MODES: ColorMode[] = ['light', 'dark', 'system']

export function AppearanceScreen() {
  const theme = useTheme()
  const cardStyle = getCardStyle(theme)
  const mode = useMode()
  const { t } = useTranslation()
  const { colorMode, themeName, setColorMode, setThemeName } = useSettingsStore()

  const modeLabels: Record<ColorMode, string> = {
    light: t.mode_light,
    dark: t.mode_dark,
    system: t.mode_system,
  }

  const themeLabels: Record<ThemeName, string> = {
    default: t.theme_default,
    sage: t.theme_sage,
    ocean: t.theme_ocean,
    sunset: t.theme_sunset,
    midnight: t.theme_midnight,
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg.primary }} contentContainerStyle={styles.container}>
      {/* Color Mode */}
      <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.color_mode.toUpperCase()}</Text>
      <View style={[styles.card, cardStyle, { backgroundColor: theme.bg.elevated }]}>
        <View style={styles.modeRow}>
          {COLOR_MODES.map((m) => {
            const active = colorMode === m
            return (
              <Pressable
                key={m}
                onPress={() => setColorMode(m)}
                style={[
                  styles.modeBtn,
                  {
                    backgroundColor: active ? theme.brand.primary : theme.bg.secondary,
                    borderColor: active ? theme.brand.primary : theme.border.subtle,
                  },
                ]}
              >
                <Text style={[styles.modeBtnText, { color: active ? '#fff' : theme.text.secondary }]}>
                  {modeLabels[m]}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Theme picker */}
      <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.theme.toUpperCase()}</Text>
      <View style={[styles.card, cardStyle, { backgroundColor: theme.bg.elevated }]}>
        <View style={styles.swatchGrid}>
          {THEME_SWATCHES.map((s) => {
            const active = themeName === s.name
            const color = mode === 'dark' ? s.dark : s.light
            return (
              <Pressable key={s.name} onPress={() => setThemeName(s.name)} style={styles.swatchItem}>
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    active && { borderWidth: 3, borderColor: color, opacity: 1 },
                    !active && { opacity: 0.7 },
                  ]}
                >
                  {active && <Feather name="check" size={22} color="#fff" />}
                </View>
                <Text
                  style={[
                    styles.swatchLabel,
                    { color: active ? theme.brand.primary : theme.text.secondary },
                    active && { fontWeight: '600' },
                  ]}
                >
                  {themeLabels[s.name]}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[1] },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing[4],
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
  },
  modeRow: { flexDirection: 'row', gap: spacing[2] },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeBtnText: { fontSize: 14, fontWeight: '500' },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
    justifyContent: 'space-around',
  },
  swatchItem: { alignItems: 'center', gap: spacing[2], minWidth: 56 },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: { fontSize: 12, textAlign: 'center' },
})
