import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Keyboard, type KeyboardEvent,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { subDays, format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useFinanceBootstrap, useTransactions, useCategories } from '@features/finance/hooks/useFinance'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { useJournalsBootstrap, useJournals } from '@features/journals/hooks/useJournals'
import { useRemindersBootstrap, useReminders } from '@features/reminders/hooks/useReminders'
import { chatCompletion, type ChatMessage } from '@services/ai/openai'
import { getAILanguage, getAICurrency, fmtAI } from '@services/ai/aiLanguage'
import { uuid } from '@services/uuid'
import { VoiceButton } from '@components/VoiceButton'

type QuickPrompt = {
  icon: keyof typeof Feather.glyphMap
  text: string
}

type UIMessage = { id: string; role: 'user' | 'assistant'; content: string }

const GREETING_ID = 'greeting'

function buildSystemPrompt(ctx: string): string {
  const language = getAILanguage()
  const today = format(new Date(), 'yyyy-MM-dd')
  return `You are a smart personal AI assistant for BataVasa — an app that tracks Finance, Habits, Journals, and Reminders.
CRITICAL: You MUST reply in ${language} ONLY. Never switch to another language.

Today is ${today}.

User's personal data:
${ctx}

Help with any question about their data: spending analysis, habit progress, journal reflection, upcoming tasks, or cross-module patterns (e.g. mood vs spending). Be concise and friendly.
Always reply in ${language}.`
}

function buildContext(
  txs: ReturnType<typeof useTransactions>,
  cats: ReturnType<typeof useCategories>,
  habits: ReturnType<typeof useHabits>,
  journals: ReturnType<typeof useJournals>,
  reminders: ReturnType<typeof useReminders>,
): string {
  const currency = getAICurrency()
  const cutoff30 = subDays(new Date(), 30).toISOString()
  const cutoff7 = subDays(new Date(), 7).toISOString()
  const catMap = new Map(cats.map((c) => [c.id, c]))

  // Finance
  const recentTxs = txs.filter((tx) => tx.occurred_at >= cutoff30)
  let income = 0, expense = 0
  const catTotals = new Map<string, number>()
  for (const tx of recentTxs) {
    const name = catMap.get(tx.category_id)?.name ?? 'Other'
    const abs = Math.abs(tx.amount_cents)
    if (tx.amount_cents > 0) income += abs
    else expense += abs
    catTotals.set(name, (catTotals.get(name) ?? 0) + abs)
  }
  const topCats = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([n, a]) => `${n}: ${fmtAI(a, currency)}`).join(', ')
  const financeLine = `Finance (30d): income ${fmtAI(income, currency)}, expense ${fmtAI(expense, currency)}, top: ${topCats || 'none'}`

  // Habits
  const habitsDue = habits.filter((h) => h.dueToday !== false)
  const habitsDone = habitsDue.filter((h) => h.todayCount >= h.target_per_period).length
  const bestStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0
  const habitNames = habits.slice(0, 5).map((h) => `${h.name}(${h.streak}d)`).join(', ')
  const habitsLine = `Habits: ${habitsDone}/${habitsDue.length} done today, best streak ${bestStreak}d, active: ${habitNames || 'none'}`

  // Journals
  const recentJournals = journals.filter((j) => j.occurred_at >= cutoff7)
  const moodEntries = recentJournals.filter((j) => j.mood !== null)
  const avgMood = moodEntries.length > 0
    ? (moodEntries.reduce((s, j) => s + (j.mood ?? 0), 0) / moodEntries.length).toFixed(1)
    : 'N/A'
  const journalsLine = `Journals: ${recentJournals.length} entries (7d), avg mood ${avgMood}/5`

  // Reminders
  const now = new Date()
  const upcoming = reminders
    .filter((r) => r.completed === 0 && new Date(r.remind_at) >= now)
    .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())
    .slice(0, 3)
    .map((r) => r.title)
  const remindersLine = `Reminders upcoming: ${upcoming.join(', ') || 'none'}`

  return [financeLine, habitsLine, journalsLine, remindersLine].join('\n')
}

