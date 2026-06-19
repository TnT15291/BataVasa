import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getProviderKey } from '@services/ai/openai'
import { generateJournalReflection, type JournalReflection } from '@services/ai/journalInsight'
import { useJournalsBootstrap, useJournals } from '../hooks/useJournals'
import { track } from '@services/analytics'
import { EmptyState, Sparkle } from '@components/ui'
import { MODULE_COLORS } from '@design/moduleColors'

export function JournalsInsightsScreen() {
  useJournalsBootstrap()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const journals = useJournals()
  const aiProvider = useSettingsStore((s) => s.aiProvider)

  const [reflection, setReflection] = useState<JournalReflection | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    const key = await getProviderKey(aiProvider)
    if (!key) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    if (journals.length < 3) { Alert.alert(t.journal_reflection_title, t.journal_reflection_min_data); return }
    setLoading(true)
    setReflection(null)
    try {
      const result = await generateJournalReflection(journals)
      if (result) {
        setReflection(result)
        track('feature_used', { feature_name: 'journal_reflection_generated' })
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
        {reflection ? (
          <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <View style={styles.aiHeader}>
              <Sparkle size={11} color={theme.brand.primary} />
              <Text style={[styles.aiLabel, { color: theme.text.muted }]}>{t.journal_reflection_title.toUpperCase()}</Text>
            </View>
            <View style={[styles.row, { borderColor: theme.border.subtle }]}>
              <Text style={[styles.label, { color: theme.brand.primary }]}>{t.journal_reflection_mood}</Text>
              <Text style={[styles.value, { color: theme.text.primary }]}>{reflection.mood_summary}</Text>
            </View>
            {reflection.themes.length > 0 && (
              <View style={[styles.row, { borderColor: theme.border.subtle }]}>
                <Text style={[styles.label, { color: theme.brand.primary }]}>{t.journal_reflection_themes}</Text>
                {reflection.themes.map((item, i) => (
                  <Text key={i} style={[styles.value, { color: theme.text.primary }]}>· {item}</Text>
                ))}
              </View>
            )}
            {reflection.recurring_questions.length > 0 && (
              <View style={[styles.row, { borderColor: theme.border.subtle }]}>
                <Text style={[styles.label, { color: theme.brand.primary }]}>{t.journal_reflection_questions}</Text>
                {reflection.recurring_questions.map((q, i) => (
                  <Text key={i} style={[styles.value, { color: theme.text.primary }]}>· {q}</Text>
                ))}
              </View>
            )}
            <View style={[styles.promptCard, { backgroundColor: theme.brand.primary + '18', borderColor: theme.brand.primary + '40' }]}>
              <Text style={[styles.label, { color: theme.brand.primary }]}>{t.journal_reflection_prompt}</Text>
              <Text style={[styles.value, { color: theme.text.primary, fontStyle: 'italic' }]}>{reflection.gentle_prompt}</Text>
            </View>
          </View>
        ) : !loading ? (
          <EmptyState
            icon="cpu"
            accent={MODULE_COLORS.journal}
            title={t.journal_reflection_title}
            body={t.journal_reflection_min_data}
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
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{reflection ? t.refresh : t.journal_reflection_generate}</Text>}
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
  promptCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing[3], gap: spacing[1] },
  label: { fontSize: 12, fontWeight: '700' },
  value: { fontSize: 14, lineHeight: 20 },
  footer: { padding: spacing[4], borderTopWidth: StyleSheet.hairlineWidth },
  btn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
