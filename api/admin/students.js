// Admin-only: existing students and their requests.
//   GET                                       → { students, requests }
//   POST { action: 'create', ...student }     → { student, pin }   (PIN is shown once)
//   POST { action: 'update', id, ...fields }  → { student }
//   POST { action: 'resetPin', id }           → { pin }
//   POST { action: 'showPin', id }            → { pin } (null for PINs set before they were kept)
//   POST { action: 'delete', id }             → removes the student and their requests
//   POST { action: 'decide', id, status, reply, time? } → accept / decline a pending request;
//        `time` ({ date | weekday, start, end }) accepts it at a different time agreed with the student
//   POST { action: 'move', studentId, lessonDate, lessonStart, toDate, toStart, toEnd } → tutor moves one lesson (this week only)
//   POST { action: 'cancelLesson', studentId, lessonDate, lessonStart }              → tutor cancels one lesson
//   POST { action: 'endSeries', studentId, lessonDate, lessonStart }   → cancel this and all following lessons (the weekly lesson stops)
//   POST { action: 'moveSeries', studentId, lessonDate, lessonStart, toDate, toStart, toEnd } → this and all following lessons
//   POST { action: 'setBreaks', studentId, breaks: [{ from, until, note }] } → lessons paused between those dates
//   POST { action: 'addLesson', studentId, date, start, end, kind, weekly? } → an extra class on that date (or weekly from it)
//   POST { action: 'setFee', studentId, month, amount (null = use suggestion), paid, note }  → one month's fee
//   POST { action: 'announce', title, body, audience, studentId?, until? } / { action: 'unannounce', id }
//   POST { action: 'saveTemplates', templates }   → WhatsApp message templates
//   POST { action: 'resetCalendar', id }          → new private phone-calendar link
//   POST { action: 'undo', id }                                                     → withdraw a move / cancellation
// A student has lessons ({ weekday, start, end, kind }), each 1-to-1 or group. A lesson repeats
// weekly, or happens once (`once`, with from = until = its date). Lessons that are over are kept
// so past months' fees stay right.
// The student's lesson_type sums them up ('private', 'group' or 'both'). When a 1-to-1
// lesson matches a timetable slot, that slot is marked taken, and freed again when nobody uses it.
import { getSql } from '../_db.js'
import { requireAdmin } from '../_auth.js'
import { allow, readBody, send, fail, isDbId } from '../_http.js'
import { normalPhone, newPin, hashPin, checkPin, encryptPin, decryptPin } from '../_students.js'
import { LEVELS, SUBJECTS, LESSON_TYPES } from '../../shared/constants.js'
import { SLOT_COLUMNS } from '../slots.js'
import { isDate, weekdayOf, dateLabel, covers, addDays, todayMY, kindOf, typeOf } from '../../shared/lessons.js'

const STUDENT_COLUMNS = `s.id, s.created_at, s.name, s.phone, s.level, s.lesson_type, s.subjects, s.lessons, s.hourly_rate,
  s.school, to_char(s.birthday, 'YYYY-MM-DD') AS birthday, s.email, s.address, s.parent_name, s.parent_relation, s.parent_phone,
  to_char(s.start_date, 'YYYY-MM-DD') AS start_date, s.active, s.enquiry_id, s.lang, s.notes, s.last_login, s.breaks`
const REQUEST_COLUMNS = `r.id, r.created_at, r.student_id, r.kind, to_char(r.lesson_date, 'YYYY-MM-DD') AS lesson_date, r.from_lesson,
  r.to_slot_id, to_char(r.to_date, 'YYYY-MM-DD') AS to_date, r.to_weekday, r.to_start, r.to_end, r.to_label, r.recording, r.note, r.status, r.reply, r.decided_at, r.by_tutor`
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

async function getStudent(sql, id) {
  const [row] = await sql.query(`SELECT ${STUDENT_COLUMNS} FROM students s WHERE s.id = $1`, [id])
  return row
}

