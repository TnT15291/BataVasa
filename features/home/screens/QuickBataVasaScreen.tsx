import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  type KeyboardEvent,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { answerAppGuideQuestion, getAppGuideSamples } from '@services/appGuide'
import { uuid } from '@services/uuid'

type GuideMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function QuickBataVasaScreen() {
  const theme = useTheme()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const samples = getAppGuideSamples(language)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [kbHeight, setKbHeight] = useState(0)
  const [messages, setMessages] = useState<GuideMessage[]>([
    {
      id: 'intro',
      role: 'assistant',
      content:
        language === 'vi'
          ? 'Mình là hướng dẫn nhanh của BataVasa. Bạn có thể hỏi về setup, app làm được gì, bắt đầu thế nào, AI backend, đồng bộ, thông báo hoặc các module.'
          : 'I am BataVasa quick help. Ask about setup, what the app can do, getting started, AI backend, sync, notifications, or modules.',
    },
  ])

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const show = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  const ask = useCallback(async (override?: string) => {
    const question = (override ?? input).trim()
    if (!question || loading) return

    const userMsg: GuideMessage = { id: uuid(), role: 'user', content: question }
    setMessages((prev) => [userMsg, ...prev])
    setInput('')
    setLoading(true)

    try {
      const answer = await answerAppGuideQuestion(question, language)
      setMessages((prev) => [{ id: uuid(), role: 'assistant', content: answer }, ...prev])
    } catch (e: any) {
      const msg =
        e?.message === 'NO_BACKEND'
          ? language === 'vi'
            ? 'AI backend chưa sẵn sàng. Bạn vẫn có thể dùng các câu hỏi mẫu bên trên để xem hướng dẫn nhanh.'
            : 'AI backend is not ready. You can still use the sample questions above for quick guidance.'
          : e?.message ?? t.ai_error
      Alert.alert(t.command_placeholder, msg)
      setMessages((prev) => [{ id: uuid(), role: 'assistant', content: msg }, ...prev])
    } finally {
      setLoading(false)
    }
  }, [input, language, loading, t.ai_error, t.command_placeholder])

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <View style={[styles.screen, Platform.OS === 'android' && { paddingBottom: kbHeight }]}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: theme.brand.primary + '24' }]}>
              <Feather name="help-circle" size={24} color={theme.brand.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text.primary }]}>{t.command_placeholder}</Text>
            <Text style={[styles.subtitle, { color: theme.text.muted }]}>
              {language === 'vi'
                ? 'Câu thường gặp trả lời ngay. Câu khác sẽ được AI trả lời trong phạm vi hướng dẫn BataVasa.'
                : 'Common questions answer instantly. Other questions use AI, limited to BataVasa guidance.'}
            </Text>
            <View style={styles.samples}>
              {samples.map((sample) => (
                <Pressable
                  key={sample.id}
                  onPress={() => { void ask(sample.question) }}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.sample,
                    {
                      backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
                      borderColor: theme.border.subtle,
                    },
                  ]}
                >
                  <Text style={[styles.sampleText, { color: theme.text.secondary }]}>{sample.question}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isUser = item.role === 'user'
          return (
            <View style={[styles.bubbleRow, isUser ? styles.userRow : styles.assistantRow]}>
              <View
                style={[
                  styles.bubble,
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

      {loading ? (
        <View style={[styles.loading, { borderColor: theme.border.subtle, backgroundColor: theme.bg.elevated }]}>
          <ActivityIndicator size="small" color={theme.brand.primary} />
          <Text style={[styles.loadingText, { color: theme.text.muted }]}>{t.analyzing}</Text>
        </View>
      ) : null}

      <View style={[styles.inputBar, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t.command_placeholder}
          placeholderTextColor={theme.text.muted}
          multiline
          style={[styles.input, { color: theme.text.primary, backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}
          onSubmitEditing={() => { void ask() }}
        />
        <Pressable
          onPress={() => { void ask() }}
          disabled={loading || !input.trim()}
          style={[styles.send, { backgroundColor: loading || !input.trim() ? theme.border.strong : theme.brand.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t.command_placeholder}
        >
          <Feather name="arrow-up" size={19} color="#fff" />
        </Pressable>
      </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: spacing[4], gap: spacing[3] },
  header: { alignItems: 'center', paddingTop: spacing[6], paddingBottom: spacing[3], gap: spacing[2] },
  icon: { width: 54, height: 54, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 320 },
  samples: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  sample: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    maxWidth: '100%',
  },
  sampleText: { fontSize: 13, fontWeight: '600' },
  bubbleRow: { flexDirection: 'row' },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '84%',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[3],
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  loadingText: { fontSize: 13 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 92,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: 14,
  },
  send: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
})
