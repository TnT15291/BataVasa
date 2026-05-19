import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { hapticSaveSuccess } from '@services/haptics'
import { useFinanceBootstrap, useCategories, useCategoryActions } from '../hooks/useFinance'
import { translateKind } from '../i18n'
import { displayToCents, centsToDisplay } from '@services/ai/aiLanguage'
import type { CategoryKind } from '../types'

const COLOR_PALETTE = [
  '#EF5350', '#EC407A', '#AB47BC', '#7E57C2', '#5C6BC0',
  '#42A5F5', '#26C6DA', '#26A69A', '#66BB6A', '#D4E157',
  '#FFCA28', '#FFA726', '#FF7043', '#8D6E63', '#78909C',
]

const KINDS: CategoryKind[] = ['essential', 'discretionary', 'income', 'savings']

export function CategoryFormScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const currency = useSettingsStore((s) => s.currency)
  const cats = useCategories()
  const { createCategory, updateCategory, deleteCategory } = useCategoryActions()

  const params = useLocalSearchParams<{ id?: string }>()
  const editingId = typeof params.id === 'string' ? params.id : null
  const editingCat = useMemo(
    () => (editingId ? cats.find((c) => c.id === editingId) ?? null : null),
    [editingId, cats]
  )
  const isEditing = !!editingId

  const [name, setName] = useState('')
  const [color, setColor] = useState(COLOR_PALETTE[0]!)
  const [kind, setKind] = useState<CategoryKind>('discretionary')
  const [budgetText, setBudgetText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    if (!editingCat || prefilled) return
    setName(editingCat.name)
    setColor(editingCat.color)
    setKind(editingCat.kind)
    if (editingCat.monthly_budget_cents) {
      setBudgetText(String(centsToDisplay(editingCat.monthly_budget_cents, currency)))
    }
    setPrefilled(true)
  }, [editingCat, currency, prefilled])

  const onSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      Alert.alert(t.invalid_amount, t.category_name_placeholder)
      return
    }
    const budgetRaw = budgetText.trim()
    const budgetNum = budgetRaw ? parseInt(budgetRaw.replace(/[^0-9]/g, ''), 10) : null
    const monthly_budget_cents = budgetNum && budgetNum > 0
      ? displayToCents(budgetNum, currency)
      : null

    setSubmitting(true)
    const res = isEditing
      ? await updateCategory({ id: editingId!, name: trimmed, color, kind, monthly_budget_cents })
      : await createCategory({ name: trimmed, icon: 'tag', color, kind, monthly_budget_cents })
    setSubmitting(false)

    if (!res.ok) {
      Alert.alert(t.could_not_save, res.error ?? '')
      return
    }
    void hapticSaveSuccess()
    router.back()
  }

  const onDelete = () => {
    Alert.alert(t.delete_category, t.delete_category_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          const r = await deleteCategory(editingId!)
          if (r.ok) router.back()
          else Alert.alert(t.could_not_save, r.error ?? '')
        },
      },
    ])
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      {/* Name */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.category}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t.category_name_placeholder}
        placeholderTextColor={theme.text.muted}
        style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
        autoFocus={!isEditing}
      />

      {/* Kind */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.category_kind}</Text>
      <View style={styles.kindRow}>
        {KINDS.map((k) => {
          const active = kind === k
          return (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={[
                styles.kindBtn,
                {
                  backgroundColor: active ? theme.brand.primary : theme.bg.elevated,
                  borderColor: active ? theme.brand.primary : theme.border.subtle,
                },
              ]}
            >
              <Text style={{ color: active ? '#fff' : theme.text.secondary, fontSize: 12, fontWeight: '600' }}>
                {translateKind(k, t)}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Color */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.category_color}</Text>
      <View style={styles.colorGrid}>
        {COLOR_PALETTE.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.colorDot,
              { backgroundColor: c },
              color === c && styles.colorDotSelected,
            ]}
          />
        ))}
      </View>

      {/* Budget */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.budget_monthly.toUpperCase()}</Text>
      <TextInput
        value={budgetText}
        onChangeText={setBudgetText}
        placeholder={t.budget_unlimited}
        placeholderTextColor={theme.text.muted}
        keyboardType="numeric"
        style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}
      />
      <Text style={[styles.hint, { color: theme.text.muted }]}>{t.budget_optional} ({currency})</Text>

      {/* Save */}
      <Pressable
        onPress={onSave}
        disabled={submitting}
        style={[styles.saveBtn, { backgroundColor: submitting ? theme.text.muted : theme.brand.primary }]}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>{isEditing ? t.update : t.save}</Text>}
      </Pressable>

      {isEditing && (
        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <Text style={[styles.deleteBtnText, { color: theme.semantic.danger }]}>{t.delete_category}</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: 15,
  },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  kindBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  hint: { fontSize: 12, marginTop: -spacing[2] },
  saveBtn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center', marginTop: spacing[2] },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing[3] },
  deleteBtnText: { fontSize: 15 },
})
