// Student page API (existing students, logged in with WhatsApp number + PIN).
//   POST { action: 'login', phone, pin }   → { token }
//   GET                                    → profile, upcoming lessons, requests, times on offer
//   POST { action: 'request', kind, ... }  → ask to move one lesson, report an absence or change the regular time
//   POST { action: 'cancel', id }          → withdraw a pending request
//   POST { action: 'pin', current, next }  → change PIN (returns a fresh token)
// Error `code`s let the page show its own translated message.
import { getSql } from './_db.js'
import { allow, readBody, send, fail, clientIp, isDbId } from './_http.js'
import { SLOT_COLUMNS } from './slots.js'
import { normalPhone, isPin, checkPin, hashPin, issueStudentToken, requireStudent } from './_students.js'
import { notify } from './_notify.js'
import { slotFits, slotLabel } from '../shared/constants.js'
import { NOTICE_HOURS, WEEKS_AHEAD, upcomingDates, hoursUntil, todayMY, isDate, weekdayOf, startsAt, dateLabel } from '../shared/lessons.js'

const MAX_FAILS = 8
const WINDOW_MIN = 15
const REQ_COLUMNS = `id, created_at, kind, to_char(lesson_date, 'YYYY-MM-DD') AS lesson_date, from_lesson, to_slot_id,
  to_char(to_date, 'YYYY-MM-DD') AS to_date, to_label, recording, note, status, reply, decided_at`
const ACTIVE = ['pending', 'approved']
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

async function login(req, res, sql, b) {
  const phone = normalPhone(b.phone)
  const keys = [`stu:${clientIp(req)}`, `stu-phone:${phone}`]
  const [{ fails }] = await sql`
    SELECT count(*)::int AS fails FROM admin_login_attempts
    WHERE ip = ANY(${keys}) AND at > now() - make_interval(mins => ${WINDOW_MIN})`
  if (fails >= MAX_FAILS) return fail(res, 429, 'Too many attempts', 'locked')
  await new Promise((r) => setTimeout(r, 400))

  // Siblings can share a parent's number; each child has their own PIN.
  const rows = phone.length >= 9 ? await sql`SELECT * FROM students WHERE phone = ${phone} AND active` : []
  const s = isPin(b.pin) ? rows.find((x) => checkPin(b.pin, x.pin_hash)) : null
  if (!s) {
    await sql`INSERT INTO admin_login_attempts (ip) SELECT unnest(${keys}::text[])`
    return fail(res, 401, 'Wrong number or PIN', 'pin')
  }
  await sql`DELETE FROM admin_login_attempts WHERE ip = ANY(${keys})`
  await sql`UPDATE students SET last_login = now() WHERE id = ${s.id}`
  return send(res, 200, { ok: true, token: issueStudentToken(s) })
}

const sameLesson = (a, b) => a && b && a.weekday === b.weekday && a.start === b.start
const weeklyLabel = (w) => slotLabel(w)

