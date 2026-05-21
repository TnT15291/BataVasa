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
import { parseUniversalEntry, type UniversalEntry } from '@services/ai/universalEntry'
import { getProviderKey } from '@services/ai/openai'
import { hapticSaveSuccess } from '@services/haptics'
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
  const [result, setResult] = useState<UniversalEntry | null>(null)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setText('')
    setResult(null)
    setAnalyzing(false)
    setSaving(false)
  }

  const handleClose = () => { reset(); onClose() }

  const onAnalyze = async (override?: string) => {
    const input = (override ?? text).trim()
    if (!input) return
    const provider = useSettingsStore.getState().aiProvider
    const key = await getProviderKey(provider)
    if (!key) { Alert.alert(t.api_key_required, t.no_api_key_msg); return }
    if (override) setText(override)
    setAnalyzing(true)
    try {
      const parsed = await parseUniversalEntry(input)
      if (!parsed) { Alert.alert(t.ai_error, t.parse_failed) }
      else { setResult(parsed) }
    } catch { Alert.alert(t.ai_error, t.parse_failed) }
    finally { setAnalyzing(false) }
  }

  useEffect(() => {
    if (!visible || !initialText.trim()) return
    setText(initialText)
    setResult(null)
    if (autoAnalyzeToken > 0) {
      void onAnalyze(initialText)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialText, autoAnalyzeToken])

  const onSave = async () => {
    if (!result) return
    setSaving(true)

    if (result.module === 'finance') {
      const cat = matchCategory(cats, result.category_hint, t)
      if (!cat) {
        Alert.alert(t.pick_category, t.pick_category_msg)
        setSaving(false)
        return
      }
      const res = await createTransaction({
        amount_cents: result.direction === 'expense' ? -Math.abs(result.amount_cents) : Math.abs(result.amount_cents),
        currency,
        category_id: cat.id,
        merchant: result.merchant || undefined,
        note: result.note || undefined,
        occurred_at: result.occurred_at,
        source: 'voice',
      })
      setSaving(false)
      if (!res.ok) { Alert.alert(t.could_not_save, res.error); return }
      void hapticSaveSuccess()
      handleClose()
      return
    }

    if (result.module === 'reminder') {
      const res = await createReminder({
        title: result.title,
        note: result.note || undefined,
        remind_at: result.remind_at,
        advance_minutes: 0,
        recurrence: result.recurrence,
      })
      setSaving(false)
      if (!res.ok) { Alert.alert(t.could_not_save, res.error); return }
      void hapticSaveSuccess()
      handleClose()
      return
    }

    if (result.module === 'habits') {
      const cadence = result.frequency === 'daily'
        ? 'daily'
        : result.frequency === 'weekdays'
        ? 'weekdays'
        : 'weekly'
      const res = await createHabit({
        name: result.title,
        cadence,
        target_per_period: 1,
        icon: 'check',
        color: '#4CAF50',
      })
      setSaving(false)
      if (!res.ok) { Alert.alert(t.could_not_save, res.error); return }
      void hapticSaveSuccess()
      handleClose()
      return
    }

    if (result.module === 'journal') {
      const res = await createJournal({
        content: result.content,
        occurred_at: new Date().toISOString(),
      })
      setSaving(false)
      if (!res.ok) { Alert.alert(t.could_not_save, res.error); return }
      void hapticSaveSuccess()
      handleClose()
      return
    }
  }

  const renderSummary = () => {
    if (!result) return null
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
      <View style={[styles.resultCard, { backgroundColor: theme.bg.elevated, borderColor: meta.color + '44' }]}>
        <View style={styles.resultHeader}>
          <View style={[styles.resultIconWrap, { backgroundColor: meta.color + '1F' }]}>
            <Feather name={meta.icon} size={20} color={meta.color} />
          </View>
          <Text style={[styles.resultModule, { color: meta.color }]}>{moduleLabel[result.module]}</Text>
        </View>
        {lines.map((line, i) => (
          <Text key={i} style={[styles.resultLine, { color: i === 0 ? theme.text.primary : theme.text.muted }]}>
            {line}
          </Text>
        ))}
      </View>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <View style={[styles.sheet, { backgroundColor: theme.bg.elevated }]}>
          <View style={[styles.handle, { backgroundColor: theme.border.strong }]} />

          <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>{t.universal_add_title}</Text>

          {!result ? (
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
            </>
          ) : (
            <>
              <Text style={[styles.youSaid, { color: theme.text.muted }]}>{t.ai_confirm_you_said} "{text}"</Text>
              {renderSummary()}
              <View style={styles.actionRow}>
                <Pressable onPress={handleClose} style={[styles.actionBtn, { borderColor: theme.border.strong }]}>
                  <Text style={{ color: theme.text.secondary }}>{t.cancel}</Text>
                </Pressable>
                <Pressable onPress={() => setResult(null)} style={[styles.actionBtn, { borderColor: theme.border.strong }]}>
                  <Text style={{ color: theme.text.secondary }}>{t.ai_confirm_edit}</Text>
                </Pressable>
                <Pressable
                  onPress={onSave}
                  disabled={saving}
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
  youSaid: { fontSize: 13, fontStyle: 'italic' },
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
  resultLine: { fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: spacing[2] },
  actionBtn: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.md,
    borderWidth: 1, alignItems: 'center',
  },
  saveBtn: { borderWidth: 0 },
})
