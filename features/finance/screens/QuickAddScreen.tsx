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

type Direction = 'expense' | 'income'

export function QuickAddScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const categories = useCategories()
  const { create } = useFinanceActions()

  const [direction, setDirection] = useState<Direction>('expense')
  const [amountText, setAmountText] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [merchant, setMerchant] = useState('')
  const [note, setNote] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filterKind = useMemo(() => (direction === 'income' ? 'income' : undefined), [direction])

  const visibleCategories = useMemo(() => {
    if (direction === 'income') return categories.filter((c) => c.kind === 'income')
    return categories.filter((c) => c.kind !== 'income')
  }, [direction, categories])

  const onSave = async () => {
    const raw = parseInt(amountText.replace(/[^0-9]/g, ''), 10)
    if (!Number.isFinite(raw) || raw <= 0) {
      Alert.alert('Invalid amount', 'Enter a number greater than 0.')
      return
    }
    if (!category) {
      Alert.alert('Pick a category', 'Every transaction needs a category.')
      return
    }
    setSubmitting(true)
    const signed = direction === 'expense' ? -raw : raw
    const res = await create({
      amount_cents: signed,
      currency: 'VND',
      category_id: category.id,
      merchant: merchant.trim() || undefined,
      note: note.trim() || undefined,
      occurred_at: new Date().toISOString(),
      mood: mood ?? undefined,
      source: 'manual',
    })
    setSubmitting(false)
    if (!res.ok) {
      Alert.alert('Could not save', res.error ?? 'Unknown error')
      return
    }
    router.back()
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.body}>
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
                  {d === 'expense' ? 'Expense' : 'Income'}
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
          style={[
            styles.amountInput,
            { color: theme.text.primary, borderColor: theme.border.strong },
          ]}
        />
        <Text style={[styles.currency, { color: theme.text.muted }]}>VND</Text>

        <Text style={[styles.label, { color: theme.text.muted }]}>Category</Text>
        <View style={[styles.box, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated }]}>
          <CategoryPicker
            categories={visibleCategories}
            selectedId={category?.id ?? null}
            onSelect={setCategory}
            filterKind={filterKind}
          />
        </View>

        <Text style={[styles.label, { color: theme.text.muted }]}>Mood (optional)</Text>
        <MoodSelector value={mood} onChange={setMood} />

        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder="Merchant (optional)"
          placeholderTextColor={theme.text.muted}
          style={[styles.input, { color: theme.text.primary, borderColor: theme.border.subtle }]}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={theme.text.muted}
          style={[styles.input, { color: theme.text.primary, borderColor: theme.border.subtle }]}
        />
      </View>

      <View style={[styles.footer, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated }]}>
        <Pressable
          onPress={onSave}
          disabled={submitting}
          style={[
            styles.saveBtn,
            { backgroundColor: submitting ? theme.text.muted : theme.brand.primary },
          ]}
        >
          <Text style={styles.saveText}>{submitting ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: spacing[4], gap: spacing[3] },
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
