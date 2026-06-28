import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, Modal, TextInput, ActivityIndicator, Alert } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS, MODULE_ICONS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useFinanceStore } from '@store/financeStore'
import { useCategories } from '@features/finance/hooks/useFinance'
import { useHabits } from '@features/habits/hooks/useHabits'
import { translateCategoryName, translateKind } from '@features/finance/i18n'
import type { CategoryKind } from '@features/finance/types'

// Kept structurally identical to the form's SourceKind so selections flow back
// without a shared import.
export type MetricSourceKind = 'finance' | 'habits' | 'journals' | 'reminders'

export type MetricSelection = {
  kind: MetricSourceKind
  // '' for reminders (tracks all completed tasks, no sub-source).
  id: string
  label: string
  // Sensible starting target when the measure is added ('' = user must type).
  defaultTarget: string
}

type Props = {
  visible: boolean
  // Keys ("kind:id") already on the goal — shown as added, not re-selectable.
  existing: string[]
  onClose: () => void
  onConfirm: (sels: MetricSelection[]) => void
}

const JOURNAL_TAGS = [
  'all', 'work', 'family', 'health', 'money', 'sleep',
  'exercise', 'stress', 'food', 'travel', 'social',
] as const

const keyOf = (kind: MetricSourceKind, id: string) => `${kind}:${id}`
const defaultTargetFor = (kind: MetricSourceKind): string =>
  kind === 'finance' || kind === 'habits' ? '' : '10'

type ItemRow = { id: string; label: string; color: string }