/** A PIN no other student on this number already uses (siblings log in by PIN). */
async function uniquePin(sql, phone, exceptId = 0) {
  const others = await sql`SELECT pin_hash FROM students WHERE phone = ${phone} AND id <> ${exceptId}`
  for (;;) {
    const pin = newPin()
    if (!others.some((o) => checkPin(pin, o.pin_hash))) return pin
  }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
// Slots a 1-to-1 student holds every week now or later (one-off lessons and lessons that already ended don't count).
const slotIds = (st) => (st && st.active
  ? (st.lessons || []).filter((l) => !l.once && kindOf(l, st) === 'private' && (!l.until || l.until >= todayMY())).map((l) => l.slot_id).filter(Boolean) : [])
const isOver = (l) => !!l.until && l.until < todayMY()
const hm = (x) => { const h = Number(x.slice(0, 2)); const m = x.slice(3, 5); return `${h % 12 || 12}${m === '00' ? '' : `:${m}`} ${h < 12 ? 'AM' : 'PM'}` }
const sortLessons = (list) => list.sort((a, c) => a.weekday - c.weekday || a.start.localeCompare(c.start) || String(a.from || '').localeCompare(String(c.from || '')))

/**
 * "This and all following lessons": the weekly lesson stops the day before `fromDate` and a new
 * one (new day / time) starts on `newFrom`. Lessons that already ended are dropped.
 */
function splitSeries(lessons, old, fromDate, next, newFrom) {
  const today = todayMY()
  const out = []
  for (const l of lessons) {
    if (isOver(l)) { out.push(l); continue }
    if (l === old || (l.weekday === old.weekday && l.start === old.start && covers(l, fromDate))) {
      const until = addDays(fromDate, -1)
      if (!(l.from && l.from > until) && until >= today) out.push({ ...l, until })
    } else out.push(l)
  }
  out.push({ weekday: next.weekday, start: next.start, end: next.end, kind: next.kind || old.kind, slot_id: next.slot_id ?? null, from: newFrom, ...(old.until ? { until: old.until } : {}) })
  return sortLessons(out)
}

/**
 * Lessons from the form, each linked to the timetable slot with the same day and times.
 * A one-off lesson has `once` and its `date`; a lesson without its own class type gets `kind`.
 */
async function cleanLessons(sql, list, kind = 'private') {
  if (!Array.isArray(list)) return []
  const slots = await sql.query(`SELECT ${SLOT_COLUMNS} FROM availability_slots`)
  const out = []
  for (const l of list.slice(0, 40)) {
    const once = l?.once === true
    if (once && !isDate(l.date)) return null
    const weekday = once ? weekdayOf(l.date) : Number(l?.weekday)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !HHMM.test(l.start) || !HHMM.test(l.end) || l.start >= l.end) return null
    const from = once ? l.date : isDate(l.from) ? l.from : null
    const until = once ? l.date : isDate(l.until) ? l.until : null
    if (!once && until && until < todayMY()) continue // a weekly lesson that is already over
    if (out.some((o) => o.weekday === weekday && o.start === l.start && (o.from || null) === from)) continue
    const slot = slots.find((x) => x.weekday === weekday && x.start === l.start && x.end === l.end)
    out.push({ weekday, start: l.start, end: l.end, kind: kindOf(l, { lesson_type: kind }), slot_id: slot ? slot.id : null, ...(once ? { once: true } : {}), ...(from ? { from } : {}), ...(until ? { until } : {}) })
  }
  return sortLessons(out)
}

/**
 * The form only shows lessons still to come, so merge its list with what came before: lessons
 * already over stay (for past fees), a weekly lesson taken off stops today rather than vanishing
 * from past months, and a new weekly lesson starts today rather than back in the past.
 */
function mergeLessons(before, lessons) {
  const today = todayMY()
  const key = (l) => `${l.weekday}|${l.start}|${l.end}|${l.from || ''}`
  const old = before?.lessons || []
  const sent = new Set(lessons.map(key))
  const kept = []
  for (const l of old) {
    if (sent.has(key(l))) continue
    if (isOver(l)) kept.push(l)
    else if (!l.once && (!l.from || l.from < today)) kept.push({ ...l, until: addDays(today, -1) })
  }
  const had = new Set(old.map(key))
  return sortLessons([...kept, ...lessons.map((l) => (had.has(key(l)) || l.from ? l : { ...l, from: today }))])
}

/**
 * After a student's weekly lessons change, clear upcoming one-off changes and pending asks
 * that belong to a weekly time they no longer have (otherwise that week would get an extra lesson).
 * Returns how many were cleared.
 */
