// Server-side provider registry. Mirrors `services/ai/providers.ts` but holds
// only what the proxy needs: the OpenAI-compatible base URL, a default model,
// and which secret holds the key. Keys themselves are NEVER in source — they are
// read from Supabase secrets (Deno.env) at request time.

export type ProviderId = 'openai' | 'gemini' | 'groq' | 'deepseek'
export type UserPlan = 'free' | 'pro'

export type ServerProvider = {
  baseUrl: string
  defaultModel: string
  keyEnv: string
}

export const PROVIDERS: Record<ProviderId, ServerProvider> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyEnv: 'OPENAI_API_KEY',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    keyEnv: 'GEMINI_API_KEY',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    keyEnv: 'GROQ_API_KEY',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyEnv: 'DEEPSEEK_API_KEY',
  },
}

export function normalizePlan(value?: unknown): UserPlan {
  return String(value || '').toLowerCase() === 'pro' ? 'pro' : 'free'
}

/**
 * Resolve which provider to use. `AI_PROVIDER` is a server-side emergency/global
 * override; when unset, user plan routing decides: free -> Groq, pro -> DeepSeek.
 */
export function resolveProvider(userPlan?: unknown, clientProvider?: string): ProviderId {
  const forced = Deno.env.get('AI_PROVIDER')
  if (forced) {
    const candidate = forced.toLowerCase()
    return (candidate in PROVIDERS ? candidate : 'groq') as ProviderId
  }

  const plan = normalizePlan(userPlan)
  if (plan === 'pro') return 'deepseek'

  return 'groq'
}

export function resolveModel(provider: ProviderId): string {
  const providerModel = Deno.env.get(`${provider.toUpperCase()}_MODEL`)
  return providerModel || Deno.env.get('AI_MODEL') || PROVIDERS[provider].defaultModel
}
