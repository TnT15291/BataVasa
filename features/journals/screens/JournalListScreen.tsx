import { useMemo, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet, Modal,
  ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { useJournalsBootstrap, useJournals } from '../hooks/useJournals'
import { generateJournalReflection, type JournalReflection } from '@services/ai/journalInsight'
import type { Journal } from '../types'

const MOOD_EMOJI = ['', '😢', '😕', '😐', '🙂', '😊'] as const

function JournalRow({ journal, onPress }: { journal: Journal; onPress: () => void }) {
  const theme = useTheme()
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)
  const preview = journal.content.slice(0, 100).replace(/\n/g, ' ')
  const timeStr = format(new Date(journal.occurred_at), 'HH:mm', { locale })

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
      ]}
    >
      <View style={styles.rowLeft}>
        {journal.mood ? (
          <Text style={styles.moodEmoji}>{MOOD_EMOJI[journal.mood]}</Text>
        ) : (
          <View style={[styles.moodDot, { backgroundColor: theme.border.strong }]} />
        )}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={[styles.timeStr, { color: theme.text.muted }]}>{timeStr}</Text>
          {journal.location_label ? (
            <Text style={[styles.location, { color: theme.text.muted }]} numberOfLines={1}>
              📍 {journal.location_label}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.preview, { color: theme.text.primary }]} numberOfLines={2}>
          {preview || '…'}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: theme.text.muted }]}>›</Text>
    </Pressable>
  )
}

