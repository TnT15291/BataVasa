import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'

type RowProps = {
  label: string
  value?: string
  onPress: () => void
  last?: boolean
}

function SettingRow({ label, value, onPress, last }: RowProps) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
        last && styles.rowLast,
      ]}
    >
      <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.rowValue, { color: theme.text.muted }]}>{value}</Text> : null}
        <Text style={[styles.chevron, { color: theme.text.muted }]}>›</Text>
      </View>
    </Pressable>
  )
}

function SectionHeader({ label }: { label: string }) {
  const theme = useTheme()
  return (
    <Text style={[styles.sectionHeader, { color: theme.text.muted }]}>{label.toUpperCase()}</Text>
  )
}

export function SettingsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const currency = useSettingsStore((s) => s.currency)

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg.primary }} contentContainerStyle={styles.container}>
      <SectionHeader label={t.appearance} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow label={t.appearance} onPress={() => router.push('/appearance')} />
        <SettingRow label={t.language} onPress={() => router.push('/language')} last />
      </View>

      <SectionHeader label={t.finance_settings} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow label={t.currency} value={currency} onPress={() => router.push('/currency')} last />
      </View>

      <SectionHeader label="AI" />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow label={t.ai_settings} onPress={() => router.push('/ai-settings')} last />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[1] },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing[4],
    marginBottom: spacing[2],
    marginLeft: spacing[1],
    letterSpacing: 0.5,
  },
  section: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 16 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowValue: { fontSize: 15 },
  chevron: { fontSize: 20, lineHeight: 22 },
})
