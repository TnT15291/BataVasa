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

// Tries OpenAI Whisper first, falls back to Groq Whisper (both are OpenAI-compatible)
export async function transcribeAudio(uri: string, language: string): Promise<string | null> {
  const openaiKey = await getSecure('openai_api_key')
  const groqKey = await getSecure('groq_api_key')
  if (!openaiKey && !groqKey) return null

  const endpoint = openaiKey
    ? 'https://api.openai.com/v1/audio/transcriptions'
    : 'https://api.groq.com/openai/v1/audio/transcriptions'
  const apiKey = (openaiKey ?? groqKey)!
  const model = openaiKey ? 'whisper-1' : 'whisper-large-v3-turbo'

  const formData = new FormData()
  formData.append('file', { uri, type: 'audio/m4a', name: 'audio.m4a' } as any)
  formData.append('model', model)
  formData.append('language', language.slice(0, 2)) // 'vi' → 'vi', already correct

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
      return null
    }
    const data = await res.json()
    return (data.text as string)?.trim() || null
  } catch (e) {
    logger.error('voice', 'transcribe failed', { error: String(e) })
    return null
  }
}

export async function hasVoiceKey(): Promise<boolean> {
  const [ok, gk] = await Promise.all([getSecure('openai_api_key'), getSecure('groq_api_key')])
  return !!(ok || gk)
}
