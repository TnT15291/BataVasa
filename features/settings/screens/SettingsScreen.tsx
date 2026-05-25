import { View, Text, Pressable, StyleSheet, ScrollView, Switch, Alert, Linking } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { requestLocationPermission } from '@services/location'
import { requestMicPermission } from '@services/voice'
import { requestNotificationPermission } from '@services/notifications'
import { useAuthStore } from '@store/authStore'
import { getBiometricSupport } from '@services/biometric'

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
        <Feather name="chevron-right" size={20} color={theme.text.muted} />
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

function confirmPermissionPrompt(title: string, message: string, cancel: string, next: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: next, onPress: () => resolve(true) },
    ])
  })
}

export function SettingsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const currency = useSettingsStore((s) => s.currency)
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const locationAccess = useSettingsStore((s) => s.locationAccess)
  const setLocationAccess = useSettingsStore((s) => s.setLocationAccess)
  const aiAutoConfirm = useSettingsStore((s) => s.aiAutoConfirm)
  const setAIAutoConfirm = useSettingsStore((s) => s.setAIAutoConfirm)
  const syncFinance = useSettingsStore((s) => s.syncFinance)
  const setSyncFinance = useSettingsStore((s) => s.setSyncFinance)
  const syncReminders = useSettingsStore((s) => s.syncReminders)
  const setSyncReminders = useSettingsStore((s) => s.setSyncReminders)
  const syncHabits = useSettingsStore((s) => s.syncHabits)
  const setSyncHabits = useSettingsStore((s) => s.setSyncHabits)
  const syncJournals = useSettingsStore((s) => s.syncJournals)
  const setSyncJournals = useSettingsStore((s) => s.setSyncJournals)
  const biometricLock = useSettingsStore((s) => s.biometricLock)
  const setBiometricLock = useSettingsStore((s) => s.setBiometricLock)
  const authConfigured = useAuthStore((s) => s.configured)
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)

  const onSignOut = () => {
    Alert.alert(t.auth_sign_out, t.auth_sign_out_confirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.auth_sign_out, style: 'destructive', onPress: () => { void signOut() } },
    ])
  }

  const toggleBiometric = async (next: boolean) => {
    if (next) {
      const { available } = await getBiometricSupport()
      if (!available) {
        Alert.alert('', t.biometric_unavailable)
        return
      }
    }
    await setBiometricLock(next)
  }

  const toggleLocation = async (next: boolean) => {
    if (next) {
      const shouldRequest = await confirmPermissionPrompt(
        t.location_access,
        t.location_access_hint,
        t.cancel,
        t.onboarding_next
      )
      if (!shouldRequest) return
      const granted = await requestLocationPermission()
      if (!granted) {
        Alert.alert(t.location_permission_denied, t.location_permission_denied_msg, [
          { text: t.cancel, style: 'cancel' },
          { text: t.go_to_settings, onPress: () => { void Linking.openSettings() } },
        ])
        return
      }
    }
    await setLocationAccess(next)
  }

  const requestMicrophone = async () => {
    const shouldRequest = await confirmPermissionPrompt(t.mic_permission_title, t.mic_permission_hint, t.cancel, t.onboarding_next)
    if (!shouldRequest) return
    const granted = await requestMicPermission()
    Alert.alert(granted ? t.permission_ready : t.mic_permission_title, granted ? t.mic_permission_ready_msg : t.mic_denied, granted ? undefined : [
      { text: t.cancel, style: 'cancel' },
      { text: t.go_to_settings, onPress: () => { void Linking.openSettings() } },
    ])
  }

  const requestNotifications = async () => {
    const shouldRequest = await confirmPermissionPrompt(t.notification_permission_title, t.notification_permission_hint, t.cancel, t.onboarding_next)
    if (!shouldRequest) return
    const granted = await requestNotificationPermission()
    Alert.alert(granted ? t.permission_ready : t.notification_permission_title, granted ? t.notification_permission_ready_msg : t.notification_permission_denied_msg, granted ? undefined : [
      { text: t.cancel, style: 'cancel' },
      { text: t.go_to_settings, onPress: () => { void Linking.openSettings() } },
    ])
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg.primary }} contentContainerStyle={styles.container}>
      {authConfigured && (
        <>
          <SectionHeader label={t.account} />
          <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <View style={[styles.row, { borderColor: theme.border.subtle }]}>
              <View style={{ flex: 1, paddingRight: spacing[3] }}>
                <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.auth_signed_in_as}</Text>
                <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{session?.user?.email ?? '—'}</Text>
              </View>
            </View>
            <Pressable
              onPress={onSignOut}
              style={({ pressed }) => [
                styles.row,
                styles.rowLast,
                { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
              ]}
            >
              <Text style={[styles.rowLabel, { color: theme.text.danger }]}>{t.auth_sign_out}</Text>
            </Pressable>
          </View>
        </>
      )}

      <SectionHeader label={t.help_title} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow label={t.help_quickstart_title} onPress={() => router.push('/help')} last />
      </View>

      <SectionHeader label={t.appearance} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow label={t.appearance} onPress={() => router.push('/appearance')} />
        <SettingRow label={t.language} onPress={() => router.push('/language')} last />
      </View>

      <SectionHeader label={t.finance_settings} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={[styles.row, { borderColor: theme.border.subtle }]}>
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.sync_data}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.sync_data_hint}</Text>
          </View>
          <Switch value={syncFinance} onValueChange={setSyncFinance} />
        </View>
        <SettingRow label={t.currency} value={currency} onPress={() => router.push('/currency')} />
        <SettingRow label={t.display_currency} value={displayCurrency} onPress={() => router.push('/display-currency')} />
        <SettingRow label={t.categories} onPress={() => router.push('/categories')} />
        <Pressable
          onPress={() => router.push('/data-management?module=finance')}
          style={({ pressed }) => [
            styles.row,
            { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.data_management}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.data_management_hint}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push('/data-management?module=finance')}
          style={({ pressed }) => [
            styles.row,
            styles.rowLast,
            { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.danger }]}>{t.delete_all_data}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.data_management_delete_hint}</Text>
          </View>
        </Pressable>
      </View>

      <SectionHeader label={t.nav_reminders} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={[styles.row, { borderColor: theme.border.subtle }]}>
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.sync_data}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.sync_data_hint}</Text>
          </View>
          <Switch value={syncReminders} onValueChange={setSyncReminders} />
        </View>
        <SettingRow label={t.reminders} onPress={() => router.push('/reminders')} />
        <Pressable
          onPress={() => router.push('/data-management?module=reminders')}
          style={({ pressed }) => [
            styles.row,
            { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.export_reminders}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.export_reminders_hint}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push('/data-management?module=reminders')}
          style={({ pressed }) => [
            styles.row,
            styles.rowLast,
            { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.danger }]}>{t.delete_all_reminders}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.delete_all_reminders_hint}</Text>
          </View>
        </Pressable>
      </View>

      <SectionHeader label={t.habits} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={[styles.row, { borderColor: theme.border.subtle }]}>
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.sync_data}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.sync_data_hint}</Text>
          </View>
          <Switch value={syncHabits} onValueChange={setSyncHabits} />
        </View>
        <SettingRow label={t.habits} onPress={() => router.push('/habits')} />
        <Pressable
          onPress={() => router.push('/data-management?module=habits')}
          style={({ pressed }) => [styles.row, { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated }]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.export_habits}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.export_habits_hint}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push('/data-management?module=habits')}
          style={({ pressed }) => [styles.row, styles.rowLast, { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated }]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.danger }]}>{t.delete_all_habits}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.delete_all_habits_hint}</Text>
          </View>
        </Pressable>
      </View>

      <SectionHeader label={t.nav_journal} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={[styles.row, { borderColor: theme.border.subtle }]}>
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.sync_data}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.sync_data_hint}</Text>
          </View>
          <Switch value={syncJournals} onValueChange={setSyncJournals} />
        </View>
        <SettingRow label={t.journals} onPress={() => router.push('/journals')} />
        <Pressable
          onPress={() => router.push('/data-management?module=journals')}
          style={({ pressed }) => [
            styles.row,
            { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.export_journals}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.export_journals_hint}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push('/data-management?module=journals')}
          style={({ pressed }) => [
            styles.row,
            styles.rowLast,
            { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.danger }]}>{t.delete_all_journals}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.delete_all_journals_hint}</Text>
          </View>
        </Pressable>
      </View>

      <SectionHeader label={t.privacy} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={[styles.row, { borderColor: theme.border.subtle }]}>
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.biometric_lock}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.biometric_lock_hint}</Text>
          </View>
          <Switch value={biometricLock} onValueChange={toggleBiometric} />
        </View>
        <View style={[styles.row, { borderColor: theme.border.subtle }]}>
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.location_access}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.location_access_hint}</Text>
          </View>
          <Switch value={locationAccess} onValueChange={toggleLocation} />
        </View>
        <Pressable
          onPress={requestMicrophone}
          style={({ pressed }) => [
            styles.row,
            { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.mic_permission_title}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.mic_permission_hint}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={requestNotifications}
          style={({ pressed }) => [
            styles.row,
            styles.rowLast,
            { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.notification_permission_title}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.notification_permission_hint}</Text>
          </View>
        </Pressable>
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
})
