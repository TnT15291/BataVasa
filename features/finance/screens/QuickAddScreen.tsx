import { useState, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  useFinanceBootstrap,
  useCategories,
  useTransactions,
  useFinanceActions,
} from '../hooks/useFinance'
import { CategoryPicker } from '../components/CategoryPicker'
import { MoodSelector } from '../components/MoodSelector'
import type { Mood, Category } from '../types'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { parseSmartEntry } from '@services/ai/smartEntry'
import { getProviderKey } from '@services/ai/openai'
import { centsToDisplay, displayToCents } from '@services/ai/aiLanguage'
import { useSettingsStore } from '@store/settingsStore'
import { DateRow } from '@components/DateRow'
import { LocationRow, EMPTY_LOCATION, type LocationValue } from '@components/LocationRow'
import { ConfirmEntrySheet, type ConfirmField } from '@components/ConfirmEntrySheet'
import { VoiceButton } from '@components/VoiceButton'
import { translateCategoryName, matchCategory } from '../i18n'
import { extractDateFromText } from '@services/dateParser'
import { formatAmount } from '../services'
import { format as formatDate } from 'date-fns'
import { getDateFnsLocale } from '@services/locale'
import { hapticSaveSuccess } from '@services/haptics'

type Direction = 'expense' | 'income'
type SmartEntrySource = 'manual' | 'voice'

