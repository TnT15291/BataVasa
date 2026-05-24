import type { Translations } from '@services/i18n'
import { logger } from '@services/logger'

/** Loose shape — accepts Supabase `AuthError` or any `{ code, message }`. */
type AuthErrorLike = { code?: string | null; message?: string; status?: number }

/**
 * Map a Supabase auth error to a calm, localized message.
 *
 * Prefers the stable `error.code` (e.g. `over_email_send_rate_limit`) and falls
 * back to substring matching for older error shapes that only carry `message`.
 * Unknown errors log for observability (Rule 8) and show a generic localized
 * message rather than a raw English string (Rule 2 — language applies everywhere).
 */
export function localizeAuthError(error: AuthErrorLike, t: Translations): string {
  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()

  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    code === 'over_sms_send_rate_limit' ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  ) {
    return t.auth_error_rate_limit
  }
  if (
    code === 'invalid_credentials' ||
    code === 'invalid_login_credentials' ||
    msg.includes('invalid login credentials')
  ) {
    return t.auth_error_invalid_credentials
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return t.auth_error_email_not_confirmed
  }
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    msg.includes('already registered') ||
    msg.includes('already been registered')
  ) {
    return t.auth_error_email_exists
  }
  if (code === 'weak_password' || msg.includes('password should be') || msg.includes('weak password')) {
    return t.auth_error_weak_password
  }
  if (code === 'same_password' || msg.includes('different from the old password')) {
    return t.auth_error_same_password
  }
  if (
    code === 'validation_failed' ||
    msg.includes('unable to validate email') ||
    msg.includes('invalid email')
  ) {
    return t.auth_error_invalid_email
  }

  logger.warn('auth.error', 'unmapped auth error', { code, message: error.message })
  return t.auth_error_generic
}
