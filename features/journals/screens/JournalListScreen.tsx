import { useMemo, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet, Modal,
  ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { endOfDay, format, startOfDay, subDays } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import { getProviderKey } from '@services/ai/openai'
import { parseJournalEntry, type ParsedJournal } from '@services/ai/journalParser'
import { VoiceButton } from '@components/VoiceButton'
import { useJournalsBootstrap, useJournals, useJournalActions } from '../hooks/useJournals'
import { generateJournalReflection, type JournalReflection } from '@services/ai/journalInsight'
import type { Journal } from '../types'

const MOOD_COLORS = ['', '#D96C6C', '#E0A84B', '#8A8A8A', '#6FAE75', '#4FA3D8'] as const

function JournalRow({ journal, onPress }: { journal: Journal; onPress: () => void }) {
  const theme = useTheme()
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)
  const preview = journal.content.slice(0, 100).replace(/\n/g, ' ')
  const timeStr = format(new Date(journal.occurred_at), 'HH:mm', { locale })
  const dateStr = format(new Date(journal.occurred_at), 'dd/MM', { locale })
  const moodColor = journal.mood ? MOOD_COLORS[journal.mood] : theme.border.strong

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
      ]}
    >
      <View style={[styles.rowAccent, { backgroundColor: moodColor }]} />
      <View style={[styles.moodBadge, { backgroundColor: moodColor + '22' }]}>
        <Feather name="book-open" size={16} color={moodColor} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={[styles.timeStr, { color: theme.text.muted }]}>{timeStr}</Text>
          <Text style={[styles.timeStr, { color: theme.text.muted }]}>{dateStr}</Text>
          {(journal.is_important ?? 0) === 1 ? (
            <Feather name="star" size={12} color={theme.brand.primary} />
          ) : null}
          {journal.location_label ? (
            <View style={styles.locationWrap}>
              <Feather name="map-pin" size={12} color={theme.text.muted} />
              <Text style={[styles.location, { color: theme.text.muted }]} numberOfLines={1}>
                {journal.location_label}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.preview, { color: theme.text.primary }]} numberOfLines={2}>
          {preview || '...'}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={theme.text.muted} />
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
          <View style={styles.sheetTitleRow}>
            <Feather name="star" size={20} color={theme.brand.primary} />
            <Text style={[styles.sheetTitle, { color: theme.brand.primary }]}>{t.journal_ai_reflect}</Text>
          </View>

          <View style={[styles.sheetCard, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.reflect_mood}</Text>
            <Text style={[styles.sectionBody, { color: theme.text.primary }]}>{reflection.mood_summary}</Text>
          </View>

          {reflection.themes.length > 0 && (
            <View style={[styles.sheetCard, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.reflect_themes}</Text>
              {reflection.themes.map((themeItem, i) => (
                <Text key={i} style={[styles.bulletItem, { color: theme.text.primary }]}>
                  {`- ${themeItem}`}
                </Text>
              ))}
            </View>
          )}

          {reflection.recurring_questions.length > 0 && (
            <View style={[styles.sheetCard, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.reflect_questions}</Text>
              {reflection.recurring_questions.map((q, i) => (
                <Text key={i} style={[styles.bulletItem, { color: theme.text.primary }]}>
                  {`- ${q}`}
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
  const { createJournal } = useJournalActions()
  const aiProvider = useSettingsStore((s) => s.aiProvider)

  const [reflecting, setReflecting] = useState(false)
  const [reflection, setReflection] = useState<JournalReflection | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [nlText, setNlText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsedJournal, setParsedJournal] = useState<ParsedJournal | null>(null)
  const [originalNlText, setOriginalNlText] = useState('')

  const handleNlParse = async (override?: string) => {
    const input = (override ?? nlText).trim()
    if (!input) return
    const key = await getProviderKey(aiProvider)
    if (!key) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    if (override) setNlText(override)
    setParsing(true)
    try {
      const result = await parseJournalEntry(input)
      if (!result) { Alert.alert(t.ai_error, t.parse_failed); return }
      setOriginalNlText(input)
      setParsedJournal(result)
    } catch { Alert.alert(t.ai_error, t.parse_failed) }
    finally { setParsing(false) }
  }

  const handleNlConfirm = async () => {
    if (!parsedJournal) return
    await createJournal({
      content: parsedJournal.content,
      mood: parsedJournal.mood ?? undefined,
      is_important: parsedJournal.is_important,
      occurred_at: parsedJournal.occurred_at,
    })
    setParsedJournal(null)
    setNlText('')
  }

  const handleNlEdit = () => {
    const p = parsedJournal
    setParsedJournal(null)
    setNlText('')
    router.push({ pathname: '/journal', params: p ? { prefill: JSON.stringify(p) } : {} } as any)
  }

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

  const journalStats = useMemo(() => {
    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const weekStart = subDays(todayStart, 6)
    const todayCount = journals.filter((j) => {
      const d = new Date(j.occurred_at)
      return d >= todayStart && d <= todayEnd
    }).length
    const weekCount = journals.filter((j) => new Date(j.occurred_at) >= weekStart).length
    const moodEntries = journals.filter((j) => typeof j.mood === 'number')
    const avgMood = moodEntries.length > 0
      ? moodEntries.reduce((sum, j) => sum + (j.mood ?? 0), 0) / moodEntries.length
      : 0
    const latest = journals
      .slice()
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0] ?? null
    const importantCount = journals.filter((j) => (j.is_important ?? 0) === 1).length
    return { todayCount, weekCount, avgMood, latest, importantCount }
  }, [journals])

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
        <View style={[styles.emptyIconWrap, { backgroundColor: theme.brand.primary + '1F' }]}>
          <Feather name="book-open" size={34} color={theme.brand.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_journals}</Text>
        <Text style={[styles.emptyMsg, { color: theme.text.muted }]}>{t.no_journals_msg}</Text>
        <Text style={[styles.emptyPrompt, { color: theme.text.secondary, backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          {t.journal_empty_prompt}
        </Text>
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
        <View style={[styles.hero, { backgroundColor: '#9C27B014', borderColor: '#9C27B044' }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={[styles.heroKicker, { color: theme.text.muted }]}>{t.nav_journal}</Text>
              <Text style={[styles.heroTitle, { color: theme.text.primary }]} numberOfLines={2}>
                {journalStats.latest ? journalStats.latest.content.slice(0, 90) : t.journal_empty_prompt}
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.text.muted }]}>
                {journalStats.latest
                  ? format(new Date(journalStats.latest.occurred_at), 'EEEE, dd MMMM yyyy', { locale })
                  : t.no_journals_msg}
              </Text>
            </View>
            <View style={[styles.heroIcon, { backgroundColor: '#9C27B01F' }]}>
              <Feather name="book-open" size={28} color="#9C27B0" />
            </View>
          </View>
          <View style={styles.statGrid}>
            <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.statValue, { color: theme.brand.primary }]}>{journalStats.todayCount}</Text>
              <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.today}</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.statValue, { color: '#9C27B0' }]}>{journalStats.weekCount}</Text>
              <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.weekly}</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
              <Text style={[styles.statValue, { color: theme.text.primary }]}>
                {journalStats.importantCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.muted }]}>Important</Text>
            </View>
          </View>
        </View>

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
          <>
            <Feather name="star" size={16} color={theme.brand.primary} />
            <Text style={[styles.reflectBtnText, { color: theme.brand.primary }]}>{t.journal_ai_reflect}</Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.push('/journals-report' as any)}
        accessibilityRole="button"
        accessibilityLabel={t.journals_report_title}
        style={[styles.reportBtn, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
      >
        <Feather name="bar-chart-2" size={20} color={theme.text.secondary} />
      </Pressable>

      <Pressable
        onPress={() => router.push('/journal' as any)}
        accessibilityRole="button"
        accessibilityLabel={t.new_journal}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </Pressable>

      <ReflectSheet
        visible={sheetVisible}
        reflection={reflection}
        onClose={() => setSheetVisible(false)}
        theme={theme}
        t={t}
      />

      <Modal visible={!!parsedJournal} transparent animationType="slide" onRequestClose={() => setParsedJournal(null)}>
        <Pressable style={styles.backdrop} onPress={() => setParsedJournal(null)} />
        <View style={[styles.sheet, { backgroundColor: theme.bg.elevated, padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.border.strong }]} />
          <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>{t.ai_confirm_title}</Text>

          <View style={[styles.infoRow, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.infoLabel, { color: theme.text.muted }]}>{t.ai_confirm_you_said}</Text>
            <Text style={[styles.infoValue, { color: theme.text.primary }]}>{originalNlText}</Text>
          </View>

          <View style={[styles.infoRow, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.infoLabel, { color: theme.text.muted }]}>{t.ai_confirm_parsed}</Text>
            <Text style={[styles.infoValue, { color: theme.text.primary }]}>
              {parsedJournal
                ? `${parsedJournal.content.slice(0, 80)}${parsedJournal.content.length > 80 ? '...' : ''}`
                : ''}
            </Text>
          </View>

          <View style={styles.sheetActions}>
            <Pressable
              onPress={handleNlEdit}
              style={[styles.sheetBtn, { backgroundColor: theme.bg.secondary, borderColor: theme.border.strong }]}
            >
              <Text style={[styles.sheetBtnText, { color: theme.text.secondary }]}>{t.nl_reject_to_form}</Text>
            </Pressable>
            <Pressable
              onPress={handleNlConfirm}
              style={[styles.sheetBtn, { backgroundColor: theme.brand.primary }]}
            >
              <Text style={[styles.sheetBtnText, { color: '#fff' }]}>{t.ai_confirm_save}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing[4], paddingBottom: 120, gap: spacing[3] },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[4],
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  heroText: { flex: 1, gap: spacing[1] },
  heroKicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800' },
  heroSubtitle: { fontSize: 13, lineHeight: 18 },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statGrid: { flexDirection: 'row', gap: spacing[2] },
  statChip: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  group: { gap: spacing[2] },
  dateLabel: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    overflow: 'hidden',
  },
  rowAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  moodBadge: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  timeStr: { fontSize: 12 },
  locationWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  location: { fontSize: 12, flex: 1 },
  preview: { fontSize: 14, lineHeight: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  emptyIconWrap: { width: 72, height: 72, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center' },
  emptyPrompt: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: 14, marginTop: spacing[1] },
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
  reportBtn: {
    position: 'absolute', left: spacing[6], bottom: spacing[8] + 56,
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    elevation: 3, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  fab: {
    position: 'absolute', right: spacing[6], bottom: spacing[8],
    width: 56, height: 56, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingTop: spacing[2], paddingBottom: spacing[6],
    maxHeight: '80%',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing[4] },
  sheetContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], gap: spacing[4] },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], marginBottom: spacing[2] },
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
  nlInput: {
    minHeight: 42,
    fontSize: 14,
    lineHeight: 19,
  },
  nlBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], gap: spacing[1] },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15 },
  sheetActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  sheetBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.md, alignItems: 'center', borderWidth: 1 },
  sheetBtnText: { fontSize: 15, fontWeight: '600' },
})
