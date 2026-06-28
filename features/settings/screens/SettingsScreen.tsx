import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, Switch, Alert, Linking, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { requestLocationPermission } from '@services/location'
import { requestMicPermission } from '@services/voice'
import { requestNotificationPermission } from '@services/notifications'
import { syncWeeklyReviewNotification } from '@services/proactiveNotifications'
import { syncAnniversaryNotifications } from '@services/anniversaryNotifications'
import { weekdayToDate } from '@services/proactiveSchedule'
import { getDateFnsLocale } from '@services/locale'
import { useAuthStore } from '@store/authStore'
import { authenticate, getBiometricSupport } from '@services/biometric'
import { supabase } from '@services/supabase'
import { localizeAuthError } from '@services/authErrors'
import { PasswordInput } from '@components/PasswordInput'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@components/ui'

type IconName = keyof typeof Feather.glyphMap

// Small tinted circular icon so settings rows are scannable at a glance (the old
// text-only list was a wall of identical rows — hard for low-tech users to read).
function RowIcon({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View style={[styles.rowIcon, { backgroundColor: color + '1A' }]}>
      <Feather name={icon} size={16} color={color} />
    </View>
  )
}

type NavRowProps = {
  icon?: IconName
  color?: string
  label: string
  value?: string
  hint?: string
  onPress: () => void
  last?: boolean
  danger?: boolean
}

function SettingRow({ icon, color, label, value, hint, onPress, last, danger }: NavRowProps) {
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
      {icon ? <RowIcon icon={icon} color={danger ? theme.text.danger : color ?? theme.text.muted} /> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: danger ? theme.text.danger : theme.text.primary }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: theme.text.muted }]}>{hint}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.rowValue, { color: theme.text.muted }]}>{value}</Text> : null}
        <Feather name="chevron-right" size={20} color={theme.text.muted} />
      </View>
    </Pressable>
  )
}

type ToggleRowProps = {
  icon?: IconName
  color?: string
  label: string
  hint?: string
  value: boolean
  onValueChange: (next: boolean) => void | Promise<void>
  last?: boolean
}

function ToggleRow({ icon, color, label, hint, value, onValueChange, last }: ToggleRowProps) {
  const theme = useTheme()
  return (
    <View style={[styles.row, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated }, last && styles.rowLast]}>
      {icon ? <RowIcon icon={icon} color={color ?? theme.text.muted} /> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: theme.text.muted }]}>{hint}</Text> : null}
      </View>
      <SettingsSwitch value={value} onValueChange={onValueChange} />
    </View>
  )
}

function DisclosureRow({ icon, color, label, open, onPress, last }: { icon?: IconName; color?: string; label: string; open: boolean; onPress: () => void; last?: boolean }) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
        last && styles.rowLast,
      ]}
    >
      {icon ? <RowIcon icon={icon} color={color ?? theme.text.muted} /> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{label}</Text>
      </View>
      <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.text.muted} />
    </Pressable>
  )
}

function SectionHeader({ icon, label }: { icon?: IconName; label: string }) {
  const theme = useTheme()
  return (
    <View style={styles.sectionHeaderRow}>
      {icon ? <Feather name={icon} size={13} color={theme.text.muted} /> : null}
      <Text style={[styles.sectionHeader, { color: theme.text.muted }]}>{label}</Text>
    </View>
  )
}

