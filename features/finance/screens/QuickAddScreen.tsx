import { useState, useMemo } from 'react'
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
import { useRouter } from 'expo-router'
import {
  useFinanceBootstrap,
  useCategories,
  useFinanceActions,
} from '../hooks/useFinance'
import { CategoryPicker } from '../components/CategoryPicker'
import { MoodSelector } from '../components/MoodSelector'
import type { Mood, Category } from '../types'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { parseSmartEntry } from '@services/ai/smartEntry'
import { useSettingsStore } from '@store/settingsStore'

type Direction = 'expense' | 'income'

export function QuickAddScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const currency = useSettingsStore((s) => s.currency)
  const categories = useCategories()
  const { create } = useFinanceActions()

  const [direction, setDirection] = useState<Direction>('expense')
  const [amountText, setAmountText] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [merchant, setMerchant] = useState('')
  const [note, setNote] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Smart entry state
  const [smartText, setSmartText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [smartExpanded, setSmartExpanded] = useState(false)

  const visibleCategories = useMemo(() => {
    if (direction === 'income') return categories.filter((c) => c.kind === 'income')
    return categories.filter((c) => c.kind !== 'income')
  }, [direction, categories])

  const onParseSmartEntry = async () => {
    const text = smartText.trim()
    if (!text) return
    setParsing(true)
    try {
      const parsed = await parseSmartEntry(text, categories)
      if (!parsed) {
        Alert.alert(t.ai_error, 'Không thể phân tích. Thử nhập chi tiết hơn.')
        return
      }
      setAmountText(String(Math.round(parsed.amount_cents / 100)))
      setDirection(parsed.direction)
      if (parsed.merchant) setMerchant(parsed.merchant)
      if (parsed.note) setNote(parsed.note)
      // Try to match category hint
      const matched = categories.find((c) =>
        c.name.toLowerCase().includes(parsed.category_hint.toLowerCase()) ||
        parsed.category_hint.toLowerCase().includes(c.name.toLowerCase())
      )
      if (matched) setCategory(matched)
      setSmartExpanded(false)
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
    const signed = direction === 'expense' ? -raw : raw
    const res = await create({
      amount_cents: signed,
      currency,
      category_id: category.id,
      merchant: merchant.trim() || undefined,
      note: note.trim() || undefined,
      occurred_at: new Date().toISOString(),
      mood: mood ?? undefined,
      source: 'manual',
    })
    setSubmitting(false)
    if (!res.ok) {
      Alert.alert(t.could_not_save, res.error ?? 'Unknown error')
      return
    }
    router.back()
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Smart Entry */}
        <Pressable
          onPress={() => setSmartExpanded((v) => !v)}
          style={[styles.smartToggle, { borderColor: theme.brand.primary, backgroundColor: theme.bg.elevated }]}
        >
          <Text style={{ fontSize: 16 }}>✨</Text>
          <Text style={[styles.smartToggleText, { color: theme.brand.primary }]}>{t.smart_entry}</Text>
          <Text style={{ color: theme.brand.primary, fontSize: 16 }}>{smartExpanded ? '▲' : '▼'}</Text>
        </Pressable>

        {smartExpanded && (
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
            <Pressable
              onPress={onParseSmartEntry}
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
        <Pressable
          onPress={onSave}
          disabled={submitting}
          style={[
            styles.saveBtn,
            { backgroundColor: submitting ? theme.text.muted : theme.brand.primary },
          ]}
        >
          <Text style={styles.saveText}>{submitting ? t.saving : t.save}</Text>
        </Pressable>
      </View>
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
  saveBtn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
