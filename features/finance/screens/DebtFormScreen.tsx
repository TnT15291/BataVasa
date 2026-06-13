import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, Switch,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format, addDays } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { hapticSaveSuccess } from '@services/haptics'
import { notifySaved, toast } from '@store/toastStore'
import { getDateFnsLocale } from '@services/locale'
import { displayToCents, centsToDisplay } from '@services/ai/aiLanguage'
import { DateRow } from '@components/DateRow'
import { useFinanceBootstrap, useDebts, useDebtActions } from '../hooks/useFinance'
import { parseAmountInput, formatAmount } from '../services'
import type { DebtLabels } from '../services'
import type { DebtDirection } from '../types'

const REMIND_DAY_OPTIONS = [0, 1, 3, 7]

export function DebtFormScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const currency = useSettingsStore((s) => s.currency)
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)
  const debts = useDebts()
  const { createDebt, updateDebt, settleDebt, deleteDebt, restoreDebt } = useDebtActions()

  const params = useLocalSearchParams<{ id?: string }>()
  const editingId = typeof params.id === 'string' ? params.id : null
  const editingDebt = useMemo(
    () => (editingId ? debts.find((d) => d.id === editingId) ?? null : null),
    [editingId, debts]
  )
  const isEditing = !!editingId
  const isSettled = editingDebt?.status === 'settled'

  const [direction, setDirection] = useState<DebtDirection>('lent')
  const [counterparty, setCounterparty] = useState('')
  const [amountText, setAmountText] = useState('')
  const [note, setNote] = useState('')
  const [occurredAt, setOccurredAt] = useState(new Date())
  const [hasDueDate, setHasDueDate] = useState(true)
  const [dueAt, setDueAt] = useState(() => addDays(new Date(), 30))
  const [remindDays, setRemindDays] = useState(1)
  const [showDuePicker, setShowDuePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  const debtCurrency = editingDebt?.currency ?? currency

  useEffect(() => {
    if (!editingDebt || prefilled) return
    setDirection(editingDebt.direction)
    setCounterparty(editingDebt.counterparty)
    setAmountText(String(centsToDisplay(editingDebt.amount_cents, editingDebt.currency)))
    setNote(editingDebt.note ?? '')
    setOccurredAt(new Date(editingDebt.occurred_at))
    setHasDueDate(!!editingDebt.due_at)
    if (editingDebt.due_at) setDueAt(new Date(editingDebt.due_at))
    setRemindDays(editingDebt.remind_days_before)
    setPrefilled(true)
  }, [editingDebt, prefilled])

  const buildLabels = (name: string, noteText: string): DebtLabels => ({
    reminderTitle: (direction === 'lent' ? t.debt_reminder_title_lent : t.debt_reminder_title_borrowed)
      .replace('{{name}}', name),
    reminderNote: noteText || undefined,
    settleNote: (direction === 'lent' ? t.debt_settle_tx_note_lent : t.debt_settle_tx_note_borrowed)
      .replace('{{name}}', name),
  })

  const onSave = async () => {
    const name = counterparty.trim()
    if (!name) {
      Alert.alert(t.could_not_save, t.debt_person_required)
      return
    }
    const amount = parseAmountInput(amountText)
    if (amount === null) {
      Alert.alert(t.invalid_amount, t.invalid_amount_msg)
      return
    }
    const amount_cents = Math.round(displayToCents(amount, debtCurrency))
    const trimmedNote = note.trim()
    const labels = buildLabels(name, trimmedNote)

    setSubmitting(true)
    const res = isEditing
      ? await updateDebt({
          id: editingId!,
          counterparty: name,
          ...(isSettled ? {} : { amount_cents }),
          note: trimmedNote || null,
          occurred_at: occurredAt.toISOString(),
          due_at: hasDueDate ? dueAt.toISOString() : null,
          remind_days_before: remindDays,
        }, labels)
      : await createDebt({
          direction,
          counterparty: name,
          amount_cents,
          currency: debtCurrency,
          note: trimmedNote || undefined,
          occurred_at: occurredAt.toISOString(),
          due_at: hasDueDate ? dueAt.toISOString() : null,
          remind_days_before: remindDays,
        }, labels)
    setSubmitting(false)

    if (!res.ok) {
      Alert.alert(t.could_not_save, res.error ?? '')
      return
    }
    void hapticSaveSuccess()
    notifySaved(t, useSettingsStore.getState().syncFinance)
    router.back()
  }

  const onSettle = () => {
    if (!editingDebt) return
    Alert.alert(
      t.debt_settle_confirm_title,
      t.debt_settle_confirm_msg
        .replace('{{name}}', editingDebt.counterparty)
        .replace('{{amount}}', formatAmount(editingDebt.amount_cents, editingDebt.currency, language)),
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.debt_mark_paid,
          onPress: () => {
            void (async () => {
              setSubmitting(true)
              const settleNote = (editingDebt.direction === 'lent' ? t.debt_settle_tx_note_lent : t.debt_settle_tx_note_borrowed)
                .replace('{{name}}', editingDebt.counterparty)
              const r = await settleDebt(editingDebt.id, { settleNote })
              setSubmitting(false)
              if (!r.ok) {
                Alert.alert(t.could_not_save, r.error ?? '')
                return
              }
              toast.success(t.debt_settled_toast)
              router.back()
            })()
          },
        },
      ]
    )
  }

  const onDelete = () => {
    if (!editingDebt) return
    Alert.alert(t.delete, t.debt_delete_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSubmitting(true)
            const r = await deleteDebt(editingDebt.id)
            setSubmitting(false)
            if (!r.ok) {
              Alert.alert(t.could_not_save, r.error ?? '')
              return
            }
            router.back()
            toast.undo(t.toast_deleted, t.undo, () => { void restoreDebt(editingDebt.id) })
          })()
        },
      },
    ])
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Direction — fixed after creation because money already moved */}
        <View style={styles.kindRow}>
          {(['lent', 'borrowed'] as DebtDirection[]).map((d) => {
            const active = direction === d
            const color = d === 'lent' ? theme.finance.expense : theme.finance.income
            return (
              <Pressable
                key={d}
                onPress={() => { if (!isEditing) setDirection(d) }}
                disabled={isEditing}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: isEditing }}
                style={[styles.kindBtn, {
                  backgroundColor: active ? color : theme.bg.elevated,
                  borderColor: active ? color : theme.border.subtle,
                  opacity: isEditing && !active ? 0.4 : 1,
                }]}
              >
                <Feather name={d === 'lent' ? 'user-minus' : 'user-plus'} size={15} color={active ? '#fff' : theme.text.secondary} />
                <Text style={{ color: active ? '#fff' : theme.text.primary, fontWeight: '600' }}>
                  {d === 'lent' ? t.debt_lent : t.debt_borrowed}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <Text style={[styles.hint, { color: theme.text.muted }]}>
          {direction === 'lent' ? t.debt_lent_hint : t.debt_borrowed_hint}
        </Text>

        {/* Counterparty */}
        <Text style={[styles.label, { color: theme.text.muted }]}>{t.debt_counterparty}</Text>
        <TextInput
          value={counterparty}
          onChangeText={setCounterparty}
          placeholder={t.debt_counterparty_placeholder}
          placeholderTextColor={theme.text.muted}
          autoFocus={!isEditing}
          style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        />

        {/* Amount */}
        <Text style={[styles.label, { color: theme.text.muted }]}>{t.amount}</Text>
        <View style={styles.amountRow}>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0"
            placeholderTextColor={theme.text.muted}
            keyboardType="decimal-pad"
            editable={!isSettled}
            accessibilityLabel={t.amount}
            style={[styles.amountInput, {
              color: theme.text.primary,
              borderColor: theme.border.strong,
              backgroundColor: theme.bg.elevated,
              opacity: isSettled ? 0.5 : 1,
            }]}
          />
          <Text style={[styles.currency, { color: theme.text.muted }]}>{debtCurrency}</Text>
        </View>

        {/* Occurred date */}
        <Text style={[styles.label, { color: theme.text.muted }]}>{t.date}</Text>
        <DateRow value={occurredAt} onChange={setOccurredAt} label={t.date} />

        {/* Due date + reminder */}
        <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle, opacity: isSettled ? 0.5 : 1 }]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: theme.text.primary }]}>{t.debt_due_date}</Text>
              <Text style={[styles.hint, { color: theme.text.muted }]}>{t.debt_due_date_hint}</Text>
            </View>
            <Switch
              value={hasDueDate}
              onValueChange={(v) => { if (!isSettled) setHasDueDate(v) }}
              disabled={isSettled}
              trackColor={{ true: theme.brand.primary }}
            />
          </View>

          {hasDueDate ? (
            <>
              <Pressable
                onPress={() => { if (!isSettled) setShowDuePicker((v) => !v) }}
                style={[styles.datePill, { backgroundColor: theme.bg.primary, borderColor: theme.border.strong }]}
              >
                <Feather name="calendar" size={16} color={theme.brand.primary} />
                <Text style={[styles.datePillText, { color: theme.text.primary }]}>
                  {format(dueAt, 'EEE, dd MMM yyyy', { locale })}
                </Text>
              </Pressable>
              {showDuePicker && (
                <DateTimePicker
                  value={dueAt}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDuePicker(Platform.OS === 'ios')
                    if (date) setDueAt((prev) => {
                      const d = new Date(date)
                      d.setHours(prev.getHours() || 9, prev.getMinutes(), 0, 0)
                      return d
                    })
                  }}
                />
              )}

              <Text style={[styles.label, { color: theme.text.muted }]}>{t.debt_remind_before}</Text>
              <View style={styles.optionRow}>
                {REMIND_DAY_OPTIONS.map((days) => {
                  const active = remindDays === days
                  return (
                    <Pressable
                      key={days}
                      onPress={() => { if (!isSettled) setRemindDays(days) }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={[styles.optionBtn, {
                        backgroundColor: active ? theme.brand.primary : theme.bg.primary,
                        borderColor: active ? theme.brand.primary : theme.border.subtle,
                      }]}
                    >
                      <Text style={{ color: active ? '#fff' : theme.text.secondary, fontSize: 12, fontWeight: '700' }}>
                        {days === 0 ? t.debt_remind_same_day : t.debt_remind_days.replace('{{count}}', String(days))}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </>
          ) : null}
        </View>

        {/* Note */}
        <Text style={[styles.label, { color: theme.text.muted }]}>{t.note_optional}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t.note_optional}
          placeholderTextColor={theme.text.muted}
          multiline
          numberOfLines={3}
          style={[styles.input, styles.noteInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        />

        {isSettled ? (
          <View style={[styles.settledBanner, { backgroundColor: theme.semantic.success + '1A', borderColor: theme.semantic.success + '55' }]}>
            <Feather name="check-circle" size={16} color={theme.semantic.success} />
            <Text style={[styles.settledText, { color: theme.semantic.success }]}>{t.debt_settled}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated }]}>
        {isEditing ? (
          <Pressable
            onPress={onDelete}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={t.delete}
            style={[styles.footerBtn, styles.footerBtnGhost, { borderColor: theme.semantic.danger + '66' }]}
          >
            <Text style={[styles.footerBtnText, { color: theme.semantic.danger }]}>{t.delete}</Text>
          </Pressable>
        ) : null}
        {isEditing && !isSettled ? (
          <Pressable
            onPress={onSettle}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={t.debt_mark_paid}
            style={[styles.footerBtn, styles.footerBtnGhost, { borderColor: theme.semantic.success + '88' }]}
          >
            <Text style={[styles.footerBtnText, { color: theme.semantic.success }]}>{t.debt_mark_paid}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onSave}
          disabled={submitting}
          accessibilityRole="button"
          style={[styles.footerBtn, { backgroundColor: submitting ? theme.text.muted : theme.brand.primary, flex: 1.4 }]}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={[styles.footerBtnText, { color: '#fff' }]}>{isEditing ? t.update : t.save}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[2], paddingBottom: spacing[8] },
  kindRow: { flexDirection: 'row', gap: spacing[2] },
  kindBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    gap: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 12, fontWeight: '600', marginTop: spacing[2] },
  input: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: 15 },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
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
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[3],
    gap: spacing[2],
    marginTop: spacing[2],
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  switchTitle: { fontSize: 14, fontWeight: '600' },
  datePill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
  },
  datePillText: { fontSize: 14, fontWeight: '500' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  optionBtn: {
    minHeight: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    marginTop: spacing[2],
  },
  settledText: { fontSize: 13, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnGhost: { borderWidth: 1, backgroundColor: 'transparent' },
  footerBtnText: { fontSize: 14, fontWeight: '600' },
})
