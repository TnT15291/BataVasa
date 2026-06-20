import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Keyboard, type KeyboardEvent,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useFinanceBootstrap, useTransactions, useCategories } from '@features/finance/hooks/useFinance'
import { useHabitsBootstrap, useHabits } from '@features/habits/hooks/useHabits'
import { useJournalsBootstrap, useJournals } from '@features/journals/hooks/useJournals'
import { useRemindersBootstrap, useReminders } from '@features/reminders/hooks/useReminders'
import { chatCompletion, type ChatMessage } from '@services/ai/openai'
import { buildAssistantContext, buildAssistantSystemPrompt } from '@services/ai/assistantContext'
import { useGoalsStore } from '@store/goalsStore'
import { uuid } from '@services/uuid'
import { VoiceButton } from '@components/VoiceButton'

type QuickPrompt = {
  icon: keyof typeof Feather.glyphMap
  text: string
}

type UIMessage = { id: string; role: 'user' | 'assistant'; content: string }

const GREETING_ID = 'greeting'

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
  const goals = useGoalsStore((s) => s.goals)
  const loadGoals = useGoalsStore((s) => s.loadGoals)
  const goalsLoadState = useGoalsStore((s) => s.loadState)
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    if (goalsLoadState === 'idle') void loadGoals()
  }, [goalsLoadState, loadGoals])

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
    { icon: 'trending-up', text: t.assistant_prompt_finance },
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

    const ctx = buildAssistantContext({
      transactions: txs,
      categories: cats,
      habits,
      journals,
      reminders,
      goals,
    })
    const history: ChatMessage[] = [
      { role: 'system', content: buildAssistantSystemPrompt(ctx) },
      ...[...messages]
        .reverse()
        .filter((m) => m.id !== GREETING_ID)
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ]

    try {
      const reply = await chatCompletion(history, { max_tokens: 800, temperature: 0.4 })
      setMessages((prev) => [{ id: uuid(), role: 'assistant', content: reply }, ...prev])
    } catch (e: any) {
      if (e?.message === 'NO_API_KEY') {
        Alert.alert(t.no_api_key, t.no_api_key_msg, [
          { text: t.go_to_settings, onPress: () => router.push('/ai-settings') },
          { text: 'OK', style: 'cancel' },
        ])
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      } else {
        setMessages((prev) => [{ id: uuid(), role: 'assistant', content: `[!] ${e?.message ?? t.ai_error}` }, ...prev])
      }
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, txs, cats, habits, journals, reminders, goals, t, router])

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
            accessibilityRole="button"
            accessibilityLabel={t.type_message}
            style={[styles.sendBtn, { backgroundColor: !input.trim() || loading ? theme.border.strong : theme.brand.primary }]}
          >
            <Feather name="arrow-up" size={20} color="#fff" />
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
    borderWidth: 1,
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
  welcomeHeader: { alignItems: 'center', paddingTop: spacing[8], paddingBottom: spacing[4], paddingHorizontal: spacing[2], gap: spacing[2] },
  welcomeIcon: { width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing[2], textAlign: 'center' },
  welcomeSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  promptGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  promptChip: {
    width: '48%',
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    gap: spacing[2],
  },
  promptText: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
})
