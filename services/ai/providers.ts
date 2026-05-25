export type AIProvider = 'openai' | 'gemini' | 'groq' | 'deepseek'

export type ProviderConfig = {
  id: AIProvider
  name: string
  baseUrl: string
  defaultModel: string
  models: Array<{ id: string; label: string }>
  keyStore: string
  keyPrefix: string
  registerUrl: string
  badge: string
}

export const AI_PROVIDERS: Record<AIProvider, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini (fast & cheap)' },
      { id: 'gpt-4o', label: 'GPT-4o (most capable)' },
    ],
    keyStore: 'openai_api_key',
    keyPrefix: 'sk-',
    registerUrl: 'platform.openai.com',
    badge: '🟢',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (free tier)' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (stable)' },
    ],
    keyStore: 'gemini_api_key',
    keyPrefix: 'AIza',
    registerUrl: 'aistudio.google.com',
    badge: '🔵',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (free + fast)' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (ultra-fast)' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
    keyStore: 'groq_api_key',
    keyPrefix: 'gsk_',
    registerUrl: 'console.groq.com',
    badge: '🟡',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek V3 (cheap & capable)' },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1 (reasoning)' },
    ],
    keyStore: 'deepseek_api_key',
    keyPrefix: 'sk-',
    registerUrl: 'platform.deepseek.com',
    badge: '🔴',
  },
}

export const PROVIDER_ORDER: AIProvider[] = ['openai', 'gemini', 'groq', 'deepseek']
