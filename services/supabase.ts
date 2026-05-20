import 'react-native-url-polyfill/auto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSecure, setSecure, deleteSecure } from './secureStorage'
import { logger } from './logger'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

/** True only when both env vars are present. Gate every cloud call on this. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

// expo-secure-store rejects values > 2 KB on iOS, and Supabase sessions can exceed
// that. Chunk the value across `<key>.0..n` keys with a `<key>.meta` count, so the
// JWT stays in secure storage (never AsyncStorage — see docs/security.md).
const CHUNK = 1800

const chunkedStorage = {
  async getItem(key: string): Promise<string | null> {
    const meta = await getSecure(`${key}.meta`)
    if (meta == null) return null
    const count = parseInt(meta, 10)
    if (!Number.isFinite(count) || count <= 0) return null
    let out = ''
    for (let i = 0; i < count; i++) {
      const part = await getSecure(`${key}.${i}`)
      if (part == null) return null // corrupt / partial write
      out += part
    }
    return out
  },
  async setItem(key: string, value: string): Promise<void> {
    const prev = await getSecure(`${key}.meta`)
    const prevCount = prev ? parseInt(prev, 10) : 0
    const chunks = Math.ceil(value.length / CHUNK) || 1
    for (let i = 0; i < chunks; i++) {
      await setSecure(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
    }
    // Drop any stale chunks left over from a previously larger value.
    for (let i = chunks; i < prevCount; i++) await deleteSecure(`${key}.${i}`)
    await setSecure(`${key}.meta`, String(chunks))
  },
  async removeItem(key: string): Promise<void> {
    const meta = await getSecure(`${key}.meta`)
    const count = meta ? parseInt(meta, 10) : 0
    for (let i = 0; i < count; i++) await deleteSecure(`${key}.${i}`)
    await deleteSecure(`${key}.meta`)
  },
}

/**
 * Supabase client, or `null` when env keys are absent (see docs/auth-setup.md).
 * Consumers MUST null-check; the app degrades to a "backend not configured" state
 * rather than crashing.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        storage: chunkedStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null

if (!isSupabaseConfigured) {
  logger.warn('supabase', 'EXPO_PUBLIC_SUPABASE_URL / ANON_KEY not set — auth disabled')
}
