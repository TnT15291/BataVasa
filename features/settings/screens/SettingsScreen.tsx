import { View, Text, Pressable, StyleSheet, ScrollView, Switch, Alert, Share } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { useFinanceStore } from '@store/financeStore'
import { requestLocationPermission } from '@services/location'
import { exportAllData } from '@features/finance/services'
import { useRemindersStore } from '@store/remindersStore'
import { exportAllReminders } from '@features/reminders/services'
import { useJournalsStore } from '@store/journalsStore'
import { exportAllJournals } from '@features/journals/services'
import { useHabitsStore } from '@store/habitsStore'
import { exportAllHabits } from '@features/habits/services'

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
  const displayCurrency = useSettingsStore((s) => s.displayCurrency)
  const locationAccess = useSettingsStore((s) => s.locationAccess)
  const setLocationAccess = useSettingsStore((s) => s.setLocationAccess)
  const aiAutoConfirm = useSettingsStore((s) => s.aiAutoConfirm)
  const setAIAutoConfirm = useSettingsStore((s) => s.setAIAutoConfirm)
  const wipeFinance = useFinanceStore((s) => s.wipeAll)
  const wipeReminders = useRemindersStore((s) => s.wipeAll)
  const wipeJournals = useJournalsStore((s) => s.wipeAll)
  const wipeHabits = useHabitsStore((s) => s.wipeAll)

  const onExportReminders = async () => {
    const r = await exportAllReminders()
    if (!r.ok) { Alert.alert(t.could_not_save, r.error.message); return }
    await Share.share({ message: r.value, title: 'BataVasa reminders.json' })
  }

  const onDeleteReminders = () => {
    Alert.alert(t.delete_all_reminders, t.delete_all_reminders_hint, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          const r = await wipeReminders()
          if (r.ok) Alert.alert(t.wipe_success.replace('{{count}}', String(r.deleted ?? 0)))
          else Alert.alert(t.could_not_save, r.error ?? '')
        },
      },
    ])
  }

  const onExportJournals = async () => {
    const r = await exportAllJournals()
    if (!r.ok) { Alert.alert(t.could_not_save, r.error.message); return }
    await Share.share({ message: r.value, title: 'BataVasa journals.json' })
  }

  const onDeleteJournals = () => {
    Alert.alert(t.delete_all_journals, t.delete_all_journals_hint, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          const r = await wipeJournals()
          if (r.ok) Alert.alert(t.wipe_success.replace('{{count}}', String(r.deleted ?? 0)))
          else Alert.alert(t.could_not_save, r.error ?? '')
        },
      },
    ])
  }

  const onExportHabits = async () => {
    const r = await exportAllHabits()
    if (!r.ok) { Alert.alert(t.could_not_save, r.error.message); return }
    await Share.share({ message: r.value, title: 'BataVasa habits.json' })
  }

  const onDeleteHabits = () => {
    Alert.alert(t.delete_all_habits, t.delete_all_habits_hint, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          const r = await wipeHabits()
          if (r.ok) Alert.alert(t.wipe_success.replace('{{count}}', String(r.deleted ?? 0)))
          else Alert.alert(t.could_not_save, r.error ?? '')
        },
      },
    ])
  }

  const onExportData = async () => {
    const r = await exportAllData()
    if (!r.ok) {
      Alert.alert(t.could_not_save, r.error.message)
      return
    }
    await Share.share({ message: r.value, title: 'BataVasa export.json' })
  }

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
        <SettingRow label={t.display_currency} value={displayCurrency} onPress={() => router.push('/display-currency' as any)} />
        <SettingRow label={t.categories} onPress={() => router.push('/categories' as any)} />
        <Pressable
          onPress={onExportData}
          style={({ pressed }) => [
            styles.row,
            { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
          ]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.export_data}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.export_data_hint}</Text>
          </View>
        </Pressable>
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

      <SectionHeader label={t.nav_reminders} />
      <View style={[styles.section, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SettingRow label={t.reminders} onPress={() => router.push('/reminders' as any)} />
        <Pressable
          onPress={onExportReminders}
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
          onPress={onDeleteReminders}
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
        <SettingRow label={t.habits} onPress={() => router.push('/habits' as any)} />
        <Pressable
          onPress={onExportHabits}
          style={({ pressed }) => [styles.row, { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated }]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.rowLabel, { color: theme.text.primary }]}>{t.export_habits}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.export_habits_hint}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onDeleteHabits}
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
        <SettingRow label={t.journals} onPress={() => router.push('/journals' as any)} />
        <Pressable
          onPress={onExportJournals}
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
          onPress={onDeleteJournals}
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
