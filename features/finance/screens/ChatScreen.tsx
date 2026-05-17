import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Keyboard,
  type KeyboardEvent,
} from 'react-native'
import { useRouter } from 'expo-router'
import { subDays } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useFinanceBootstrap, useTransactions, useCategories } from '../hooks/useFinance'
import { chatCompletion, type ChatMessage } from '@services/ai/openai'
import { getAILanguage, getAICurrency, fmtAI } from '@services/ai/aiLanguage'
import { uuid } from '@services/uuid'

type UIMessage = { id: string; role: 'user' | 'assistant'; content: string }

const GREETING_ID = 'greeting'

function buildSystemPrompt(summary: string): string {
  const language = getAILanguage()
  return `You are a smart personal finance assistant.
CRITICAL: You MUST reply in ${language} ONLY. Never switch to another language regardless of what language the data or the user message is written in.

User's financial data (last 30 days):
${summary}

Only answer finance-related questions. Politely decline unrelated topics.
Remember: always reply in ${language}.`
}

function buildSummaryText(
  txs: ReturnType<typeof useTransactions>,
  cats: ReturnType<typeof useCategories>
): string {
  const currency = getAICurrency()
  const catMap = new Map(cats.map((c) => [c.id, c]))
  let income = 0, expense = 0
  const catTotals = new Map<string, number>()
  for (const tx of txs) {
    const name = catMap.get(tx.category_id)?.name ?? 'Other'
    const abs = Math.abs(tx.amount_cents)
    if (tx.amount_cents > 0) income += abs
    else expense += abs
    catTotals.set(name, (catTotals.get(name) ?? 0) + abs)
  }
  const top = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => `${name}: ${fmtAI(total, currency)}`)
    .join(', ')
  return `Income: ${fmtAI(income, currency)} | Expense: ${fmtAI(expense, currency)} | Top: ${top || 'none'}`
}

export function ChatScreen() {
  useFinanceBootstrap()
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const allTxs = useTransactions()
  const cats = useCategories()
  const listRef = useRef<FlatList>(null)

  const [kbHeight, setKbHeight] = useState(0)

  // On Android edge-to-edge, edgeToEdgeEnabled=true means endCoordinates.height
  // already excludes the nav bar — use raw value, no inset subtraction needed.
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const show = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => {
      setKbHeight(e.endCoordinates.height)
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  // Inverted list — newest message at index 0, displayed at bottom
  const greeting: UIMessage = { id: GREETING_ID, role: 'assistant', content: t.ai_greeting }
  const [messages, setMessages] = useState<UIMessage[]>([greeting])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: UIMessage = { id: uuid(), role: 'user', content: text }
    // Prepend to keep newest-first order for inverted FlatList
    setMessages((prev) => [userMsg, ...prev])
    setInput('')
    setLoading(true)

    const cutoff = subDays(new Date(), 30).toISOString()
    const recent = allTxs.filter((tx) => tx.occurred_at >= cutoff)
    const summary = buildSummaryText(recent, cats)

    // Build history in chronological order, exclude static greeting
    const history: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(summary) },
      ...[...messages]
        .reverse()
        .filter((m) => m.id !== GREETING_ID)
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ]

    try {
      const reply = await chatCompletion(history, { max_tokens: 500 })
      const assistantMsg: UIMessage = { id: uuid(), role: 'assistant', content: reply }
      setMessages((prev) => [assistantMsg, ...prev])
    } catch (e: any) {
      if (e?.message === 'NO_API_KEY') {
        Alert.alert(t.no_api_key, t.no_api_key_msg, [
          { text: t.go_to_settings, onPress: () => router.push('/ai-settings') },
          { text: 'OK', style: 'cancel' },
        ])
        // Remove the user message that failed
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      } else {
        const errMsg: UIMessage = { id: uuid(), role: 'assistant', content: `⚠️ ${e?.message ?? t.ai_error}` }
        setMessages((prev) => [errMsg, ...prev])
      }
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, allTxs, cats, t, router])

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Android: paddingBottom đẩy toàn bộ nội dung lên trên bàn phím */}
      <View style={[{ flex: 1 }, Platform.OS === 'android' && { paddingBottom: kbHeight }]}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        inverted
        renderItem={({ item }) => {
          const isUser = item.role === 'user'
          return (
            <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
              <View
                style={[
                  styles.bubbleBg,
                  {
                    backgroundColor: isUser ? theme.brand.primary : theme.bg.elevated,
                    borderColor: isUser ? theme.brand.primary : theme.border.subtle,
                  },
                ]}
              >
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
          style={[
            styles.textInput,
            { color: theme.text.primary, backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle },
          ]}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={send}
        />
        <Pressable
          onPress={send}
          disabled={loading || !input.trim()}
          style={[
            styles.sendBtn,
            { backgroundColor: !input.trim() || loading ? theme.border.strong : theme.brand.primary },
          ]}
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
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
})
