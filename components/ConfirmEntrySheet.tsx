import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useTheme } from '@design/useTheme'
import { useTranslation } from '@services/i18n'
import { spacing, radius } from '@design/tokens'

export type ConfirmField = { label: string; value: string }

type Props = {
  visible: boolean
  rawInput: string
  fields: ConfirmField[]
  onSave: () => void
  onEdit: () => void
  onCancel: () => void
  busy?: boolean
}

export function ConfirmEntrySheet({ visible, rawInput, fields, onSave, onEdit, onCancel, busy }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheet, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
        >
          <View style={styles.handle} />

          <Text style={[styles.title, { color: theme.text.primary }]}>{t.ai_confirm_title}</Text>

          <View style={[styles.echoBox, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.echoLabel, { color: theme.text.muted }]}>{t.ai_confirm_you_said}</Text>
            <Text style={[styles.echoText, { color: theme.text.primary }]}>“{rawInput}”</Text>
          </View>

          <Text style={[styles.parsedLabel, { color: theme.text.muted }]}>{t.ai_confirm_parsed}</Text>
          <ScrollView style={styles.parsedBox} contentContainerStyle={{ gap: spacing[2] }}>
            {fields.map((f, idx) => (
              <View key={idx} style={styles.parsedRow}>
                <Text style={[styles.fieldLabel, { color: theme.text.muted }]}>{f.label}</Text>
                <Text style={[styles.fieldValue, { color: theme.text.primary }]} numberOfLines={2}>
                  {f.value}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={[styles.btn, styles.btnGhost, { borderColor: theme.border.strong }]}
            >
              <Text style={[styles.btnText, { color: theme.text.secondary }]}>{t.ai_confirm_cancel}</Text>
            </Pressable>
            <Pressable
              onPress={onEdit}
              disabled={busy}
              style={[styles.btn, styles.btnGhost, { borderColor: theme.brand.primary }]}
            >
              <Text style={[styles.btnText, { color: theme.brand.primary }]}>{t.ai_confirm_edit}</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={busy}
              style={[styles.btn, { backgroundColor: busy ? theme.text.muted : theme.brand.primary }]}
            >
              <Text style={[styles.btnText, { color: '#fff' }]}>{busy ? '…' : t.ai_confirm_save}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[5],
    paddingBottom: spacing[8],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#999',
    borderRadius: 2,
    alignSelf: 'center',
    opacity: 0.4,
    marginBottom: spacing[2],
  },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: spacing[2] },
  echoBox: {
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  echoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: spacing[1] },
  echoText: { fontSize: 15, fontStyle: 'italic' },
  parsedLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  parsedBox: { maxHeight: 240 },
  parsedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  fieldLabel: { fontSize: 13, minWidth: 90, paddingTop: 2 },
  fieldValue: { fontSize: 15, flex: 1, fontWeight: '500' },
  buttonRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  btn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnGhost: { borderWidth: 1, backgroundColor: 'transparent' },
  btnText: { fontSize: 14, fontWeight: '600' },
})
