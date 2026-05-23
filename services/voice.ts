import { Audio } from 'expo-av'
import { getSecure } from '@services/secureStorage'
import { logger } from '@services/logger'

let _recording: Audio.Recording | null = null
const TRANSCRIBE_TIMEOUT_MS = 30000

export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync()
  return status === 'granted'
}

export async function startRecording(): Promise<void> {
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  )
  _recording = recording
}

export async function stopRecording(): Promise<string | null> {
  if (!_recording) return null
  const rec = _recording
  _recording = null
  await rec.stopAndUnloadAsync()
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
  return rec.getURI() ?? null
}

function withTimeout<T>(promise: Promise<T>, ms: number, controller: AbortController): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort()
      reject(new Error('VOICE_TIMEOUT'))
    }, ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

// Whisper hallucinates fixed phrases when fed silence/noise — it was trained on
// YouTube captions, so on an empty clip it emits the most common outros from its
// training data (Vietnamese: "Hãy subscribe cho kênh Ghiền Mì Gõ…"; English:
// "Thanks for watching"). Strip diacritics + lowercase, then match a denylist of
// these known phantom phrases. No real finance/habit/journal voice note contains
// them, so dropping them is safe.
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const HALLUCINATION_PHRASES = [
  'ghien mi go',
  'subscribe cho kenh',
  'dang ky kenh',
  'nhan chuong',
  'cam on cac ban da theo doi',
  'cam on cac ban da xem',
  'hen gap lai cac ban',
  // English Whisper silence hallucinations
  'thanks for watching',
  'thank you for watching',
  'please subscribe',
  'subscribe to my channel',
].map(normalizeForMatch)

function isHallucination(text: string): boolean {
  const n = normalizeForMatch(text)
  if (!n) return true
  return HALLUCINATION_PHRASES.some((p) => n.includes(p))
}

// A clip with no real speech: every Whisper segment reports a high no-speech
// probability. Whisper's own decoder uses 0.6 as the silence threshold; real
// speech segments sit far below it (typically < 0.2), so this won't drop genuine
// input even when the provider omits the field.
function hasNoSpeech(segments: unknown): boolean {
  if (!Array.isArray(segments) || segments.length === 0) return false
  return segments.every(
    (s) => typeof s?.no_speech_prob === 'number' && s.no_speech_prob > 0.6
  )
}

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'no_speech' | 'error' }

// Tries OpenAI Whisper first, falls back to Groq Whisper (both are OpenAI-compatible)
export async function transcribeAudio(uri: string, language: string): Promise<TranscribeResult> {
  const openaiKey = await getSecure('openai_api_key')
  const groqKey = await getSecure('groq_api_key')
  if (!openaiKey && !groqKey) return { ok: false, reason: 'error' }

  const endpoint = openaiKey
    ? 'https://api.openai.com/v1/audio/transcriptions'
    : 'https://api.groq.com/openai/v1/audio/transcriptions'
  const apiKey = (openaiKey ?? groqKey)!
  const model = openaiKey ? 'whisper-1' : 'whisper-large-v3-turbo'

  const formData = new FormData()
  formData.append('file', { uri, type: 'audio/m4a', name: 'audio.m4a' } as any)
  formData.append('model', model)
  formData.append('language', language.slice(0, 2)) // 'vi' → 'vi', already correct
  // verbose_json exposes per-segment no_speech_prob; temperature 0 disables the
  // decoder's temperature-fallback, which is the main driver of hallucinations.
  formData.append('response_format', 'verbose_json')
  formData.append('temperature', '0')

  try {
    const controller = new AbortController()
    const res = await withTimeout(fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    }), TRANSCRIBE_TIMEOUT_MS, controller)
    if (!res.ok) {
      logger.warn('voice', `Whisper error ${res.status}`)
      return { ok: false, reason: 'error' }
    }
    const data = await res.json()
    const text = (data.text as string)?.trim() || ''
    // Empty text or an all-silence clip → the user didn't actually speak.
    if (!text || hasNoSpeech(data.segments)) {
      logger.warn('voice', 'dropped no-speech transcription (silence)')
      return { ok: false, reason: 'no_speech' }
    }
    // A known phantom phrase from a silent clip is also "no speech", not an error.
    if (isHallucination(text)) {
      logger.warn('voice', 'dropped hallucinated transcription')
      return { ok: false, reason: 'no_speech' }
    }
    return { ok: true, text }
  } catch (e) {
    logger.error('voice', 'transcribe failed', { error: String(e) })
    return { ok: false, reason: 'error' }
  }
}

export async function hasVoiceKey(): Promise<boolean> {
  const [ok, gk] = await Promise.all([getSecure('openai_api_key'), getSecure('groq_api_key')])
  return !!(ok || gk)
}
