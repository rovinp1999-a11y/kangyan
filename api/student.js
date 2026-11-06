// Student page API (existing students, logged in with WhatsApp number + PIN).
//   POST { action: 'login', phone, pin }   → { token }
//   GET                                    → profile, upcoming lessons, requests, times on offer
//   POST { action: 'request', kind, ... }  → ask to move one lesson, report an absence or change the regular time
//   POST { action: 'cancel', id }          → withdraw a pending request
//   POST { action: 'pin', current, next }  → change PIN (returns a fresh token)
//   POST { action: 'profile', ... }        → update their own school, birthday, contact and parent details
//   GET ?feed=<token>                      → their lessons as a calendar feed (.ics) for phone calendars
// Error `code`s let the page show its own translated message.
import { getSql } from './_db.js'
import { allow, readBody, send, fail, clientIp, isDbId } from './_http.js'
import { normalPhone, isPin, checkPin, hashPin, encryptPin, issueStudentToken, requireStudent } from './_students.js'
import { notify } from './_notify.js'
import { randomBytes } from 'node:crypto'
import { occurrences, monthRange, monthOf, suggestedFee, monthProgress, feeState } from '../shared/schedule.js'
import { NOTICE_HOURS, WEEKS_AHEAD, upcomingDates, hoursUntil, todayMY, isDate, weekdayOf, startsAt, dateLabel, addDays, covers, kindOf } from '../shared/lessons.js'

const MAX_FAILS = 8
const WINDOW_MIN = 15
const REQ_COLUMNS = `id, created_at, kind, to_char(lesson_date, 'YYYY-MM-DD') AS lesson_date, from_lesson, to_slot_id,
  to_char(to_date, 'YYYY-MM-DD') AS to_date, to_weekday, to_start, to_end, to_label, recording, note, status, reply, decided_at, by_tutor`
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_LESSON_MIN = 4 * 60
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
/** A requested start/end pair: real times, start before end, at most 4 hours. */
const okTimes = (a, b) => HHMM.test(a || '') && HHMM.test(b || '') && a < b && toMin(b) - toMin(a) <= MAX_LESSON_MIN
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
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hm = (t) => { const h = Number(t.slice(0, 2)); const m = t.slice(3, 5); return `${h % 12 || 12}${m === '00' ? '' : `:${m}`} ${h < 12 ? 'AM' : 'PM'}` }
const span = (a, b) => `${hm(a)}–${hm(b)}`

/**
 * When other confirmed students have lessons over the next weeks (no names): their
 * weekly lessons, minus approved absences and moves away, plus lessons moved in.
 */
async function occupied(sql, me, dates) {
  const others = await sql`SELECT id, lessons, to_char(start_date, 'YYYY-MM-DD') AS start_day FROM students WHERE active AND id <> ${me}`
  const reqs = await sql.query(`SELECT student_id, kind, status, to_char(lesson_date, 'YYYY-MM-DD') AS lesson_date, from_lesson,
      to_char(to_date, 'YYYY-MM-DD') AS to_date, to_start, to_end
    FROM student_requests WHERE student_id <> $1 AND status = ANY($2) AND (lesson_date >= $3::date OR to_date >= $3::date)`, [me, ACTIVE, dates[0]])
  const out = []
  for (const o of others) {
    for (const l of o.lessons || []) {
      for (const date of dates) {
        if (!covers(l, date) || (o.start_day && date < o.start_day)) continue
        const gone = reqs.some((r) => r.student_id === o.id && r.status === 'approved' && r.kind !== 'change' && r.lesson_date === date && (!r.from_lesson || r.from_lesson.start === l.start))
        if (!gone) out.push({ date, start: l.start, end: l.end })
      }
    }
  }
  for (const r of reqs) if (r.kind === 'reschedule' && r.to_date && r.to_start && dates.includes(r.to_date)) out.push({ date: r.to_date, start: r.to_start, end: r.to_end })
  return out
}

