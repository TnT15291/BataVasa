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
import { useJournalsBootstrap, useJournals, useJournalActions } from '../hooks/useJournals'

const MOODS = [
  { value: 1, emoji: '😢' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😊' },
] as const

export function JournalFormScreen() {
  useJournalsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const journals = useJournals()
  const { createJournal, updateJournal, deleteJournal } = useJournalActions()

  const params = useLocalSearchParams<{ id?: string }>()
  const editingId = typeof params.id === 'string' ? params.id : null
  const editingJournal = useMemo(
    () => (editingId ? journals.find((j) => j.id === editingId) ?? null : null),
    [editingId, journals]
  )
  const isEditing = !!editingId

  const [content, setContent] = useState('')
  const [mood, setMood] = useState<number | null>(null)
  const [occurredAt, setOccurredAt] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    if (!editingJournal || prefilled) return
    setContent(editingJournal.content)
    setMood(editingJournal.mood ?? null)
    setOccurredAt(new Date(editingJournal.occurred_at))
    setPrefilled(true)
  }, [editingJournal, prefilled])

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
          occurred_at: occurredAt.toISOString(),
        })
      : await createJournal({
          content: trimmed,
          mood: mood ?? undefined,
          occurred_at: occurredAt.toISOString(),
        })
    setSubmitting(false)
    if (!res.ok) { Alert.alert(t.could_not_save, res.error ?? ''); return }
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
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
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  datePill: { borderWidth: 1, borderRadius: radius.md, padding: spacing[3] },
  moodRow: { flexDirection: 'row', gap: spacing[3] },
  moodBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1.5,
  },
  moodEmoji: { fontSize: 24 },
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