export function QuickAddScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const currency = useSettingsStore((s) => s.currency)
  const language = useSettingsStore((s) => s.language)
  const locationAccess = useSettingsStore((s) => s.locationAccess)
  const aiProvider = useSettingsStore((s) => s.aiProvider)
  const [hasApiKey, setHasApiKey] = useState(false)
  useEffect(() => {
    getProviderKey(aiProvider).then((k) => setHasApiKey(!!k))
  }, [aiProvider])
  const categories = useCategories()
  const allTxs = useTransactions()
  const { create, update, remove } = useFinanceActions()

  // Edit mode if `id` query param present
  const params = useLocalSearchParams<{ id?: string }>()
  const editingId = typeof params.id === 'string' ? params.id : null
  const editingTx = useMemo(
    () => (editingId ? allTxs.find((t) => t.id === editingId) ?? null : null),
    [editingId, allTxs]
  )
  const isEditing = !!editingId

  const [direction, setDirection] = useState<Direction>('expense')
  const [amountText, setAmountText] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [merchant, setMerchant] = useState('')
  const [note, setNote] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  const [occurredAt, setOccurredAt] = useState<Date>(() => new Date())
  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION)
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  // Pre-fill state when editing an existing transaction
  useEffect(() => {
    if (!editingTx || prefilled) return
    const cat = categories.find((c) => c.id === editingTx.category_id) ?? null
    setDirection(editingTx.amount_cents < 0 ? 'expense' : 'income')
    setAmountText(String(centsToDisplay(Math.abs(editingTx.amount_cents), editingTx.currency)))
    setCategory(cat)
    setMerchant(editingTx.merchant ?? '')
    setNote(editingTx.note ?? '')
    setMood(editingTx.mood)
    setOccurredAt(new Date(editingTx.occurred_at))
    setLocation({
      lat: editingTx.location_lat,
      lng: editingTx.location_lng,
      label: editingTx.location_label ?? '',
    })
    setPrefilled(true)
  }, [editingTx, categories, prefilled])

  // Smart entry state
  const [smartText, setSmartText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [smartExpanded, setSmartExpanded] = useState(false)
  const aiAutoConfirm = useSettingsStore((s) => s.aiAutoConfirm)
  const [confirmSheet, setConfirmSheet] = useState<{
    rawInput: string
    fields: ConfirmField[]
    payload: {
      direction: Direction
      amount_cents: number
      category: Category
      merchant: string
      note: string
      occurredAt: Date
      source: SmartEntrySource
    }
  } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const visibleCategories = useMemo(() => {
    if (direction === 'income') return categories.filter((c) => c.kind === 'income')
    return categories.filter((c) => c.kind !== 'income')
  }, [direction, categories])

  // Apply a parsed result into the form state (used by both auto-fill path and "Edit" from confirm sheet)
  const applyParsedToForm = (p: {
    direction: Direction
    amount_cents: number
    category: Category
    merchant: string
    note: string
    occurredAt: Date
    source?: SmartEntrySource
  }) => {
    setAmountText(String(centsToDisplay(p.amount_cents, currency)))
    setDirection(p.direction)
    setCategory(p.category)
    if (p.merchant) setMerchant(p.merchant)
    if (p.note) setNote(p.note)
    setOccurredAt(p.occurredAt)
    setSmartExpanded(false)
  }

  const onParseSmartEntry = async (override?: string, source: SmartEntrySource = 'manual') => {
    const text = (override ?? smartText).trim()
    if (!text) return
    if (override) setSmartText(override)
    // H7: parse date deterministically before AI call so result is never reliant on AI
    const parsedDate = extractDateFromText(text)
    setParsing(true)
    try {
      const parsed = await parseSmartEntry(text, categories)
      if (!parsed) {
        Alert.alert(t.ai_error, t.smart_entry_hint)
        return
      }
      // H6: match using English exact → translated → substring, never silently fail
      const matched = matchCategory(categories, parsed.category_hint, t)
      const fallbackCat =
        matched ??
        categories.find((c) => (parsed.direction === 'income' ? c.kind === 'income' : c.kind !== 'income')) ??
        null
      if (!fallbackCat) {
        Alert.alert(t.pick_category, t.pick_category_msg)
        return
      }

      const payload = {
        direction: parsed.direction as Direction,
        amount_cents: parsed.amount_cents,
        category: fallbackCat,
        merchant: parsed.merchant ?? '',
        note: parsed.note ?? '',
        occurredAt: parsedDate,
        source,
      }

      // Rule 5: voice input always requires confirmation, even when text smart entry auto-confirm is off.
      if (source === 'voice' || aiAutoConfirm) {
        const fields: ConfirmField[] = [
          {
            label: parsed.direction === 'income' ? t.income : t.expense,
            value: formatAmount(parsed.amount_cents, currency, language),
          },
          { label: t.category, value: translateCategoryName(fallbackCat, t) },
          {
            label: t.date,
            value: formatDate(payload.occurredAt, 'EEE, dd MMM yyyy · HH:mm', {
              locale: getDateFnsLocale(language),
            }),
          },
        ]
        if (payload.merchant) fields.push({ label: t.merchant_optional.replace(/\s*\(.+\)/, ''), value: payload.merchant })
        if (payload.note) fields.push({ label: t.note_optional.replace(/\s*\(.+\)/, ''), value: payload.note })
        setConfirmSheet({ rawInput: text, fields, payload })
      } else {
        applyParsedToForm(payload)
      }
    } catch (e: any) {
      if (e?.message === 'NO_API_KEY') {
        Alert.alert(t.no_api_key, t.no_api_key_msg)
      } else {
        Alert.alert(t.ai_error, e?.message ?? 'Unknown error')
      }
    } finally {
      setParsing(false)
    }
  }

  // Confirm sheet handlers
  const onSheetSave = async () => {
    if (!confirmSheet) return
    setConfirmBusy(true)
    const p = confirmSheet.payload
    const signed = p.direction === 'expense' ? -p.amount_cents : p.amount_cents
    const res = await create({
      amount_cents: signed,
      currency,
      category_id: p.category.id,
      merchant: p.merchant || undefined,
      note: p.note || undefined,
      occurred_at: p.occurredAt.toISOString(),
      source: p.source,
    })
    setConfirmBusy(false)
    if (res.ok) {
      void hapticSaveSuccess()
      setConfirmSheet(null)
      router.back()
    } else {
      Alert.alert(t.could_not_save, res.error ?? '')
    }
  }
  const onSheetEdit = () => {
    if (!confirmSheet) return
    applyParsedToForm(confirmSheet.payload)
    setConfirmSheet(null)
  }
  const onSheetCancel = () => setConfirmSheet(null)

  const onSave = async () => {
    const raw = parseInt(amountText.replace(/[^0-9]/g, ''), 10)
    if (!Number.isFinite(raw) || raw <= 0) {
      Alert.alert(t.invalid_amount, t.invalid_amount_msg)
      return
    }
    if (!category) {
      Alert.alert(t.pick_category, t.pick_category_msg)
      return
    }
    setSubmitting(true)
    const cents = displayToCents(raw, currency)
    const signed = direction === 'expense' ? -cents : cents
    const trimmedLabel = location.label.trim()
    const payload = {
      amount_cents: signed,
      currency,
      category_id: category.id,
      merchant: merchant.trim() || undefined,
      note: note.trim() || undefined,
      occurred_at: occurredAt.toISOString(),
      mood: mood ?? undefined,
      source: 'manual' as const,
      location_lat: trimmedLabel ? location.lat ?? undefined : undefined,
      location_lng: trimmedLabel ? location.lng ?? undefined : undefined,
      location_label: trimmedLabel || undefined,
    }
    const res = isEditing
      ? await update({ id: editingId!, ...payload })
      : await create(payload)
    setSubmitting(false)
    if (!res.ok) {
      Alert.alert(t.could_not_save, res.error ?? 'Unknown error')
      return
    }
    void hapticSaveSuccess()
    router.back()
  }

  const onDelete = () => {
    if (!isEditing) return
    Alert.alert(t.delete, t.confirm_delete_msg ?? '', [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          const r = await remove(editingId!)
          if (r.ok) router.back()
          else Alert.alert(t.could_not_save, r.error ?? '')
        },
      },
    ])
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Smart Entry */}
        <Pressable
          onPress={() => {
            if (!hasApiKey) {
              router.push('/ai-settings')
              return
            }
            setSmartExpanded((v) => !v)
          }}
          style={[
            styles.smartToggle,
            {
              borderColor: hasApiKey ? theme.brand.primary : theme.border.strong,
              backgroundColor: theme.bg.elevated,
            },
          ]}
        >
          <Text style={{ fontSize: 16 }}>✨</Text>
          <Text style={[styles.smartToggleText, { color: hasApiKey ? theme.brand.primary : theme.text.muted }]}>
            {t.smart_entry}
          </Text>
          {hasApiKey ? (
            <Text style={{ color: theme.brand.primary, fontSize: 16 }}>{smartExpanded ? '▲' : '▼'}</Text>
          ) : (
            <Text style={{ color: theme.text.muted, fontSize: 12 }}>{t.setup_ai_first} →</Text>
          )}
        </Pressable>

        {smartExpanded && hasApiKey && (
          <View style={[styles.smartBox, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <Text style={[styles.smartHint, { color: theme.text.muted }]}>{t.smart_entry_hint}</Text>
            <TextInput
              value={smartText}
              onChangeText={setSmartText}
              placeholder={t.smart_entry_placeholder}
              placeholderTextColor={theme.text.muted}
              multiline
              style={[styles.smartInput, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.secondary }]}
            />
            <View style={styles.smartActions}>
              <VoiceButton onResult={(text) => onParseSmartEntry(text, 'voice')} disabled={parsing} size={44} module="finance" />
              <Pressable
                onPress={() => onParseSmartEntry()}
                disabled={parsing || !smartText.trim()}
                style={[styles.smartBtn, { backgroundColor: parsing || !smartText.trim() ? theme.text.muted : theme.brand.accent }]}
              >
                {parsing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.smartBtnText}>{t.fill_from_ai}</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Direction toggle */}
        <View style={styles.directionRow}>
          {(['expense', 'income'] as Direction[]).map((d) => {
            const active = direction === d
            const color = d === 'expense' ? theme.finance.expense : theme.finance.income
            return (
              <Pressable
                key={d}
                onPress={() => {
                  setDirection(d)
                  setCategory(null)
                }}
                style={[
                  styles.directionBtn,
                  {
                    backgroundColor: active ? color : theme.bg.elevated,
                    borderColor: active ? color : theme.border.subtle,
                  },
                ]}
              >
                <Text style={{ color: active ? '#fff' : theme.text.primary, fontWeight: '600' }}>
                  {d === 'expense' ? t.expense : t.income}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0"
          placeholderTextColor={theme.text.muted}
          keyboardType="numeric"
          style={[styles.amountInput, { color: theme.text.primary, borderColor: theme.border.strong }]}
        />
        <Text style={[styles.currency, { color: theme.text.muted }]}>{currency}</Text>

        <Text style={[styles.label, { color: theme.text.muted }]}>{t.category}</Text>
        <View style={[styles.box, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated }]}>
          <CategoryPicker
            categories={visibleCategories}
            selectedId={category?.id ?? null}
            onSelect={setCategory}
            filterKind={direction === 'income' ? 'income' : undefined}
          />
        </View>

        <Text style={[styles.label, { color: theme.text.muted }]}>{t.mood_label}</Text>
        <MoodSelector value={mood} onChange={setMood} />

        <DateRow value={occurredAt} onChange={setOccurredAt} label={t.date} />

        <LocationRow
          value={location}
          onChange={setLocation}
          autoFetch={locationAccess}
          label={t.location}
        />

        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder={t.merchant_optional}
          placeholderTextColor={theme.text.muted}
          style={[styles.input, { color: theme.text.primary, borderColor: theme.border.subtle }]}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t.note_optional}
          placeholderTextColor={theme.text.muted}
          style={[styles.input, { color: theme.text.primary, borderColor: theme.border.subtle }]}
        />
      </ScrollView>

      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated }]}>
        <View style={styles.footerRow}>
          {isEditing && (
            <Pressable
              onPress={onDelete}
              disabled={submitting}
              style={[styles.deleteBtn, { borderColor: theme.text.danger }]}
            >
              <Text style={[styles.deleteText, { color: theme.text.danger }]}>{t.delete}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onSave}
            disabled={submitting}
            style={[
              styles.saveBtn,
              { backgroundColor: submitting ? theme.text.muted : theme.brand.primary },
              isEditing && { flex: 1 },
            ]}
          >
            <Text style={styles.saveText}>
              {submitting ? t.saving : isEditing ? t.update : t.save}
            </Text>
          </Pressable>
        </View>
      </View>

      {confirmSheet && (
        <ConfirmEntrySheet
          visible={!!confirmSheet}
          rawInput={confirmSheet.rawInput}
          fields={confirmSheet.fields}
          onSave={onSheetSave}
          onEdit={onSheetEdit}
          onCancel={onSheetCancel}
          busy={confirmBusy}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  smartToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  smartToggleText: { flex: 1, fontSize: 15, fontWeight: '600' },
  smartBox: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[3],
  },
  smartHint: { fontSize: 12 },
  smartActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  smartInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  smartBtn: {
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  smartBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  directionRow: { flexDirection: 'row', gap: spacing[2] },
  directionBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  currency: { textAlign: 'center', fontSize: 12, marginTop: -spacing[2] },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: spacing[2] },
  box: {
    flexShrink: 1,
    maxHeight: 220,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: 15,
  },
  footer: {
    padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerRow: { flexDirection: 'row', gap: spacing[2] },
  saveBtn: { flex: 1, paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { fontSize: 15, fontWeight: '600' },
})
