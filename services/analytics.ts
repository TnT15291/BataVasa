import * as Sentry from '@sentry/react-native'
import { logger } from '@services/logger'

export type AnalyticsEvent =
  | 'app_open'
  | 'app_background'
  | 'auth_signup'
  | 'auth_login'
  | 'auth_logout'
  | 'transaction_created'
  | 'insight_generated'
  | 'sync_failed'
  | 'feature_used'

export type AnalyticsProps = {
  app_open: Record<string, never>
  app_background: Record<string, never>
  auth_signup: Record<string, never>
  auth_login: Record<string, never>
  auth_logout: Record<string, never>
  transaction_created: { category_kind?: string; source?: string }
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
  transaction_created: ['category_kind', 'source'],
  insight_generated: ['module', 'kind', 'cache_hit'],
  sync_failed: ['table', 'error_code'],
  feature_used: ['feature_name'],
}

const PII_KEY_PATTERN = /amount|merchant|note|content|body|journal|mood|email|phone|location|lat|lng/i
let transport: AnalyticsTransport | null = null

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
    Sentry.addBreadcrumb({ category: 'analytics', message: event, data: safe, level: 'info' })
    void transport?.(event, safe)
  } catch (e) {
    logger.warn('analytics', 'track failed', { event, error: String(e) })
  }
}
