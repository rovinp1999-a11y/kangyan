// Every lesson a student has between two dates and what happened to it, plus the monthly
// fee suggestion. Shared by the API (student page, phone calendar) and the admin.
import { covers, addDays, todayMY, startsAt, kindOf } from './lessons.js'
import { GROUP_FEE, PRIVATE_FEE_FROM, feeStage } from './constants.js'

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/**
 * Lessons from `from` to `to` (inclusive, 'YYYY-MM-DD'), soonest first. Each has a status:
 *   lesson    – happens (attended once it's in the past)
 *   absent    – student reported absent (still a lesson for fees)
 *   cancelled – cancelled by the tutor (not charged)
 *   moved     – moved to another time (the moved-in lesson is listed on its new date)
 * and a kind ('private' or 'group'), from its weekly lesson.
 * Only approved changes count; requests still waiting don't change anything yet.
 */
export function occurrences(student, requests, from, to) {
  const done = (requests || []).filter((r) => r.student_id === undefined || r.student_id === student.id).filter((r) => r.status === 'approved')
  const out = []
  for (const l of student.lessons || []) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (!covers(l, d) || (student.start_date && d < student.start_date)) continue
      const r = done.find((x) => x.kind !== 'change' && x.lesson_date === d && (!x.from_lesson || x.from_lesson.start === l.start))
      const status = !r ? 'lesson' : r.kind === 'reschedule' ? 'moved' : r.by_tutor ? 'cancelled' : 'absent'
      out.push({ date: d, start: l.start, end: l.end, kind: kindOf(l, student), status, request: r || null })
    }
  }
  for (const r of done) {
    if (r.kind === 'reschedule' && r.to_date && r.to_start && r.to_date >= from && r.to_date <= to) {
      const was = r.from_lesson && (student.lessons || []).find((l) => l.start === r.from_lesson.start && covers(l, r.lesson_date))
      out.push({ date: r.to_date, start: r.to_start, end: r.to_end, kind: kindOf(r.from_lesson?.kind ? r.from_lesson : was, student), status: 'lesson', movedFrom: r.lesson_date, request: r })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
}

/** First and last day of a month 'YYYY-MM'. */
export function monthRange(month) {
  const first = `${month}-01`
  const next = addDays(first, 32).slice(0, 7)
  return [first, addDays(`${next}-01`, -1)]
}

export const monthOf = (date) => date.slice(0, 7)

/**
 * Suggested fee for a month: group classes are a fixed monthly fee by stage; 1-to-1 is the
 * hourly rate × hours that month (absences are still charged, lessons the tutor cancelled aren't).
 * A 1-to-1 student who also joins a group class pays their hourly rate for the group hours too,
 * not the group fee. Returns null when there is nothing to suggest (e.g. level 'Other').
 */
export function suggestedFee(student, requests, month) {
  if (student.lesson_type === 'group') return GROUP_FEE[feeStage(student.level)] ?? null
  const [a, b] = monthRange(month)
  const mins = occurrences(student, requests, a, b)
    .filter((o) => o.status === 'lesson' || o.status === 'absent')
    .reduce((n, o) => n + toMin(o.end) - toMin(o.start), 0)
  if (!mins) return 0
  return Math.round(((student.hourly_rate || PRIVATE_FEE_FROM) * mins) / 60)
}

/** This month's lessons: how many in total and how many already done. */
export function monthProgress(student, requests, now = Date.now()) {
  const [a, b] = monthRange(monthOf(todayMY(now)))
  const list = occurrences(student, requests, a, b).filter((o) => o.status === 'lesson' || o.status === 'absent')
  const done = list.filter((o) => o.status === 'lesson' && startsAt(o.date, o.end) <= now).length
  return { total: list.length, done }
}

/** A fee is due on the 1st and overdue after the 14th (the 2-week rule in the FAQ). */
export function feeState(month, paid, now = Date.now()) {
  if (paid) return 'paid'
  const today = todayMY(now)
  if (today > `${month}-14`) return 'overdue'
  return today >= `${month}-01` ? 'due' : 'upcoming'
}
