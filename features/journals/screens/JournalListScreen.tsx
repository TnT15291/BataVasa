import { useMemo, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet, Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { endOfDay, format, startOfDay, subDays } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getDateFnsLocale } from '@services/locale'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { useJournalsBootstrap, useJournals, useJournalActions } from '../hooks/useJournals'
import type { Journal } from '../types'
import { FAB } from '@components/FAB'
import { ScreenTransition } from '@components/ScreenTransition'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader, ModuleOverview } from '@components/ui'
import { toast } from '@store/toastStore'

const MOOD_COLORS = ['', '#D96C6C', '#E0A84B', '#8A8A8A', '#6FAE75', '#4FA3D8'] as const

const ACTIVITY_TAGS = [
  'work', 'family', 'health', 'money', 'sleep',
  'exercise', 'stress', 'food', 'travel', 'social',
] as const
type ActivityTag = typeof ACTIVITY_TAGS[number]

function JournalRow({ journal, onPress }: { journal: Journal; onPress: () => void }) {
  const theme = useTheme()
  const language = useSettingsStore((s) => s.language)
  const locale = getDateFnsLocale(language)
  const preview = journal.content.slice(0, 100).replace(/\n/g, ' ')
  const timeStr = format(new Date(journal.occurred_at), 'HH:mm', { locale })
  const dateStr = format(new Date(journal.occurred_at), 'dd/MM', { locale })
  const moodColor = journal.mood ? MOOD_COLORS[journal.mood] : MODULE_COLORS.journal

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
      ]}
    >
      <View style={[styles.moodBadge, { backgroundColor: moodColor }]}>
        <Feather name="book-open" size={16} color="#fff" />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={[styles.timeStr, { color: theme.text.muted }]}>{timeStr}</Text>
          <Text style={[styles.timeStr, { color: theme.text.muted }]}>{dateStr}</Text>
          {(journal.is_important ?? 0) === 1 ? (
            <Feather name="star" size={12} color={MODULE_COLORS.journal} />
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

type DateGroup = { dateLabel: string; entries: Journal[] }

export function JournalListScreen() {
  useJournalsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const journals = useJournals()
  const locale = getDateFnsLocale(language)
  const { deleteJournal, restoreJournal } = useJournalActions()

  const [activeTag, setActiveTag] = useState<ActivityTag | null>(null)

  const tagLabels: Record<ActivityTag, string> = {
    work: t.tag_work,
    family: t.tag_family,
    health: t.tag_health,
    money: t.tag_money,
    sleep: t.tag_sleep,
    exercise: t.tag_exercise,
    stress: t.tag_stress,
    food: t.tag_food,
    travel: t.tag_travel,
    social: t.tag_social,
  }

  const filteredJournals = useMemo(
    () => activeTag
      ? journals.filter((j) => j.tags?.split(',').includes(activeTag))
      : journals,
    [journals, activeTag]
  )

  const groups = useMemo<DateGroup[]>(() => {
    const map = new Map<string, Journal[]>()
    for (const j of filteredJournals) {
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
  }, [filteredJournals, locale])

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

  if (journals.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.bg.primary }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: MODULE_COLORS.journal + '1F' }]}>
          <Feather name="book-open" size={34} color={MODULE_COLORS.journal} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_journals}</Text>
        <Text style={[styles.emptyMsg, { color: theme.text.muted }]}>{t.no_journals_msg}</Text>
        <Text style={[styles.emptyPrompt, { color: theme.text.secondary, backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          {t.journal_empty_prompt}
        </Text>
        <Pressable
          onPress={() => router.push('/journal')}
          style={[styles.emptyBtn, { backgroundColor: theme.brand.primary }]}
        >
          <Text style={styles.emptyBtnText}>{t.new_journal}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScreenTransition style={{ backgroundColor: theme.bg.primary }}>
      <ScrollView contentContainerStyle={[styles.list, { paddingTop: insets.top + spacing[2] }]}>
        <AppHeader subtitle={t.nav_journal} onSettings={() => router.push('/settings')} />
        <ModuleOverview
          eyebrow={t.report_avg_mood}
          value={journalStats.avgMood > 0 ? `${journalStats.avgMood.toFixed(1)}/5` : String(journals.length)}
          subtitle={journalStats.latest
            ? journalStats.latest.content.replace(/^#+\s?/gm, '').replace(/[*_`]/g, '').replace(/\n+/g, ' ').trim().slice(0, 60)
            : t.journal_empty_prompt}
          icon="book-open"
          accent={MODULE_COLORS.journal}
          stats={[
            { key: 'today', label: t.today, value: String(journalStats.todayCount), color: MODULE_COLORS.journal },
            { key: 'week', label: t.weekly, value: String(journalStats.weekCount) },
            { key: 'important', label: t.report_important, value: String(journalStats.importantCount), color: MODULE_COLORS.journal },
          ]}
        />

        <View style={styles.analysisRow}>
          {[
            { label: t.nav_reports, icon: 'bar-chart-2' as const, route: '/journals-report', bg: MODULE_COLORS.journal },
            { label: t.nav_insights, icon: 'cpu' as const, route: '/journals-insights', bg: MODULE_COLORS.analysis },
          ].map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route as any)}
              style={({ pressed }) => [
                styles.analysisBtn,
                {
                  backgroundColor: pressed ? item.bg + '12' : theme.bg.elevated,
                  borderColor: item.bg + '66',
                },
              ]}
            >
              <Feather name={item.icon} size={16} color={item.bg} />
              <Text style={[styles.analysisBtnText, { color: item.bg }]} numberOfLines={1}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagScroll}
        >
          <Pressable
            onPress={() => setActiveTag(null)}
            style={[styles.tagChip, {
              backgroundColor: activeTag === null ? MODULE_COLORS.journal + '18' : theme.bg.elevated,
              borderColor: activeTag === null ? MODULE_COLORS.journal + '66' : theme.border.subtle,
            }]}
          >
            <Text style={[styles.tagChipText, { color: activeTag === null ? MODULE_COLORS.journal : theme.text.secondary }]}>
              {t.tag_all}
            </Text>
          </Pressable>
          {ACTIVITY_TAGS.map((tag) => {
            const active = activeTag === tag
            return (
              <Pressable
                key={tag}
                onPress={() => setActiveTag(active ? null : tag)}
                style={[styles.tagChip, {
                  backgroundColor: active ? MODULE_COLORS.journal + '18' : theme.bg.elevated,
                  borderColor: active ? MODULE_COLORS.journal + '66' : theme.border.subtle,
                }]}
              >
                <Text style={[styles.tagChipText, { color: active ? MODULE_COLORS.journal : theme.text.secondary }]}>
                  {tagLabels[tag]}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {groups.map((group) => (
          <View key={group.dateLabel} style={styles.group}>
            <Text style={[styles.dateLabel, { color: theme.text.muted }]}>{group.dateLabel}</Text>
            {group.entries.map((j) => (
              (() => {
                const confirmDelete = () => Alert.alert(t.delete, t.confirm_delete_item, [
                  { text: t.cancel, style: 'cancel' },
                  {
                    text: t.delete,
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        const result = await deleteJournal(j.id)
                        if (!result.ok) {
                          Alert.alert(t.could_not_save, result.error ?? '')
                          return
                        }
                        toast.undo(t.toast_deleted, t.undo, () => { void restoreJournal(j.id) })
                      })()
                    },
                  },
                ])
                return (
              <ReanimatedSwipeable
                key={j.id}
                renderRightActions={(_p, _d, swipeable) => (
                  <Pressable
                    onPress={() => {
                      swipeable.close()
                      confirmDelete()
                    }}
                    style={[styles.swipeDelete, { backgroundColor: theme.semantic.danger }]}
                  >
                    <Feather name="trash-2" size={20} color="#fff" />
                  </Pressable>
                )}
                overshootRight={false}
              >
                <JournalRow
                  journal={j}
                  onPress={() => router.push({ pathname: '/journal', params: { id: j.id } })}
                />
              </ReanimatedSwipeable>
                )
              })()
            ))}
          </View>
        ))}
      </ScrollView>

      <FAB
        onPress={() => router.push('/journal')}
        accessibilityLabel={t.new_journal}
        style={[styles.fab, { backgroundColor: theme.brand.primary, bottom: spacing[5] }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </FAB>
    </ScreenTransition>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing[4], paddingBottom: 120, gap: spacing[3] },
  radarStats: { gap: spacing[2] },
  radarMetricRow: { flexDirection: 'row', gap: spacing[2] },
  tagScroll: { paddingHorizontal: 0, gap: spacing[2], flexDirection: 'row' },
  tagChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  tagChipText: { fontSize: 12, fontWeight: '600' },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[4],
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  heroText: { flex: 1, gap: spacing[1] },
  heroKicker: { fontSize: 12, fontWeight: '500' },
  heroTitle: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  heroSubtitle: { fontSize: 13, lineHeight: 18 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statGrid: { flexDirection: 'row', gap: spacing[2] },
  statChip: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  analysisRow: { flexDirection: 'row', gap: spacing[2] },
  analysisBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  analysisBtnText: { fontSize: 12, fontWeight: '600' },
  group: { gap: spacing[2] },
  dateLabel: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    borderRadius: radius.lg, borderWidth: 1,
    padding: spacing[3],
    overflow: 'hidden',
  },
  moodBadge: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  timeStr: { fontSize: 12 },
  locationWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  location: { fontSize: 12, flex: 1 },
  preview: { fontSize: 13, lineHeight: 19 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  emptyIconWrap: { width: 72, height: 72, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center' },
  emptyPrompt: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: 14, marginTop: spacing[1] },
  emptyBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fab: {
    position: 'absolute', right: spacing[6],
    width: 56, height: 56, borderRadius: radius.lg, borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    elevation: 5, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  swipeDelete: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
})
