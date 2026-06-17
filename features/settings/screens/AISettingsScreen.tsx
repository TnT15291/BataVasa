import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { hapticSaveSuccess } from '@services/haptics'
import { AI_PROVIDERS, PROVIDER_ORDER } from '@services/ai/providers'

export function AISettingsScreen() {
  const theme = useTheme()
  const { t } = useTranslation()
  const { aiProvider, setAIProvider } = useSettingsStore()

  const onSelect = async (provider: typeof aiProvider) => {
    if (provider === aiProvider) return
    await setAIProvider(provider)
    void hapticSaveSuccess()
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      contentContainerStyle={styles.container}
    >
      {/* Keys are managed by the BataVasa server — no API key entry. */}
      <View style={[styles.note, { backgroundColor: theme.brand.primary + '14', borderColor: theme.brand.primary + '33' }]}>
        <Feather name="shield" size={18} color={theme.brand.primary} />
        <Text style={[styles.noteText, { color: theme.text.secondary }]}>{t.ai_server_managed}</Text>
      </View>

      <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.ai_provider_label}</Text>
      <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        {PROVIDER_ORDER.map((p, i) => {
          const cfg = AI_PROVIDERS[p]
          const active = aiProvider === p
          return (
            <Pressable
              key={p}
              onPress={() => onSelect(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border.subtle },
              ]}
            >
              <Text style={styles.rowBadge}>{cfg.badge}</Text>
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: theme.text.primary }]}>{cfg.name}</Text>
                <Text style={[styles.rowModel, { color: theme.text.muted }]}>{cfg.defaultModel}</Text>
              </View>
              {active ? (
                <Feather name="check-circle" size={20} color={theme.semantic.success} />
              ) : (
                <View style={[styles.radio, { borderColor: theme.border.strong }]} />
              )}
            </Pressable>
          )
        })}
      </View>

      <Text style={[styles.hint, { color: theme.text.muted }]}>{t.ai_provider_hint}</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[3] },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: spacing[1],
    marginTop: spacing[2],
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  rowBadge: { fontSize: 18, width: 24, textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowModel: { fontSize: 12, fontFamily: 'Courier' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  hint: { fontSize: 12, lineHeight: 18, marginHorizontal: spacing[1] },
})
