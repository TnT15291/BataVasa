import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getProviderKey } from '@services/ai/openai'
import { generateReminderInsight, type ReminderInsight } from '@services/ai/reminderInsight'
import { useRemindersBootstrap, useReminders } from '../hooks/useReminders'
import { track } from '@services/analytics'

export function RemindersInsightsScreen() {
  useRemindersBootstrap()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const reminders = useReminders()
  const aiProvider = useSettingsStore((s) => s.aiProvider)

  const [insight, setInsight] = useState<ReminderInsight | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    const key = await getProviderKey(aiProvider)
    if (!key) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    if (reminders.length < 5) { Alert.alert(t.reminder_insight_title, t.reminder_insight_min_data); return }
    setLoading(true)
    setInsight(null)
    try {
      const result = await generateReminderInsight(reminders)
      if (result) {
        setInsight(result)
        track('feature_used', { feature_name: 'reminder_insight_generated' })
      } else {
        Alert.alert(t.ai_error, t.parse_failed)
      }
    } catch {
      Alert.alert(t.ai_error, t.parse_failed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={styles.content}>
        {insight ? (
          <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            {([
              { key: t.reminder_insight_pattern, val: insight.pattern_summary },
              { key: t.report_completion_rate, val: insight.completion_insight },
              { key: t.report_overdue, val: insight.overdue_insight },
              { key: t.reminder_insight_tip, val: insight.tip },
            ] as { key: string; val: string }[]).map(({ key, val }) => (
              <View key={key} style={[styles.row, { borderColor: theme.border.subtle }]}>
                <Text style={[styles.label, { color: theme.brand.primary }]}>{key}</Text>
                <Text style={[styles.value, { color: theme.text.primary }]}>{val}</Text>
              </View>
            ))}
          </View>
        ) : !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧠</Text>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.reminder_insight_title}</Text>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>{t.reminder_insight_min_data}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated, paddingBottom: spacing[4] + insets.bottom }]}>
        <Pressable
          onPress={handleGenerate}
          disabled={loading}
          style={[styles.btn, { backgroundColor: loading ? theme.text.muted : theme.brand.primary }]}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{insight ? t.refresh : t.reminder_insight_generate}</Text>}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[3] },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing[2], gap: 3 },
  label: { fontSize: 12, fontWeight: '700' },
  value: { fontSize: 14, lineHeight: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[12] },
  emptyIcon: { fontSize: 48, marginBottom: spacing[3] },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[6] },
  footer: { padding: spacing[4], borderTopWidth: StyleSheet.hairlineWidth },
  btn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