function ReflectSheet({
  visible,
  reflection,
  onClose,
  theme,
  t,
}: {
  visible: boolean
  reflection: JournalReflection | null
  onClose: () => void
  theme: ReturnType<typeof useTheme>
  t: ReturnType<typeof useTranslation>['t']
}) {
  if (!reflection) return null
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.bg.elevated }]}>
        <View style={[styles.sheetHandle, { backgroundColor: theme.border.subtle }]} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: theme.brand.primary }]}>✨ {t.journal_ai_reflect}</Text>

          <View style={[styles.sheetCard, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.reflect_mood}</Text>
            <Text style={[styles.sectionBody, { color: theme.text.primary }]}>{reflection.mood_summary}</Text>
          </View>

          {reflection.themes.length > 0 && (
            <View style={[styles.sheetCard, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.reflect_themes}</Text>
              {reflection.themes.map((theme_item, i) => (
                <Text key={i} style={[styles.bulletItem, { color: theme.text.primary }]}>
                  • {theme_item}
                </Text>
              ))}
            </View>
          )}

          {reflection.recurring_questions.length > 0 && (
            <View style={[styles.sheetCard, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.reflect_questions}</Text>
              {reflection.recurring_questions.map((q, i) => (
                <Text key={i} style={[styles.bulletItem, { color: theme.text.primary }]}>
                  • {q}
                </Text>
              ))}
            </View>
          )}

          <View style={[styles.sheetPrompt, { backgroundColor: theme.brand.primary + '18', borderColor: theme.brand.primary + '40' }]}>
            <Text style={[styles.sectionLabel, { color: theme.brand.primary }]}>{t.reflect_prompt}</Text>
            <Text style={[styles.promptText, { color: theme.text.primary }]}>{reflection.gentle_prompt}</Text>
          </View>
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={[styles.closeBtn, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}
        >
          <Text style={[styles.closeBtnText, { color: theme.text.primary }]}>{t.cancel}</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

type DateGroup = { dateLabel: string; entries: Journal[] }

export function JournalListScreen() {
  useJournalsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const journals = useJournals()
  const locale = getDateFnsLocale(language)

  const [reflecting, setReflecting] = useState(false)
  const [reflection, setReflection] = useState<JournalReflection | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)

  const groups = useMemo<DateGroup[]>(() => {
    const map = new Map<string, Journal[]>()
    for (const j of journals) {
      const key = format(new Date(j.occurred_at), 'yyyy-MM-dd')
      const arr = map.get(key) ?? []
      arr.push(j)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, entries]) => ({
        dateLabel: format(new Date(key), 'EEEE, dd MMMM yyyy', { locale }),
        entries: entries.sort(
          (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
        ),
      }))
  }, [journals, locale])

  async function handleReflect() {
    if (journals.length < 3) {
      Alert.alert(t.journal_ai_reflect, t.reflect_need_more)
      return
    }
    setReflecting(true)
    try {
      const result = await generateJournalReflection(journals)
      if (result) {
        setReflection(result)
        setSheetVisible(true)
      } else {
        Alert.alert(t.ai_error, t.retry)
      }
    } finally {
      setReflecting(false)
    }
  }

  if (journals.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.bg.primary }]}>
        <Text style={styles.emptyIcon}>📖</Text>
        <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_journals}</Text>
        <Text style={[styles.emptyMsg, { color: theme.text.muted }]}>{t.no_journals_msg}</Text>
        <Pressable
          onPress={() => router.push('/journal' as any)}
          style={[styles.emptyBtn, { backgroundColor: theme.brand.primary }]}
        >
          <Text style={styles.emptyBtnText}>{t.new_journal}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={styles.list}>
        {groups.map((group) => (
          <View key={group.dateLabel} style={styles.group}>
            <Text style={[styles.dateLabel, { color: theme.text.muted }]}>{group.dateLabel}</Text>
            {group.entries.map((j) => (
              <JournalRow
                key={j.id}
                journal={j}
                onPress={() => router.push({ pathname: '/journal', params: { id: j.id } } as any)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {/* AI Reflect button */}
      <Pressable
        onPress={handleReflect}
        disabled={reflecting}
        accessibilityRole="button"
        accessibilityLabel={t.journal_ai_reflect}
        style={[styles.reflectBtn, { backgroundColor: theme.bg.elevated, borderColor: theme.brand.primary }]}
      >
        {reflecting ? (
          <ActivityIndicator size="small" color={theme.brand.primary} />
        ) : (
          <Text style={[styles.reflectBtnText, { color: theme.brand.primary }]}>✨ {t.journal_ai_reflect}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.push('/journal' as any)}
        accessibilityRole="button"
        accessibilityLabel={t.new_journal}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      <ReflectSheet
        visible={sheetVisible}
        reflection={reflection}
        onClose={() => setSheetVisible(false)}
        theme={theme}
        t={t}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing[4], paddingBottom: 120, gap: spacing[5] },
  group: { gap: spacing[2] },
  dateLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
  },
  rowLeft: { width: 32, alignItems: 'center' },
  moodEmoji: { fontSize: 22 },
  moodDot: { width: 8, height: 8, borderRadius: 4 },
  rowBody: { flex: 1, gap: 2 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  timeStr: { fontSize: 12 },
  location: { fontSize: 12, flex: 1 },
  preview: { fontSize: 14, lineHeight: 20 },
  chevron: { fontSize: 20, lineHeight: 22 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center' },
  emptyBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  reflectBtn: {
    position: 'absolute', left: spacing[6], bottom: spacing[8],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderRadius: radius.full, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    elevation: 3, shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    minWidth: 44, justifyContent: 'center',
  },
  reflectBtnText: { fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute', right: spacing[6], bottom: spacing[8],
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  fabIcon: { color: '#fff', fontSize: 30, fontWeight: '600', lineHeight: 32 },
  // Sheet styles
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingTop: spacing[2], paddingBottom: spacing[6],
    maxHeight: '80%',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing[4] },
  sheetContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], gap: spacing[4] },
  sheetTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: spacing[2] },
  sheetCard: {
    borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4], gap: spacing[2],
  },
  sheetPrompt: {
    borderRadius: radius.lg, borderWidth: 1,
    padding: spacing[4], gap: spacing[2],
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionBody: { fontSize: 15, lineHeight: 22 },
  bulletItem: { fontSize: 14, lineHeight: 21 },
  promptText: { fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  closeBtn: {
    marginHorizontal: spacing[5], marginTop: spacing[2],
    borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing[3], alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '600' },
})
