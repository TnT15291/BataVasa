import { chatCompletion, type ChatMessage } from './ai/openai'

export type AppGuideLanguage = 'en' | 'vi' | string

export type AppGuideSample = {
  id: string
  question: string
}

type GuideContent = {
  samples: AppGuideSample[]
  answers: Record<string, string>
  fallbackSystem: string
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function guideContent(language: AppGuideLanguage): GuideContent {
  if (language === 'vi') {
    return {
      samples: [
        { id: 'what', question: 'BataVasa làm được gì?' },
        { id: 'start', question: 'Tôi nên bắt đầu như thế nào?' },
        { id: 'setup', question: 'Setup app cần làm gì?' },
        { id: 'ai', question: 'AI/API key hoạt động thế nào?' },
        { id: 'sync', question: 'Dữ liệu có đồng bộ không?' },
      ],
      answers: {
        what:
          'BataVasa là một trợ lý đời sống cá nhân: theo dõi tài chính, công việc, thói quen, nhật ký và mục tiêu. App giúp bạn ghi nhanh dữ liệu hằng ngày, xem báo cáo, nhận tín hiệu liên module và dùng AI để hiểu điều gì đang diễn ra trong cuộc sống của mình.',
        start:
          'Cách bắt đầu gọn nhất: 1) đăng nhập tài khoản, 2) thêm vài giao dịch hoặc công việc bằng nút +, 3) tạo 1-2 thói quen quan trọng, 4) viết một dòng nhật ký cuối ngày, 5) mở Weekly Review sau vài ngày để xem bức tranh tổng quan.',
        setup:
          'Setup cơ bản gồm: đăng nhập, chọn ngôn ngữ/giao diện, bật thông báo nếu muốn nhắc việc hoặc Weekly Review, kiểm tra đồng bộ Supabase nếu dùng nhiều thiết bị, và cấu hình AI backend ở server nếu bạn muốn dùng phân tích thông minh.',
        ai:
          'API key AI không nên nhập trực tiếp trong app. BataVasa đang đi theo hướng backend-managed: key như GROQ_API_KEY được lưu trong Supabase Edge Function Secrets, app chỉ gọi backend. Như vậy key không lộ trên thiết bị và sau này có thể đổi provider theo gói user.',
        sync:
          'App lưu dữ liệu trên thiết bị trước để dùng được khi offline. Khi có tài khoản và cấu hình Supabase, dữ liệu được đưa vào hàng đợi sync rồi đồng bộ lên backend. Nếu mất mạng, app sẽ sync lại khi điều kiện ổn hơn.',
      },
      fallbackSystem:
        'Bạn là hướng dẫn viên trong app BataVasa. Chỉ trả lời câu hỏi về cách setup, chức năng, dữ liệu, quyền, AI backend, đồng bộ, dark mode, báo cáo, nhập nhanh, tài chính, thói quen, nhật ký, công việc, mục tiêu và Weekly Review của BataVasa. Trả lời bằng tiếng Việt, ngắn gọn, thực tế. Nếu câu hỏi nằm ngoài BataVasa, nói rõ rằng bạn chỉ hỗ trợ về app BataVasa.',
    }
  }

  return {
    samples: [
      { id: 'what', question: 'What can BataVasa do?' },
      { id: 'start', question: 'How should I get started?' },
      { id: 'setup', question: 'What setup is required?' },
      { id: 'ai', question: 'How do AI/API keys work?' },
      { id: 'sync', question: 'Does my data sync?' },
    ],
    answers: {
      what:
        'BataVasa is a personal life assistant for finance, tasks, habits, journals, and goals. It helps you capture daily data, review patterns, see cross-module signals, and use AI to understand what is happening across your life.',
      start:
        'A simple start: 1) sign in, 2) add a few transactions or tasks with +, 3) create 1-2 important habits, 4) write one short journal entry each day, then open Weekly Review after a few days.',
      setup:
        'Basic setup: sign in, choose language/theme, enable notifications if you want reminders or Weekly Review nudges, check Supabase sync for multi-device use, and configure backend AI secrets if you want smart insights.',
      ai:
        'AI API keys should live on the backend, not inside the app. BataVasa calls Supabase Edge Functions, where secrets such as GROQ_API_KEY are stored. That keeps keys off the device and allows provider changes by user tier later.',
      sync:
        'BataVasa saves locally first so the app works offline. With Supabase configured, changes are queued and synced to the backend when the network/session is available.',
    },
    fallbackSystem:
      'You are the in-app guide for BataVasa. Only answer questions about BataVasa setup, features, data, permissions, AI backend, sync, dark mode, reports, quick entry, finance, habits, journals, tasks, goals, and Weekly Review. Be concise and practical. If the question is outside BataVasa, say you only help with the BataVasa app.',
  }
}

export function getAppGuideSamples(language: AppGuideLanguage): AppGuideSample[] {
  return guideContent(language).samples
}

export function getPresetAppGuideAnswer(question: string, language: AppGuideLanguage): string | null {
  const q = fold(question)
  const content = guideContent(language)

  if (/(lam duoc gi|chuc nang|app la gi|what.*do|features|capabilit)/.test(q)) return content.answers.what
  if (/(bat dau|start|getting started|new user|dung nhu the nao)/.test(q)) return content.answers.start
  if (/(setup|set up|cai dat|thiet lap|configure|config)/.test(q)) return content.answers.setup
  if (/(api key|backend key|groq|deepseek|openai|ai|provider|edge function|secret)/.test(q)) return content.answers.ai
  if (/(sync|dong bo|supabase|offline|backup|sao luu)/.test(q)) return content.answers.sync

  const sample = content.samples.find((s) => fold(s.question) === q)
  return sample ? content.answers[sample.id] ?? null : null
}

export async function answerAppGuideQuestion(question: string, language: AppGuideLanguage): Promise<string> {
  const preset = getPresetAppGuideAnswer(question, language)
  if (preset) return preset

  const content = guideContent(language)
  const messages: ChatMessage[] = [
    { role: 'system', content: content.fallbackSystem },
    { role: 'user', content: question },
  ]
  return chatCompletion(messages, { temperature: 0.2, max_tokens: 500 })
}