export function AssistantScreen() {
  useFinanceBootstrap()
  useHabitsBootstrap()
  useJournalsBootstrap()
  useRemindersBootstrap()

  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const txs = useTransactions()
  const cats = useCategories()
  const habits = useHabits()
  const journals = useJournals()
  const reminders = useReminders()
  const listRef = useRef<FlatList>(null)

  const [kbHeight, setKbHeight] = useState(0)
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const show = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  const greeting: UIMessage = { id: GREETING_ID, role: 'assistant', content: t.ai_greeting }
  const [messages, setMessages] = useState<UIMessage[]>([greeting])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const quickPrompts: QuickPrompt[] = [
    { icon: 'sun', text: t.assistant_prompt_today },
    { icon: 'dollar-sign', text: t.assistant_prompt_finance },
    { icon: 'check-circle', text: t.assistant_prompt_habits },
    { icon: 'book-open', text: t.assistant_prompt_journal },
  ]

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: UIMessage = { id: uuid(), role: 'user', content: text }
    setMessages((prev) => [userMsg, ...prev])
    setInput('')
    setLoading(true)

    const ctx = buildContext(txs, cats, habits, journals, reminders)
    const history: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(ctx) },
      ...[...messages]
        .reverse()
        .filter((m) => m.id !== GREETING_ID)
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ]

    try {
      const reply = await chatCompletion(history, { max_tokens: 600 })
      setMessages((prev) => [{ id: uuid(), role: 'assistant', content: reply }, ...prev])
    } catch (e: any) {
      if (e?.message === 'NO_API_KEY') {
        Alert.alert(t.no_api_key, t.no_api_key_msg, [
          { text: t.go_to_settings, onPress: () => router.push('/ai-settings') },
          { text: 'OK', style: 'cancel' },
        ])
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      } else {
        setMessages((prev) => [{ id: uuid(), role: 'assistant', content: `⚠️ ${e?.message ?? t.ai_error}` }, ...prev])
      }
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, txs, cats, habits, journals, reminders, t, router])

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={[{ flex: 1 }, Platform.OS === 'android' && { paddingBottom: kbHeight }]}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          style={styles.list}
          inverted
          ListFooterComponent={
            <View style={styles.welcomeHeader}>
              <View style={[styles.welcomeIcon, { backgroundColor: theme.brand.primary + '1F' }]}>
                <Feather name="message-circle" size={24} color={theme.brand.primary} />
              </View>
              <Text style={[styles.welcomeTitle, { color: theme.text.primary }]}>{t.nav_chat}</Text>
              <Text style={[styles.welcomeSubtitle, { color: theme.text.muted }]}>{t.assistant_subtitle}</Text>
              <View style={styles.promptGrid}>
                {quickPrompts.map((prompt) => (
                  <Pressable
                    key={prompt.text}
                    onPress={() => setInput(prompt.text)}
                    style={({ pressed }) => [
                      styles.promptChip,
                      {
                        backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
                        borderColor: theme.border.subtle,
                      },
                    ]}
                  >
                    <Feather name={prompt.icon} size={15} color={theme.brand.primary} />
                    <Text style={[styles.promptText, { color: theme.text.secondary }]} numberOfLines={2}>
                      {prompt.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.role === 'user'
            return (
              <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
                <View style={[
                  styles.bubbleBg,
                  {
                    backgroundColor: isUser ? theme.brand.primary : theme.bg.elevated,
                    borderColor: isUser ? theme.brand.primary : theme.border.subtle,
                  },
                ]}>
                  <Text style={[styles.bubbleText, { color: isUser ? '#fff' : theme.text.primary }]}>
                    {item.content}
                  </Text>
                </View>
              </View>
            )
          }}
        />

        {loading && (
          <View style={[styles.typingRow, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
            <ActivityIndicator size="small" color={theme.brand.primary} />
            <Text style={[styles.typingText, { color: theme.text.muted }]}>{t.analyzing}</Text>
          </View>
        )}

        <View style={[styles.inputRow, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t.type_message}
            placeholderTextColor={theme.text.muted}
            multiline
            style={[styles.textInput, { color: theme.text.primary, backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={send}
          />
          <VoiceButton
            onResult={(text) => { setInput(text) }}
            disabled={loading}
            size={40}
            module="assistant"
          />
          <Pressable
            onPress={send}
            disabled={loading || !input.trim()}
            style={[styles.sendBtn, { backgroundColor: !input.trim() || loading ? theme.border.strong : theme.brand.primary }]}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { padding: spacing[4], gap: spacing[3] },
  bubble: { flexDirection: 'row' },
  bubbleUser: { justifyContent: 'flex-end' },
  bubbleAI: { justifyContent: 'flex-start' },
  bubbleBg: {
    maxWidth: '82%',
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  typingText: { fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing[3],
    gap: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
  welcomeHeader: { alignItems: 'center', paddingTop: spacing[8], paddingBottom: spacing[4], paddingHorizontal: spacing[2], gap: spacing[2] },
  welcomeIcon: { width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing[2], textAlign: 'center' },
  welcomeSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  promptGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  promptChip: {
    width: '48%',
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[2],
  },
  promptText: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
})
