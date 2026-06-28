import { useState, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { isAiAvailable } from '@services/ai/openai'
import { generateHabitInsight, type HabitInsight } from '@services/ai/habitInsight'
import { exportAllHabits } from '../services'
import { useHabitsBootstrap, useHabits } from '../hooks/useHabits'
import { track } from '@services/analytics'
import { EmptyState, Sparkle } from '@components/ui'
import { MODULE_COLORS } from '@design/moduleColors'
import type { Habit, HabitLog } from '../types'

export function HabitsInsightsScreen() {
  useHabitsBootstrap()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const habits = useHabits()

  const [insight, setInsight] = useState<HabitInsight | null>(null)
  const [loading, setLoading] = useState(false)
  const [allLogs, setAllLogs] = useState<HabitLog[]>([])

  useEffect(() => {
    exportAllHabits().then((r) => {
      if (r.ok) {
        try {
          const parsed = JSON.parse(r.value)
          setAllLogs(parsed.logs ?? [])
        } catch {}
      }
    })
  }, [])

  const handleGenerate = async () => {
    if (!isAiAvailable()) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    if (allLogs.length < 3) { Alert.alert(t.habit_insight_title, t.habit_insight_min_data); return }
    setLoading(true)
    setInsight(null)
    try {
      const baseHabits = habits.map(({ id, user_id, name, icon, color, cadence, target_per_period,
        location_lat, location_lng, location_label, created_at, updated_at, deleted_at, synced_at }) => ({
        id, user_id, name, icon, color, cadence, target_per_period,
        location_lat, location_lng, location_label, created_at, updated_at, deleted_at, synced_at,
      }) as Habit)
      const result = await generateHabitInsight(baseHabits, allLogs)
      if (result) {
        setInsight(result)
        track('feature_used', { feature_name: 'habit_insight_generated' })
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
            <View style={styles.aiHeader}>
              <Sparkle size={11} color={theme.brand.primary} />
              <Text style={[styles.aiLabel, { color: theme.text.muted }]}>{t.habit_insight_title.toUpperCase()}</Text>
            </View>
            {([
              { key: t.habit_insight_consistency, val: insight.consistency_summary },
              { key: t.habit_insight_strongest, val: insight.strongest_habit },
              { key: t.habit_insight_attention, val: insight.needs_attention },
              { key: t.habit_insight_encouragement, val: insight.encouragement },
              { key: t.habit_insight_tip, val: insight.tip },
            ] as { key: string; val: string }[]).map(({ key, val }) => (
              <View key={key} style={[styles.row, { borderColor: theme.border.subtle }]}>
                <Text style={[styles.label, { color: theme.brand.primary }]}>{key}</Text>
                <Text style={[styles.value, { color: theme.text.primary }]}>{val}</Text>
              </View>
            ))}
          </View>
        ) : !loading ? (
          <EmptyState
            icon="cpu"
            accent={MODULE_COLORS.habits}
            title={t.habit_insight_title}
            body={t.habit_insight_min_data}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated, paddingBottom: spacing[4] + insets.bottom }]}>
        <Pressable
          onPress={handleGenerate}
          disabled={loading}
          style={[styles.btn, { backgroundColor: loading ? theme.text.muted : theme.brand.primary }]}
        >
          {loading
            ? <ActivityIndicator color={theme.brand.onPrimary} />
            : <Text style={[styles.btnText, { color: theme.brand.onPrimary }]}>{insight ? t.refresh : t.habit_insight_generate}</Text>}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[3] },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  aiLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing[2], gap: 3 },
  label: { fontSize: 12, fontWeight: '700' },
  value: { fontSize: 14, lineHeight: 20 },
  footer: { padding: spacing[4], borderTopWidth: StyleSheet.hairlineWidth },
  btn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
