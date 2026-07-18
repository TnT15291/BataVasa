import { useEffect, useState } from 'react'
import {
  Modal, View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { notifySaved, toast } from '@store/toastStore'
import { hapticSaveSuccess } from '@services/haptics'
import { centsToDisplay, displayToCents } from '@services/ai/aiLanguage'
import { parsePlanItemEntry } from '@services/ai/smartEntry'
import { isAiAvailable } from '@services/ai/openai'
import { SmartEntryCard } from '@components/ui/SmartEntryCard'
import { CategoryPicker } from './CategoryPicker'
import { useCategories, usePlanItemActions } from '../hooks/useFinance'
import { getCurrentPlanMonth, parseAmountInput } from '../services'
import { matchCategory } from '../i18n'
import type { Category, PlanItem, PlanItemKind } from '../types'

type Props = {
  visible: boolean
  /** null = create a new plan item; otherwise edit this one. */
  item: PlanItem | null
  draft?: {
    name?: string
    kind?: PlanItemKind
    amount_cents?: number
    currency?: string
    category_id?: string | null
    due_day?: number
    recurrence?: 'once' | 'monthly'
  } | null
  onClose: () => void
}

/**
 * Create / edit a Monthly Plan item (recurring bill or expected income).
 * Single sheet serves both modes (Cross-Module Rule 7).
 */
export function PlanItemSheet({ visible, item, draft, onClose }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const currency = useSettingsStore((s) => s.currency)
  const categories = useCategories()
  const { createPlanItem, updatePlanItem, deletePlanItem, restorePlanItem } = usePlanItemActions()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<PlanItemKind>('expense')
  const [amountText, setAmountText] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [dueDay, setDueDay] = useState(1)
  const [monthly, setMonthly] = useState(false)
  const [smartText, setSmartText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  const itemCurrency = item?.currency ?? draft?.currency ?? currency

  useEffect(() => {
    if (!visible) return
    setName(item?.name ?? draft?.name ?? '')
    setKind(item?.kind ?? draft?.kind ?? 'expense')
    setCategory(categories.find((c) => c.id === (item?.category_id ?? draft?.category_id ?? null)) ?? null)
    setAmountText(item
      ? String(centsToDisplay(item.amount_cents, item.currency))
      : draft?.amount_cents
      ? String(centsToDisplay(draft.amount_cents, itemCurrency))
      : '')
    setDueDay(item?.due_day ?? draft?.due_day ?? new Date().getDate())
    setMonthly(item ? (item.recurrence ?? 'monthly') === 'monthly' : draft?.recurrence === 'monthly')
    setSmartText('')
    setSaving(false)
  }, [visible, item, draft, itemCurrency, categories])

  const categoryMatchesKind = (cat: Category, nextKind: PlanItemKind): boolean =>
    nextKind === 'income' ? cat.kind === 'income' : cat.kind !== 'income'

  const visibleCategories = categories.filter((c) => categoryMatchesKind(c, kind))

  const onParseSmartEntry = async (override?: string) => {
    const input = (override ?? smartText).trim()
    if (!input || parsing) return
    if (override) setSmartText(override)
    if (!isAiAvailable()) {
      Alert.alert(t.no_api_key, t.no_api_key_msg)
      return
    }
    setParsing(true)
    try {
      const parsed = await parsePlanItemEntry(input, categories)
      if (!parsed) {
        Alert.alert(t.ai_error, t.smart_entry_hint)
        return
      }
      setName(parsed.name)
      setKind(parsed.kind)
      setAmountText(String(centsToDisplay(parsed.amount_cents, itemCurrency)))
      setDueDay(parsed.due_day)
      setMonthly(parsed.recurrence === 'monthly')
      const matched = matchCategory(categories, parsed.category_hint, t)
      setCategory(matched && categoryMatchesKind(matched, parsed.kind) ? matched : null)
      setSmartText('')
    } catch (e: any) {
      Alert.alert(t.ai_error, e?.message ?? t.smart_entry_hint)
    } finally {
      setParsing(false)
    }
  }

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
    const recurrence = monthly ? 'monthly' as const : 'once' as const
    const res = item
      ? await updatePlanItem({ id: item.id, name: trimmed, kind, amount_cents, category_id: category?.id ?? null, due_day: dueDay, recurrence, applies_month: monthly ? null : item.applies_month ?? getCurrentPlanMonth() })
      : await createPlanItem({ name: trimmed, kind, amount_cents, currency: itemCurrency, category_id: category?.id ?? null, due_day: dueDay, recurrence, applies_month: monthly ? null : getCurrentPlanMonth(), status: 'confirmed' })
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

          <SmartEntryCard
            value={smartText}
            onChangeText={setSmartText}
            onSubmit={() => void onParseSmartEntry()}
            onVoiceResult={(text) => void onParseSmartEntry(text)}
            parsing={parsing}
            placeholder={t.plan_name_placeholder}
            module="finance_plan"
            hint={t.monthly_plan_empty}
            disabled={!isAiAvailable()}
          />

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
                  onPress={() => {
                    setKind(k)
                    if (category && !categoryMatchesKind(category, k)) setCategory(null)
                  }}
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

          <View style={[styles.categoryBox, { borderColor: theme.border.subtle, backgroundColor: theme.bg.primary }]}>
            <Text style={[styles.label, { color: theme.text.muted }]}>{t.category}</Text>
            <CategoryPicker
              categories={visibleCategories}
              selectedId={category?.id ?? null}
              onSelect={setCategory}
              filterKind={kind === 'income' ? 'income' : undefined}
              scrollEnabled={false}
            />
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

          <Pressable
            onPress={() => setMonthly((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: monthly }}
            style={({ pressed }) => [
              styles.checkRow,
              {
                backgroundColor: pressed ? theme.bg.primary : theme.bg.secondary,
                borderColor: monthly ? MODULE_COLORS.finance : theme.border.subtle,
              },
            ]}
          >
            <View style={[styles.checkBox, { backgroundColor: monthly ? MODULE_COLORS.finance : 'transparent', borderColor: monthly ? MODULE_COLORS.finance : theme.border.strong }]}>
              {monthly ? <Feather name="check" size={15} color="#fff" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.checkTitle, { color: theme.text.primary }]}>{t.plan_monthly_toggle}</Text>
              <Text style={[styles.checkHint, { color: theme.text.muted }]}>{monthly ? t.plan_monthly_hint : t.plan_once_hint}</Text>
            </View>
          </Pressable>

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
              style={[styles.btn, { backgroundColor: saving ? theme.text.muted : MODULE_COLORS.finance }]}
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
  categoryBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    gap: spacing[2],
  },
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
  checkRow: {
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTitle: { fontSize: 14, fontWeight: '700' },
  checkHint: { fontSize: 12, lineHeight: 17, marginTop: 2 },
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
