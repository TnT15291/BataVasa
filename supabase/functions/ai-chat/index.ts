// ai-chat — authenticated chat-completion proxy.
//
// The publisher's provider API key lives as a Supabase secret and is used ONLY
// here. The app calls this with the signed-in user's JWT (verify_jwt = true, so
// the platform rejects anonymous calls before this code runs). The active
// provider is decided server-side from Supabase Auth app_metadata.plan. The
// AI_PROVIDER secret remains an emergency/global override.
// Providers: openai | gemini | groq | deepseek | openrouter | nvidia (see _shared/providers.ts).
//
// Request body: { provider?, messages, model?, temperature?, max_tokens? }
// Response:     { content } | { error }

import { corsHeaders, json } from '../_shared/cors.ts'
import { PROVIDERS, resolveModel, resolveProvider } from '../_shared/providers.ts'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

async function getUserPlan(req: Request): Promise<string> {
  const auth = req.headers.get('authorization') || ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!auth || !supabaseUrl || !anonKey) return 'free'

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      authorization: auth,
      apikey: anonKey,
    },
  })

  if (!res.ok) return 'free'

  const user = await res.json().catch(() => null)
  return user?.app_metadata?.plan || 'free'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: 'messages required' }, 400)
    }

    const userPlan = await getUserPlan(req)
    const provider = resolveProvider(userPlan, body.provider)
    const cfg = PROVIDERS[provider]
    const key = Deno.env.get(cfg.keyEnv)
    if (!key) {
      // Publisher hasn't set this provider's secret. Surfaces as a generic AI
      // error in the app (see services/ai/openai.ts).
      return json({ error: `AI not configured (${provider})` }, 503)
    }

    // Model override precedence: server AI_MODEL secret → provider default.
    // The client never sends a provider-specific model today, so we ignore
    // body.model to avoid cross-provider model mismatches.
    const model = resolveModel(provider)

    const upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: body.messages as ChatMessage[],
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
        max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 1500,
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      console.error(`provider ${provider} error ${upstream.status}: ${detail.slice(0, 500)}`)
      return json({ error: `Provider error ${upstream.status} [${provider}/${model}]: ${detail.slice(0, 200)}` }, 502)
    }

    const data = await upstream.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    return json({ content })
  } catch (e) {
    console.error('ai-chat failure', e)
    return json({ error: (e as Error)?.message ?? 'Unknown error' }, 500)
  }
})