/** Everything the student page shows. */
async function state(sql, s) {
  const slots = await sql.query(`SELECT ${SLOT_COLUMNS} FROM availability_slots ORDER BY weekday, start_time`)
  const weekly = (Array.isArray(s.lessons) ? s.lessons : []).slice().sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
  const requests = await sql.query(`SELECT ${REQ_COLUMNS} FROM student_requests WHERE student_id = $1 ORDER BY created_at DESC LIMIT 60`, [s.id])
  const [{ start_day: startDay }] = await sql`SELECT to_char(start_date, 'YYYY-MM-DD') AS start_day FROM students WHERE id = ${s.id}`

  // Every upcoming lesson from every weekly time, soonest first.
  const lessons = weekly
    .flatMap((w) => upcomingDates(w, { from: startDay || undefined }).map((date) => ({ date, weekday: w.weekday, start: w.start, end: w.end })))
    .sort((a, b) => startsAt(a.date, a.start) - startsAt(b.date, b.start))
    .map((l) => {
      const r = requests.find((x) => x.lesson_date === l.date && x.kind !== 'change' && ACTIVE.includes(x.status) && (!x.from_lesson || x.from_lesson.start === l.start))
      return { ...l, hours: hoursUntil(l.date, l.start), request: r || null }
    })

  // One-off lessons already booked into a slot by anyone (so two students can't take the same replacement).
  const booked = await sql`
    SELECT to_slot_id, to_char(to_date, 'YYYY-MM-DD') AS d, student_id FROM student_requests
    WHERE kind = 'reschedule' AND status = ANY(${ACTIVE}) AND to_date >= ${todayMY()}::date`
  const busy = new Set(booked.map((x) => `${x.to_slot_id}|${x.d}`))
  const options = slots
    .filter((x) => x.status === 'open' && slotFits(x.kind, s.lesson_type) && !weekly.some((w) => sameLesson(w, x)))
    .map((x) => ({ ...x, label: slotLabel(x), dates: upcomingDates(x, { weeks: WEEKS_AHEAD }).filter((d) => !busy.has(`${x.id}|${d}`)) }))

  return {
    student: { name: s.name, level: s.level, lessonType: s.lesson_type, subjects: s.subjects, lang: s.lang },
    weekly: weekly.map((w) => ({ weekday: w.weekday, start: w.start, end: w.end })),
    lessons, requests, options, noticeHours: NOTICE_HOURS, weeksAhead: WEEKS_AHEAD, today: todayMY(), startDay: startDay || null,
    // For the calendar: the tutor's slots this student could use, and one-off bookings by date.
    // Only free / occupied is shared, never who is in a slot.
    calendar: {
      slots: slots.filter((x) => slotFits(x.kind, s.lesson_type)).map((x) => ({ id: x.id, weekday: x.weekday, start: x.start, end: x.end, status: x.status })),
      booked: booked.map((x) => ({ slotId: x.to_slot_id, date: x.d, mine: x.student_id === s.id })),
    },
    // Day and time of every slot, so the page can label requests in its own language.
    times: Object.fromEntries(slots.map((x) => [x.id, { weekday: x.weekday, start: x.start, end: x.end }])),
  }
}

