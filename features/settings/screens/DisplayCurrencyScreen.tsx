import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'

const CURRENCIES = [
  { code: 'VND', name: 'Vietnamese Dong',  symbol: '₫',  flag: '🇻🇳' },
  { code: 'USD', name: 'US Dollar',         symbol: '$',  flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro',              symbol: '€',  flag: '🇪🇺' },
  { code: 'JPY', name: 'Japanese Yen',      symbol: '¥',  flag: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan',      symbol: '¥',  flag: '🇨🇳' },
  { code: 'KRW', name: 'Korean Won',        symbol: '₩',  flag: '🇰🇷' },
  { code: 'GBP', name: 'British Pound',     symbol: '£',  flag: '🇬🇧' },
  { code: 'THB', name: 'Thai Baht',         symbol: '฿',  flag: '🇹🇭' },
  { code: 'SGD', name: 'Singapore Dollar',  symbol: 'S$', flag: '🇸🇬' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar',   symbol: 'CA$',flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc',       symbol: 'Fr', flag: '🇨🇭' },
]

export function DisplayCurrencyScreen() {
  const theme = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const { displayCurrency, setDisplayCurrency } = useSettingsStore()

  function handleSelect(code: string) {
    setDisplayCurrency(code)
    router.back()
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.subtitle, { color: theme.text.muted }]}>{t.display_currency}</Text>
      <Text style={[styles.hint, { color: theme.text.muted }]}>{t.display_currency_hint}</Text>
      <View style={[styles.list, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        {CURRENCIES.map((c, i) => {
          const active = displayCurrency === c.code
          const last = i === CURRENCIES.length - 1
          return (
            <Pressable
              key={c.code}
              onPress={() => handleSelect(c.code)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : 'transparent' },
                last && styles.rowLast,
              ]}
            >
              <Text style={styles.flag}>{c.flag}</Text>
              <View style={styles.info}>
                <Text style={[styles.code, { color: theme.text.primary }]}>{c.code}</Text>
                <Text style={[styles.name, { color: theme.text.muted }]}>{c.name}</Text>
              </View>
              <Text style={[styles.symbol, { color: theme.text.secondary }]}>{c.symbol}</Text>
              {active && (
                <Text style={[styles.check, { color: theme.brand.primary }]}>✓</Text>
              )}
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[3] },
  subtitle: { fontSize: 13, marginLeft: spacing[1] },
  hint: { fontSize: 12, marginLeft: spacing[1], marginTop: -spacing[2], fontStyle: 'italic' },
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
  rowLast: { borderBottomWidth: 0 },
  flag: { fontSize: 22, width: 32 },
  info: { flex: 1 },
  code: { fontSize: 16, fontWeight: '600' },
  name: { fontSize: 13, marginTop: 1 },
  symbol: { fontSize: 16, width: 32, textAlign: 'right' },
  check: { fontSize: 18, fontWeight: '700', width: 24, textAlign: 'center' },
})
