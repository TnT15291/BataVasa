import { subDays, subWeeks, isValid, startOfDay } from 'date-fns'

// Mapping of English and French month name spellings → month number (1-based).
// CJK and Korean months use numeric patterns handled separately.
const NAMED_MONTHS: Record<string, number> = {
  // English
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
  // French
  janvier: 1, 'févr': 2, 'février': 2, fevrier: 2, 'fév': 2, fev: 2,
  mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  'août': 8, aout: 8, septembre: 9, octobre: 10, novembre: 11,
  'décembre': 12, decembre: 12,
}

function makeDate(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month - 1, day)
  // Guard against JS date wrapping (e.g. Feb 30 → Mar 2)
  if (!isValid(d) || d.getMonth() !== month - 1) return null
  return d
}

/**
 * Deterministically extract a date from free-text input.
 * Handles absolute patterns (ISO, DD/MM/YYYY, DD/MM, named months in EN/FR,
 * CJK/Korean numeric month-day patterns, Vietnamese tháng/ngày notation)
 * and relative keywords in all 6 app languages (vi/en/zh/ja/ko/fr).
 * Falls back to `new Date()` when no date signal is found.
 */
export function extractDateFromText(text: string): Date {
  const now = new Date()
  const today = startOfDay(now)
  const t = text.toLowerCase()
  const yr = now.getFullYear()

  // ── Absolute date patterns ───────────────────────────────────────────────

  // ISO: 2023-02-13 or 2023/02/13
  const iso = t.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/)
  if (iso) {
    const d = makeDate(+iso[1], +iso[2], +iso[3])
    if (d) return d
  }

  // Japanese: 2023年2月13日 or 2月13日
  const jpFull = t.match(/(20\d{2})年(0?[1-9]|1[0-2])月(0?[1-9]|[12]\d|3[01])日/)
  if (jpFull) { const d = makeDate(+jpFull[1], +jpFull[2], +jpFull[3]); if (d) return d }
  const jpShort = t.match(/(0?[1-9]|1[0-2])月(0?[1-9]|[12]\d|3[01])日/)
  if (jpShort) { const d = makeDate(yr, +jpShort[1], +jpShort[2]); if (d) return d }

  // Korean: 2023년 2월 13일 or 2월 13일
  const krFull = t.match(/(20\d{2})년\s*(0?[1-9]|1[0-2])월\s*(0?[1-9]|[12]\d|3[01])일/)
  if (krFull) { const d = makeDate(+krFull[1], +krFull[2], +krFull[3]); if (d) return d }
  const krShort = t.match(/(0?[1-9]|1[0-2])월\s*(0?[1-9]|[12]\d|3[01])일/)
  if (krShort) { const d = makeDate(yr, +krShort[1], +krShort[2]); if (d) return d }

  // Vietnamese: ngày D/M/YYYY or D tháng M năm YYYY or D tháng M
  const viSlash = t.match(/ngày\s+(0?[1-9]|[12]\d|3[01])[/\-](0?[1-9]|1[0-2])(?:[/\-](20\d{2}))?/)
  if (viSlash) {
    const d = makeDate(viSlash[3] ? +viSlash[3] : yr, +viSlash[2], +viSlash[1])
    if (d) return d
  }
  const viText = t.match(/(0?[1-9]|[12]\d|3[01])\s+tháng\s+(0?[1-9]|1[0-2])(?:\s+năm\s+(20\d{2}))?/)
  if (viText) {
    const d = makeDate(viText[3] ? +viText[3] : yr, +viText[2], +viText[1])
    if (d) return d
  }

  // DD/MM/YYYY or D/M/YYYY (EU style)
  const dmy = t.match(/\b(0?[1-9]|[12]\d|3[01])[/\-](0?[1-9]|1[0-2])[/\-](20\d{2})\b/)
  if (dmy) {
    const d = makeDate(+dmy[3], +dmy[2], +dmy[1])
    if (d) return d
  }

  // English/French named month: "Feb 13", "13 Feb", "Feb 13, 2023", "13 février 2023"
  const mnPat = Object.keys(NAMED_MONTHS).join('|')
  const monthDay = t.match(new RegExp(`\\b(${mnPat})\\s+(\\d{1,2})(?:[, ]+(20\\d{2}))?\\b`))
  if (monthDay) {
    const m = NAMED_MONTHS[monthDay[1]]
    const d = makeDate(monthDay[3] ? +monthDay[3] : yr, m, +monthDay[2])
    if (d) return d
  }
  const dayMonth = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${mnPat})(?:\\s+(20\\d{2}))?\\b`))
  if (dayMonth) {
    const m = NAMED_MONTHS[dayMonth[2]]
    const d = makeDate(dayMonth[3] ? +dayMonth[3] : yr, m, +dayMonth[1])
    if (d) return d
  }

  // DD/MM (current year, "/" only — hyphen is too ambiguous in free text)
  const dm = t.match(/\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\b/)
  if (dm) {
    const d = makeDate(yr, +dm[2], +dm[1])
    if (d) {
      if (d > now) return makeDate(yr - 1, +dm[2], +dm[1]) ?? now
      return d
    }
  }

  // ── Relative keywords (order matters: most-specific first) ───────────────

  // Day before yesterday: hôm kia · day before yesterday · 前天 · 그제/그저께 · avant-hier · 一昨日/おととい
  if (/(hôm kia|hom kia|day before yesterday|前天|그제|그저께|avant.hier|一昨日|おととい)/.test(t)) {
    return subDays(today, 2)
  }

  // Last night: tối qua · last night · 昨夜/昨晩 · 어젯밤 · hier soir
  if (/(tối qua|toi qua|last night|昨夜|昨晩|어젯밤|hier soir)/.test(t)) {
    const d = new Date(subDays(today, 1))
    d.setHours(20, 0, 0, 0)
    return d
  }

  // Yesterday: hôm qua · yesterday · 昨日 · 어제 · hier
  if (/(hôm qua|hom qua|\byesterday\b|昨日|어제|\bhier\b)/.test(t)) {
    return subDays(today, 1)
  }

  // Last week: tuần trước · last week · 先週 · 지난 주 · semaine dernière · 上周/上週
  if (/(tuần trước|tuan truoc|last week|先週|지난\s*주|semaine\s+derni|上周|上週)/.test(t)) {
    return subWeeks(today, 1)
  }

  // This morning: sáng nay · this morning · 今朝/今天早上 · 오늘 아침 · ce matin
  if (/(sáng nay|sang nay|this morning|今朝|今天早上|오늘\s*아침|ce matin)/.test(t)) {
    const d = new Date(today)
    d.setHours(8, 0, 0, 0)
    return d
  }

  // This evening / tonight: tối nay · tonight · 今夜/今晚 · 오늘 밤 · ce soir
  if (/(tối nay|toi nay|\btonight\b|this evening|今夜|今晚|오늘\s*밤|ce soir)/.test(t)) {
    const d = new Date(today)
    d.setHours(20, 0, 0, 0)
    return d
  }

  return now
}
