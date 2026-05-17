import { View, Text, Pressable, StyleSheet, ScrollView, Switch, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { useFinanceStore } from '@store/financeStore'
import { requestLocationPermission } from '@services/location'

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
  const locationAccess = useSettingsStore((s) => s.locationAccess)
  const setLocationAccess = useSettingsStore((s) => s.setLocationAccess)
  const aiAutoConfirm = useSettingsStore((s) => s.aiAutoConfirm)
  const setAIAutoConfirm = useSettingsStore((s) => s.setAIAutoConfirm)
  const wipeFinance = useFinanceStore((s) => s.wipeAll)

  const toggleLocation = async (next: boolean) => {
    if (next) {
      const granted = await requestLocationPermission()
      if (!granted) {
        Alert.alert(t.location_permission_denied, t.location_permission_denied_msg)
        return
      }
    }
    await setLocationAccess(next)
  }

  const onDeleteFinanceData = () => {
    // Double-confirm pattern for destructive action
    Alert.alert(t.confirm_wipe_title, t.confirm_wipe_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          Alert.alert(t.confirm_wipe_final_title, t.confirm_wipe_final_msg, [
            { text: t.cancel, style: 'cancel' },
            {
              text: t.delete,
              style: 'destructive',
              onPress: async () => {
                const r = await wipeFinance()
                if (r.ok) {
                  Alert.alert(t.wipe_success.replace('{{count}}', String(r.deleted ?? 0)))
                } else {
                  Alert.alert(t.could_not_save, r.error ?? '')
                }
              },
            },
          ])
        },
      },
    ])
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg.primary }} contentContainerStyle={styles.container}>
      <SectionHeader label={t.appearance} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow label={t.appearance} onPress={() => router.push('/appearance')} />
        <SettingRow label={t.language} onPress={() => router.push('/language')} last />
      </View>

      <SectionHeader label={t.finance_settings} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow label={t.currency} value={currency} onPress={() => router.push('/currency')} />
        <Pressable
          onPress={onDeleteFinanceData}
          style={({ pressed }) => [
            styles.row,
            styles.rowLast,
            { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.danger }]}>{t.delete_all_data}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.delete_all_data_hint}</Text>
          </View>
        </Pressable>
      </View>

      <SectionHeader label={t.privacy} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={[styles.row, styles.rowLast, { borderColor: theme.border.subtle }]}>
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.location_access}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.location_access_hint}</Text>
          </View>
          <Switch value={locationAccess} onValueChange={toggleLocation} />
        </View>
      </View>

      <SectionHeader label="AI" />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow label={t.ai_settings} onPress={() => router.push('/ai-settings')} />
        <View style={[styles.row, styles.rowLast, { borderColor: theme.border.subtle }]}>
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.ai_auto_confirm}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.ai_auto_confirm_hint}</Text>
          </View>
          <Switch value={aiAutoConfirm} onValueChange={setAIAutoConfirm} />
        </View>
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
  rowHint: { fontSize: 12, marginTop: 4 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowValue: { fontSize: 15 },
  chevron: { fontSize: 20, lineHeight: 22 },
})
