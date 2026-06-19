// ai-transcribe — authenticated Whisper transcription proxy.
//
// Reuses the OpenAI key (Whisper, preferred) and falls back to Groq's
// whisper-large-v3. The app posts multipart form-data (file, language, prompt)
// with the signed-in user's JWT (verify_jwt = true).
//
// Response: { text, segments } | { error }

import { corsHeaders, json } from '../_shared/cors.ts'

const OPENAI = {
  endpoint: 'https://api.openai.com/v1/audio/transcriptions',
  model: 'whisper-1',
  keyEnv: 'OPENAI_API_KEY',
}
const GROQ = {
  endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
  model: 'whisper-large-v3',
  keyEnv: 'GROQ_API_KEY',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return json({ error: 'file required' }, 400)
    }
    const language = (form.get('language') as string | null)?.slice(0, 2) || 'en'
    const prompt = (form.get('prompt') as string | null) || ''

    // OpenAI Whisper preferred; Groq fallback.
    const openaiKey = Deno.env.get(OPENAI.keyEnv)
    const groqKey = Deno.env.get(GROQ.keyEnv)
    const target = openaiKey
      ? { ...OPENAI, key: openaiKey }
      : groqKey
        ? { ...GROQ, key: groqKey }
        : null
    if (!target) {
      return json({ error: 'Transcription not configured' }, 503)
    }

    const upstream = new FormData()
    upstream.append('file', file, 'audio.m4a')
    upstream.append('model', target.model)
    upstream.append('language', language)
    if (prompt) upstream.append('prompt', prompt)
    // verbose_json yields per-segment data so the client can drop silent clips.
    upstream.append('response_format', 'verbose_json')

    const res = await fetch(target.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${target.key}` },
      body: upstream,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`transcribe error ${res.status}: ${detail.slice(0, 500)}`)
      return json({ error: `Transcribe error ${res.status}` }, 502)
    }

    const data = await res.json()
    return json({ text: data?.text ?? '', segments: data?.segments ?? [] })
  } catch (e) {
    console.error('ai-transcribe failure', e)
    return json({ error: (e as Error)?.message ?? 'Unknown error' }, 500)
  }
})
