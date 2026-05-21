import { useState } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { getProviderKey } from '@services/ai/openai'
import { parseHabitLog, type ParsedHabitLog } from '@services/ai/habitParser'
import { VoiceButton } from '@components/VoiceButton'
import { useHabitsBootstrap, useHabits, useHabitActions } from '../hooks/useHabits'

const CADENCE_COLORS: Record<string, string> = {
  daily: '#4CAF50',
  weekdays: '#2196F3',
  weekly: '#9C27B0',
}

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
      <Text style={styles.rowIcon}>{habit.icon}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: theme.text.primary }]}>{habit.name}</Text>
        <Text style={[styles.rowMeta, { color: theme.text.muted }]}>
          {done
            ? `✓ ${t.habit_done_today}  ·  🔥 ${habit.streak}`
            : `○ ${habit.todayCount}/${habit.target_per_period}  ·  🔥 ${habit.streak}`}
        </Text>
      </View>
      <View style={[styles.checkCircle, {
        backgroundColor: done ? habit.color : 'transparent',
        borderColor: done ? habit.color : theme.border.strong,
      }]}>
        {done ? <Text style={styles.checkMark}>✓</Text> : null}
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
    // Navigate to habit form; if we have a matched habit, open it for logging
    // Otherwise open create form
    if (parsed?.matched_habit_id) {
      router.push({ pathname: '/habit', params: { id: parsed.matched_habit_id } } as any)
    } else {
      router.push('/habit' as any)
    }
    setNlText('')
  }

  const doneCount = habits.filter((h) => h.todayCount >= h.target_per_period).length
  const totalCount = habits.length

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg.primary }}>
      {/* Summary bar */}
      {habits.length > 0 && (
        <View style={[styles.summary, { backgroundColor: theme.bg.elevated, borderBottomColor: theme.border.subtle }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryText, { color: theme.text.muted }]}>
              {t.habits_done_today.replace('{{done}}', String(doneCount)).replace('{{total}}', String(totalCount))}
            </Text>
            <View style={[styles.progressBar, { backgroundColor: theme.border.subtle }]}>
              <View style={[styles.progressFill, {
                backgroundColor: doneCount === totalCount ? '#4CAF50' : theme.brand.primary,
                width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`,
              }]} />
            </View>
          </View>
          <Pressable onPress={() => router.push('/habits-report' as any)} hitSlop={8} style={styles.reportBtn}>
            <Text style={[styles.reportBtnText, { color: theme.brand.primary }]}>📊</Text>
          </Pressable>
        </View>
      )}

      {/* NL input */}
      <View style={[styles.nlRow, { backgroundColor: theme.bg.secondary, borderBottomColor: theme.border.subtle }]}>
        <TextInput
          value={nlText}
          onChangeText={setNlText}
          placeholder={t.nl_placeholder_habits}
          placeholderTextColor={theme.text.muted}
          style={[styles.nlInput, { color: theme.text.primary, backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}
          returnKeyType="done"
          onSubmitEditing={() => handleParse()}
          editable={!parsing}
        />
        <VoiceButton onResult={(text) => handleParse(text)} disabled={parsing} size={36} module="habits" />
        <Pressable
          onPress={() => handleParse()}
          disabled={parsing || !nlText.trim()}
          style={[styles.nlBtn, { backgroundColor: (parsing || !nlText.trim()) ? theme.border.strong : theme.brand.primary }]}
        >
          {parsing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.nlBtnText}>{t.parse_btn}</Text>}
        </Pressable>
      </View>

      {habits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💪</Text>
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{t.no_habits}</Text>
          <Text style={[styles.emptyMsg, { color: theme.text.muted }]}>{t.no_habits_msg}</Text>
          <Pressable
            onPress={() => router.push('/habit' as any)}
            style={[styles.emptyBtn, { backgroundColor: theme.brand.primary }]}
          >
            <Text style={styles.emptyBtnText}>{t.new_habit}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onToggle={() => toggleTodayLog(habit.id)}
              onEdit={() => router.push({ pathname: '/habit', params: { id: habit.id } } as any)}
            />
          ))}
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.push('/habit' as any)}
        accessibilityRole="button"
        accessibilityLabel={t.new_habit}
        style={[styles.fab, { backgroundColor: theme.brand.primary }]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      {/* Confirm modal */}
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
              {parsed ? `✅ ${parsed.matched_habit_name}${parsed.note ? ' · ' + parsed.note : ''}` : ''}
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
  summary: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing[2],
    flexDirection: 'row', alignItems: 'center',
  },
  reportBtn: { padding: spacing[2] },
  reportBtnText: { fontSize: 20 },
  summaryText: { fontSize: 13, fontWeight: '500' },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  nlRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nlInput: {
    flex: 1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontSize: 14,
  },
  nlBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md },
  nlBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  list: { padding: spacing[4], paddingBottom: 100, gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  rowAccent: { width: 4, alignSelf: 'stretch' },
  rowIcon: { fontSize: 22, marginLeft: spacing[1] },
  rowBody: { flex: 1, paddingVertical: spacing[3], gap: 3 },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowMeta: { fontSize: 12 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: spacing[3] },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center' },
  emptyBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fab: {
    position: 'absolute', right: spacing[6], bottom: spacing[8],
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  fabIcon: { color: '#fff', fontSize: 30, fontWeight: '600', lineHeight: 32 },
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
