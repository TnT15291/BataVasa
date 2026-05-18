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

export function InsightsScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
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
            <Text style={[styles.resultText, { color: theme.text.primary }]}>{result}</Text>
          </View>
        ) : !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{keyChecked && !hasApiKey ? '🔑' : '🧠'}</Text>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
              {keyChecked && !hasApiKey ? t.setup_ai_first : t.ai_insights}
            </Text>
            <Text style={[styles.emptyBody, { color: theme.text.muted }]}>
              {keyChecked && !hasApiKey ? t.no_api_key_msg : t.no_insights_msg}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated }]}>
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
              <Text style={styles.btnText}>{result ? t.refresh : t.analyzing.replace('...', '')}</Text>
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