async function clearOrphans(sql, student) {
  const weekly = student?.lessons || []
  const rows = await sql`
    SELECT id, from_lesson, to_char(lesson_date, 'YYYY-MM-DD') AS lesson_date FROM student_requests
    WHERE student_id = ${student.id} AND kind <> 'change' AND status IN ('pending','approved') AND lesson_date >= (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date`
  const gone = rows.filter((x) => x.from_lesson && x.lesson_date && !weekly.some((l) => l.start === x.from_lesson.start && covers(l, x.lesson_date))).map((x) => x.id)
  if (gone.length) await sql`UPDATE student_requests SET status = 'cancelled', decided_at = now(), reply = COALESCE(reply, 'Weekly time changed') WHERE id = ANY(${gone})`
  return gone.length
}

/** Save new weekly lessons (from the tutor or an accepted request) and the type they add up to. */
async function saveLessons(sql, student, lessons) {
  await sql`UPDATE students SET lessons = ${JSON.stringify(lessons)}::jsonb, lesson_type = ${typeOf(lessons, student.lesson_type)} WHERE id = ${student.id}`
}

/** Keep the timetable in step with 1-to-1 students' weekly lessons. */
async function syncSlots(sql, before, after) {
  const was = slotIds(before)
  const now = slotIds(after)
  for (const id of now) if (!was.includes(id)) await sql`UPDATE availability_slots SET status = 'taken' WHERE id = ${id}`
  for (const id of was) {
    if (now.includes(id)) continue
    const users = await sql`SELECT lesson_type, lessons FROM students WHERE active AND lessons @> ${JSON.stringify([{ slot_id: id }])}::jsonb`
    if (!users.some((u) => slotIds(u).includes(id))) await sql`UPDATE availability_slots SET status = 'open' WHERE id = ${id}`
  }
}

/** Validated student fields from the request body; `partial` allows leaving fields out. */
function fields(b, partial) {
  const out = {}
  const has = (k) => !partial || k in b
  if (has('name')) { out.name = str(b.name, 80); if (out.name.length < 2) return 'Please enter the student name' }
  if (has('phone')) { out.phone = normalPhone(b.phone); if (out.phone.length < 9 || out.phone.length > 15) return 'Please enter a valid WhatsApp number' }
  if (has('level')) { out.level = LEVELS.includes(b.level) ? b.level : null }
  if (has('lessonType')) { if (![...LESSON_TYPES, 'both'].includes(b.lessonType)) return 'Choose 1-to-1 or group'; out.lesson_type = b.lessonType }
  if (has('subjects')) { out.subjects = Array.isArray(b.subjects) ? [...new Set(b.subjects.filter((x) => SUBJECTS.includes(x)))] : [] }
  if (has('startDate')) { out.start_date = b.startDate ? (isDate(b.startDate) ? b.startDate : NaN) : null; if (Number.isNaN(out.start_date)) return 'Invalid start date' }
  if (has('notes')) out.notes = str(b.notes, 2000) || null
  if (has('hourlyRate')) { const n = b.hourlyRate === '' || b.hourlyRate == null ? null : Number(b.hourlyRate); if (n !== null && !(Number.isInteger(n) && n >= 0 && n <= 2000)) return 'Hourly rate must be a whole number'; out.hourly_rate = n }
  if (has('lang')) out.lang = b.lang === 'zh' ? 'zh' : 'en'
  if (has('school')) out.school = str(b.school, 120) || null
  if (has('birthday')) { out.birthday = b.birthday ? (isDate(b.birthday) ? b.birthday : NaN) : null; if (Number.isNaN(out.birthday)) return 'Invalid birthday' }
  if (has('email')) { out.email = str(b.email, 120) || null; if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) return 'Please check the email address' }
  if (has('address')) out.address = str(b.address, 300) || null
  if (has('parentName')) out.parent_name = str(b.parentName, 80) || null
  if (has('parentRelation')) out.parent_relation = ['mother', 'father', 'guardian'].includes(b.parentRelation) ? b.parentRelation : null
  if (has('parentPhone')) {
    out.parent_phone = b.parentPhone ? normalPhone(b.parentPhone) : null
    if (out.parent_phone && (out.parent_phone.length < 9 || out.parent_phone.length > 15)) return "Please enter a valid parent's WhatsApp number"
  }
  if (partial && 'active' in b) out.active = b.active === true
  return out
}

