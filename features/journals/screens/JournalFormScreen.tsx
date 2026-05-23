import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { hapticSaveSuccess } from '@services/haptics'
import { getProviderKey } from '@services/ai/openai'
import { parseJournalEntry } from '@services/ai/journalParser'
import { VoiceButton } from '@components/VoiceButton'
import { Feather } from '@expo/vector-icons'
import { useJournalsBootstrap, useJournals, useJournalActions } from '../hooks/useJournals'

const MOODS = [
  { value: 1, emoji: '😢' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😊' },
] as const

const JOURNAL_TEMPLATES = [
  {
    key: 'checkin',
    label: 'Daily check-in',
    mood: 3,
    content: 'Today I noticed...\n\nI felt...\n\nOne thing I want to remember is...',
  },
  {
    key: 'gratitude',
    label: 'Gratitude',
    mood: 4,
    content: 'Three things I am grateful for:\n1. \n2. \n3. \n\nWhy this mattered today...',
  },
  {
    key: 'stress',
    label: 'Stress log',
    mood: 2,
    content: 'What stressed me today...\n\nWhat triggered it...\n\nWhat helped, or could help next time...',
  },
  {
    key: 'money',
    label: 'Money reflection',
    mood: 3,
    content: 'A spending or money moment I noticed today...\n\nHow I felt about it...\n\nOne adjustment I want to try...',
  },
  {
    key: 'habit',
    label: 'Habit reflection',
    mood: 3,
    content: 'A habit I kept or missed today...\n\nWhat made it easier or harder...\n\nOne small next step...',
  },
] as const

export function JournalFormScreen() {
  useJournalsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const journals = useJournals()
  const { createJournal, updateJournal, deleteJournal } = useJournalActions()
  const aiProvider = useSettingsStore((s) => s.aiProvider)

  const params = useLocalSearchParams<{ id?: string; prefill?: string }>()
  const editingId = typeof params.id === 'string' ? params.id : null
  const editingJournal = useMemo(
    () => (editingId ? journals.find((j) => j.id === editingId) ?? null : null),
    [editingId, journals]
  )
  const isEditing = !!editingId

  const [content, setContent] = useState('')
  const [mood, setMood] = useState<number | null>(null)
  const [isImportant, setIsImportant] = useState(false)
  const [occurredAt, setOccurredAt] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const [smartText, setSmartText] = useState('')
  const [parsing, setParsing] = useState(false)

  useEffect(() => {
    if (!editingJournal || prefilled) return
    setContent(editingJournal.content)
    setMood(editingJournal.mood ?? null)
    setIsImportant((editingJournal.is_important ?? 0) === 1)
    setOccurredAt(new Date(editingJournal.occurred_at))
    setPrefilled(true)
  }, [editingJournal, prefilled])

  useEffect(() => {
    if (editingId || prefilled || !params.prefill) return
    try {
      const p = JSON.parse(params.prefill as string)
      if (p.content) setContent(p.content)
      if (p.mood != null) setMood(Number(p.mood))
      if (p.is_important != null) setIsImportant(Number(p.is_important) === 1)
      if (p.occurred_at) setOccurredAt(new Date(p.occurred_at))
      setPrefilled(true)
    } catch { /* ignore malformed prefill */ }
  }, [editingId, prefilled, params.prefill])

  const locale = getDateFnsLocale(language)
  const dateStr = format(occurredAt, 'dd/MM/yyyy', { locale })

  const onSave = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      Alert.alert(t.invalid_amount, t.journal_content_placeholder)
      return
    }
    setSubmitting(true)
    const res = isEditing
      ? await updateJournal({
          id: editingId!,
          content: trimmed,
          mood: mood ?? undefined,
          is_important: isImportant ? 1 : 0,
          occurred_at: occurredAt.toISOString(),
        })
      : await createJournal({
          content: trimmed,
          mood: mood ?? undefined,
          is_important: isImportant ? 1 : 0,
          occurred_at: occurredAt.toISOString(),
        })
    setSubmitting(false)
    if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); return }
    void hapticSaveSuccess()
    router.back()
  }

  const onDelete = () => {
    Alert.alert(t.delete_journal, t.delete_journal_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          const r = await deleteJournal(editingId!)
          if (r.ok) router.back()
          else Alert.alert(t.could_not_save, r.error ?? '')
        },
      },
    ])
  }

  const handleSmartParse = async (override?: string) => {
    const input = (override ?? smartText).trim()
    if (!input || parsing) return
    const key = await getProviderKey(aiProvider)
    if (!key) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    if (override) setSmartText(override)
    setParsing(true)
    try {
      const parsed = await parseJournalEntry(input)
      if (!parsed) { Alert.alert(t.ai_error, t.parse_failed); return }
      setContent(parsed.content)
      setMood(parsed.mood)
      setIsImportant(parsed.is_important === 1)
      setOccurredAt(new Date(parsed.occurred_at))
      setSmartText('')
    } catch {
      Alert.alert(t.ai_error, t.parse_failed)
    } finally {
      setParsing(false)
    }
  }

  const applyTemplate = (template: typeof JOURNAL_TEMPLATES[number]) => {
    setContent((current) => current.trim() ? `${current.trim()}\n\n${template.content}` : template.content)
    setMood((current) => current ?? template.mood)
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: theme.brand.primary + '1F' }]}>
            <Feather name="zap" size={16} color={theme.brand.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{t.smart_entry}</Text>
        </View>
        <View style={[styles.smartInputWrap, { backgroundColor: theme.bg.primary, borderColor: theme.border.strong }]}>
          <TextInput
            value={smartText}
            onChangeText={setSmartText}
            placeholder={t.nl_placeholder_journal}
            placeholderTextColor={theme.text.muted}
            style={[styles.smartInput, { color: theme.text.primary }]}
            returnKeyType="done"
            editable={!parsing}
            multiline
            onSubmitEditing={() => handleSmartParse()}
          />
          <View style={styles.smartActions}>
            <VoiceButton onResult={(text) => handleSmartParse(text)} disabled={parsing} size={38} module="journals" />
            <Pressable
              onPress={() => handleSmartParse()}
              disabled={parsing || !smartText.trim()}
              style={[styles.smartSend, { backgroundColor: parsing || !smartText.trim() ? theme.border.strong : theme.brand.primary }]}
            >
              {parsing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Date */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.date.toUpperCase()}</Text>
      <Pressable
        onPress={() => setShowDatePicker(true)}
        style={[styles.datePill, { backgroundColor: theme.bg.elevated, borderColor: theme.border.strong }]}
      >
        <Text style={{ color: theme.text.primary, fontSize: 15 }}>📅 {dateStr}</Text>
      </Pressable>
      {showDatePicker && (
        <DateTimePicker
          value={occurredAt}
          mode="date"
          maximumDate={new Date()}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, date) => {
            setShowDatePicker(Platform.OS === 'ios')
            if (date) setOccurredAt(date)
          }}
        />
      )}

      {/* Mood */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.journal_mood_label.toUpperCase()}</Text>
      <View style={styles.moodRow}>
        {MOODS.map(({ value, emoji }) => {
          const active = mood === value
          return (
            <Pressable
              key={value}
              onPress={() => setMood(active ? null : value)}
              style={[
                styles.moodBtn,
                {
                  backgroundColor: active ? theme.brand.primary + '22' : theme.bg.elevated,
                  borderColor: active ? theme.brand.primary : theme.border.subtle,
                },
              ]}
            >
              <Text style={styles.moodEmoji}>{emoji}</Text>
            </Pressable>
          )
        })}
      </View>

      <Text style={[styles.label, { color: theme.text.muted }]}>TEMPLATES</Text>
      <View style={styles.templateGrid}>
        {JOURNAL_TEMPLATES.map((template) => (
          <Pressable
            key={template.key}
            onPress={() => applyTemplate(template)}
            style={[styles.templateChip, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
          >
            <Text style={[styles.templateText, { color: theme.text.secondary }]}>{template.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => setIsImportant((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isImportant }}
        style={[styles.importantToggle, {
          backgroundColor: isImportant ? theme.brand.primary + '18' : theme.bg.elevated,
          borderColor: isImportant ? theme.brand.primary : theme.border.subtle,
        }]}
      >
        <Feather name="star" size={18} color={isImportant ? theme.brand.primary : theme.text.muted} />
        <Text style={[styles.importantText, { color: isImportant ? theme.brand.primary : theme.text.secondary }]}>
          Important event
        </Text>
      </Pressable>

      {/* Content */}
      <Text style={[styles.label, { color: theme.text.muted }]}>{t.new_journal.toUpperCase()}</Text>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder={t.journal_content_placeholder}
        placeholderTextColor={theme.text.muted}
        multiline
        style={[styles.contentInput, {
          color: theme.text.primary,
          borderColor: theme.border.strong,
          backgroundColor: theme.bg.elevated,
        }]}
        autoFocus={!isEditing}
        textAlignVertical="top"
      />

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
          <Text style={[styles.deleteBtnText, { color: theme.text.danger }]}>{t.delete_journal}</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing[4], gap: spacing[3] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  smartInputWrap: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    paddingBottom: 46,
  },
  smartInput: { minHeight: 42, fontSize: 14, lineHeight: 19 },
  smartActions: {
    position: 'absolute',
    right: spacing[2],
    bottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  smartSend: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  datePill: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3] },
  moodRow: { flexDirection: 'row', gap: spacing[3] },
  moodBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1.5,
  },
  moodEmoji: { fontSize: 24 },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  templateChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  templateText: { fontSize: 12, fontWeight: '700' },
  importantToggle: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  importantText: { fontSize: 14, fontWeight: '700' },
  contentInput: {
    borderWidth: 1, borderRadius: radius.md,
    padding: spacing[3], fontSize: 15, lineHeight: 22,
    minHeight: 200,
  },
  saveBtn: { paddingVertical: spacing[4], borderRadius: radius.md, alignItems: 'center', marginTop: spacing[2] },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing[3] },
  deleteBtnText: { fontSize: 15 },
})