/** The student's private calendar-feed token (made on first use). */
async function calendarToken(sql, s) {
  if (s.cal_token) return s.cal_token
  const token = randomBytes(18).toString('base64url')
  await sql`UPDATE students SET cal_token = ${token} WHERE id = ${s.id} AND cal_token IS NULL`
  const [row] = await sql`SELECT cal_token FROM students WHERE id = ${s.id}`
  return row.cal_token
}

/** Lessons as an iCalendar feed: 4 weeks back to 12 ahead, moves applied, 1-hour reminder. */
async function feed(res, sql, token) {
  const [s] = token && /^[A-Za-z0-9_-]{16,40}$/.test(token)
    ? await sql`SELECT *, to_char(start_date, 'YYYY-MM-DD') AS start_day FROM students WHERE cal_token = ${token} AND active` : []
  if (!s) { res.status(404).setHeader('Content-Type', 'text/plain'); return res.send('Not found') }
  const requests = await sql.query(`SELECT ${REQ_COLUMNS} FROM student_requests WHERE student_id = $1 AND status = 'approved'`, [s.id])
  const today = todayMY()
  const list = occurrences({ ...s, start_date: s.start_day }, requests, addDays(today, -28), addDays(today, 84))
    .filter((o) => o.status === 'lesson' || o.status === 'absent')
  const stamp = (date, hhmm) => new Date(startsAt(date, hhmm)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (t) => String(t).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
  const subj = (s.subjects || []).join(', ') || 'Tuition'
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kangyan//Lessons//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`Kangyan lessons · ${s.name}`)}`, 'X-WR-TIMEZONE:Asia/Kuala_Lumpur', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H']
  for (const o of list) {
    lines.push('BEGIN:VEVENT', `UID:${s.id}-${o.date}-${o.start.replace(':', '')}@kangyan.work`, `DTSTAMP:${now}`,
      `DTSTART:${stamp(o.date, o.start)}`, `DTEND:${stamp(o.date, o.end)}`,
      `SUMMARY:${esc(`${subj} · ${o.kind === 'group' ? 'Group class' : '1-to-1'}${o.status === 'absent' ? ' (absent)' : ''}`)}`,
      `DESCRIPTION:${esc('Kangyan tuition. Changes: https://kangyan.work/student')}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${subj} lesson in 1 hour`)}`, 'TRIGGER:-PT1H', 'END:VALARM', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).send(lines.join('\r\n') + '\r\n')
}

/** Everything the student page shows. */
async function state(sql, s) {
  // Lessons that are still going (a lesson that ended for "this and all following" drops out);
  // `weekly` is the ones that repeat, without one-off lessons.
  const current = (Array.isArray(s.lessons) ? s.lessons : []).filter((w) => !w.until || w.until >= todayMY())
    .slice().sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
  const weekly = current.filter((w) => !w.once)
  const requests = await sql.query(`SELECT ${REQ_COLUMNS} FROM student_requests WHERE student_id = $1 ORDER BY created_at DESC LIMIT 60`, [s.id])
  const [{ start_day: startDay }] = await sql`SELECT to_char(start_date, 'YYYY-MM-DD') AS start_day FROM students WHERE id = ${s.id}`

  // Every upcoming lesson from every weekly time, soonest first.
  const lessons = current
    .flatMap((w) => upcomingDates(w, { from: startDay || undefined }).map((date) => ({ date, weekday: w.weekday, start: w.start, end: w.end, kind: kindOf(w, s), once: !!w.once })))
    .sort((a, b) => startsAt(a.date, a.start) - startsAt(b.date, b.start))
    .map((l) => {
      const r = requests.find((x) => x.lesson_date === l.date && x.kind !== 'change' && ACTIVE.includes(x.status) && (!x.from_lesson || x.from_lesson.start === l.start))
      return { ...l, hours: hoursUntil(l.date, l.start), request: r || null }
    })

  // The calendar covers this week and the next ones, from Monday.
  const today = todayMY()
  const monday = addDays(today, -weekdayOf(today))
  const dates = Array.from({ length: WEEKS_AHEAD * 7 }, (_, i) => addDays(monday, i))

  // Lesson history (last 8 weeks, but not before the month they were added) and this month's count.
  const stu = { ...s, start_date: startDay || null }
  const joinedDay = new Date(Date.parse(s.created_at) + 8 * 3600e3).toISOString().slice(0, 10)
  const historyFrom = [addDays(today, -56), `${joinedDay.slice(0, 7)}-01`].sort().pop()
  const history = occurrences(stu, requests, historyFrom, today)
    .filter((o) => startsAt(o.date, o.start) <= Date.now())
    .reverse()
    .map(({ date, start, end, kind, status, movedFrom }) => ({ date, start, end, kind, status, movedFrom: movedFrom || null }))

  // Fees: this month and the two before (only months since they joined).
  const joined = monthOf(joinedDay)
  const months = [0, 1, 2].map((i) => monthOf(addDays(`${monthOf(today)}-01`, -i * 28))).filter((m, i, a) => a.indexOf(m) === i && m >= joined)
  const saved = await sql`SELECT month, amount, paid FROM student_fees WHERE student_id = ${s.id} AND month = ANY(${months})`
  const fees = months.map((month) => {
    const row = saved.find((x) => x.month === month)
    const amount = row?.amount ?? suggestedFee(stu, requests, month)
    return { month, amount, state: feeState(month, row?.paid) }
  }).filter((f, i) => i === 0 || f.state !== 'paid') // older months only while unpaid

  const news = await sql`
    SELECT id, created_at, title, body FROM announcements
    WHERE (until IS NULL OR until >= ${today}::date)
      AND (audience = 'all' OR audience = ${s.lesson_type} OR (${s.lesson_type} = 'both' AND audience IN ('private','group')) OR (audience = 'student' AND student_id = ${s.id}))
    ORDER BY created_at DESC LIMIT 5`

  return {
    student: { name: s.name, level: s.level, lessonType: s.lesson_type, subjects: s.subjects, lang: s.lang },
    profile: await profileOf(sql, s.id),
    history, progress: monthProgress(stu, requests), fees, announcements: news, calendarToken: await calendarToken(sql, s),
    weekly: weekly.map((w) => ({ weekday: w.weekday, start: w.start, end: w.end, kind: kindOf(w, s), from: w.from || null, until: w.until || null })),
    lessons, requests, noticeHours: NOTICE_HOURS, weeksAhead: WEEKS_AHEAD, today, lastDay: dates[dates.length - 1], startDay: startDay || null,
    // Other confirmed students' lessons, shown only as "occupied" (never who).
    busy: await occupied(sql, s.id, dates),
  }
}

const PROFILE_COLUMNS = `name, phone, school, to_char(birthday, 'YYYY-MM-DD') AS birthday, email, address, parent_name, parent_relation, parent_phone, lang`
async function profileOf(sql, id) {
  const [p] = await sql.query(`SELECT ${PROFILE_COLUMNS} FROM students WHERE id = $1`, [id])
  return p
}

/** What a student may change themselves. Name, level and the login number stay with the tutor. */
async function saveProfile(res, sql, s, b) {
  const f = {
    school: str(b.school, 120) || null,
    birthday: b.birthday ? (isDate(b.birthday) && b.birthday <= todayMY() ? b.birthday : NaN) : null,
    email: str(b.email, 120) || null,
    address: str(b.address, 300) || null,
    parent_name: str(b.parentName, 80) || null,
    parent_relation: ['mother', 'father', 'guardian'].includes(b.parentRelation) ? b.parentRelation : null,
    parent_phone: b.parentPhone ? normalPhone(b.parentPhone) : null,
    lang: b.lang === 'zh' ? 'zh' : 'en',
  }
  if (Number.isNaN(f.birthday)) return fail(res, 400, 'Invalid birthday', 'birthday')
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return fail(res, 400, 'Invalid email', 'email')
  if (f.parent_phone && (f.parent_phone.length < 9 || f.parent_phone.length > 15)) return fail(res, 400, 'Invalid phone', 'phone')
  const before = await profileOf(sql, s.id)
  await sql`UPDATE students SET school = ${f.school}, birthday = ${f.birthday}, email = ${f.email}, address = ${f.address},
    parent_name = ${f.parent_name}, parent_relation = ${f.parent_relation}, parent_phone = ${f.parent_phone}, lang = ${f.lang} WHERE id = ${s.id}`
  const after = await profileOf(sql, s.id)
  const changed = Object.keys(f).filter((k) => (before[k] ?? null) !== (after[k] ?? null))
  if (changed.length) await notify(`Kangyan: ${s.name} updated their profile`, `${s.name} changed: ${changed.map((k) => `${k.replace('_', ' ')} → ${after[k] ?? '(removed)'}`).join('\n')}`)
  return send(res, 200, { ok: true, profile: after })
}

async function createRequest(res, sql, s, b) {
  const kind = b.kind
  if (!['reschedule', 'absence', 'change'].includes(kind)) return fail(res, 400, 'Invalid request', 'invalid')
  const st = await state(sql, s)
  const note = str(b.note, 500)
  let lessonDate = null
  let fromLesson = null
  let to = null // { date?, weekday?, start, end }

  if (kind === 'reschedule' || kind === 'absence') {
    const lesson = st.lessons.find((l) => l.date === b.lessonDate && (!b.lessonStart || l.start === b.lessonStart))
    if (!lesson) return fail(res, 400, 'That lesson is not coming up', 'invalid')
    if (kind === 'reschedule' && lesson.kind !== 'private') return fail(res, 400, 'Group classes are not moved', 'group')
    if (lesson.request) return fail(res, 409, 'There is already a request for that lesson', 'duplicate')
    if (kind === 'reschedule' && lesson.hours < NOTICE_HOURS) return fail(res, 400, 'Less than 12 hours before the lesson', 'notice')
    lessonDate = lesson.date
    fromLesson = { weekday: lesson.weekday, start: lesson.start, end: lesson.end, kind: lesson.kind }
  }
  if (kind === 'reschedule') {
    // Any date and time can be asked for; the tutor accepts, declines or adjusts it.
    if (!isDate(b.toDate) || b.toDate < st.today || b.toDate > st.lastDay || !okTimes(b.toStart, b.toEnd)) return fail(res, 400, 'Pick a date and time', 'times')
    if (startsAt(b.toDate, b.toStart) <= Date.now()) return fail(res, 400, 'Pick a time in the future', 'past')
    if (b.toDate === lessonDate && b.toStart === fromLesson.start) return fail(res, 400, 'That is the same time', 'same')
    to = { date: b.toDate, weekday: weekdayOf(b.toDate), start: b.toStart, end: b.toEnd }
  }
  if (kind === 'change') {
    // "This and all following lessons": starts from one lesson (lessonDate), or from the next one.
    if (b.lessonDate) {
      const lesson = st.lessons.find((l) => l.date === b.lessonDate && (!b.lessonStart || l.start === b.lessonStart))
      if (!lesson || lesson.once) return fail(res, 400, 'That lesson is not coming up', 'invalid')
      lessonDate = lesson.date
      fromLesson = { weekday: lesson.weekday, start: lesson.start, end: lesson.end, kind: lesson.kind }
    } else {
      fromLesson = st.weekly.find((w) => w.weekday === Number(b.fromWeekday) && w.start === b.fromStart) || (st.weekly.length === 1 ? st.weekly[0] : null)
      if (st.weekly.length && !fromLesson) return fail(res, 400, 'Pick which lesson to change', 'invalid')
      lessonDate = fromLesson ? st.lessons.find((l) => l.weekday === fromLesson.weekday && l.start === fromLesson.start)?.date ?? null : null
    }
    // A date for the first moved lesson (from the calendar), or just a weekday.
    const startDate = isDate(b.toDate) && b.toDate >= st.today && b.toDate <= st.lastDay ? b.toDate : null
    const weekday = startDate ? weekdayOf(startDate) : Number(b.toWeekday)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !okTimes(b.toStart, b.toEnd)) return fail(res, 400, 'Pick a day and time', 'times')
    if (fromLesson && weekday === fromLesson.weekday && b.toStart === fromLesson.start && b.toEnd === fromLesson.end) return fail(res, 400, 'That is the same time', 'same')
    if (st.requests.some((r) => r.kind === 'change' && r.status === 'pending' && sameLesson(r.from_lesson, fromLesson))) {
      return fail(res, 409, 'You already asked to change this lesson', 'duplicate')
    }
    to = { weekday, start: b.toStart, end: b.toEnd, ...(startDate ? { date: startDate } : {}) }
  }

  // Link to the timetable slot with the same day and times, if there is one.
  let slotId = null
  if (to) {
    const [slot] = await sql.query(`SELECT id FROM availability_slots WHERE weekday = $1 AND start_time = $2::time AND end_time = $3::time`, [to.weekday, to.start, to.end])
    slotId = slot?.id ?? null
  }
  const toLabel = to ? `${kind === 'reschedule' ? dateLabel(to.date) : `Every ${DAY_NAMES[to.weekday]}`} ${span(to.start, to.end)}` : null
  const [row] = await sql`
    INSERT INTO student_requests (student_id, kind, lesson_date, from_lesson, to_slot_id, to_date, to_weekday, to_start, to_end, to_label, recording, note)
    VALUES (${s.id}, ${kind}, ${lessonDate}, ${fromLesson ? JSON.stringify(fromLesson) : null}::jsonb, ${slotId}, ${to?.date ?? null}, ${to?.weekday ?? null},
      ${to?.start ?? null}, ${to?.end ?? null}, ${toLabel}, ${kind === 'absence' && b.recording === true}, ${note || null})
    RETURNING id`

  const what = {
    reschedule: `Move the lesson on ${dateLabel(lessonDate)} ${span(fromLesson.start, fromLesson.end)} to ${toLabel}`,
    absence: `Can't make the lesson on ${dateLabel(lessonDate)} ${span(fromLesson.start, fromLesson.end)}${b.recording === true ? ' (would like the recording)' : ''}`,
    change: `From ${lessonDate ? dateLabel(lessonDate) : 'now'} on, change the weekly lesson${fromLesson ? ` (${DAY_NAMES[fromLesson.weekday]} ${span(fromLesson.start, fromLesson.end)})` : ''} to ${toLabel}`,
  }[kind]
  await notify(`Kangyan: ${s.name} — ${kind === 'absence' ? 'absence' : kind === 'change' ? 'new regular time' : 'reschedule'} request`,
    `${s.name} (${s.level || ''}, ${fromLesson?.kind === 'group' || (!fromLesson && s.lesson_type === 'group') ? 'group' : '1-to-1'})\n${what}${note ? `\nNote: ${note}` : ''}\n\nAccept, decline or change the time: https://kangyan.work/admin`)
  return send(res, 201, { ok: true, id: row.id })
}

export default async function handler(req, res) {
  if (!allow(req, res, ['GET', 'POST'])) return
  const sql = getSql()
  const b = req.method === 'POST' ? readBody(req) : {}
  try {
    if (req.method === 'GET' && req.query?.feed) return await feed(res, sql, String(req.query.feed))
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
      const [u] = await sql`UPDATE students SET pin_hash = ${hashPin(b.next)}, pin_enc = ${encryptPin(b.next)} WHERE id = ${s.id} RETURNING *`
      return send(res, 200, { ok: true, token: issueStudentToken(u) })
    }
    if (b.action === 'profile') return await saveProfile(res, sql, s, b)
    return fail(res, 400, 'Unknown action', 'invalid')
  } catch (err) {
    console.error('[api/student]', err)
    return fail(res, 500, 'Something went wrong', 'server')
  }
}
