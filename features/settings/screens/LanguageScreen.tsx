import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation, LANGUAGES, type Language } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'

export function LanguageScreen() {
  const theme = useTheme()
  const { t, language } = useTranslation()
  const setLanguage = useSettingsStore((s) => s.setLanguage)

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary, padding: spacing[4] }}>
      <Text style={[styles.hint, { color: theme.text.muted }]}>{t.select_language}</Text>
      <View style={[styles.list, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        {LANGUAGES.map((lang, i) => {
          const active = language === lang.code
          return (
            <Pressable
              key={lang.code}
              onPress={() => setLanguage(lang.code as Language)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : 'transparent' },
                i === LANGUAGES.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={styles.flag}>{lang.flag}</Text>
              <Text style={[styles.label, { color: theme.text.primary }]}>{lang.nativeLabel}</Text>
              {active && (
                <Text style={[styles.check, { color: theme.brand.primary }]}>✓</Text>
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, marginBottom: spacing[3], marginLeft: spacing[1] },
  list: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
  },
  flag: { fontSize: 22 },
  label: { flex: 1, fontSize: 16 },
  check: { fontSize: 18, fontWeight: '700' },
})
