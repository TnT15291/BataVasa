import { useEffect, useState } from 'react'
import {
  Modal, View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { notifySaved, toast } from '@store/toastStore'
import { hapticSaveSuccess } from '@services/haptics'
import { centsToDisplay, displayToCents } from '@services/ai/aiLanguage'
import { usePlanItemActions } from '../hooks/useFinance'
import { parseAmountInput } from '../services'
import type { PlanItem, PlanItemKind } from '../types'

type Props = {
  visible: boolean
  /** null = create a new plan item; otherwise edit this one. */
  item: PlanItem | null
  onClose: () => void
}

/**
 * Create / edit a Monthly Plan item (recurring bill or expected income).
 * Single sheet serves both modes (Cross-Module Rule 7).
 */
export function PlanItemSheet({ visible, item, onClose }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const currency = useSettingsStore((s) => s.currency)
  const { createPlanItem, updatePlanItem, deletePlanItem, restorePlanItem } = usePlanItemActions()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<PlanItemKind>('expense')
  const [amountText, setAmountText] = useState('')
  const [dueDay, setDueDay] = useState(1)
  const [saving, setSaving] = useState(false)

  const itemCurrency = item?.currency ?? currency

  useEffect(() => {
    if (!visible) return
    setName(item?.name ?? '')
    setKind(item?.kind ?? 'expense')
    setAmountText(item ? String(centsToDisplay(item.amount_cents, item.currency)) : '')
    setDueDay(item?.due_day ?? new Date().getDate())
    setSaving(false)
  }, [visible, item])

  const onSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      Alert.alert(t.could_not_save, t.plan_name_required)
      return
    }
    const amount = parseAmountInput(amountText)
    if (amount === null) {
      Alert.alert(t.invalid_amount, t.invalid_amount_msg)
      return
    }
    setSaving(true)
    const amount_cents = Math.round(displayToCents(amount, itemCurrency))
    const res = item
      ? await updatePlanItem({ id: item.id, name: trimmed, kind, amount_cents, due_day: dueDay })
      : await createPlanItem({ name: trimmed, kind, amount_cents, currency: itemCurrency, due_day: dueDay, status: 'confirmed' })
    setSaving(false)
    if (!res.ok) {
      Alert.alert(t.could_not_save, res.error ?? '')
      return
    }
    void hapticSaveSuccess()
    notifySaved(t, useSettingsStore.getState().syncFinance)
    onClose()
  }

  const onDelete = () => {
    if (!item) return
    Alert.alert(t.delete, item.name, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaving(true)
            const result = await deletePlanItem(item.id)
            setSaving(false)
            if (!result.ok) {
              Alert.alert(t.could_not_save, result.error ?? '')
              return
            }
            onClose()
            toast.undo(t.toast_deleted, t.undo, () => { void restorePlanItem(item.id) })
          })()
        },
      },
    ])
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdropWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={[styles.handle, { backgroundColor: theme.border.strong }]} />
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {item ? t.plan_edit_title : t.plan_add_title}
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t.plan_name_placeholder}
            placeholderTextColor={theme.text.muted}
            autoFocus={!item}
            style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.primary }]}
          />

          <View style={styles.kindRow}>
            {(['expense', 'income'] as PlanItemKind[]).map((k) => {
              const active = kind === k
              const color = k === 'expense' ? theme.finance.expense : theme.finance.income
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.kindBtn, {
                    backgroundColor: active ? color : theme.bg.secondary,
                    borderColor: active ? color : theme.border.subtle,
                  }]}
                >
                  <Text style={{ color: active ? '#fff' : theme.text.primary, fontWeight: '600' }}>
                    {k === 'expense' ? t.expense : t.income}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.amountRow}>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0"
              placeholderTextColor={theme.text.muted}
              keyboardType="decimal-pad"
              accessibilityLabel={kind === 'expense' ? t.expense : t.income}
              style={[styles.amountInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.primary }]}
            />
            <Text style={[styles.currency, { color: theme.text.muted }]}>{itemCurrency}</Text>
          </View>

          <Text style={[styles.label, { color: theme.text.muted }]}>{t.plan_due_day_label}</Text>
          <View style={styles.dayRow}>
            <Pressable
              onPress={() => setDueDay((d) => Math.max(1, d - 1))}
              accessibilityRole="button"
              style={[styles.dayBtn, { backgroundColor: theme.bg.secondary, borderColor: theme.border.strong }]}
            >
              <Text style={[styles.dayBtnText, { color: theme.text.primary }]}>−</Text>
            </Pressable>
            <Text style={[styles.dayValue, { color: theme.text.primary }]}>{dueDay}</Text>
            <Pressable
              onPress={() => setDueDay((d) => Math.min(31, d + 1))}
              accessibilityRole="button"
              style={[styles.dayBtn, { backgroundColor: theme.bg.secondary, borderColor: theme.border.strong }]}
            >
              <Text style={[styles.dayBtnText, { color: theme.text.primary }]}>+</Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            {item ? (
              <Pressable
                onPress={onDelete}
                disabled={saving}
                style={[styles.iconBtn, { borderColor: theme.semantic.danger + '66', backgroundColor: theme.bg.secondary }]}
                accessibilityRole="button"
                accessibilityLabel={t.delete}
              >
                <Text style={[styles.deleteText, { color: theme.semantic.danger }]}>{t.delete}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              disabled={saving}
              style={[styles.btn, styles.btnGhost, { borderColor: theme.border.strong }]}
            >
              <Text style={[styles.btnText, { color: theme.text.secondary }]}>{t.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={saving}
              style={[styles.btn, { backgroundColor: saving ? theme.text.muted : theme.brand.primary }]}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={[styles.btnText, { color: '#fff' }]}>{item ? t.update : t.save}</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing[5],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing[1] },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: spacing[1] },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  kindRow: { flexDirection: 'row', gap: spacing[2] },
  kindBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: 18,
    fontWeight: '600',
  },
  currency: { fontSize: 13, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  dayBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnText: { fontSize: 20, fontWeight: '400' },
  dayValue: { fontSize: 20, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  iconBtn: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { fontSize: 14, fontWeight: '700' },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { borderWidth: 1, backgroundColor: 'transparent' },
  btnText: { fontSize: 14, fontWeight: '600' },
})
