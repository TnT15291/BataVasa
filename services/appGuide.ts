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
        { id: 'what', question: 'BataVasa giúp tôi làm gì?' },
        { id: 'usage', question: 'Tôi dùng các chức năng chính thế nào?' },
        { id: 'spirit', question: 'Tinh thần của app là gì?' },
        { id: 'privacy', question: 'Dữ liệu cá nhân của tôi có bị lộ không?' },
        { id: 'better', question: 'App giúp tôi tốt hơn như thế nào?' },
        { id: 'start', question: 'Tôi nên bắt đầu từ đâu?' },
        { id: 'weekly', question: 'Weekly Review dùng để làm gì?' },
      ],
      answers: {
        what:
          'BataVasa là một trợ lý đời sống cá nhân cho tài chính, công việc, thói quen, nhật ký và mục tiêu. Giá trị chính không chỉ là ghi chép, mà là giúp bạn nhìn thấy nhịp sống của mình rõ hơn: tiền đang đi đâu, việc gì đang bị trễ, thói quen nào đang nâng bạn lên, và cảm xúc nào lặp lại qua thời gian.',
        usage:
          'Bạn có thể dùng BataVasa theo một vòng rất đơn giản: ghi nhanh bằng nút +, xem lại trên từng module, rồi dùng Insights/Weekly Review để hiểu bức tranh lớn. Finance dùng để theo dõi thu chi và kế hoạch tiền; Tasks để giữ việc quan trọng không rơi mất; Habits để xây nhịp sống tốt hơn; Journal để ghi lại cảm xúc/suy nghĩ; Goals để nối dữ liệu hằng ngày với mục tiêu dài hơn.',
        spirit:
          'Tinh thần của BataVasa là bình tĩnh, riêng tư và hướng về sự trưởng thành. App không thúc ép bạn tối ưu mọi thứ như một cỗ máy; nó giúp bạn quan sát cuộc sống thật của mình, chọn một bước nhỏ đúng lúc, và dần xây một phiên bản tốt hơn của chính bạn.',
        privacy:
          'BataVasa được thiết kế theo hướng dữ liệu thuộc về bạn. Dữ liệu được lưu trên thiết bị trước, các tính năng đồng bộ/AI đi qua backend thay vì để lộ khóa hay dữ liệu nhạy cảm trong app. Mục tiêu là chỉ dùng dữ liệu để phục vụ bạn: báo cáo, nhắc việc, phân tích và Weekly Review.',
        better:
          'BataVasa giúp bạn thành một “better version” bằng cách biến những mảnh nhỏ hằng ngày thành phản hồi có ý nghĩa: chi tiêu thành thói quen tài chính, việc cần làm thành ưu tiên, nhật ký thành hiểu biết về cảm xúc, và thói quen thành bằng chứng rằng bạn đang tiến lên.',
        start:
          'Bắt đầu nhẹ thôi: thêm vài giao dịch, tạo 1-2 thói quen thật sự quan trọng, ghi một dòng nhật ký cuối ngày, và dùng nhắc việc cho những thứ dễ quên. Sau vài ngày, mở Weekly Review để xem bức tranh tổng quan thay vì chỉ nhìn từng mảnh rời rạc.',
        finance:
          'Với Finance, hãy ghi thu/chi bằng nút + hoặc nhập nhanh kiểu “cà phê 35k”. Sau đó xem danh mục, báo cáo và các mục cần review để biết tiền đang chảy vào đâu. Nếu có khoản nợ hoặc kế hoạch chi tiêu, dùng Debt/Plan để biến tiền bạc thành việc có thể theo dõi, không chỉ là con số.',
        habits:
          'Với Habits, hãy bắt đầu bằng 1-2 thói quen nhỏ nhưng có ý nghĩa, ví dụ uống nước, đọc sách, đi bộ. Mỗi ngày chỉ cần đánh dấu hoàn thành hoặc bỏ qua có chủ đích. App sẽ giúp bạn nhìn nhịp duy trì, số lần hoàn thành, và gợi ý cách giữ đà mà không tự trách mình.',
        journal:
          'Với Journal, bạn không cần viết dài. Một dòng về hôm nay, cảm xúc, điều đáng nhớ hoặc bài học nhỏ là đủ. Theo thời gian, nhật ký giúp Weekly Review và AI nhận ra chủ đề lặp lại, tâm trạng, điều làm bạn tốt hơn hoặc điều đang kéo năng lượng xuống.',
        tasks:
          'Với Tasks/Reminders, hãy ghi những việc dễ quên hoặc có thời điểm rõ ràng. Đặt nhắc trước nếu cần. Mục tiêu không phải nhồi thật nhiều việc, mà là giữ những việc quan trọng nằm đúng chỗ để đầu óc nhẹ hơn.',
        goals:
          'Với Goals, hãy tạo mục tiêu có liên quan đến dữ liệu thật: tiết kiệm theo danh mục, duy trì thói quen, hoặc cải thiện một nhịp sống. BataVasa sẽ cố nối mục tiêu với Finance/Habits/Tasks để bạn thấy tiến độ đến từ hành động hằng ngày.',
        weekly:
          'Weekly Review là nơi BataVasa gom tín hiệu từ tài chính, thói quen, nhật ký, công việc và mục tiêu thành một bức tranh tuần. Nó giúp bạn hỏi: tuần này mình đang đi về đâu, điều gì đang hỗ trợ mình, điều gì cần chỉnh nhẹ, và bước nhỏ tiếp theo là gì.',
        setup:
          'Setup cơ bản gồm: đăng nhập, chọn ngôn ngữ/giao diện, bật thông báo nếu muốn nhận nhắc việc hoặc Weekly Review, và kiểm tra đồng bộ nếu dùng nhiều thiết bị. Các thiết lập kỹ thuật như AI backend/API key nên được quản lý ở server.',
        ai:
          'API key AI không nên nhập trực tiếp trong app. BataVasa đi theo hướng backend-managed: key như GROQ_API_KEY được lưu trong Supabase Edge Function Secrets, app chỉ gọi backend. Như vậy key không lộ trên thiết bị và sau này có thể đổi provider theo gói user.',
        sync:
          'App lưu dữ liệu trên thiết bị trước để dùng được khi offline. Khi có tài khoản và cấu hình Supabase, dữ liệu được đưa vào hàng đợi sync rồi đồng bộ lên backend. Nếu mất mạng, app sẽ sync lại khi điều kiện ổn hơn.',
      },
      fallbackSystem:
        'Bạn là hướng dẫn viên trong app BataVasa. Chỉ trả lời câu hỏi về tinh thần sản phẩm, cách dùng, quyền riêng tư, dữ liệu, setup, chức năng, AI backend, đồng bộ, dark mode, báo cáo, nhập nhanh, tài chính, thói quen, nhật ký, công việc, mục tiêu và Weekly Review của BataVasa. Khi người dùng hỏi cách dùng một chức năng, hãy trả lời như hướng dẫn thao tác thực tế: dùng nút nào, ghi gì, xem ở đâu, khi nào nên mở báo cáo/review. Trả lời bằng tiếng Việt, ngắn gọn, ấm áp, thực tế. Nhấn mạnh giá trị: giúp người dùng hiểu đời sống của mình và xây một phiên bản tốt hơn mà không bị áp lực. Nếu câu hỏi nằm ngoài BataVasa, nói rõ rằng bạn chỉ hỗ trợ về app BataVasa.',
    }
  }

  return {
    samples: [
      { id: 'what', question: 'How does BataVasa help me?' },
      { id: 'usage', question: 'How do I use the main features?' },
      { id: 'spirit', question: 'What is the spirit of the app?' },
      { id: 'privacy', question: 'Will my personal data be exposed?' },
      { id: 'better', question: 'How does it help me become better?' },
      { id: 'start', question: 'Where should I start?' },
      { id: 'weekly', question: 'What is Weekly Review for?' },
    ],
    answers: {
      what:
        'BataVasa is a personal life assistant for finance, tasks, habits, journals, and goals. Its value is not just logging data; it helps you see your life rhythm more clearly: where money goes, what is overdue, which habits lift you up, and which emotions repeat over time.',
      usage:
        'Use BataVasa as a simple loop: capture with +, review each module, then open Insights or Weekly Review to see the bigger pattern. Finance tracks money and plans; Tasks keeps important work visible; Habits builds daily rhythm; Journal captures thoughts and mood; Goals connects daily actions to longer-term progress.',
      spirit:
        'The spirit of BataVasa is calm, private, and growth-oriented. It does not push you to optimize yourself like a machine. It helps you observe your real life, choose one useful next step, and gradually build a better version of yourself.',
      privacy:
        'BataVasa is designed around the idea that your data belongs to you. Data is saved locally first, and sync/AI features go through the backend rather than exposing sensitive keys in the app. The goal is to use your data only to serve you: reports, reminders, insights, and Weekly Review.',
      better:
        'BataVasa helps you become a better version of yourself by turning small daily traces into meaningful feedback: spending into financial habits, tasks into priorities, journals into emotional insight, and habits into evidence that you are moving forward.',
      start:
        'Start lightly: add a few transactions, create 1-2 habits that truly matter, write one short journal line at the end of the day, and use reminders for things you often forget. After a few days, open Weekly Review to see the bigger picture.',
      finance:
        'For Finance, add income/expenses with + or quick text such as “coffee 35k”. Then review categories, reports, and items needing review to see where money is going. Use Debt or Plan when money becomes something you need to track over time.',
      habits:
        'For Habits, start with 1-2 small habits that matter. Mark them done or intentionally skipped each day. BataVasa helps you see consistency, completions, and gentle suggestions for keeping momentum without self-blame.',
      journal:
        'For Journal, one short line is enough. Capture a mood, thought, moment, or lesson. Over time, journals help Weekly Review and AI notice recurring themes, emotional patterns, and what gives or drains energy.',
      tasks:
        'For Tasks/Reminders, capture things that are easy to forget or time-sensitive. Add reminder times when needed. The point is not to store everything; it is to keep important things in the right place so your head feels lighter.',
      goals:
        'For Goals, create goals connected to real data: saving in a category, maintaining a habit, or improving a life rhythm. BataVasa links goals back to Finance, Habits, and Tasks so progress comes from daily action.',
      weekly:
        'Weekly Review combines finance, habits, journals, tasks, and goals into one weekly picture. It helps you see where the week is going, what supported you, what needs a small adjustment, and what next step matters.',
      setup:
        'Basic setup: sign in, choose language/theme, enable notifications if you want reminders or Weekly Review nudges, and check sync if you use multiple devices. Technical AI backend/API key setup should be managed server-side.',
      ai:
        'AI API keys should live on the backend, not inside the app. BataVasa calls Supabase Edge Functions, where secrets such as GROQ_API_KEY are stored. That keeps keys off the device and allows provider changes by user tier later.',
      sync:
        'BataVasa saves locally first so the app works offline. With Supabase configured, changes are queued and synced to the backend when the network/session is available.',
    },
    fallbackSystem:
      'You are the in-app guide for BataVasa. Only answer questions about the product spirit, usage, privacy, data, setup, features, AI backend, sync, dark mode, reports, quick entry, finance, habits, journals, tasks, goals, and Weekly Review. When users ask how to use a feature, answer as practical app guidance: what to tap, what to enter, where to review it, and when to use reports/reviews. Be concise, warm, and practical. Emphasize the value: helping users understand their life and build a better version of themselves without pressure. If the question is outside BataVasa, say you only help with the BataVasa app.',
  }
}

