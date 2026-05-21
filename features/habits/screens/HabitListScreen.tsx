import { useMemo, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getProviderKey } from '@services/ai/openai'
import { parseHabitLog, type ParsedHabitLog } from '@services/ai/habitParser'
import { VoiceButton } from '@components/VoiceButton'
import { useHabitsBootstrap, useHabits, useHabitActions } from '../hooks/useHabits'

function HabitRow({
  habit,
  onToggle,
  onEdit,
}: {
  habit: ReturnType<typeof useHabits>[number]
  onToggle: () => void
  onEdit: () => void
}) {
  const theme = useTheme()
  const { t } = useTranslation()
  const done = habit.todayCount >= habit.target_per_period

  return (
    <Pressable
      onLongPress={onEdit}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={habit.name}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
          borderColor: done ? habit.color + '66' : theme.border.subtle,
        },
      ]}
    >
      <View style={[styles.rowAccent, { backgroundColor: habit.color }]} />
      <View style={[styles.rowIconWrap, { backgroundColor: habit.color + '1F' }]}>
        <Feather name="check-circle" size={20} color={habit.color} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: theme.text.primary }]}>{habit.name}</Text>
        <Text style={[styles.rowMeta, { color: theme.text.muted }]}>
          {done
            ? `${t.habit_done_today} / ${habit.streak}`
            : `${habit.todayCount}/${habit.target_per_period} / ${habit.streak}`}
        </Text>
      </View>
      <View style={[styles.checkCircle, {
        backgroundColor: done ? habit.color : 'transparent',
        borderColor: done ? habit.color : theme.border.strong,
      }]}>
        {done ? <Feather name="check" size={14} color="#fff" /> : null}
      </View>
    </Pressable>
  )
}

