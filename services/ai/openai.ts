import { getSecure, setSecure, deleteSecure } from '@services/secureStorage'
import { AI_PROVIDERS, type AIProvider } from './providers'
import { useSettingsStore } from '@store/settingsStore'

// ── Key management (per-provider) ─────────────────────────────────────────

export async function getProviderKey(provider: AIProvider): Promise<string | null> {
  return getSecure(AI_PROVIDERS[provider].keyStore)
}

export async function saveProviderKey(provider: AIProvider, key: string): Promise<void> {
  await setSecure(AI_PROVIDERS[provider].keyStore, key.trim())
}

export async function deleteProviderKey(provider: AIProvider): Promise<void> {
  await deleteSecure(AI_PROVIDERS[provider].keyStore)
}

export async function getKeysStatus(): Promise<Record<AIProvider, boolean>> {
  const entries = await Promise.all(
    (['openai', 'gemini', 'groq', 'deepseek'] as AIProvider[]).map(async (p) => {
      const key = await getProviderKey(p)
      return [p, !!key] as const
    })
  )
  return Object.fromEntries(entries) as Record<AIProvider, boolean>
}

// Backward compat — uses active provider
export async function getApiKey(): Promise<string | null> {
  const provider = useSettingsStore.getState().aiProvider
  return getProviderKey(provider)
}

export async function saveApiKey(key: string): Promise<void> {
  const provider = useSettingsStore.getState().aiProvider
  await saveProviderKey(provider, key)
}

export async function deleteApiKey(): Promise<void> {
  const provider = useSettingsStore.getState().aiProvider
  await deleteProviderKey(provider)
}

// ── Chat completion ────────────────────────────────────────────────────────

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; max_tokens?: number }
): Promise<string> {
  const provider = useSettingsStore.getState().aiProvider
  const config = AI_PROVIDERS[provider]

  const key = await getProviderKey(provider)
  if (!key) throw new Error('NO_API_KEY')

  const model = opts?.model ?? config.defaultModel

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.max_tokens ?? 1500,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as any)?.error?.message ?? `API error ${res.status}`
    throw new Error(msg)
  }

  const data = await res.json()
  return (data.choices?.[0]?.message?.content as string) ?? ''
}
