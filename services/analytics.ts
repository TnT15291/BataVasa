import { logger } from '@services/logger'

type SentryApi = {
  addBreadcrumb: (breadcrumb: Record<string, unknown>) => void
}

declare const require: ((id: string) => SentryApi) | undefined

export type AnalyticsEvent =
  | 'app_open'
  | 'app_background'
  | 'auth_signup'
  | 'auth_login'
  | 'auth_logout'
  | 'auth_password_reset'
  | 'transaction_created'
  | 'data_exported'
  | 'data_deleted'
  | 'report_generated'
  | 'voice_started'
  | 'voice_transcribed'
  | 'voice_failed'
  | 'insight_generated'
  | 'sync_failed'
  | 'feature_used'

export type AnalyticsProps = {
  app_open: Record<string, never>
  app_background: Record<string, never>
  auth_signup: Record<string, never>
  auth_login: Record<string, never>
  auth_logout: Record<string, never>
  auth_password_reset: Record<string, never>
  transaction_created: { category_kind?: string; source?: string }
  data_exported: { module?: string; item_count?: number }
  data_deleted: { module?: string; item_count?: number }
  report_generated: { module?: string; kind?: string; item_count?: number }
  voice_started: { module?: string }
  voice_transcribed: { module?: string; duration_ms?: number }
  voice_failed: { module?: string; reason?: string }
  insight_generated: { module?: string; kind?: string; cache_hit?: boolean }
  sync_failed: { table?: string; error_code?: string }
  feature_used: { feature_name?: string }
}

type AnalyticsTransport = <E extends AnalyticsEvent>(
  event: E,
  props: AnalyticsProps[E]
) => void | Promise<void>

const ALLOWED_KEYS: { [E in AnalyticsEvent]: ReadonlyArray<keyof AnalyticsProps[E]> } = {
  app_open: [],
  app_background: [],
  auth_signup: [],
  auth_login: [],
  auth_logout: [],
  auth_password_reset: [],
  transaction_created: ['category_kind', 'source'],
  data_exported: ['module', 'item_count'],
  data_deleted: ['module', 'item_count'],
  report_generated: ['module', 'kind', 'item_count'],
  voice_started: ['module'],
  voice_transcribed: ['module', 'duration_ms'],
  voice_failed: ['module', 'reason'],
  insight_generated: ['module', 'kind', 'cache_hit'],
  sync_failed: ['table', 'error_code'],
  feature_used: ['feature_name'],
}

const PII_KEY_PATTERN = /amount|merchant|note|content|body|journal|mood|email|phone|location|lat|lng/i
let transport: AnalyticsTransport | null = null

function getSentry(): SentryApi | null {
  try {
    return typeof require === 'function' ? require('@sentry/react-native') : null
  } catch {
    return null
  }
}

export function setAnalyticsTransport(next: AnalyticsTransport | null) {
  transport = next
}

export function sanitizeAnalyticsProps<E extends AnalyticsEvent>(
  event: E,
  props?: Partial<Record<string, unknown>>
): AnalyticsProps[E] {
  const allowed = new Set<string>(ALLOWED_KEYS[event] as string[])
  const safe: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props ?? {})) {
    if (!allowed.has(key)) continue
    if (PII_KEY_PATTERN.test(key)) continue
    if (value == null) continue
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safe[key] = value
    }
  }

  return safe as AnalyticsProps[E]
}

export function track<E extends AnalyticsEvent>(event: E, props?: Partial<AnalyticsProps[E]>) {
  const safe = sanitizeAnalyticsProps(event, props as Partial<Record<string, unknown>>)

  try {
    getSentry()?.addBreadcrumb({ category: 'analytics', message: event, data: safe, level: 'info' })
    void transport?.(event, safe)
  } catch (e) {
    logger.warn('analytics', 'track failed', { event, error: String(e) })
  }
}