export function HabitListScreen() {
  useHabitsBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const habits = useHabits()
  const { toggleTodayLog } = useHabitActions()
  const aiProvider = useSettingsStore((s) => s.aiProvider)

  const [nlText, setNlText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedHabitLog | null>(null)
  const [originalText, setOriginalText] = useState('')

  const handleParse = async (override?: string) => {
    const input = (override ?? nlText).trim()
    if (!input) return
    const key = await getProviderKey(aiProvider)
    if (!key) { Alert.alert(t.no_api_key, t.no_api_key_msg); return }
    if (override) setNlText(override)
    setParsing(true)
    try {
      const result = await parseHabitLog(input, habits)
      if (!result) { Alert.alert(t.ai_error, t.parse_failed) }
      else { setOriginalText(input); setParsed(result) }
    } catch { Alert.alert(t.ai_error, t.parse_failed) }
    finally { setParsing(false) }
  }

  const handleConfirm = async () => {
    if (!parsed) return
    const matchedId = parsed.matched_habit_id
    if (matchedId) {
      await toggleTodayLog(matchedId)
    }
    setParsed(null)
    setNlText('')
  }

  const handleEditManually = () => {
    setParsed(null)
    if (parsed?.matched_habit_id) {
      router.push({ pathname: '/habit', params: { id: parsed.matched_habit_id } } as any)
    } else {
      router.push('/habit' as any)
    }
    setNlText('')
  }

  const doneCount = habits.filter((h) => h.todayCount >= h.target_per_period).length
  const totalCount = habits.length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const { pendingHabits, doneHabits, bestStreak } = useMemo(() => {
    const pendingHabits = habits.filter((h) => h.todayCount < h.target_per_period)
    const doneHabits = habits.filter((h) => h.todayCount >= h.target_per_period)
    const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0)
    return { pendingHabits, doneHabits, bestStreak }
  }, [habits])

  const renderGroup = (title: string, items: typeof habits) => {
    if (items.length === 0) return null
    return (
      <View style={styles.group}>
        <View style={styles.groupTitleRow}>
          <Text style={[styles.groupTitle, { color: theme.text.primary }]}>{title}</Text>
          <Text style={[styles.groupCount, { color: theme.text.muted }]}>{items.length}</Text>
        </View>
        <View style={styles.listStack}>
          {items.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onToggle={() => toggleTodayLog(habit.id)}
              onEdit={() => router.push({ pathname: '/habit', params: { id: habit.id } } as any)}
            />
          ))}
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      {habits.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.brand.primary + '1F' }]}>
            <Feather name="check-circle" size={34} color={theme.brand.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_habits}</Text>
          <Text style={[styles.emptyMsg, { color: theme.text.muted }]}>{t.no_habits_msg}</Text>
          <View style={styles.emptySamples}>
            {[t.habit_sample_water, t.habit_sample_exercise, t.habit_sample_read].map((sample) => (
              <Text
                key={sample}
                style={[styles.emptySample, { color: theme.text.secondary, backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
              >
                {sample}
              </Text>
            ))}
          </View>
          <Pressable
            onPress={() => router.push('/habit' as any)}
            style={[styles.emptyBtn, { backgroundColor: theme.brand.primary }]}
          >
            <Text style={styles.emptyBtnText}>{t.new_habit}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={[styles.hero, { backgroundColor: '#FF980014', borderColor: '#FF980044' }]}>
            <View style={styles.heroTop}>
              <View style={styles.heroText}>
                <Text style={[styles.heroKicker, { color: theme.text.muted }]}>{t.habits}</Text>
                <Text style={[styles.heroTitle, { color: theme.text.primary }]}>
                  {t.habits_done_today.replace('{{done}}', String(doneCount)).replace('{{total}}', String(totalCount))}
                </Text>
                <Text style={[styles.heroSubtitle, { color: theme.text.muted }]}>
                  {pendingHabits[0]?.name ?? t.habit_done_today}
                </Text>
              </View>
              <View style={[styles.progressDial, { borderColor: doneCount === totalCount ? '#4CAF50' : '#FF9800' }]}>
                <Text style={[styles.progressValue, { color: theme.text.primary }]}>{progress}%</Text>
                <Text style={[styles.progressLabel, { color: theme.text.muted }]}>{t.today}</Text>
              </View>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.border.subtle }]}>
              <View style={[styles.progressFill, {
                backgroundColor: doneCount === totalCount ? '#4CAF50' : '#FF9800',
                width: `${progress}%`,
              }]} />
            </View>
            <View style={styles.statGrid}>
              <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
                <Text style={[styles.statValue, { color: '#FF9800' }]}>{pendingHabits.length}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.reminder_upcoming}</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
                <Text style={[styles.statValue, { color: '#4CAF50' }]}>{doneHabits.length}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.habit_done_today}</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}>
                <Text style={[styles.statValue, { color: theme.text.primary }]}>{bestStreak}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{t.report_best_streak}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.commandCard, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <View style={styles.commandHeader}>
              <View style={[styles.commandIcon, { backgroundColor: theme.brand.primary + '1F' }]}>
                <Feather name="zap" size={16} color={theme.brand.primary} />
              </View>
              <Text style={[styles.commandTitle, { color: theme.text.primary }]}>{t.smart_entry}</Text>
            </View>
            <View style={[styles.nlInputWrap, { backgroundColor: theme.bg.primary, borderColor: theme.border.strong }]}>
              <TextInput
                value={nlText}
                onChangeText={setNlText}
                placeholder={t.nl_placeholder_habits}
                placeholderTextColor={theme.text.muted}
                style={[styles.nlInput, { color: theme.text.primary }]}
                returnKeyType="done"
                onSubmitEditing={() => handleParse()}
                editable={!parsing}
                multiline
              />
              <View style={styles.nlActions}>
                <VoiceButton onResult={(text) => handleParse(text)} disabled={parsing} size={38} module="habits" />
                <Pressable
                  onPress={() => handleParse()}
                  disabled={parsing || !nlText.trim()}
                  style={[styles.nlBtn, { backgroundColor: (parsing || !nlText.trim()) ? theme.border.strong : theme.brand.primary }]}
                >
                  {parsing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
                </Pressable>
              </View>
            </View>
          </View>

          {renderGroup(t.reminder_upcoming, pendingHabits)}
          {renderGroup(t.habit_done_today, doneHabits)}
        </ScrollView>
      )}

      {habits.length > 0 ? (
        <Pressable
          onPress={() => router.push('/habits-report' as any)}
          accessibilityRole="button"
          accessibilityLabel={t.habits_report_title}
          style={[styles.reportFab, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
        >
          <Feather name="bar-chart-2" size={20} color={theme.text.secondary} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => router.push('/habit' as any)}
        accessibilityRole="button"
        accessibilityLabel={t.new_habit}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Feather name="plus" size={28} color="#fff" />
      </Pressable>

      <Modal visible={!!parsed} transparent animationType="slide" onRequestClose={() => setParsed(null)}>
        <Pressable style={styles.backdrop} onPress={() => setParsed(null)} />
        <View style={[styles.sheet, { backgroundColor: theme.bg.elevated }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.border.strong }]} />
          <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>{t.ai_confirm_title}</Text>

          <View style={[styles.infoRow, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.infoLabel, { color: theme.text.muted }]}>{t.ai_confirm_you_said}</Text>
            <Text style={[styles.infoValue, { color: theme.text.primary }]}>{originalText}</Text>
          </View>

          <View style={[styles.infoRow, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
            <Text style={[styles.infoLabel, { color: theme.text.muted }]}>{t.ai_confirm_parsed}</Text>
            <Text style={[styles.infoValue, { color: theme.text.primary }]}>
              {parsed ? `${parsed.matched_habit_name}${parsed.note ? ' / ' + parsed.note : ''}` : ''}
            </Text>
          </View>

          <View style={styles.sheetActions}>
            <Pressable
              onPress={handleEditManually}
              style={[styles.sheetBtn, { backgroundColor: theme.bg.secondary, borderColor: theme.border.strong }]}
            >
              <Text style={[styles.sheetBtnText, { color: theme.text.secondary }]}>{t.nl_reject_to_form}</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
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
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[4],
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  heroText: { flex: 1, gap: spacing[1] },
  heroKicker: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  heroSubtitle: { fontSize: 13, lineHeight: 18 },
  progressDial: {
    width: 74,
    height: 74,
    borderRadius: radius.full,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressValue: { fontSize: 17, fontWeight: '800' },
  progressLabel: { fontSize: 10, fontWeight: '700' },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
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
  commandCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[3],
  },
  commandHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  commandIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commandTitle: { fontSize: 15, fontWeight: '800' },
  nlInputWrap: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    paddingBottom: 46,
  },
  nlActions: {
    position: 'absolute',
    right: spacing[2],
    bottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
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
  list: { padding: spacing[4], paddingBottom: 100, gap: spacing[3] },
  group: { gap: spacing[2] },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontSize: 15, fontWeight: '800' },
  groupCount: { fontSize: 12, fontWeight: '700' },
  listStack: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  rowAccent: { width: 4, alignSelf: 'stretch' },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[1],
  },
  rowBody: { flex: 1, paddingVertical: spacing[3], gap: 3 },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowMeta: { fontSize: 12 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: spacing[3] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center' },
  emptySamples: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[2], marginTop: spacing[1] },
  emptySample: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 12 },
  emptyBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fab: {
    position: 'absolute', right: spacing[6], bottom: spacing[8],
    width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  reportFab: {
    position: 'absolute', left: spacing[6], bottom: spacing[8],
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 3, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3],
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing[2] },
  sheetTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  infoRow: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], gap: spacing[1] },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15 },
  sheetActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  sheetBtn: { flex: 1, paddingVertical: spacing[3], borderRadius: radius.md, alignItems: 'center', borderWidth: 1 },
  sheetBtnText: { fontSize: 15, fontWeight: '600' },
})