async function createRequest(res, sql, s, b) {
  const kind = b.kind
  if (!['reschedule', 'absence', 'change'].includes(kind)) return fail(res, 400, 'Invalid request', 'invalid')
  const st = await state(sql, s)
  const note = str(b.note, 500)
  let lessonDate = null
  let fromLesson = null
  let toSlot = null
  let toDate = null

  if (kind === 'reschedule' || kind === 'absence') {
    if (kind === 'reschedule' && s.lesson_type !== 'private') return fail(res, 400, 'Group classes are not moved', 'group')
    const lesson = st.lessons.find((l) => l.date === b.lessonDate && (!b.lessonStart || l.start === b.lessonStart))
    if (!lesson) return fail(res, 400, 'That lesson is not coming up', 'invalid')
    if (lesson.request) return fail(res, 409, 'There is already a request for that lesson', 'duplicate')
    if (kind === 'reschedule' && lesson.hours < NOTICE_HOURS) return fail(res, 400, 'Less than 12 hours before the lesson', 'notice')
    lessonDate = lesson.date
    fromLesson = { weekday: lesson.weekday, start: lesson.start, end: lesson.end }
  }
  if (kind === 'change') {
    fromLesson = st.weekly.find((w) => w.weekday === Number(b.fromWeekday) && w.start === b.fromStart) || (st.weekly.length === 1 ? st.weekly[0] : null)
    if (st.weekly.length && !fromLesson) return fail(res, 400, 'Pick which lesson to change', 'invalid')
  }
  if (kind === 'reschedule' || kind === 'change') {
    toSlot = st.options.find((o) => o.id === Number(b.toSlotId))
    if (!toSlot) return fail(res, 409, 'That time is no longer available', 'taken')
  }
  if (kind === 'reschedule') {
    if (!isDate(b.toDate) || !toSlot.dates.includes(b.toDate) || weekdayOf(b.toDate) !== toSlot.weekday) return fail(res, 409, 'That time is no longer available', 'taken')
    if (startsAt(b.toDate, toSlot.start) <= Date.now()) return fail(res, 400, 'Pick a time in the future', 'invalid')
    toDate = b.toDate
  }
  if (kind === 'change' && st.requests.some((r) => r.kind === 'change' && r.status === 'pending' && sameLesson(r.from_lesson, fromLesson))) {
    return fail(res, 409, 'You already asked to change your regular time', 'duplicate')
  }

  const toLabel = toSlot ? (toDate ? `${dateLabel(toDate)} ${slotLabel(toSlot).split(' ').slice(1).join(' ')}` : slotLabel(toSlot)) : null
  const [row] = await sql`
    INSERT INTO student_requests (student_id, kind, lesson_date, from_lesson, to_slot_id, to_date, to_label, recording, note)
    VALUES (${s.id}, ${kind}, ${lessonDate}, ${fromLesson ? JSON.stringify(fromLesson) : null}::jsonb, ${toSlot?.id ?? null}, ${toDate}, ${toLabel}, ${kind === 'absence' && b.recording === true}, ${note || null})
    RETURNING id`

  const what = {
    reschedule: `Move the lesson on ${dateLabel(lessonDate)} ${fromLesson?.start || ''} to ${toLabel}`,
    absence: `Can't make the lesson on ${dateLabel(lessonDate)} ${fromLesson?.start || ''}${b.recording === true ? ' (would like the recording)' : ''}`,
    change: `Change the regular lesson${fromLesson ? ` on ${weeklyLabel(fromLesson)}` : ''} to ${toLabel}`,
  }[kind]
  await notify(`Kangyan: ${s.name} — ${kind === 'absence' ? 'absence' : kind === 'change' ? 'new regular time' : 'reschedule'} request`,
    `${s.name} (${s.level || ''}, ${s.lesson_type === 'group' ? 'group' : '1-to-1'})\n${what}${note ? `\nNote: ${note}` : ''}\n\nApprove or reject: https://kangyan.work/admin`)
  return send(res, 201, { ok: true, id: row.id })
}

export default async function handler(req, res) {
  if (!allow(req, res, ['GET', 'POST'])) return
  const sql = getSql()
  const b = req.method === 'POST' ? readBody(req) : {}
  try {
    if (b.action === 'login') return await login(req, res, sql, b)

    const s = await requireStudent(req, res)
    if (!s) return
    if (req.method === 'GET') return send(res, 200, { ok: true, ...(await state(sql, s)) })

    if (b.action === 'request') return await createRequest(res, sql, s, b)
    if (b.action === 'cancel') {
      const id = Number(b.id)
      if (!isDbId(id)) return fail(res, 400, 'Invalid id', 'invalid')
      const rows = await sql`UPDATE student_requests SET status = 'cancelled', decided_at = now() WHERE id = ${id} AND student_id = ${s.id} AND status = 'pending' RETURNING id`
      if (!rows.length) return fail(res, 409, 'That request was already answered', 'answered')
      return send(res, 200, { ok: true })
    }
    if (b.action === 'pin') {
      if (!checkPin(b.current, s.pin_hash)) return fail(res, 401, 'Current PIN is wrong', 'pin')
      if (!isPin(b.next)) return fail(res, 400, 'PIN must be 6 digits', 'pinFormat')
      // Siblings on one number are told apart by PIN, so it must differ from theirs.
      const sibs = await sql`SELECT pin_hash FROM students WHERE phone = ${s.phone} AND id <> ${s.id}`
      if (sibs.some((x) => checkPin(b.next, x.pin_hash))) return fail(res, 409, 'Choose a different PIN', 'pinTaken')
      const [u] = await sql`UPDATE students SET pin_hash = ${hashPin(b.next)} WHERE id = ${s.id} RETURNING *`
      return send(res, 200, { ok: true, token: issueStudentToken(u) })
    }
    return fail(res, 400, 'Unknown action', 'invalid')
  } catch (err) {
    console.error('[api/student]', err)
    return fail(res, 500, 'Something went wrong', 'server')
  }
}
