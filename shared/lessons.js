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

/**
 * Does this weekly lesson happen on `date`? A weekly lesson can start (`from`) or stop
 * (`until`) on a date, which is how "this and all following lessons" changes are kept.
 */
export const covers = (l, date) => l && weekdayOf(date) === l.weekday && (!l.from || date >= l.from) && (!l.until || date <= l.until)

/** The next lesson dates for a weekly slot or lesson that haven't started yet (respects its from / until). */
export function upcomingDates(slot, { from, weeks = WEEKS_AHEAD, now = Date.now() } = {}) {
  if (!slot) return []
  const today = todayMY(now)
  let startFrom = from && from > today ? from : today
  if (slot.from && slot.from > startFrom) startFrom = slot.from
  const first = addDays(startFrom, (slot.weekday - weekdayOf(startFrom) + 7) % 7)
  const out = []
  for (let i = 0; i < weeks; i++) {
    const d = addDays(first, i * 7)
    if (slot.until && d > slot.until) break
    if (d >= addDays(today, weeks * 7)) break // stay inside the window even when the lesson starts later
    if (startsAt(d, slot.start) > now) out.push(d)
  }
  return out
}

/**
 * A weekly lesson's class type: 'private' (1-to-1) or 'group'. Lessons saved before each one
 * had its own type follow the student's.
 */
export const kindOf = (l, student) => (l?.kind === 'group' || l?.kind === 'private' ? l.kind : student?.lesson_type === 'group' ? 'group' : 'private')

/** The student's overall type from the weekly lessons still going: 'private', 'group' or 'both'. */
export function typeOf(lessons, fallback = 'private', today = todayMY()) {
  const kinds = new Set((lessons || []).filter((l) => !l.until || l.until >= today).map((l) => kindOf(l, { lesson_type: fallback })))
  return kinds.size > 1 ? 'both' : kinds.size ? [...kinds][0] : fallback === 'group' ? 'group' : fallback === 'both' ? 'both' : 'private'
}

/** First date on or after `date` that falls on `weekday` (0 = Monday). */
export const firstOn = (date, weekday) => addDays(date, (weekday - weekdayOf(date) + 7) % 7)

/** Readable date: 'Tue 3 Nov' / '11月3日（周二）'. */
export function dateLabel(date, lang = 'en') {
  const d = new Date(parse(date))
  const wd = weekdayOf(date)
  if (lang === 'zh') return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${['周一', '周二', '周三', '周四', '周五', '周六', '周日'][wd]}）`
  return `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][wd]} ${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`
}
