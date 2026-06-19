import { useState, useCallback, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { subDays } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getProviderKey } from '@services/ai/openai'
import { useFinanceBootstrap, useTransactions, useCategories } from '../hooks/useFinance'
import { generateFinanceInsights } from '@services/ai/financeInsight'
import { InsightText } from '@/components/InsightText'
import { EmptyState, Sparkle } from '@components/ui'
import { MODULE_COLORS } from '@design/moduleColors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function InsightsScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useTranslation()
  const allTxs = useTransactions()
  const cats = useCategories()
  const aiProvider = useSettingsStore((s) => s.aiProvider)

  const [hasApiKey, setHasApiKey] = useState(false)
  const [keyChecked, setKeyChecked] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getProviderKey(aiProvider).then((k) => {
      setHasApiKey(!!k)
      setKeyChecked(true)
    })
  }, [aiProvider])

  const run = useCallback(async () => {
    const cutoff = subDays(new Date(), 30).toISOString()
    const recent = allTxs.filter((tx) => tx.occurred_at >= cutoff)
    setLoading(true)
    setResult(null)
    try {
      const text = await generateFinanceInsights(recent, cats, t.last_30_days)
      setResult(text)
    } catch (e: any) {
      if (e?.message === 'NO_API_KEY') {
        setHasApiKey(false)
      } else if (e?.message === 'NO_DATA') {
        Alert.alert(t.no_insights, t.no_insights_msg)
      } else {
        Alert.alert(t.ai_error, e?.message ?? 'Unknown error')
      }
    } finally {
      setLoading(false)
    }
  }, [allTxs, cats, t])

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={styles.content}>
        {result ? (
          <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <View style={styles.aiHeader}>
              <Sparkle size={11} color={theme.brand.primary} />
              <Text style={[styles.aiLabel, { color: theme.text.muted }]}>{t.ai_insights.toUpperCase()}</Text>
            </View>
            <InsightText text={result} />
          </View>
        ) : !loading ? (
          <EmptyState
            icon={keyChecked && !hasApiKey ? 'key' : 'cpu'}
            accent={MODULE_COLORS.finance}
            title={keyChecked && !hasApiKey ? t.setup_ai_first : t.ai_insights}
            body={keyChecked && !hasApiKey ? t.no_api_key_msg : t.no_insights_msg}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated, paddingBottom: spacing[4] + insets.bottom }]}>
        {keyChecked && !hasApiKey ? (
          <Pressable
            onPress={() => router.push('/ai-settings')}
            style={[styles.btn, { backgroundColor: theme.brand.accent }]}
          >
            <Text style={styles.btnText}>{t.go_to_settings} →</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={run}
            disabled={loading || !keyChecked}
            style={[styles.btn, { backgroundColor: loading || !keyChecked ? theme.text.muted : theme.brand.primary }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{result ? t.refresh : t.generate}</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing[4], gap: spacing[3], flexGrow: 1 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[2],
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  aiLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  footer: { padding: spacing[4], borderTopWidth: StyleSheet.hairlineWidth },
  btn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