function SettingsSwitch({
  value,
  onValueChange,
}: {
  value: boolean
  onValueChange: (next: boolean) => void | Promise<void>
}) {
  return (
    <Switch
      value={value}
      onValueChange={(next) => { void onValueChange(next) }}
      trackColor={{ false: '#D1D5DB', true: '#34C759' }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#D1D5DB"
      style={styles.iosSwitch}
    />
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
  const insets = useSafeAreaInsets()
  const { t, language } = useTranslation()
  const currency = useSettingsStore((s) => s.currency)
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const locationAccess = useSettingsStore((s) => s.locationAccess)
  const setLocationAccess = useSettingsStore((s) => s.setLocationAccess)
  const syncFinance = useSettingsStore((s) => s.syncFinance)
  const setSyncFinance = useSettingsStore((s) => s.setSyncFinance)
  const syncReminders = useSettingsStore((s) => s.syncReminders)
  const setSyncReminders = useSettingsStore((s) => s.setSyncReminders)
  const syncHabits = useSettingsStore((s) => s.syncHabits)
  const setSyncHabits = useSettingsStore((s) => s.setSyncHabits)
  const syncJournals = useSettingsStore((s) => s.syncJournals)
  const setSyncJournals = useSettingsStore((s) => s.setSyncJournals)
  const syncGoals = useSettingsStore((s) => s.syncGoals)
  const setSyncGoals = useSettingsStore((s) => s.setSyncGoals)
  const financeCycleStartDay = useSettingsStore((s) => s.financeCycleStartDay)
  const setFinanceCycleStartDay = useSettingsStore((s) => s.setFinanceCycleStartDay)
  const safeToSpendCountPlannedIncome = useSettingsStore((s) => s.safeToSpendCountPlannedIncome)
  const setSafeToSpendCountPlannedIncome = useSettingsStore((s) => s.setSafeToSpendCountPlannedIncome)
  const safeToSpendCarryOver = useSettingsStore((s) => s.safeToSpendCarryOver)
  const setSafeToSpendCarryOver = useSettingsStore((s) => s.setSafeToSpendCarryOver)
  const biometricLock = useSettingsStore((s) => s.biometricLock)
  const setBiometricLock = useSettingsStore((s) => s.setBiometricLock)
  const hideJournals = useSettingsStore((s) => s.hideJournals)
  const setHideJournals = useSettingsStore((s) => s.setHideJournals)
  const notificationAccess = useSettingsStore((s) => s.notificationAccess)
  const proactiveWeeklyReview = useSettingsStore((s) => s.proactiveWeeklyReview)
  const setProactiveWeeklyReview = useSettingsStore((s) => s.setProactiveWeeklyReview)
  const anniversaryReminders = useSettingsStore((s) => s.anniversaryReminders)
  const setAnniversaryReminders = useSettingsStore((s) => s.setAnniversaryReminders)
  const proactiveWeeklyDay = useSettingsStore((s) => s.proactiveWeeklyDay)
  const setProactiveWeeklyDay = useSettingsStore((s) => s.setProactiveWeeklyDay)
  const proactiveWeeklyHour = useSettingsStore((s) => s.proactiveWeeklyHour)
  const setProactiveWeeklyHour = useSettingsStore((s) => s.setProactiveWeeklyHour)
  const authConfigured = useAuthStore((s) => s.configured)
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)
  const [journalAuthTarget, setJournalAuthTarget] = useState<boolean | null>(null)
  const [journalPassword, setJournalPassword] = useState('')
  const [journalAuthError, setJournalAuthError] = useState<string | null>(null)
  const [journalAuthBusy, setJournalAuthBusy] = useState(false)
  // Advanced layers stay collapsed by default so the first screen a low-tech user
  // sees is short and plain — power settings are one tap away, not in their face.
  const [showModules, setShowModules] = useState(false)
  const [showFinanceAdvanced, setShowFinanceAdvanced] = useState(false)
  const canUsePassword = authConfigured && !!session?.user?.email && !!supabase

  // One master Cloud Sync switch (CLAUDE Rule 1: per-module sync still exists,
  // tucked under "Manage by module"). Master is ON only when every module is ON;
  // flipping it sets them all at once.
  const allSync = syncFinance && syncReminders && syncHabits && syncJournals && syncGoals
  const setAllSync = async (next: boolean) => {
    await Promise.all([
      setSyncFinance(next),
      setSyncReminders(next),
      setSyncHabits(next),
      setSyncJournals(next),
      setSyncGoals(next),
    ])
  }

  const moduleSync: { key: string; label: string; value: boolean; set: (next: boolean) => void | Promise<void>; icon: IconName; color: string; route: string }[] = [
    { key: 'finance', label: t.nav_finance, value: syncFinance, set: setSyncFinance, icon: MODULE_ICONS.finance, color: MODULE_COLORS.finance, route: 'finance' },
    { key: 'reminders', label: t.nav_reminders, value: syncReminders, set: setSyncReminders, icon: MODULE_ICONS.tasks, color: MODULE_COLORS.tasks, route: 'reminders' },
    { key: 'habits', label: t.habits, value: syncHabits, set: setSyncHabits, icon: MODULE_ICONS.habits, color: MODULE_COLORS.habits, route: 'habits' },
    { key: 'journals', label: t.nav_journal, value: syncJournals, set: setSyncJournals, icon: MODULE_ICONS.journal, color: MODULE_COLORS.journal, route: 'journals' },
    { key: 'goals', label: t.nav_goals, value: syncGoals, set: setSyncGoals, icon: MODULE_ICONS.goals as IconName, color: MODULE_COLORS.analysis, route: 'goals' },
  ]

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

  const openJournalPassword = (next: boolean) => {
    setJournalPassword('')
    setJournalAuthError(null)
    setJournalAuthTarget(next)
  }

  const closeJournalPassword = () => {
    if (journalAuthBusy) return
    setJournalAuthTarget(null)
    setJournalPassword('')
    setJournalAuthError(null)
  }

  const authenticateJournalBiometric = async (next: boolean) => {
    const ok = await authenticate(t.hide_journals_auth_title, t.cancel)
    if (!ok) return
    await setHideJournals(next)
  }

  const toggleHideJournals = async (next: boolean) => {
    const { available } = await getBiometricSupport()
    if (available && canUsePassword) {
      Alert.alert(t.hide_journals_auth_title, t.hide_journals_auth_msg, [
        { text: t.cancel, style: 'cancel' },
        { text: t.hide_journals_auth_biometric, onPress: () => { void authenticateJournalBiometric(next) } },
        { text: t.hide_journals_auth_password, onPress: () => openJournalPassword(next) },
      ])
      return
    }
    if (available) {
      await authenticateJournalBiometric(next)
      return
    }
    if (canUsePassword) {
      openJournalPassword(next)
      return
    }
    Alert.alert(t.hide_journals_auth_title, t.hide_journals_auth_unavailable)
  }

  const submitJournalPassword = async () => {
    const email = session?.user?.email
    if (!email || !supabase || journalAuthTarget === null) return
    if (journalPassword.length === 0) {
      setJournalAuthError(t.auth_password_ph)
      return
    }
    setJournalAuthBusy(true)
    setJournalAuthError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: journalPassword })
    if (error) {
      setJournalAuthBusy(false)
      setJournalAuthError(localizeAuthError(error, t))
      return
    }
    await setHideJournals(journalAuthTarget)
    setJournalAuthBusy(false)
    closeJournalPassword()
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

  const toggleProactiveWeekly = async (next: boolean) => {
    if (next) {
      if (!notificationAccess) {
        Alert.alert(t.weekly_review_reminder, t.weekly_review_needs_notifications)
        return
      }
      const granted = await requestNotificationPermission()
      if (!granted) {
        Alert.alert(t.notification_permission_title, t.notification_permission_denied_msg, [
          { text: t.cancel, style: 'cancel' },
          { text: t.go_to_settings, onPress: () => { void Linking.openSettings() } },
        ])
        return
      }
    }
    await setProactiveWeeklyReview(next)
    await syncWeeklyReviewNotification()
  }

  const toggleAnniversary = async (next: boolean) => {
    if (next) {
      if (!notificationAccess) {
        Alert.alert(t.anniversary_reminder, t.weekly_review_needs_notifications)
        return
      }
      const granted = await requestNotificationPermission()
      if (!granted) {
        Alert.alert(t.notification_permission_title, t.notification_permission_denied_msg, [
          { text: t.cancel, style: 'cancel' },
          { text: t.go_to_settings, onPress: () => { void Linking.openSettings() } },
        ])
        return
      }
    }
    await setAnniversaryReminders(next)
    await syncAnniversaryNotifications()
  }

  const changeWeeklyDay = async (day: number) => {
    await setProactiveWeeklyDay(day)
    await syncWeeklyReviewNotification()
  }

  const changeWeeklyHour = async (delta: number) => {
    await setProactiveWeeklyHour(proactiveWeeklyHour + delta)
    await syncWeeklyReviewNotification()
  }

  const weekdayLabel = (weekday: number): string =>
    format(weekdayToDate(weekday), 'EEE', { locale: getDateFnsLocale(language) })

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing[2] }]}>
      <AppHeader subtitle={t.settings} onBack={router.canGoBack() ? () => router.back() : undefined} />

      {authConfigured && (
        <>
          <SectionHeader icon="user" label={t.account} />
          <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <View style={[styles.row, { borderColor: theme.border.subtle }]}>
              <RowIcon icon="mail" color={theme.brand.primary} />
              <View style={styles.rowText}>
                <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.auth_signed_in_as}</Text>
                <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{session?.user?.email ?? '—'}</Text>
              </View>
            </View>
            <SettingRow icon="log-out" label={t.auth_sign_out} onPress={onSignOut} danger last />
          </View>
        </>
      )}

      {/* Display & Language — high-value, low-risk, things people change often. */}
      <SectionHeader icon="eye" label={t.settings_group_display} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow icon="sun" color={MODULE_COLORS.analysis} label={t.appearance} onPress={() => router.push('/appearance')} />
        <SettingRow icon="globe" color={MODULE_COLORS.journal} label={t.language} onPress={() => router.push('/language')} last />
      </View>

      {/* Notifications — system permission + the weekly review reminder, together. */}
      <SectionHeader icon="bell" label={t.settings_group_notifications} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow icon="bell" color={MODULE_COLORS.tasks} label={t.notification_permission_title} hint={t.notification_permission_hint} onPress={requestNotifications} />
        <ToggleRow
          icon="gift"
          color={MODULE_COLORS.journal}
          label={t.anniversary_reminder}
          hint={t.anniversary_reminder_hint}
          value={anniversaryReminders}
          onValueChange={toggleAnniversary}
        />
        <ToggleRow
          icon="calendar"
          color={MODULE_COLORS.analysis}
          label={t.weekly_review_reminder}
          hint={t.weekly_review_reminder_hint}
          value={proactiveWeeklyReview}
          onValueChange={toggleProactiveWeekly}
          last={!proactiveWeeklyReview}
        />
        {proactiveWeeklyReview && (
          <>
            <View style={[styles.row, { borderColor: theme.border.subtle, flexDirection: 'column', alignItems: 'stretch', gap: spacing[2] }]}>
              <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.weekly_review_reminder_day}</Text>
              <View style={styles.dayChipsRow}>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const active = proactiveWeeklyDay === day
                  return (
                    <Pressable
                      key={day}
                      onPress={() => { void changeWeeklyDay(day) }}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: active ? theme.brand.primary : theme.bg.secondary,
                          borderColor: active ? theme.brand.primary : theme.border.subtle,
                        },
                      ]}
                    >
                      <Text style={[styles.dayChipText, { color: active ? theme.brand.onPrimary : theme.text.secondary }]}>
                        {weekdayLabel(day)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
            <View style={[styles.row, styles.rowLast, { borderColor: theme.border.subtle }]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.weekly_review_reminder_time}</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => { void changeWeeklyHour(-1) }}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={[styles.stepBtn, { borderColor: theme.border.strong, backgroundColor: theme.bg.secondary }]}
                >
                  <Text style={[styles.stepBtnText, { color: theme.text.primary }]}>−</Text>
                </Pressable>
                <Text style={[styles.stepValue, { color: theme.text.primary }]}>{`${String(proactiveWeeklyHour).padStart(2, '0')}:00`}</Text>
                <Pressable
                  onPress={() => { void changeWeeklyHour(1) }}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={[styles.stepBtn, { borderColor: theme.border.strong, backgroundColor: theme.bg.secondary }]}
                >
                  <Text style={[styles.stepBtnText, { color: theme.text.primary }]}>+</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Privacy & Security */}
      <SectionHeader icon="lock" label={t.privacy} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <ToggleRow icon="lock" color={MODULE_COLORS.finance} label={t.biometric_lock} hint={t.biometric_lock_hint} value={biometricLock} onValueChange={toggleBiometric} />
        <ToggleRow icon="eye-off" color={MODULE_COLORS.journal} label={t.hide_journals} hint={t.hide_journals_hint} value={hideJournals} onValueChange={toggleHideJournals} />
        <ToggleRow icon="map-pin" color={MODULE_COLORS.tasks} label={t.location_access} hint={t.location_access_hint} value={locationAccess} onValueChange={toggleLocation} />
        <SettingRow icon="mic" color={MODULE_COLORS.habits} label={t.mic_permission_title} hint={t.mic_permission_hint} onPress={requestMicrophone} last />
      </View>

      {/* AI */}
      <SectionHeader icon="zap" label="AI" />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow icon="cpu" color={MODULE_COLORS.analysis} label={t.ai_settings} onPress={() => router.push('/ai-settings')} last />
      </View>

      {/* Finance — only Currency stays in front; everything else behind Advanced. */}
      <SectionHeader icon={MODULE_ICONS.finance} label={t.finance_settings} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow icon="dollar-sign" color={MODULE_COLORS.finance} label={t.currency} value={currency} onPress={() => router.push('/currency')} />
        <DisclosureRow icon="sliders" color={MODULE_COLORS.finance} label={t.settings_finance_advanced} open={showFinanceAdvanced} onPress={() => setShowFinanceAdvanced((v) => !v)} last={!showFinanceAdvanced} />
        {showFinanceAdvanced && (
          <>
            <SettingRow icon="repeat" color={MODULE_COLORS.finance} label={t.display_currency} value={displayCurrency} onPress={() => router.push('/display-currency')} />
            <View style={[styles.row, { borderColor: theme.border.subtle }]}>
              <RowIcon icon="calendar" color={MODULE_COLORS.finance} />
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.finance_cycle_start}</Text>
                <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.finance_cycle_start_hint}</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => { void setFinanceCycleStartDay(financeCycleStartDay - 1) }}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={[styles.stepBtn, { borderColor: theme.border.strong, backgroundColor: theme.bg.secondary }]}
                >
                  <Text style={[styles.stepBtnText, { color: theme.text.primary }]}>−</Text>
                </Pressable>
                <Text style={[styles.stepValue, { color: theme.text.primary }]}>{financeCycleStartDay}</Text>
                <Pressable
                  onPress={() => { void setFinanceCycleStartDay(financeCycleStartDay + 1) }}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={[styles.stepBtn, { borderColor: theme.border.strong, backgroundColor: theme.bg.secondary }]}
                >
                  <Text style={[styles.stepBtnText, { color: theme.text.primary }]}>+</Text>
                </Pressable>
              </View>
            </View>
            <ToggleRow icon="trending-up" color={MODULE_COLORS.finance} label={t.safe_count_planned_income} hint={t.safe_count_planned_income_hint} value={safeToSpendCountPlannedIncome} onValueChange={setSafeToSpendCountPlannedIncome} />
            <ToggleRow icon="rotate-ccw" color={MODULE_COLORS.finance} label={t.safe_carry_over} hint={t.safe_carry_over_hint} value={safeToSpendCarryOver} onValueChange={setSafeToSpendCarryOver} />
            <SettingRow icon="tag" color={MODULE_COLORS.finance} label={t.categories} onPress={() => router.push('/categories')} last />
          </>
        )}
      </View>

      {/* Data & Backup — one master Sync; per-module sync/export/delete behind a disclosure. */}
      <SectionHeader icon="cloud" label={t.settings_group_data} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <ToggleRow icon="refresh-cw" color={MODULE_COLORS.analysis} label={t.sync_data} hint={t.settings_sync_all_hint} value={allSync} onValueChange={setAllSync} />
        <DisclosureRow icon="sliders" color={MODULE_COLORS.analysis} label={t.settings_manage_by_module} open={showModules} onPress={() => setShowModules((v) => !v)} last={!showModules} />
        {showModules && moduleSync.map((m, i) => (
          <Pressable
            key={m.key}
            onPress={() => router.push(`/data-management?module=${m.route}` as any)}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
              i === moduleSync.length - 1 && styles.rowLast,
            ]}
          >
            <RowIcon icon={m.icon} color={m.color} />
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{m.label}</Text>
              <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.data_management_hint}</Text>
            </View>
            <SettingsSwitch value={m.value} onValueChange={m.set} />
          </Pressable>
        ))}
      </View>

      {/* Help */}
      <SectionHeader icon="help-circle" label={t.help_title} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow icon="help-circle" color={MODULE_COLORS.analysis} label={t.help_quickstart_title} onPress={() => router.push('/help')} />
        <SettingRow icon="message-circle" color={MODULE_COLORS.analysis} label={t.command_placeholder} onPress={() => router.push('/quick-batavasa')} last />
      </View>

    </ScrollView>
    {/* Opaque backdrop behind the translucent status bar (native header now
        hidden) so scrolled content doesn't collide with the system clock. */}
    <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top, backgroundColor: theme.bg.primary }]} />
    <Modal transparent visible={journalAuthTarget !== null} animationType="fade" onRequestClose={closeJournalPassword}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <Text style={[styles.modalTitle, { color: theme.text.primary }]}>{t.hide_journals_password_title}</Text>
          <Text style={[styles.modalHint, { color: theme.text.muted }]}>{t.hide_journals_password_hint}</Text>
          <PasswordInput
            value={journalPassword}
            onChangeText={setJournalPassword}
            placeholder={t.hide_journals_password_placeholder}
            editable={!journalAuthBusy}
            onSubmitEditing={() => { void submitJournalPassword() }}
            returnKeyType="done"
          />
          {journalAuthError ? <Text style={[styles.modalError, { color: theme.text.danger }]}>{journalAuthError}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable
              onPress={closeJournalPassword}
              disabled={journalAuthBusy}
              style={[styles.modalSecondaryBtn, { borderColor: theme.border.strong }]}
            >
              <Text style={[styles.modalSecondaryText, { color: theme.text.secondary }]}>{t.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={() => { void submitJournalPassword() }}
              disabled={journalAuthBusy}
              style={[styles.modalPrimaryBtn, { backgroundColor: journalAuthBusy ? theme.text.muted : theme.brand.primary }]}
            >
              {journalAuthBusy ? <ActivityIndicator color={theme.brand.onPrimary} /> : <Text style={[styles.modalPrimaryText, { color: theme.brand.onPrimary }]}>{t.done}</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[1] },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing[4],
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, paddingRight: spacing[2] },
  rowLabel: { fontSize: 16 },
  rowHint: { fontSize: 12, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowValue: { fontSize: 15 },
  iosSwitch: { transform: [{ scaleX: 0.86 }, { scaleY: 0.86 }] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, fontWeight: '400' },
  stepValue: { fontSize: 16, fontWeight: '700', minWidth: 48, textAlign: 'center' },
  dayChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  dayChip: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
    minWidth: 44,
    alignItems: 'center',
  },
  dayChipText: { fontSize: 13, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing[5],
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalHint: { fontSize: 13, lineHeight: 18 },
  modalError: { fontSize: 12, fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[1] },
  modalSecondaryBtn: {
    minHeight: 44,
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: { fontSize: 14, fontWeight: '700' },
  modalPrimaryBtn: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
})