export function MetricPickerSheet({ visible, existing, onClose, onConfirm }: Props) {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const allCategories = useCategories()
  const habits = useHabits()
  const createCategory = useFinanceStore((s) => s.createCategory)
  const financeCategories = allCategories.filter((c) => c.kind === 'savings' || c.kind === 'income' || c.kind === 'discretionary' || c.kind === 'essential')

  // null = module list (level 1); a kind = that module's item list (level 2).
  const [view, setView] = useState<MetricSourceKind | null>(null)
  // New selections this session, keyed "kind:id".
  const [selected, setSelected] = useState<Record<string, MetricSelection>>({})
  const [creatingName, setCreatingName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [savingNew, setSavingNew] = useState(false)
  // Kind for a new finance category (user picks instead of a hardcoded default,
  // so the category surfaces in the right finance pickers afterwards).
  const [newKind, setNewKind] = useState<CategoryKind>('discretionary')

  const existingSet = new Set(existing)

  useEffect(() => {
    if (visible) {
      setView(null)
      setSelected({})
      setShowCreate(false)
      setCreatingName('')
      setNewKind('discretionary')
    }
  }, [visible])

  const tagLabels: Record<string, string> = {
    all: t.tag_all, work: t.tag_work, family: t.tag_family, health: t.tag_health,
    money: t.tag_money, sleep: t.tag_sleep, exercise: t.tag_exercise,
    stress: t.tag_stress, food: t.tag_food, travel: t.tag_travel, social: t.tag_social,
  }

  const modules: Array<{ kind: MetricSourceKind; label: string; hint: string; icon: keyof typeof MODULE_ICONS; color: string }> = [
    { kind: 'finance', label: t.goal_source_finance, hint: t.goal_source_finance_hint, icon: 'finance', color: MODULE_COLORS.finance },
    { kind: 'habits', label: t.goal_source_habit, hint: t.goal_source_habit_hint, icon: 'habits', color: MODULE_COLORS.habits },
    { kind: 'journals', label: t.goal_source_journal, hint: t.goal_source_journal_hint, icon: 'journal', color: MODULE_COLORS.journal },
    { kind: 'reminders', label: t.goal_source_reminder, hint: t.goal_source_reminder_hint, icon: 'tasks', color: MODULE_COLORS.tasks },
  ]

  const itemsFor = (kind: MetricSourceKind): ItemRow[] => {
    if (kind === 'finance') return financeCategories.map((c) => ({ id: c.id, label: translateCategoryName(c, t), color: c.color }))
    if (kind === 'habits') return habits.map((h) => ({ id: h.id, label: h.name, color: h.color || MODULE_COLORS.habits }))
    if (kind === 'journals') return JOURNAL_TAGS.map((tag) => ({ id: tag, label: tagLabels[tag] ?? tag, color: MODULE_COLORS.journal }))
    return []
  }

  const isAdded = (kind: MetricSourceKind, id: string) => existingSet.has(keyOf(kind, id))
  const isChecked = (kind: MetricSourceKind, id: string) => isAdded(kind, id) || !!selected[keyOf(kind, id)]

  const toggle = (sel: MetricSelection) => {
    if (isAdded(sel.kind, sel.id)) return
    setSelected((prev) => {
      const next = { ...prev }
      const k = keyOf(sel.kind, sel.id)
      if (next[k]) delete next[k]
      else next[k] = sel
      return next
    })
  }

  const confirm = () => {
    onConfirm(Object.values(selected))
    onClose()
  }

  const openCreate = () => { setShowCreate(true); setCreatingName('') }

  // Finance categories are simple (name + kind), so they're created inline here.
  const submitCreate = async () => {
    const name = creatingName.trim()
    if (!name || savingNew || view !== 'finance') return
    setSavingNew(true)
    try {
      const res = await createCategory({ name, icon: 'target', color: MODULE_COLORS.finance, kind: newKind })
      if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); return }
      const created = useFinanceStore.getState().categories.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
      if (!created) { Alert.alert(t.could_not_save, ''); return }
      toggle({ kind: 'finance', id: created.id, label: translateCategoryName(created, t), defaultTarget: defaultTargetFor('finance') })
      setShowCreate(false)
      setCreatingName('')
    } finally {
      setSavingNew(false)
    }
  }

  // Habits need frequency/color/icon, so open the full habit editor. It hands the
  // new habit back via the link inbox; the goal form attaches it as a measure.
  const openHabitForm = () => {
    onClose()
    router.push({ pathname: '/habit', params: { linkToGoal: '1' } })
  }

  const selectedCount = Object.keys(selected).length
  const activeModule = view ? modules.find((m) => m.kind === view)! : null
  const items = view ? itemsFor(view) : []
  const canCreateHere = view === 'finance' || view === 'habits'

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.bg.primary, paddingBottom: insets.bottom + spacing[3] }]}>
          <View style={styles.header}>
            {view ? (
              <Pressable onPress={() => { setView(null); setShowCreate(false) }} hitSlop={10} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t.back}>
                <Feather name="chevron-left" size={22} color={theme.text.muted} />
              </Pressable>
            ) : null}
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
                {activeModule ? activeModule.label : t.goal_metric_sheet_title}
              </Text>
              <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={2}>
                {activeModule ? t.goal_metric_pick_item : t.goal_select_modules_hint}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t.cancel}>
              <Feather name="x" size={22} color={theme.text.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {view === null
              ? modules.map((m) => {
                  // Reminders has no sub-items, so it carries its own checkbox.
                  if (m.kind === 'reminders') {
                    const checked = isChecked('reminders', '')
                    const added = isAdded('reminders', '')
                    return (
                      <Pressable
                        key={m.kind}
                        onPress={() => toggle({ kind: 'reminders', id: '', label: m.label, defaultTarget: defaultTargetFor('reminders') })}
                        style={[styles.moduleRow, { backgroundColor: theme.bg.elevated, borderColor: checked ? m.color + '99' : theme.border.subtle }]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                      >
                        <View style={[styles.moduleIcon, { backgroundColor: m.color + '1F' }]}>
                          <Feather name={MODULE_ICONS[m.icon]} size={18} color={m.color} />
                        </View>
                        <View style={styles.moduleBody}>
                          <Text style={[styles.moduleLabel, { color: theme.text.primary }]}>{m.label}</Text>
                          <Text style={[styles.moduleHint, { color: theme.text.muted }]} numberOfLines={2}>{m.hint}</Text>
                        </View>
                        <Checkbox checked={checked} disabled={added} color={m.color} />
                      </Pressable>
                    )
                  }
                  return (
                    <Pressable
                      key={m.kind}
                      onPress={() => { setView(m.kind); setShowCreate(false) }}
                      style={[styles.moduleRow, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
                      accessibilityRole="button"
                    >
                      <View style={[styles.moduleIcon, { backgroundColor: m.color + '1F' }]}>
                        <Feather name={MODULE_ICONS[m.icon]} size={18} color={m.color} />
                      </View>
                      <View style={styles.moduleBody}>
                        <Text style={[styles.moduleLabel, { color: theme.text.primary }]}>{m.label}</Text>
                        <Text style={[styles.moduleHint, { color: theme.text.muted }]} numberOfLines={2}>{m.hint}</Text>
                      </View>
                      <Feather name="chevron-right" size={20} color={theme.text.muted} />
                    </Pressable>
                  )
                })
              : (
                <>
                  {view === 'finance' ? (
                    showCreate ? (
                      <View style={styles.createWrap}>
                        <View style={styles.kindRow}>
                          {(['essential', 'discretionary', 'income', 'savings'] as const).map((k) => {
                            const active = newKind === k
                            return (
                              <Pressable
                                key={k}
                                onPress={() => setNewKind(k)}
                                style={[styles.kindChip, { backgroundColor: active ? MODULE_COLORS.finance : theme.bg.elevated, borderColor: active ? MODULE_COLORS.finance : theme.border.subtle }]}
                              >
                                <Text style={[styles.kindChipText, { color: active ? '#fff' : theme.text.secondary }]} numberOfLines={1}>{translateKind(k, t)}</Text>
                              </Pressable>
                            )
                          })}
                        </View>
                        <View style={[styles.createRow, { backgroundColor: theme.bg.elevated, borderColor: MODULE_COLORS.finance + '66' }]}>
                        <TextInput
                          value={creatingName}
                          onChangeText={setCreatingName}
                          placeholder={t.goal_new_name_placeholder}
                          placeholderTextColor={theme.text.muted}
                          style={[styles.createInput, { color: theme.text.primary }]}
                          autoFocus
                          editable={!savingNew}
                          onSubmitEditing={submitCreate}
                          returnKeyType="done"
                        />
                        <Pressable
                          onPress={submitCreate}
                          disabled={savingNew || !creatingName.trim()}
                          style={[styles.createConfirm, { backgroundColor: savingNew || !creatingName.trim() ? theme.border.strong : MODULE_COLORS.finance }]}
                          accessibilityRole="button"
                          accessibilityLabel={t.save}
                        >
                          {savingNew ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="check" size={16} color="#fff" />}
                        </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable onPress={openCreate} style={[styles.createCta, { borderColor: MODULE_COLORS.finance + '66' }]} accessibilityRole="button">
                        <Feather name="plus" size={16} color={MODULE_COLORS.finance} />
                        <Text style={[styles.createCtaText, { color: MODULE_COLORS.finance }]}>{t.goal_create_category}</Text>
                      </Pressable>
                    )
                  ) : view === 'habits' ? (
                    <Pressable onPress={openHabitForm} style={[styles.createCta, { borderColor: MODULE_COLORS.habits + '66' }]} accessibilityRole="button">
                      <Feather name="plus" size={16} color={MODULE_COLORS.habits} />
                      <Text style={[styles.createCtaText, { color: MODULE_COLORS.habits }]}>{t.goal_create_habit}</Text>
                    </Pressable>
                  ) : null}

                  {items.length === 0 && !canCreateHere ? (
                    <View style={styles.empty}>
                      <Feather name="inbox" size={26} color={theme.text.muted} />
                      <Text style={[styles.emptyText, { color: theme.text.muted }]}>{t.goal_metric_none}</Text>
                    </View>
                  ) : (
                    items.map((item) => {
                      const checked = isChecked(view, item.id)
                      const added = isAdded(view, item.id)
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => toggle({ kind: view, id: item.id, label: item.label, defaultTarget: defaultTargetFor(view) })}
                          style={[styles.itemRow, { backgroundColor: theme.bg.elevated, borderColor: checked ? item.color : theme.border.subtle }]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked, disabled: added }}
                        >
                          <View style={[styles.dot, { backgroundColor: item.color }]} />
                          <Text style={[styles.itemLabel, { color: theme.text.primary }]} numberOfLines={1}>{item.label}</Text>
                          {added ? <Text style={[styles.addedTag, { color: theme.text.muted }]}>{t.done}</Text> : null}
                          <Checkbox checked={checked} disabled={added} color={item.color} />
                        </Pressable>
                      )
                    })
                  )}
                </>
              )}
          </ScrollView>

          <Pressable onPress={confirm} style={[styles.confirmBtn, { backgroundColor: MODULE_COLORS.analysis }]} accessibilityRole="button">
            <Text style={styles.confirmText}>
              {selectedCount > 0 ? `${t.done} (${selectedCount})` : t.done}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function Checkbox({ checked, disabled, color }: { checked: boolean; disabled?: boolean; color: string }) {
  const theme = useTheme()
  return (
    <View style={[styles.checkbox, { borderColor: checked ? color : theme.border.strong, backgroundColor: checked ? (disabled ? color + '99' : color) : 'transparent' }]}>
      {checked ? <Feather name="check" size={13} color="#fff" /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '86%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingBottom: spacing[3] },
  backBtn: { padding: spacing[1] },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 18 },
  closeBtn: { padding: spacing[1] },
  body: { gap: spacing[2], paddingBottom: spacing[3] },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderWidth: 1, borderRadius: radius.md, padding: spacing[3] },
  moduleIcon: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  moduleBody: { flex: 1, gap: 2 },
  moduleLabel: { fontSize: 15, fontWeight: '700' },
  moduleHint: { fontSize: 12, lineHeight: 17 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[3], minHeight: 50 },
  dot: { width: 12, height: 12, borderRadius: radius.full },
  itemLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  addedTag: { fontSize: 11, fontWeight: '700' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  createWrap: { gap: spacing[2] },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  kindChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  kindChipText: { fontSize: 12, fontWeight: '700' },
  createCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, minHeight: 48 },
  createCtaText: { fontSize: 14, fontWeight: '700' },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderWidth: 1, borderRadius: radius.md, paddingLeft: spacing[3], paddingRight: spacing[2], minHeight: 50 },
  createInput: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: spacing[2] },
  createConfirm: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: spacing[8], alignItems: 'center', gap: spacing[3] },
  emptyText: { fontSize: 14, textAlign: 'center' },
  confirmBtn: { minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
