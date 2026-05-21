type SentryApi = {
  addBreadcrumb: (breadcrumb: Record<string, unknown>) => void
  captureMessage: (message: string, level?: string) => void
}

declare const require: ((id: string) => SentryApi) | undefined

type Level = 'debug' | 'info' | 'warn' | 'error'

const PII_KEYS = [
  'amount_cents',
  'merchant',
  'note',
  'body',
  'email',
  'phone',
  'location_lat',
  'location_lng',
  'location_label',
] as const

function scrub(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    out[k] = (PII_KEYS as readonly string[]).includes(k) ? '[redacted]' : v
  }
  return out
}

function getSentry(): SentryApi | null {
  try {
    return typeof require === 'function' ? require('@sentry/react-native') : null
  } catch {
    return null
  }
}

function log(level: Level, module: string, msg: string, meta?: Record<string, unknown>) {
  if (level === 'debug' && !__DEV__) return
  const safe = scrub(meta)
  const tag = `[${module}]`
  if (level === 'error') console.error(tag, msg, safe ?? '')
  else if (level === 'warn') console.warn(tag, msg, safe ?? '')
  else console.log(tag, msg, safe ?? '')

  if (level === 'warn' || level === 'error') {
    try {
      const Sentry = getSentry()
      if (!Sentry) return
      Sentry.addBreadcrumb({ level: level === 'error' ? 'error' : 'warning', message: `${tag} ${msg}`, data: safe })
      if (level === 'error') Sentry.captureMessage(`${tag} ${msg}`, 'error')
    } catch {}
  }
}

export const logger = {
  debug: (module: string, msg: string, meta?: Record<string, unknown>) => log('debug', module, msg, meta),
  info: (module: string, msg: string, meta?: Record<string, unknown>) => log('info', module, msg, meta),
  warn: (module: string, msg: string, meta?: Record<string, unknown>) => log('warn', module, msg, meta),
  error: (module: string, msg: string, meta?: Record<string, unknown>) => log('error', module, msg, meta),
}
