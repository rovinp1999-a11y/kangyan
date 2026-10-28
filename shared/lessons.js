// Lesson dates for students with a regular weekly slot, shared by the API and the pages.
// All dates are Malaysia time (UTC+8, no daylight saving) as 'YYYY-MM-DD' strings.

const MY_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Rule from the FAQ: 1-to-1 lessons can be moved with at least this much notice. */
export const NOTICE_HOURS = 12
/** How far ahead students see (and can change) their lessons. */
export const WEEKS_AHEAD = 6

const iso = (ms) => new Date(ms).toISOString().slice(0, 10)
const parse = (date) => Date.parse(`${date}T00:00:00Z`)

/** Today's date in Malaysia. */
export const todayMY = (now = Date.now()) => iso(now + MY_OFFSET_MS)
export const addDays = (date, n) => iso(parse(date) + n * DAY_MS)
/** 0 = Monday … 6 = Sunday, like the timetable. */
export const weekdayOf = (date) => (new Date(parse(date)).getUTCDay() + 6) % 7
/** Epoch ms when a lesson on `date` at 'HH:MM' (Malaysia time) starts. */
export const startsAt = (date, hhmm) => parse(date) + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))) * 60000 - MY_OFFSET_MS
export const hoursUntil = (date, hhmm, now = Date.now()) => (startsAt(date, hhmm) - now) / 3600000
export const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && iso(parse(v)) === v

/** The next lesson dates for a weekly slot that haven't started yet. */
export function upcomingDates(slot, { from, weeks = WEEKS_AHEAD, now = Date.now() } = {}) {
  if (!slot) return []
  const today = todayMY(now)
  const startFrom = from && from > today ? from : today
  const first = addDays(startFrom, (slot.weekday - weekdayOf(startFrom) + 7) % 7)
  const out = []
  for (let i = 0; i < weeks; i++) {
    const d = addDays(first, i * 7)
    if (startsAt(d, slot.start) > now) out.push(d)
  }
  return out
}

/** Readable date: 'Tue 3 Nov' / '11月3日（周二）'. */
export function dateLabel(date, lang = 'en') {
  const d = new Date(parse(date))
  const wd = weekdayOf(date)
  if (lang === 'zh') return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${['周一', '周二', '周三', '周四', '周五', '周六', '周日'][wd]}）`
  return `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][wd]} ${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`
}
