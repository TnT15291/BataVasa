import { isExpoGo } from './expoGo'

type SentryApi = {
  init?: (options: Record<string, unknown>) => void
  captureException?: (error: unknown, context?: Record<string, unknown>) => void
}

declare const require: ((id: string) => SentryApi) | undefined

let cached: SentryApi | null | undefined

function getSentry(): SentryApi | null {
  if (isExpoGo()) return null
  if (cached !== undefined) return cached
  try {
    cached = typeof require === 'function' ? require('@sentry/react-native') : null
  } catch {
    cached = null
  }
  return cached
}

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN
  if (!dsn) return
  getSentry()?.init?.({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 0 : 0.2,
  })
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try {
    getSentry()?.captureException?.(error, context)
  } catch {}
}
