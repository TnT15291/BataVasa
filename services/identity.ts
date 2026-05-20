import { useAuthStore } from '@store/authStore'

/**
 * The owning user_id to stamp on new rows. Returns the authenticated Supabase
 * user id, or `null` when not signed in (e.g. backend not configured).
 *
 * With the login-wall launch flow, a session is always present when writes occur,
 * so in practice this returns a real id. Kept null-safe so services never throw.
 */
export function getCurrentUserId(): string | null {
  return useAuthStore.getState().session?.user?.id ?? null
}
