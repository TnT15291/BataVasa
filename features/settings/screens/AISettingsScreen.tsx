import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { hapticSaveSuccess } from '@services/haptics'

export function AISettingsScreen() {
  const theme = useTheme()
  const { t } = useTranslation()
  const aiAutoConfirm = useSettingsStore((s) => s.aiAutoConfirm)
  const setAIAutoConfirm = useSettingsStore((s) => s.setAIAutoConfirm)

  const onToggle = (next: boolean) => {
    void setAIAutoConfirm(next)
    void hapticSaveSuccess()
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      contentContainerStyle={styles.container}
    >
      {/* AI provider + key are managed by the BataVasa server — the only
          user-facing AI preference is the parse-confirm safety net. */}
      <View style={[styles.note, { backgroundColor: theme.brand.primary + '14', borderColor: theme.brand.primary + '33' }]}>
        <Feather name="shield" size={18} color={theme.brand.primary} />
        <Text style={[styles.noteText, { color: theme.text.secondary }]}>{t.ai_server_managed}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowName, { color: theme.text.primary }]}>{t.ai_auto_confirm}</Text>
            <Text style={[styles.rowHint, { color: theme.text.muted }]}>{t.ai_auto_confirm_hint}</Text>
          </View>
          <Switch
            value={aiAutoConfirm}
            onValueChange={onToggle}
            trackColor={{ false: '#D1D5DB', true: '#34C759' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D5DB"
          />
        </View>
      </View>
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
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowHint: { fontSize: 12, lineHeight: 18 },
})
