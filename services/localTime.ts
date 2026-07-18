export function getLocalTzOffset(date = new Date()): string {
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

export function toLocalISOString(date = new Date()): string {
  const tzOffset = getLocalTzOffset(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${tzOffset}`
  )
}

export function localDateString(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function dateOnlyFromAI(value: unknown, fallback?: string): string | null {
  if (!value) return fallback ?? null
  const raw = String(value).trim()
  const datePart = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/)?.[1]
  if (datePart) return datePart

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return localDateString(parsed)
  return fallback ?? null
}

export function parseAIWallTime(value: string): Date {
  if (value.endsWith('Z') || value.endsWith('z')) {
    const wallStr = value.replace(/Z$/i, getLocalTzOffset())
    const local = new Date(wallStr)
    if (!Number.isNaN(local.getTime())) return local
  }
  return new Date(value)
}
