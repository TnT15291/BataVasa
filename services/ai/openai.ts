import { supabase, isSupabaseConfigured } from '@services/supabase'
import { useSettingsStore } from '@store/settingsStore'
import type { AIProvider } from './providers'

// AI keys are NOT stored on the device anymore. They live as Supabase secrets and
// are used only inside the `ai-chat` / `ai-transcribe` Edge Functions, which the
// app calls with the signed-in user's token. See docs/ai-integration.md.

/**
 * Whether AI features can run. They route through the Supabase Edge Function
 * proxy, so availability == backend configured (and, in practice, a signed-in
 * session — guaranteed behind the app's login wall).
 */
export function isAiAvailable(): boolean {
  return isSupabaseConfigured
}

/**
 * @deprecated Provider API keys are now held server-side by the Edge Function
 * proxy; the app never sees them. This shim only reports availability so the
 * legacy pre-flight `if (!key)` gates across feature screens keep working.
 * New code should call {@link isAiAvailable} instead.
 */
export async function getProviderKey(_provider?: AIProvider): Promise<string | null> {
  return isAiAvailable() ? 'server' : null
}

// ── Chat completion (via Edge Function proxy) ───────────────────────────────

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; max_tokens?: number }
): Promise<string> {
  if (!supabase) throw new Error('NO_BACKEND')
  const provider = useSettingsStore.getState().aiProvider

  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      provider,
      messages,
      model: opts?.model,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.max_tokens ?? 1500,
    },
  })

  if (error) {
    // FunctionsHttpError carries the response; pull the server's error message.
    let msg = error.message
    try {
      const ctx = (error as { context?: Response }).context
      const j = ctx ? await ctx.json() : null
      if (j?.error) msg = j.error
    } catch {
      // keep the generic message
    }
    throw new Error(msg)
  }

  return (data?.content as string) ?? ''
}
