import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { parseUniversalCandidates, type UniversalCandidate, type UniversalEntry } from '@services/ai/universalEntry'
import { getProviderKey } from '@services/ai/openai'
import { hapticSaveSuccess } from '@services/haptics'
import { notifySaved } from '@store/toastStore'
import { VoiceButton } from '@components/VoiceButton'
import { matchCategory } from '@features/finance/i18n'
import { useCategories } from '@features/finance/hooks/useFinance'
import { useFinanceStore } from '@store/financeStore'
import { useRemindersStore } from '@store/remindersStore'
import { useHabitsStore } from '@store/habitsStore'
import { useJournalsStore } from '@store/journalsStore'
import { formatAmount } from '@features/finance/services'

type IconName = keyof typeof Feather.glyphMap

const MODULE_META: Record<string, { icon: IconName; color: string }> = {
  finance:  { icon: 'dollar-sign', color: '#4CAF50' },
  reminder: { icon: 'bell', color: '#2196F3' },
  habits:   { icon: 'check-circle', color: '#FF9800' },
  journal:  { icon: 'book-open', color: '#9C27B0' },
}

type Props = {
  visible: boolean
  onClose: () => void
  initialText?: string
  autoAnalyzeToken?: number
}

export function UniversalAddSheet({ visible, onClose, initialText = '', autoAnalyzeToken = 0 }: Props) {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const currency = useSettingsStore((s) => s.currency)
  const cats = useCategories()
  const createTransaction = useFinanceStore((s) => s.createTransaction)
  const createReminder = useRemindersStore((s) => s.createReminder)
  const createHabit = useHabitsStore((s) => s.createHabit)
  const createJournal = useJournalsStore((s) => s.createJournal)

  const [text, setText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [candidates, setCandidates] = useState<UniversalCandidate[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setText('')
    setCandidates([])
    setSelectedIds([])
    setAnalyzing(false)
    setSaving(false)
  }

  const handleClose = () => { reset(); onClose() }

  const goToForm = (route: string) => { handleClose(); router.push(route as any) }

  const quickModules: { route: string; icon: IconName; color: string; label: string }[] = [
    { route: '/new', icon: 'dollar-sign', color: '#4CAF50', label: t.nav_new_transaction },
    { route: '/reminder', icon: 'bell', color: '#2196F3', label: t.new_reminder },
    { route: '/habit', icon: 'check-circle', color: '#FF9800', label: t.new_habit },
    { route: '/journal', icon: 'book-open', color: '#9C27B0', label: t.new_journal },
  ]

  const onAnalyze = async (override?: string) => {
    const input = (override ?? text).trim()
    if (!input) return
    const provider = useSettingsStore.getState().aiProvider
    const key = await getProviderKey(provider)
    if (!key) { Alert.alert(t.api_key_required, t.no_api_key_msg); return }
    if (override) setText(override)
    setAnalyzing(true)
    try {
      const parsed = await parseUniversalCandidates(input)
      if (parsed.length === 0) {
        Alert.alert(t.ai_error, t.parse_failed)
      } else {
        setCandidates(parsed)
        const defaults = parsed.filter((c) => c.selectedByDefault).map((c) => c.id)
        setSelectedIds(defaults.length > 0 ? defaults : [parsed[0]!.id])
      }
    } catch { Alert.alert(t.ai_error, t.parse_failed) }
    finally { setAnalyzing(false) }
  }

  useEffect(() => {
    if (!visible || !initialText.trim()) return
    setText(initialText)
    setCandidates([])
    setSelectedIds([])
    if (autoAnalyzeToken > 0) {
      void onAnalyze(initialText)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialText, autoAnalyzeToken])

  const onSave = async () => {
    const selected = candidates.filter((c) => selectedIds.includes(c.id)).map((c) => c.entry)
    if (selected.length === 0) return
    setSaving(true)

    const financeEntries = selected.filter((entry): entry is Extract<UniversalEntry, { module: 'finance' }> => entry.module === 'finance')
    for (const entry of financeEntries) {
      const cat = matchCategory(cats, entry.category_hint, t)
      if (!cat) {
        Alert.alert(t.pick_category, t.pick_category_msg)
        setSaving(false)
        return
      }
    }

    for (const entry of selected) {
      if (entry.module === 'finance') {
        const cat = matchCategory(cats, entry.category_hint, t)
        const res = await createTransaction({
          amount_cents: entry.direction === 'expense' ? -Math.abs(entry.amount_cents) : Math.abs(entry.amount_cents),
          currency,
          category_id: cat!.id,
          merchant: entry.merchant || undefined,
          note: entry.note || undefined,
          occurred_at: entry.occurred_at,
          source: 'voice',
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
      } else if (entry.module === 'reminder') {
        const res = await createReminder({
          title: entry.title,
          note: entry.note || undefined,
          remind_at: entry.remind_at,
          advance_minutes: 0,
          recurrence: entry.recurrence,
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
      } else if (entry.module === 'habits') {
        const cadence = entry.frequency === 'daily'
          ? 'daily'
          : entry.frequency === 'weekdays'
          ? 'weekdays'
          : 'weekly'
        const res = await createHabit({
          name: entry.title,
          cadence,
          target_per_period: 1,
          icon: 'check',
          color: '#4CAF50',
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
      } else if (entry.module === 'journal') {
        const res = await createJournal({
          content: entry.content,
          occurred_at: new Date().toISOString(),
        })
        if (!res.ok) { setSaving(false); Alert.alert(t.could_not_save, res.error); return }
      }
    }

    setSaving(false)
    void hapticSaveSuccess()
    const s = useSettingsStore.getState()
    const anySynced = selected.some((e) =>
      (e.module === 'finance' && s.syncFinance) ||
      (e.module === 'reminder' && s.syncReminders) ||
      (e.module === 'habits' && s.syncHabits) ||
      (e.module === 'journal' && s.syncJournals)
    )
    notifySaved(t, anySynced)
    handleClose()
  }

  const toggleCandidate = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]
    )
  }

  const renderSummary = (candidate: UniversalCandidate) => {
    const result = candidate.entry
    const meta = MODULE_META[result.module]!
    const locale = getDateFnsLocale(language)

    let lines: string[] = []
    if (result.module === 'finance') {
      const sign = result.direction === 'expense' ? '- ' : '+ '
      lines = [
        `${sign}${formatAmount(result.amount_cents, currency, language)}`,
        result.category_hint,
        result.merchant || '',
        result.occurred_at ? format(new Date(result.occurred_at), 'dd/MM/yyyy', { locale }) : '',
      ].filter(Boolean)
    } else if (result.module === 'reminder') {
      lines = [
        result.title,
        result.remind_at ? format(new Date(result.remind_at), 'dd/MM/yyyy HH:mm', { locale }) : '',
        result.recurrence !== 'none' ? result.recurrence : '',
        result.note || '',
      ].filter(Boolean)
    } else if (result.module === 'habits') {
      lines = [result.title, result.frequency]
    } else {
      lines = [result.content?.slice(0, 120) ?? '']
    }

    const moduleLabel: Record<string, string> = {
      finance: t.classified_finance,
      reminder: t.classified_reminder,
      habits: t.classified_habits,
      journal: t.classified_journal,
    }

    return (
      <Pressable
        onPress={() => toggleCandidate(candidate.id)}
        style={[styles.resultCard, { backgroundColor: theme.bg.elevated, borderColor: selectedIds.includes(candidate.id) ? meta.color : meta.color + '44' }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selectedIds.includes(candidate.id) }}
      >
        <View style={styles.resultHeader}>
          <View style={[styles.resultIconWrap, { backgroundColor: meta.color + '1F' }]}>
            <Feather name={meta.icon} size={20} color={meta.color} />
          </View>
          <Text style={[styles.resultModule, { color: meta.color }]}>{moduleLabel[result.module]}</Text>
          <View style={[styles.resultCheck, { borderColor: meta.color, backgroundColor: selectedIds.includes(candidate.id) ? meta.color : 'transparent' }]}>
            {selectedIds.includes(candidate.id) && <Feather name="check" size={12} color="#fff" />}
          </View>
        </View>
        {lines.map((line, i) => (
          <Text key={i} style={[styles.resultLine, { color: i === 0 ? theme.text.primary : theme.text.muted }]}>
            {line}
          </Text>
        ))}
      </Pressable>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <View style={[styles.sheet, { backgroundColor: theme.bg.elevated }]}>
          <View style={[styles.handle, { backgroundColor: theme.border.strong }]} />

          <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>{t.universal_add_title}</Text>

          {candidates.length === 0 ? (
            <>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t.universal_add_hint}
                placeholderTextColor={theme.text.muted}
                multiline
                numberOfLines={3}
                style={[styles.input, { color: theme.text.primary, borderColor: theme.border.strong, backgroundColor: theme.bg.primary }]}
                autoFocus
              />
              <Text style={[styles.examples, { color: theme.text.muted }]}>{t.universal_add_examples}</Text>
              <View style={styles.analyzeRow}>
                <VoiceButton onResult={(t) => onAnalyze(t)} disabled={analyzing} size={44} module="quick_add" />
                <Pressable
                  onPress={() => onAnalyze()}
                  disabled={analyzing || !text.trim()}
                  style={[styles.analyzeBtn, { backgroundColor: analyzing || !text.trim() ? theme.text.muted : theme.brand.primary }]}
                >
                  {analyzing
                    ? <ActivityIndicator color="#fff" />
                    : (
                      <View style={styles.analyzeBtnContent}>
                        <Feather name="send" size={16} color="#fff" />
                        <Text style={styles.analyzeBtnText}>{t.parse_btn}</Text>
                      </View>
                    )}
                </Pressable>
              </View>

              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border.subtle }]} />
                <Text style={[styles.dividerText, { color: theme.text.muted }]}>{t.universal_add_or_create}</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border.subtle }]} />
              </View>
              <View style={styles.quickChips}>
                {quickModules.map((m) => (
                  <Pressable
                    key={m.route}
                    onPress={() => goToForm(m.route)}
                    style={[styles.quickChip, { borderColor: m.color + '55', backgroundColor: m.color + '12' }]}
                  >
                    <Feather name={m.icon} size={16} color={m.color} />
                    <Text style={[styles.quickChipText, { color: theme.text.primary }]} numberOfLines={1}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.youSaid, { color: theme.text.muted }]}>{t.ai_confirm_you_said} "{text}"</Text>
              <ScrollView style={styles.resultsBox} contentContainerStyle={styles.resultsContent}>
                {candidates.map((candidate) => (
                  <View key={candidate.id}>{renderSummary(candidate)}</View>
                ))}
              </ScrollView>
              <View style={styles.actionRow}>
                <Pressable onPress={handleClose} style={[styles.actionBtn, { borderColor: theme.border.strong }]}>
                  <Text style={{ color: theme.text.secondary }}>{t.cancel}</Text>
                </Pressable>
                <Pressable onPress={() => { setCandidates([]); setSelectedIds([]) }} style={[styles.actionBtn, { borderColor: theme.border.strong }]}>
                  <Text style={{ color: theme.text.secondary }}>{t.ai_confirm_edit}</Text>
                </Pressable>
                <Pressable
                  onPress={onSave}
                  disabled={saving || selectedIds.length === 0}
                  style={[styles.actionBtn, styles.saveBtn, { backgroundColor: theme.brand.primary }]}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontWeight: '600' }}>{t.save}</Text>}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000055' },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[5],
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing[1] },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  input: {
    borderWidth: 1, borderRadius: radius.md,
    padding: spacing[3], fontSize: 15, minHeight: 80, textAlignVertical: 'top',
  },
  examples: { fontSize: 12, marginTop: -spacing[2] },
  analyzeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  analyzeBtn: { flex: 1, paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center' },
  analyzeBtnContent: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: -spacing[1] },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, fontWeight: '600' },
  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  quickChipText: { fontSize: 13, fontWeight: '600' },
  youSaid: { fontSize: 13, fontStyle: 'italic' },
  resultsBox: { maxHeight: 360 },
  resultsContent: { gap: spacing[3] },
  resultCard: {
    borderWidth: 1.5, borderRadius: radius.lg,
    padding: spacing[4], gap: spacing[2],
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  resultIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultModule: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  resultCheck: {
    marginLeft: 'auto',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLine: { fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: spacing[2] },
  actionBtn: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.md,
    borderWidth: 1, alignItems: 'center',
  },
  saveBtn: { borderWidth: 0 },
})