export function getAppGuideSamples(language: AppGuideLanguage): AppGuideSample[] {
  return guideContent(language).samples
}

export function getPresetAppGuideAnswer(question: string, language: AppGuideLanguage): string | null {
  const q = fold(question)
  const content = guideContent(language)

  if (/(tinh than|spirit|philosophy|triet ly|gia tri|value)/.test(q)) return content.answers.spirit
  if (/(du lieu.*lo|lo.*du lieu|bao mat|rieng tu|privacy|personal data|exposed|private|safe)/.test(q)) return content.answers.privacy
  if (/(better version|tot hon|phien ban tot hon|truong thanh|growth|become better|improve)/.test(q)) return content.answers.better
  if (/(dung.*chuc nang|chuc nang.*dung|main features|use.*features|workflow|quy trinh)/.test(q)) return content.answers.usage
  if (/(finance|tai chinh|thu chi|giao dich|chi tieu|income|expense|money|debt|plan)/.test(q)) return content.answers.finance
  if (/(habit|habits|thoi quen|streak|duy tri)/.test(q)) return content.answers.habits
  if (/(journal|nhat ky|cam xuc|mood|ghi chep)/.test(q)) return content.answers.journal
  if (/(task|tasks|reminder|reminders|cong viec|nhac viec|to do|todo)/.test(q)) return content.answers.tasks
  if (/(goal|goals|muc tieu|progress|tien do)/.test(q)) return content.answers.goals
  if (/(weekly review|review tuan|tong ket tuan|bao cao tuan)/.test(q)) return content.answers.weekly
  if (/(lam duoc gi|giup toi lam gi|chuc nang|app la gi|what.*do|how.*help|features|capabilit)/.test(q)) return content.answers.what
  if (/(bat dau|start|getting started|new user|dung nhu the nao|tu dau)/.test(q)) return content.answers.start
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