export default async function handler(req, res) {
  if (!allow(req, res, ['GET', 'POST'])) return
  if (!(await requireAdmin(req, res))) return
  const sql = getSql()

  try {
    if (req.method === 'GET') {
      const students = await sql.query(`SELECT ${STUDENT_COLUMNS} FROM students s ORDER BY s.active DESC, s.name`)
      const requests = await sql.query(`SELECT ${REQUEST_COLUMNS} FROM student_requests r ORDER BY (r.status = 'pending') DESC, r.created_at DESC LIMIT 1000`)
      const fees = await sql`SELECT student_id, month, amount, paid, paid_at, note FROM student_fees WHERE month >= to_char(now() - interval '6 months', 'YYYY-MM')`
      const announcements = await sql`SELECT id, created_at, title, body, audience, student_id, to_char(until, 'YYYY-MM-DD') AS until FROM announcements ORDER BY created_at DESC LIMIT 100`
      const [t] = await sql`SELECT value FROM admin_settings WHERE key = 'templates'`
      return send(res, 200, { ok: true, students, requests, fees, announcements, templates: t ? JSON.parse(t.value) : {} })
    }

    const b = readBody(req)
    const id = Number(b.id)

    if (b.action === 'create') {
      const f = fields(b, false)
      if (typeof f === 'string') return fail(res, 400, f)
      const lessons = await cleanLessons(sql, b.lessons, f.lesson_type)
      if (!lessons) return fail(res, 400, 'Check the lesson dates and times')
      f.lesson_type = typeOf(lessons, f.lesson_type)
      const enquiryId = isDbId(Number(b.enquiryId)) ? Number(b.enquiryId) : null
      const pin = await uniquePin(sql, f.phone)
      const [row] = await sql`
        INSERT INTO students (name, phone, pin_hash, pin_enc, level, lesson_type, subjects, lessons, start_date, enquiry_id, lang, notes, hourly_rate,
          school, birthday, email, address, parent_name, parent_relation, parent_phone)
        VALUES (${f.name}, ${f.phone}, ${hashPin(pin)}, ${encryptPin(pin)}, ${f.level}, ${f.lesson_type}, ${f.subjects}, ${JSON.stringify(lessons)}::jsonb, ${f.start_date}, ${enquiryId}, ${f.lang}, ${f.notes}, ${f.hourly_rate ?? null},
          ${f.school}, ${f.birthday}, ${f.email}, ${f.address}, ${f.parent_name}, ${f.parent_relation}, ${f.parent_phone})
        RETURNING id`
      const created = await getStudent(sql, row.id)
      await syncSlots(sql, null, created)
      if (enquiryId) await sql`UPDATE enquiries SET status = 'confirmed' WHERE id = ${enquiryId}`
      return send(res, 201, { ok: true, student: created, pin })
    }

    if (b.action === 'setFee') {
      const sid = Number(b.studentId)
      if (!isDbId(sid) || !/^\d{4}-\d{2}$/.test(b.month || '')) return fail(res, 400, 'Invalid fee')
      const amount = b.amount === '' || b.amount == null ? null : Number(b.amount)
      if (amount !== null && !(Number.isInteger(amount) && amount >= 0 && amount <= 100000)) return fail(res, 400, 'Amount must be a whole number of ringgit')
      const paid = b.paid === true
      const [row] = await sql`
        INSERT INTO student_fees (student_id, month, amount, paid, paid_at, note)
        VALUES (${sid}, ${b.month}, ${amount}, ${paid}, ${paid ? new Date() : null}, ${str(b.note, 300) || null})
        ON CONFLICT (student_id, month) DO UPDATE SET amount = EXCLUDED.amount, paid = EXCLUDED.paid,
          paid_at = CASE WHEN EXCLUDED.paid AND NOT student_fees.paid THEN now() WHEN EXCLUDED.paid THEN student_fees.paid_at ELSE NULL END,
          note = EXCLUDED.note, updated_at = now()
        RETURNING student_id, month, amount, paid, paid_at, note`
      return send(res, 200, { ok: true, fee: row })
    }

    if (b.action === 'announce') {
      const title = str(b.title, 120)
      if (title.length < 2) return fail(res, 400, 'Please add a title')
      const audience = ['all', 'private', 'group', 'student'].includes(b.audience) ? b.audience : 'all'
      const sid = audience === 'student' ? Number(b.studentId) : null
      if (audience === 'student' && !isDbId(sid)) return fail(res, 400, 'Choose a student')
      const until = isDate(b.until) ? b.until : null
      const [row] = await sql`
        INSERT INTO announcements (title, body, audience, student_id, until) VALUES (${title}, ${str(b.body, 2000) || null}, ${audience}, ${sid}, ${until})
        RETURNING id, created_at, title, body, audience, student_id, to_char(until, 'YYYY-MM-DD') AS until`
      return send(res, 201, { ok: true, announcement: row })
    }

    if (b.action === 'unannounce') {
      await sql`DELETE FROM announcements WHERE id = ${Number(b.id)}`
      return send(res, 200, { ok: true })
    }

    if (b.action === 'saveTemplates') {
      // { key: { en, zh } } with plain text; anything else is ignored.
      const t = b.templates && typeof b.templates === 'object' ? b.templates : {}
      const clean = {}
      for (const [k, v] of Object.entries(t).slice(0, 30)) {
        if (!/^[a-zA-Z]{2,40}$/.test(k) || !v || typeof v !== 'object') continue
        clean[k] = { en: str(v.en, 3000), zh: str(v.zh, 3000) }
      }
      await sql`INSERT INTO admin_settings (key, value) VALUES ('templates', ${JSON.stringify(clean)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
      return send(res, 200, { ok: true, templates: clean })
    }

    if (b.action === 'moveSeries') {
      const sid = Number(b.studentId)
      const s = isDbId(sid) ? await getStudent(sql, sid) : null
      if (!s) return fail(res, 404, 'Student not found')
      if (!isDate(b.lessonDate) || !isDate(b.toDate) || !HHMM.test(b.toStart || '') || !HHMM.test(b.toEnd || '') || b.toStart >= b.toEnd) return fail(res, 400, 'Check the new date and times')
      const old = (s.lessons || []).find((l) => l.start === b.lessonStart && covers(l, b.lessonDate))
      if (!old) return fail(res, 400, 'That lesson is not on their schedule')
      const weekday = weekdayOf(b.toDate)
      const [slot] = await sql.query(`SELECT id FROM availability_slots WHERE weekday = $1 AND start_time = $2::time AND end_time = $3::time`, [weekday, b.toStart, b.toEnd])
      // The new pattern starts at the moved lesson (or this one, if moved later in the week). A one-off lesson just moves.
      const newFrom = b.toDate < b.lessonDate ? b.toDate : b.lessonDate
      const lessons = old.once
        ? sortLessons([...s.lessons.filter((l) => l !== old), { ...old, weekday, start: b.toStart, end: b.toEnd, slot_id: slot?.id ?? null, from: b.toDate, until: b.toDate }])
        : splitSeries(s.lessons || [], old, b.lessonDate, { weekday, start: b.toStart, end: b.toEnd, slot_id: slot?.id }, newFrom)
      await saveLessons(sql, s, lessons)
      const after = await getStudent(sql, sid)
      await syncSlots(sql, s, after)
      const cleared = await clearOrphans(sql, after)
      return send(res, 200, { ok: true, student: after, cleared })
    }

    if (b.action === 'endSeries') {
      // Cancel this and all following: the weekly lesson's last lesson becomes the week before.
      const sid = Number(b.studentId)
      const s = isDbId(sid) ? await getStudent(sql, sid) : null
      if (!s) return fail(res, 404, 'Student not found')
      if (!isDate(b.lessonDate)) return fail(res, 400, 'Invalid lesson date')
      const old = (s.lessons || []).find((l) => l.start === b.lessonStart && covers(l, b.lessonDate))
      if (!old) return fail(res, 400, 'That lesson is not on their schedule')
      const until = addDays(b.lessonDate, -1)
      const rest = (s.lessons || []).filter((l) => l !== old)
      const lessons = sortLessons(old.once || (old.from && old.from > until) ? rest : [...rest, { ...old, until }])
      await saveLessons(sql, s, lessons)
      const after = await getStudent(sql, sid)
      await syncSlots(sql, s, after)
      const cleared = await clearOrphans(sql, after)
      return send(res, 200, { ok: true, student: after, cleared })
    }

    if (b.action === 'setBreaks') {
      // Breaks pause a student's lessons from one date to another (no lessons, no fee); their
      // weekly lessons and the enquiry slots are left as they are.
      const sid = Number(b.studentId)
      if (!isDbId(sid)) return fail(res, 400, 'Invalid student')
      const list = Array.isArray(b.breaks) ? b.breaks.slice(0, 30) : []
      const breaks = []
      for (const x of list) {
        if (!isDate(x?.from) || !isDate(x?.until) || x.until < x.from) return fail(res, 400, 'Check the break dates (the end must be on or after the start)')
        breaks.push({ from: x.from, until: x.until, ...(str(x.note, 120) ? { note: str(x.note, 120) } : {}) })
      }
      breaks.sort((p, q) => p.from.localeCompare(q.from))
      await sql`UPDATE students SET breaks = ${JSON.stringify(breaks)}::jsonb WHERE id = ${sid}`
      const after = await getStudent(sql, sid)
      if (!after) return fail(res, 404, 'Student not found')
      return send(res, 200, { ok: true, student: after })
    }

    if (b.action === 'addLesson') {
      // From the calendar: one extra class on a date, or (weekly) a new weekly lesson starting that date.
      const sid = Number(b.studentId)
      const s = isDbId(sid) ? await getStudent(sql, sid) : null
      if (!s) return fail(res, 404, 'Student not found')
      if (!isDate(b.date)) return fail(res, 400, 'Pick a date')
      const kind = b.kind === 'group' ? 'group' : 'private'
      const [l] = (await cleanLessons(sql, [b.weekly === true
        ? { weekday: weekdayOf(b.date), from: b.date, start: b.start, end: b.end, kind }
        : { once: true, date: b.date, start: b.start, end: b.end, kind }])) || []
      if (!l) return fail(res, 400, 'Check the start and end time')
      if ((s.lessons || []).some((x) => covers(x, b.date) && x.start < l.end && l.start < x.end)) return fail(res, 409, `${s.name} already has a lesson at that time`)
      await saveLessons(sql, s, sortLessons([...(s.lessons || []), l]))
      const after = await getStudent(sql, sid)
      await syncSlots(sql, s, after)
      return send(res, 200, { ok: true, student: after })
    }

    if (b.action === 'move' || b.action === 'cancelLesson') {
      // One lesson on one date changes; the weekly pattern and every other week stay as they are.
      const sid = Number(b.studentId)
      const s = isDbId(sid) ? await getStudent(sql, sid) : null
      if (!s) return fail(res, 404, 'Student not found')
      if (!isDate(b.lessonDate)) return fail(res, 400, 'Invalid lesson date')
      const lesson = (s.lessons || []).find((l) => l.start === b.lessonStart && covers(l, b.lessonDate))
      if (!lesson) return fail(res, 400, 'That lesson is not on their schedule')
      const from = { weekday: lesson.weekday, start: lesson.start, end: lesson.end, kind: kindOf(lesson, s) }
      let to = null
      if (b.action === 'move') {
        if (!isDate(b.toDate) || !HHMM.test(b.toStart || '') || !HHMM.test(b.toEnd || '') || b.toStart >= b.toEnd) return fail(res, 400, 'Check the new date and times')
        const weekday = weekdayOf(b.toDate)
        const [slot] = await sql.query(`SELECT id FROM availability_slots WHERE weekday = $1 AND start_time = $2::time AND end_time = $3::time`, [weekday, b.toStart, b.toEnd])
        to = { date: b.toDate, weekday, start: b.toStart, end: b.toEnd, slot: slot?.id ?? null, label: `${dateLabel(b.toDate)} ${hm(b.toStart)}–${hm(b.toEnd)}` }
      }
      const kind = b.action === 'move' ? 'reschedule' : 'absence'
      // A tutor cancellation isn't charged; marking a student absent (a no-show) is.
      const byTutor = !(b.action === 'cancelLesson' && b.absent === true)
      const replyText = byTutor ? 'Changed by your tutor' : 'Marked absent by your tutor'
      // Reuse the request already on this lesson (a student's pending ask, or an earlier change) so there is only ever one.
      const [existing] = await sql.query(`SELECT id FROM student_requests WHERE student_id = $1 AND lesson_date = $2::date AND kind <> 'change'
          AND status IN ('pending','approved') AND (from_lesson IS NULL OR from_lesson->>'start' = $3) ORDER BY created_at DESC LIMIT 1`, [sid, b.lessonDate, lesson.start])
      let rid
      if (existing) {
        await sql`
          UPDATE student_requests SET kind = ${kind}, status = 'approved', decided_at = now(), from_lesson = ${JSON.stringify(from)}::jsonb,
            to_date = ${to?.date ?? null}, to_weekday = ${to?.weekday ?? null}, to_start = ${to?.start ?? null}, to_end = ${to?.end ?? null},
            to_slot_id = ${to?.slot ?? null}, to_label = ${to?.label ?? null}, reply = COALESCE(reply, ${replyText}), by_tutor = ${byTutor}
          WHERE id = ${existing.id}`
        rid = existing.id
      } else {
        const [row] = await sql`
          INSERT INTO student_requests (student_id, kind, lesson_date, from_lesson, to_slot_id, to_date, to_weekday, to_start, to_end, to_label, status, reply, decided_at, by_tutor)
          VALUES (${sid}, ${kind}, ${b.lessonDate}, ${JSON.stringify(from)}::jsonb, ${to?.slot ?? null}, ${to?.date ?? null}, ${to?.weekday ?? null},
            ${to?.start ?? null}, ${to?.end ?? null}, ${to?.label ?? null}, 'approved', ${replyText}, now(), ${byTutor})
          RETURNING id`
        rid = row.id
      }
      const [request] = await sql.query(`SELECT ${REQUEST_COLUMNS} FROM student_requests r WHERE r.id = $1`, [rid])
      return send(res, 200, { ok: true, request })
    }

    if (!isDbId(id)) return fail(res, 400, 'Invalid id')

    if (b.action === 'update') {
      const before = await getStudent(sql, id)
      if (!before) return fail(res, 404, 'Student not found')
      const f = fields(b, true)
      if (typeof f === 'string') return fail(res, 400, f)
      if ('lessons' in b) {
        const clean = await cleanLessons(sql, b.lessons, f.lesson_type || before.lesson_type)
        if (!clean) return fail(res, 400, 'Check the lesson dates and times')
        const lessons = mergeLessons(before, clean)
        f.lessons = JSON.stringify(lessons)
        f.lesson_type = typeOf(lessons, f.lesson_type || before.lesson_type)
      }
      const keys = Object.keys(f)
      if (!keys.length) return fail(res, 400, 'Nothing to update')
      await sql.query(`UPDATE students SET ${keys.map((k, i) => `${k} = $${i + 2}${k === 'lessons' ? '::jsonb' : ''}`).join(', ')} WHERE id = $1`, [id, ...keys.map((k) => f[k])])
      const after = await getStudent(sql, id)
      // Free or take slots when the lessons, class type or active state changed.
      await syncSlots(sql, before, after)
      const cleared = 'lessons' in f ? await clearOrphans(sql, after) : 0
      return send(res, 200, { ok: true, student: after, cleared })
    }

    if (b.action === 'resetPin') {
      const s = await getStudent(sql, id)
      if (!s) return fail(res, 404, 'Student not found')
      const pin = await uniquePin(sql, s.phone, id)
      await sql`UPDATE students SET pin_hash = ${hashPin(pin)}, pin_enc = ${encryptPin(pin)} WHERE id = ${id}`
      return send(res, 200, { ok: true, pin })
    }

    if (b.action === 'resetCalendar') {
      await sql`UPDATE students SET cal_token = NULL WHERE id = ${id}`
      return send(res, 200, { ok: true })
    }

    if (b.action === 'showPin') {
      const [row] = await sql`SELECT pin_enc FROM students WHERE id = ${id}`
      if (!row) return fail(res, 404, 'Student not found')
      return send(res, 200, { ok: true, pin: decryptPin(row.pin_enc) })
    }

    if (b.action === 'delete') {
      const s = await getStudent(sql, id)
      if (!s) return fail(res, 404, 'Student not found')
      await sql`DELETE FROM students WHERE id = ${id}`
      await syncSlots(sql, s, null)
      return send(res, 200, { ok: true, id })
    }

    if (b.action === 'undo') {
      const rows = await sql`UPDATE student_requests SET status = 'cancelled', decided_at = now() WHERE id = ${id} AND kind <> 'change' AND status IN ('pending','approved') RETURNING id`
      if (!rows.length) return fail(res, 409, 'Nothing to undo')
      const [request] = await sql.query(`SELECT ${REQUEST_COLUMNS} FROM student_requests r WHERE r.id = $1`, [id])
      return send(res, 200, { ok: true, request })
    }

    if (b.action === 'decide') {
      if (!['approved', 'rejected'].includes(b.status)) return fail(res, 400, 'Invalid decision')
      const reply = str(b.reply, 500) || null
      const [cur] = await sql.query(`SELECT ${REQUEST_COLUMNS} FROM student_requests r WHERE r.id = $1`, [id])
      if (!cur || cur.status !== 'pending') return fail(res, 409, 'This request was already answered or withdrawn')

      // Accepting at another time (agreed on WhatsApp): replace the requested time first.
      if (b.status === 'approved' && b.time && cur.kind !== 'absence') {
        const t = b.time
        if (!HHMM.test(t.start || '') || !HHMM.test(t.end || '') || t.start >= t.end) return fail(res, 400, 'Check the start and end time')
        let date = null
        let weekday
        if (cur.kind === 'reschedule') {
          if (!isDate(t.date)) return fail(res, 400, 'Pick a date')
          date = t.date
          weekday = weekdayOf(date)
        } else {
          weekday = Number(t.weekday)
          if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return fail(res, 400, 'Pick a day')
        }
        const [slot] = await sql.query(`SELECT id FROM availability_slots WHERE weekday = $1 AND start_time = $2::time AND end_time = $3::time`, [weekday, t.start, t.end])
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        const label = `${date ? dateLabel(date) : `Every ${days[weekday]}`} ${hm(t.start)}–${hm(t.end)}`
        await sql`
          UPDATE student_requests SET to_date = ${date}, to_weekday = ${weekday}, to_start = ${t.start}, to_end = ${t.end}, to_slot_id = ${slot?.id ?? null}, to_label = ${label}
          WHERE id = ${id}`
      }

      const [rq] = await sql`
        UPDATE student_requests SET status = ${b.status}, reply = ${reply}, decided_at = now()
        WHERE id = ${id} AND status = 'pending' RETURNING id, student_id, kind, to_slot_id, to_weekday, to_start, to_end, from_lesson, to_char(lesson_date, 'YYYY-MM-DD') AS lesson_date, to_char(to_date, 'YYYY-MM-DD') AS to_date`
      if (!rq) return fail(res, 409, 'This request was already answered or withdrawn')
      let student = null
      if (b.status === 'approved' && rq.kind === 'change' && rq.to_start) {
        // Swap the weekly lesson they asked about for the new time (or add it if they had none).
        const before = await getStudent(sql, rq.student_id)
        if (before) {
          const old = rq.from_lesson && rq.lesson_date && (before.lessons || []).find((l) => l.start === rq.from_lesson.start && covers(l, rq.lesson_date))
          const was = old || (rq.from_lesson && (before.lessons || []).find((l) => l.weekday === rq.from_lesson.weekday && l.start === rq.from_lesson.start))
          const next = { weekday: rq.to_weekday, start: rq.to_start, end: rq.to_end, kind: kindOf(was || rq.from_lesson, before), slot_id: rq.to_slot_id ?? null }
          // From that lesson on ("this and all following"); older requests replace the weekly lesson outright.
          const lessons = old
            ? splitSeries(before.lessons || [], old, rq.lesson_date, next, rq.to_date && rq.to_date < rq.lesson_date ? rq.to_date : rq.lesson_date)
            : sortLessons([...(before.lessons || []).filter((l) => !(rq.from_lesson && l.weekday === rq.from_lesson.weekday && l.start === rq.from_lesson.start)), next])
          await saveLessons(sql, before, lessons)
          student = await getStudent(sql, rq.student_id)
          await syncSlots(sql, before, student)
          await clearOrphans(sql, student)
        }
      }
      const [request] = await sql.query(`SELECT ${REQUEST_COLUMNS} FROM student_requests r WHERE r.id = $1`, [id])
      return send(res, 200, { ok: true, request, student })
    }

    return fail(res, 400, 'Unknown action')
  } catch (err) {
    console.error('[api/admin/students]', err)
    return fail(res, 500, 'Database error')
  }
}
