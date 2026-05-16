export type AppErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DUPLICATE'
  | 'DB_ERROR'
  | 'NETWORK_ERROR'
  | 'AI_BUDGET_EXCEEDED'
  | 'UPSTREAM_AI_ERROR'
  | 'AUTH_REQUIRED'
  | 'AUTH_FORBIDDEN'
  | 'INTERNAL'

export type AppError = {
  code: AppErrorCode
  message: string
  cause?: unknown
}

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })

export const err = <E = AppError>(error: E): Result<never, E> => ({ ok: false, error })

export const appErr = (code: AppErrorCode, message: string, cause?: unknown): Result<never, AppError> =>
  err({ code, message, cause })

export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`)
  return r.value
}
