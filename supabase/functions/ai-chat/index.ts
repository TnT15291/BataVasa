// ai-chat — authenticated chat-completion proxy.
//
// The publisher's provider API key lives as a Supabase secret and is used ONLY
// here. The app calls this with the signed-in user's JWT (verify_jwt = true, so
// the platform rejects anonymous calls before this code runs). The active
// provider is decided server-side via the AI_PROVIDER secret.
//
// Request body: { provider?, messages, model?, temperature?, max_tokens? }
// Response:     { content } | { error }

import { corsHeaders, json } from '../_shared/cors.ts'
import { PROVIDERS, resolveProvider } from '../_shared/providers.ts'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: 'messages required' }, 400)
    }

    const provider = resolveProvider(body.provider)
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
    const model = Deno.env.get('AI_MODEL') || cfg.defaultModel

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
      return json({ error: `Provider error ${upstream.status}` }, 502)
    }

    const data = await upstream.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    return json({ content })
  } catch (e) {
    console.error('ai-chat failure', e)
    return json({ error: (e as Error)?.message ?? 'Unknown error' }, 500)
  }
})
