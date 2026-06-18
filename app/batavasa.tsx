import { useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
import { BrandMark } from '@components/ui'
import { uuid } from '@services/uuid'

type Message = { id: string; role: 'user' | 'assistant'; text: string }

const QUICK_QUESTIONS = [
  'App này sử dụng như thế nào?',
  'BataVasa có chức năng gì?',
  'Nhập nhanh hoạt động ra sao?',
  'Tôi nên bắt đầu từ đâu?',
]

function answerAboutBataVasa(question: string): string {
  const q = question.toLowerCase()
  if (q.includes('sử dụng') || q.includes('dùng') || q.includes('bắt đầu')) {
    return 'Bạn có thể bắt đầu từ nút + ở màn hình chính: nhập một câu tự nhiên như “cà phê 35k”, “uống nước lúc 9h”, hoặc “hôm nay khá mệt”. BataVasa sẽ đưa nội dung đó vào đúng module: tài chính, công việc, thói quen hoặc nhật ký.'
  }
  if (q.includes('chức năng') || q.includes('module') || q.includes('làm gì')) {
    return 'BataVasa là app quản lý đời sống cá nhân gồm 4 phần chính: Tài chính để ghi thu chi, Thói quen để theo dõi việc lặp lại, Nhật ký để lưu cảm xúc và sự kiện, Công việc để nhắc việc. Màn hình chính gom lại các tín hiệu quan trọng trong ngày.'
  }
  if (q.includes('tài chính') || q.includes('tiền') || q.includes('chi tiêu')) {
    return 'Module Tài chính giúp bạn ghi giao dịch, phân loại thu chi, xem báo cáo, theo dõi khoản định kỳ và các mục cần xem lại. Bạn có thể nhập nhanh bằng câu tự nhiên hoặc vào tab Tài chính để xem chi tiết.'
  }
  if (q.includes('thói quen') || q.includes('habit')) {
    return 'Module Thói quen dùng để tạo việc lặp lại như uống nước, đọc sách, tập luyện. Mỗi ngày bạn đánh dấu hoàn thành, bỏ qua khi cần, và xem chuỗi ngày duy trì trong báo cáo.'
  }
  if (q.includes('nhật ký') || q.includes('cảm xúc')) {
    return 'Module Nhật ký giúp bạn viết nhanh một dòng về ngày hôm nay, gắn tâm trạng, vị trí hoặc mức độ quan trọng. Về lâu dài, báo cáo nhật ký giúp bạn nhìn lại cảm xúc và chủ đề thường xuất hiện.'
  }
  if (q.includes('công việc') || q.includes('nhắc') || q.includes('reminder')) {
    return 'Module Công việc dùng để tạo nhắc việc, inbox, lịch và việc lặp lại. Những việc quan trọng hoặc quá hạn sẽ nổi lên ở màn hình chính để bạn xử lý trước.'
  }
  if (q.includes('ai') || q.includes('trợ lý') || q.includes('gợi ý')) {
    return 'AI trong BataVasa giúp bạn hỏi về dữ liệu cá nhân, ví dụ “tháng này tôi tiêu nhiều ở đâu?”, “hôm nay nên làm gì trước?”, hoặc “làm sao giữ chuỗi thói quen?”. Màn này tập trung trả lời cách dùng app.'
  }
  if (q.includes('báo cáo') || q.includes('report') || q.includes('phân tích')) {
    return 'Báo cáo tổng hợp dữ liệu theo module: thu chi, thói quen, nhật ký và công việc. Mục tiêu là giúp bạn thấy xu hướng thay vì chỉ nhìn từng dòng dữ liệu rời rạc.'
  }
  return 'Bạn có thể hỏi tôi bất cứ điều gì về cách dùng BataVasa: nhập nhanh, tài chính, thói quen, nhật ký, công việc, báo cáo hoặc AI. Cách nhanh nhất là hỏi bằng một câu tự nhiên, tôi sẽ giải thích theo ngữ cảnh của app.'
}

export default function BataVasaGuideRoute() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'hello',
      role: 'assistant',
      text: 'Chào bạn, tôi là BataVasa AI. Hỏi tôi cách dùng app, từng module làm gì, hoặc nên bắt đầu từ đâu.',
    },
  ])

  const send = (text?: string) => {
    const q = (text ?? input).trim()
    if (!q) return
    setInput('')
    setMessages((prev) => [
      ...prev,
      { id: uuid(), role: 'user', text: q },
      { id: uuid(), role: 'assistant', text: answerAboutBataVasa(q) },
    ])
  }

  const chips = useMemo(() => QUICK_QUESTIONS, [])

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[3] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BrandMark size={42} bg="#fff" glyph={theme.brand.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text.primary }]}>Hỏi BataVasa</Text>
            <Text style={[styles.subtitle, { color: theme.text.muted }]}>Hỏi mọi thứ về cách dùng app</Text>
          </View>
        </View>

        <View style={styles.chips}>
          {chips.map((q) => (
            <Pressable
              key={q}
              onPress={() => send(q)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
                  borderColor: theme.border.subtle,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: theme.text.secondary }]}>{q}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.messages}>
          {messages.map((m) => {
            const isUser = m.role === 'user'
            return (
              <View key={m.id} style={[styles.messageRow, isUser && styles.messageRowUser]}>
                {!isUser ? (
                  <View style={[styles.avatar, { backgroundColor: theme.brand.primary + '18' }]}>
                    <Feather name="message-circle" size={14} color={theme.brand.primary} />
                  </View>
                ) : null}
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
                    {m.text}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing[3]), backgroundColor: theme.bg.elevated, borderTopColor: theme.border.subtle }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Hỏi về BataVasa..."
          placeholderTextColor={theme.text.muted}
          multiline
          style={[styles.input, { color: theme.text.primary, backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}
        />
        <Pressable
          onPress={() => send()}
          accessibilityRole="button"
          accessibilityLabel="Gửi câu hỏi"
          style={[styles.sendBtn, { backgroundColor: input.trim() ? theme.brand.primary : theme.border.strong }]}
        >
          <Feather name="send" size={17} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[4], paddingBottom: 112, gap: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  chipText: { fontSize: 12, fontWeight: '600' },
  messages: { gap: spacing[3] },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  messageRowUser: { justifyContent: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '84%', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  bubbleText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: 14,
  },
  sendBtn: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
})
