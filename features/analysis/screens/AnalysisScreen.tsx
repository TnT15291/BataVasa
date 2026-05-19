import { useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getProviderKey } from '@services/ai/openai'
import { generateCrossModuleInsights } from '@services/ai/crossModuleInsight'
import { useFinanceBootstrap, useTransactions, useCategories } from '@features/finance/hooks/useFinance'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { useJournalsBootstrap, useJournals } from '@features/journals/hooks/useJournals'

export function AnalysisScreen() {
  useFinanceBootstrap()
  useHabitsBootstrap()
  useJournalsBootstrap()

  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const aiProvider = useSettingsStore((s) => s.aiProvider)

  const transactions = useTransactions()
  const categories = useCategories()
  const habits = useHabits()
  const journals = useJournals()

  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    const key = await getProviderKey(aiProvider)
    if (!key) {
      Alert.alert(t.no_api_key, t.no_api_key_msg, [
        { text: t.go_to_settings, onPress: () => router.push('/ai-settings' as any) },
        { text: t.cancel, style: 'cancel' },
      ])
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const text = await generateCrossModuleInsights({ transactions, categories, habits, journals })
      setResult(text)
    } catch (e: any) {
      if (e?.message === 'NO_DATA') {
        Alert.alert(t.analysis_no_data, t.analysis_no_data_msg)
      } else {
        Alert.alert(t.ai_error, e?.message ?? 'Unknown error')
      }
    } finally {
      setLoading(false)
    }
  }, [aiProvider, transactions, categories, habits, journals, t, router])

  const moduleCount = [
    transactions.length > 0,
    habits.length > 0,
    journals.length > 0,
  ].filter(Boolean).length

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Module status chips */}
        <View style={styles.chips}>
          <Chip label={`💰 ${t.nav_finance}`} active={transactions.length > 0} theme={theme} />
          <Chip label={`✅ ${t.nav_habits}`} active={habits.length > 0} theme={theme} />
          <Chip label={`📔 ${t.nav_journal}`} active={journals.length > 0} theme={theme} />
        </View>

        {result ? (
          <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Text style={[styles.resultText, { color: theme.text.primary }]}>{result}</Text>
          </View>
        ) : !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔮</Text>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.analysis_title}</Text>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>
              {moduleCount < 2 ? t.analysis_no_data_msg : t.analysis_subtitle}
            </Text>
          </View>
        ) : (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={theme.brand.primary} />
            <Text style={[styles.emptyBody, { color: theme.text.muted, marginTop: spacing[3] }]}>{t.generating}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated }]}>
        <Pressable
          onPress={run}
          disabled={loading}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: loading ? theme.text.muted : theme.brand.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{result ? t.refresh : t.analysis_generate}</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function Chip({ label, active, theme }: { label: string; active: boolean; theme: any }) {
  return (
    <View style={[
      styles.chip,
      {
        backgroundColor: active ? theme.brand.primary + '22' : theme.bg.elevated,
        borderColor: active ? theme.brand.primary : theme.border.subtle,
      },
    ]}>
      <Text style={[styles.chipText, { color: active ? theme.brand.primary : theme.text.muted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  chips: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '500' },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
  },
  resultText: { fontSize: 15, lineHeight: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[12] },
  emptyIcon: { fontSize: 48, marginBottom: spacing[3] },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing[2] },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing[6] },
  footer: { padding: spacing[4], borderTopWidth: StyleSheet.hairlineWidth },
  btn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
