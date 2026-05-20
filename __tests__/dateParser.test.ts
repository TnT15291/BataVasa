import { extractDateFromText } from '../services/dateParser'

// Fix "now" to 2026-05-20 10:00 local so relative + current-year branches are deterministic.
const NOW = new Date(2026, 4, 20, 10, 0, 0)

beforeAll(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
})
afterAll(() => jest.useRealTimers())

/** Compare local Y/M/D (+ optional H) — avoids timezone flakiness from ISO strings. */
function ymd(d: Date) {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}

describe('extractDateFromText — absolute patterns', () => {
  it('parses ISO 2023-02-13', () => {
    expect(ymd(extractDateFromText('paid rent on 2023-02-13'))).toEqual({ y: 2023, m: 2, d: 13 })
  })

  it('parses ISO with slashes 2024/11/05', () => {
    expect(ymd(extractDateFromText('2024/11/05 lunch'))).toEqual({ y: 2024, m: 11, d: 5 })
  })

  it('parses Japanese full 2023年2月13日', () => {
    expect(ymd(extractDateFromText('2023年2月13日 メモ'))).toEqual({ y: 2023, m: 2, d: 13 })
  })

  it('parses Japanese short 2月13日 (current year)', () => {
    expect(ymd(extractDateFromText('2月13日'))).toEqual({ y: 2026, m: 2, d: 13 })
  })

  it('parses Korean full 2022년 7월 9일', () => {
    expect(ymd(extractDateFromText('2022년 7월 9일'))).toEqual({ y: 2022, m: 7, d: 9 })
  })

  it('parses Korean short 7월 9일 (current year)', () => {
    expect(ymd(extractDateFromText('7월 9일 점심'))).toEqual({ y: 2026, m: 7, d: 9 })
  })

  it('parses Vietnamese "ngày 13/2/2023"', () => {
    expect(ymd(extractDateFromText('ngày 13/2/2023 đóng tiền'))).toEqual({ y: 2023, m: 2, d: 13 })
  })

  it('parses Vietnamese "13 tháng 2 năm 2021"', () => {
    expect(ymd(extractDateFromText('13 tháng 2 năm 2021'))).toEqual({ y: 2021, m: 2, d: 13 })
  })

  it('parses Vietnamese "ngày 5/3" without year (current year)', () => {
    expect(ymd(extractDateFromText('ngày 5/3 ăn sáng'))).toEqual({ y: 2026, m: 3, d: 5 })
  })

  it('parses EU-style DD/MM/YYYY 07/04/2020', () => {
    expect(ymd(extractDateFromText('chi tiêu 07/04/2020'))).toEqual({ y: 2020, m: 4, d: 7 })
  })

  it('parses English named month "Feb 13, 2023"', () => {
    expect(ymd(extractDateFromText('paid Feb 13, 2023'))).toEqual({ y: 2023, m: 2, d: 13 })
  })

  it('parses English "13 March" without year (current year)', () => {
    expect(ymd(extractDateFromText('on 13 March'))).toEqual({ y: 2026, m: 3, d: 13 })
  })

  it('parses French "13 février 2023"', () => {
    expect(ymd(extractDateFromText('payé le 13 février 2023'))).toEqual({ y: 2023, m: 2, d: 13 })
  })

  it('rolls DD/MM in the future back to last year', () => {
    // now = 2026-05-20; "25/12" is in the future → previous year
    expect(ymd(extractDateFromText('quà 25/12'))).toEqual({ y: 2025, m: 12, d: 25 })
  })

  it('keeps DD/MM in the past within current year', () => {
    expect(ymd(extractDateFromText('cà phê 10/01'))).toEqual({ y: 2026, m: 1, d: 10 })
  })
})

describe('extractDateFromText — invalid absolute dates fall through to now', () => {
  it('rejects Feb 30 (date wrap guard) and returns now', () => {
    const d = extractDateFromText('2026-02-30 weird')
    expect(ymd(d)).toEqual({ y: 2026, m: 5, d: 20 })
  })
})

describe('extractDateFromText — relative keywords (multi-language)', () => {
  it('yesterday → -1 day at start of day', () => {
    const d = extractDateFromText('hôm qua tôi ăn phở')
    expect(ymd(d)).toEqual({ y: 2026, m: 5, d: 19 })
    expect(d.getHours()).toBe(0)
  })

  it('English "yesterday"', () => {
    expect(ymd(extractDateFromText('paid yesterday'))).toEqual({ y: 2026, m: 5, d: 19 })
  })

  it('day before yesterday → -2 days', () => {
    expect(ymd(extractDateFromText('hôm kia'))).toEqual({ y: 2026, m: 5, d: 18 })
  })

  it('last night → yesterday 20:00', () => {
    const d = extractDateFromText('tối qua nhậu')
    expect(ymd(d)).toEqual({ y: 2026, m: 5, d: 19 })
    expect(d.getHours()).toBe(20)
  })

  it('last week → -7 days', () => {
    expect(ymd(extractDateFromText('last week trip'))).toEqual({ y: 2026, m: 5, d: 13 })
  })

  it('this morning → today 08:00', () => {
    const d = extractDateFromText('sáng nay cà phê')
    expect(ymd(d)).toEqual({ y: 2026, m: 5, d: 20 })
    expect(d.getHours()).toBe(8)
  })

  it('tonight → today 20:00', () => {
    const d = extractDateFromText('tối nay xem phim')
    expect(ymd(d)).toEqual({ y: 2026, m: 5, d: 20 })
    expect(d.getHours()).toBe(20)
  })

  it('Korean "지난 주" (last week)', () => {
    expect(ymd(extractDateFromText('지난 주 여행'))).toEqual({ y: 2026, m: 5, d: 13 })
  })

  it('French "hier" (yesterday)', () => {
    expect(ymd(extractDateFromText('payé hier'))).toEqual({ y: 2026, m: 5, d: 19 })
  })
})

describe('extractDateFromText — no date signal', () => {
  it('returns now when text has no date', () => {
    const d = extractDateFromText('mua cà phê sữa đá')
    expect(ymd(d)).toEqual({ y: 2026, m: 5, d: 20 })
    expect(d.getHours()).toBe(10)
  })
})
