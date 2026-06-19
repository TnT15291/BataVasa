// Server-side provider registry. Mirrors `services/ai/providers.ts` but holds
// only what the proxy needs: the OpenAI-compatible base URL, a default model,
// and which secret holds the key. Keys themselves are NEVER in source — they are
// read from Supabase secrets (Deno.env) at request time.

export type ProviderId = 'openai' | 'gemini' | 'groq' | 'deepseek'

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

/**
 * Resolve which provider to use. The publisher controls this server-side via the
 * `AI_PROVIDER` secret; the client-sent value is only a fallback (and the chooser
 * UI was removed, so in practice it is always the store default). Defaults to
 * OpenAI.
 */
export function resolveProvider(clientProvider?: string): ProviderId {
  const candidate = (Deno.env.get('AI_PROVIDER') || clientProvider || 'openai')
    .toLowerCase()
  return (candidate in PROVIDERS ? candidate : 'openai') as ProviderId
}
