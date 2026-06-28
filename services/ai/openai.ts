import { supabase, isSupabaseConfigured } from '@services/supabase'

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

  // The provider is decided server-side (AI_PROVIDER secret / user plan); the
  // Edge Function ignores any client-sent provider, so we don't send one.
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
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
