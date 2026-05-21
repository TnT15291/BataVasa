import { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Share, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { track } from '@services/analytics'
import { exportAllData } from '@features/finance/services'
import { exportAllHabits } from '@features/habits/services'
import { exportAllJournals } from '@features/journals/services'
import { exportAllReminders } from '@features/reminders/services'
import { useFinanceStore } from '@store/financeStore'
import { useHabitsStore } from '@store/habitsStore'
import { useJournalsStore } from '@store/journalsStore'
import { useRemindersStore } from '@store/remindersStore'
import { useSettingsStore } from '@store/settingsStore'

type DataModule = 'finance' | 'habits' | 'journals' | 'reminders'

type ModuleConfig = {
  key: DataModule
  title: string
  body: string
  exportTitle: string
  exportHint: string
  deleteTitle: string
  deleteHint: string
  fileName: string
  recordCount: number
  syncEnabled: boolean
  exportData: () => Promise<{ ok: true; value: string } | { ok: false; error: { message: string } }>
  wipe: () => Promise<{ ok: boolean; deleted?: number; error?: string }>
}

function countPayloadItems(json: string): number {
  try {
    const payload = JSON.parse(json)
    return Object.values(payload).reduce<number>((total, value) => {
      return total + (Array.isArray(value) ? value.length : 0)
    }, 0)
  } catch {
    return 0
  }
}

export function DataManagementScreen() {
  const theme = useTheme()
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ module?: string }>()
  const wipeFinance = useFinanceStore((s) => s.wipeAll)
  const wipeHabits = useHabitsStore((s) => s.wipeAll)
  const wipeJournals = useJournalsStore((s) => s.wipeAll)
  const wipeReminders = useRemindersStore((s) => s.wipeAll)
  const financeRecords = useFinanceStore((s) => s.transactions.length + s.categories.length)
  const habitRecords = useHabitsStore((s) => s.habits.length)
  const journalRecords = useJournalsStore((s) => s.journals.length)
  const reminderRecords = useRemindersStore((s) => s.reminders.length)
  const syncFinance = useSettingsStore((s) => s.syncFinance)
  const syncHabits = useSettingsStore((s) => s.syncHabits)
  const syncJournals = useSettingsStore((s) => s.syncJournals)
  const syncReminders = useSettingsStore((s) => s.syncReminders)
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)

  const configs = useMemo<Record<DataModule, ModuleConfig>>(() => ({
    finance: {
      key: 'finance',
      title: t.finance_settings,
      body: t.data_management_finance_body,
      exportTitle: t.export_data,
      exportHint: t.export_data_hint,
      deleteTitle: t.delete_all_data,
      deleteHint: t.delete_all_data_hint,
      fileName: 'batavasa-finance.json',
      recordCount: financeRecords,
      syncEnabled: syncFinance,
      exportData: exportAllData,
      wipe: wipeFinance,
    },
    habits: {
      key: 'habits',
      title: t.habits,
      body: t.data_management_habits_body,
      exportTitle: t.export_habits,
      exportHint: t.export_habits_hint,
      deleteTitle: t.delete_all_habits,
      deleteHint: t.delete_all_habits_hint,
      fileName: 'batavasa-habits.json',
      recordCount: habitRecords,
      syncEnabled: syncHabits,
      exportData: exportAllHabits,
      wipe: wipeHabits,
    },
    journals: {
      key: 'journals',
      title: t.journals,
      body: t.data_management_journals_body,
      exportTitle: t.export_journals,
      exportHint: t.export_journals_hint,
      deleteTitle: t.delete_all_journals,
      deleteHint: t.delete_all_journals_hint,
      fileName: 'batavasa-journals.json',
      recordCount: journalRecords,
      syncEnabled: syncJournals,
      exportData: exportAllJournals,
      wipe: wipeJournals,
    },
    reminders: {
      key: 'reminders',
      title: t.reminders,
      body: t.data_management_reminders_body,
      exportTitle: t.export_reminders,
      exportHint: t.export_reminders_hint,
      deleteTitle: t.delete_all_reminders,
      deleteHint: t.delete_all_reminders_hint,
      fileName: 'batavasa-reminders.json',
      recordCount: reminderRecords,
      syncEnabled: syncReminders,
      exportData: exportAllReminders,
      wipe: wipeReminders,
    },
  }), [
    t,
    wipeFinance,
    wipeHabits,
    wipeJournals,
    wipeReminders,
    financeRecords,
    habitRecords,
    journalRecords,
    reminderRecords,
    syncFinance,
    syncHabits,
    syncJournals,
    syncReminders,
  ])

  const moduleKey = (params.module === 'habits' || params.module === 'journals' || params.module === 'reminders')
    ? params.module
    : 'finance'
  const config = configs[moduleKey]

  const onExport = async () => {
    setBusy('export')
    try {
      const r = await config.exportData()
      if (!r.ok) {
        Alert.alert(t.could_not_save, r.error.message)
        return
      }
      track('data_exported', { module: config.key, item_count: countPayloadItems(r.value) })
      await Share.share({ message: r.value, title: config.fileName })
    } finally {
      setBusy(null)
    }
  }

  const runDelete = async () => {
    setBusy('delete')
    try {
      const r = await config.wipe()
      if (r.ok) {
        track('data_deleted', { module: config.key, item_count: r.deleted ?? 0 })
        Alert.alert(t.wipe_success.replace('{{count}}', String(r.deleted ?? 0)))
      } else {
        Alert.alert(t.could_not_save, r.error ?? '')
      }
    } finally {
      setBusy(null)
    }
  }

  const onDelete = () => {
    Alert.alert(config.deleteTitle, config.deleteHint, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          Alert.alert(t.confirm_wipe_final_title, t.confirm_wipe_final_msg, [
            { text: t.cancel, style: 'cancel' },
            { text: t.delete, style: 'destructive', onPress: () => { void runDelete() } },
          ])
        },
      },
    ])
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg.primary }} contentContainerStyle={styles.container}>
      <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <Text style={[styles.title, { color: theme.text.primary }]}>{config.title}</Text>
        <Text style={[styles.body, { color: theme.text.muted }]}>{config.body}</Text>
        <View style={styles.metaGrid}>
          <View style={[styles.metaItem, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.metaValue, { color: theme.text.primary }]}>{config.recordCount}</Text>
            <Text style={[styles.metaLabel, { color: theme.text.muted }]}>{t.data_records}</Text>
          </View>
          <View style={[styles.metaItem, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.metaValue, { color: theme.text.primary }]}>JSON</Text>
            <Text style={[styles.metaLabel, { color: theme.text.muted }]}>{t.data_export_format}</Text>
          </View>
          <View style={[styles.metaItem, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.metaValue, { color: config.syncEnabled ? theme.brand.primary : theme.text.primary }]}>
              {config.syncEnabled ? t.data_scope_cloud : t.data_scope_device}
            </Text>
            <Text style={[styles.metaLabel, { color: theme.text.muted }]}>{t.data_delete_scope}</Text>
          </View>
        </View>
        <Text style={[styles.scopeNote, { color: theme.text.muted }]}>
          {config.syncEnabled ? t.data_delete_cloud_note : t.data_delete_device_note}
        </Text>
      </View>

      <Pressable
        onPress={onExport}
        disabled={busy != null}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionTitle, { color: theme.text.primary }]}>{config.exportTitle}</Text>
          <Text style={[styles.actionHint, { color: theme.text.muted }]}>{config.exportHint}</Text>
        </View>
        {busy === 'export' ? <ActivityIndicator color={theme.brand.primary} /> : <Text style={[styles.chevron, { color: theme.text.muted }]}>›</Text>}
      </Pressable>

      <Pressable
        onPress={onDelete}
        disabled={busy != null}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionTitle, { color: theme.text.danger }]}>{config.deleteTitle}</Text>
          <Text style={[styles.actionHint, { color: theme.text.muted }]}>{config.deleteHint}</Text>
        </View>
        {busy === 'delete' ? <ActivityIndicator color={theme.text.danger} /> : null}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[3] },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[2],
  },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  metaGrid: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  metaItem: { flex: 1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], gap: spacing[1] },
  metaValue: { fontSize: 16, fontWeight: '700' },
  metaLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  scopeNote: { fontSize: 12, lineHeight: 18, marginTop: spacing[1] },
  action: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  actionTitle: { fontSize: 16, fontWeight: '600' },
  actionHint: { fontSize: 12, lineHeight: 18, marginTop: spacing[1] },
  chevron: { fontSize: 22, lineHeight: 24 },
})
