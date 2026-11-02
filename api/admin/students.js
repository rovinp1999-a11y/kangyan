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
//   POST { action: 'moveSeries', studentId, lessonDate, lessonStart, toDate, toStart, toEnd } → this and all following lessons
//   POST { action: 'undo', id }                                                     → withdraw a move / cancellation
// A student has one or more weekly lessons ({ weekday, start, end }). When a 1-to-1
// lesson matches a timetable slot, that slot is marked taken, and freed again when nobody uses it.
import { getSql } from '../_db.js'
import { requireAdmin } from '../_auth.js'
import { allow, readBody, send, fail, isDbId } from '../_http.js'
import { normalPhone, newPin, hashPin, checkPin, encryptPin, decryptPin } from '../_students.js'
import { LEVELS, SUBJECTS, LESSON_TYPES } from '../../shared/constants.js'
import { SLOT_COLUMNS } from '../slots.js'
import { isDate, weekdayOf, dateLabel, covers, addDays, todayMY } from '../../shared/lessons.js'

const STUDENT_COLUMNS = `s.id, s.created_at, s.name, s.phone, s.level, s.lesson_type, s.subjects, s.lessons,
  to_char(s.start_date, 'YYYY-MM-DD') AS start_date, s.active, s.enquiry_id, s.lang, s.notes, s.last_login`
const REQUEST_COLUMNS = `r.id, r.created_at, r.student_id, r.kind, to_char(r.lesson_date, 'YYYY-MM-DD') AS lesson_date, r.from_lesson,
  r.to_slot_id, to_char(r.to_date, 'YYYY-MM-DD') AS to_date, r.to_weekday, r.to_start, r.to_end, r.to_label, r.recording, r.note, r.status, r.reply, r.decided_at`
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
// Slots a 1-to-1 student holds now or later (lessons that already ended don't count).
const slotIds = (st) => (st && st.active && st.lesson_type === 'private'
  ? (st.lessons || []).filter((l) => !l.until || l.until >= todayMY()).map((l) => l.slot_id).filter(Boolean) : [])
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
    if (l.until && l.until < today) continue
    if (l === old || (l.weekday === old.weekday && l.start === old.start && covers(l, fromDate))) {
      const until = addDays(fromDate, -1)
      if (!(l.from && l.from > until) && until >= today) out.push({ ...l, until })
    } else out.push(l)
  }
  out.push({ weekday: next.weekday, start: next.start, end: next.end, slot_id: next.slot_id ?? null, from: newFrom, ...(old.until ? { until: old.until } : {}) })
  return sortLessons(out)
}

/** Weekly lessons from the form, each linked to the timetable slot with the same day and times. */
async function cleanLessons(sql, list) {
  if (!Array.isArray(list)) return []
  const slots = await sql.query(`SELECT ${SLOT_COLUMNS} FROM availability_slots`)
  const out = []
  for (const l of list.slice(0, 7)) {
    const weekday = Number(l?.weekday)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !HHMM.test(l.start) || !HHMM.test(l.end) || l.start >= l.end) return null
    const from = isDate(l.from) ? l.from : null
    const until = isDate(l.until) ? l.until : null
    if (until && until < todayMY()) continue // already over
    if (out.some((o) => o.weekday === weekday && o.start === l.start && (o.from || null) === from)) continue
    const slot = slots.find((x) => x.weekday === weekday && x.start === l.start && x.end === l.end)
    out.push({ weekday, start: l.start, end: l.end, slot_id: slot ? slot.id : null, ...(from ? { from } : {}), ...(until ? { until } : {}) })
  }
  return sortLessons(out)
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

/** Keep the timetable in step with 1-to-1 students' weekly lessons. */
async function syncSlots(sql, before, after) {
  const was = slotIds(before)
  const now = slotIds(after)
  for (const id of now) if (!was.includes(id)) await sql`UPDATE availability_slots SET status = 'taken' WHERE id = ${id}`
  for (const id of was) {
    if (now.includes(id)) continue
    const [{ n }] = await sql`
      SELECT count(*)::int AS n FROM students
      WHERE active AND lesson_type = 'private' AND lessons @> ${JSON.stringify([{ slot_id: id }])}::jsonb`
    if (!n) await sql`UPDATE availability_slots SET status = 'open' WHERE id = ${id}`
  }
}

/** Validated student fields from the request body; `partial` allows leaving fields out. */
function fields(b, partial) {
  const out = {}
  const has = (k) => !partial || k in b
  if (has('name')) { out.name = str(b.name, 80); if (out.name.length < 2) return 'Please enter the student name' }
  if (has('phone')) { out.phone = normalPhone(b.phone); if (out.phone.length < 9 || out.phone.length > 15) return 'Please enter a valid WhatsApp number' }
  if (has('level')) { out.level = LEVELS.includes(b.level) ? b.level : null }
  if (has('lessonType')) { if (!LESSON_TYPES.includes(b.lessonType)) return 'Choose 1-to-1 or group'; out.lesson_type = b.lessonType }
  if (has('subjects')) { out.subjects = Array.isArray(b.subjects) ? [...new Set(b.subjects.filter((x) => SUBJECTS.includes(x)))] : [] }
  if (has('startDate')) { out.start_date = b.startDate ? (isDate(b.startDate) ? b.startDate : NaN) : null; if (Number.isNaN(out.start_date)) return 'Invalid start date' }
  if (has('notes')) out.notes = str(b.notes, 2000) || null
  if (has('lang')) out.lang = b.lang === 'zh' ? 'zh' : 'en'
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
      const requests = await sql.query(`SELECT ${REQUEST_COLUMNS} FROM student_requests r ORDER BY (r.status = 'pending') DESC, r.created_at DESC LIMIT 300`)
      return send(res, 200, { ok: true, students, requests })
    }

    const b = readBody(req)
    const id = Number(b.id)

    if (b.action === 'create') {
      const f = fields(b, false)
      if (typeof f === 'string') return fail(res, 400, f)
      const lessons = await cleanLessons(sql, b.lessons)
      if (!lessons) return fail(res, 400, 'Check the weekly lesson times')
      const enquiryId = isDbId(Number(b.enquiryId)) ? Number(b.enquiryId) : null
      const pin = await uniquePin(sql, f.phone)
      const [row] = await sql`
        INSERT INTO students (name, phone, pin_hash, pin_enc, level, lesson_type, subjects, lessons, start_date, enquiry_id, lang, notes)
        VALUES (${f.name}, ${f.phone}, ${hashPin(pin)}, ${encryptPin(pin)}, ${f.level}, ${f.lesson_type}, ${f.subjects}, ${JSON.stringify(lessons)}::jsonb, ${f.start_date}, ${enquiryId}, ${f.lang}, ${f.notes})
        RETURNING id`
      const created = await getStudent(sql, row.id)
      await syncSlots(sql, null, created)
      if (enquiryId) await sql`UPDATE enquiries SET status = 'confirmed' WHERE id = ${enquiryId}`
      return send(res, 201, { ok: true, student: created, pin })
    }

    if (b.action === 'moveSeries') {
      const sid = Number(b.studentId)
      const s = isDbId(sid) ? await getStudent(sql, sid) : null
      if (!s) return fail(res, 404, 'Student not found')
      if (!isDate(b.lessonDate) || !isDate(b.toDate) || !HHMM.test(b.toStart || '') || !HHMM.test(b.toEnd || '') || b.toStart >= b.toEnd) return fail(res, 400, 'Check the new date and times')
      const old = (s.lessons || []).find((l) => l.start === b.lessonStart && covers(l, b.lessonDate))
      if (!old) return fail(res, 400, 'That lesson is not on their weekly schedule')
      const weekday = weekdayOf(b.toDate)
      const [slot] = await sql.query(`SELECT id FROM availability_slots WHERE weekday = $1 AND start_time = $2::time AND end_time = $3::time`, [weekday, b.toStart, b.toEnd])
      // The new pattern starts at the moved lesson (or this one, if moved later in the week).
      const newFrom = b.toDate < b.lessonDate ? b.toDate : b.lessonDate
      const lessons = splitSeries(s.lessons || [], old, b.lessonDate, { weekday, start: b.toStart, end: b.toEnd, slot_id: slot?.id }, newFrom)
      await sql`UPDATE students SET lessons = ${JSON.stringify(lessons)}::jsonb WHERE id = ${sid}`
      const after = await getStudent(sql, sid)
      await syncSlots(sql, s, after)
      const cleared = await clearOrphans(sql, after)
      return send(res, 200, { ok: true, student: after, cleared })
    }

    if (b.action === 'move' || b.action === 'cancelLesson') {
      // One lesson on one date changes; the weekly pattern and every other week stay as they are.
      const sid = Number(b.studentId)
      const s = isDbId(sid) ? await getStudent(sql, sid) : null
      if (!s) return fail(res, 404, 'Student not found')
      if (!isDate(b.lessonDate)) return fail(res, 400, 'Invalid lesson date')
      const lesson = (s.lessons || []).find((l) => l.start === b.lessonStart && covers(l, b.lessonDate))
      if (!lesson) return fail(res, 400, 'That lesson is not on their weekly schedule')
      const from = { weekday: lesson.weekday, start: lesson.start, end: lesson.end }
      let to = null
      if (b.action === 'move') {
        if (!isDate(b.toDate) || !HHMM.test(b.toStart || '') || !HHMM.test(b.toEnd || '') || b.toStart >= b.toEnd) return fail(res, 400, 'Check the new date and times')
        const weekday = weekdayOf(b.toDate)
        const [slot] = await sql.query(`SELECT id FROM availability_slots WHERE weekday = $1 AND start_time = $2::time AND end_time = $3::time`, [weekday, b.toStart, b.toEnd])
        to = { date: b.toDate, weekday, start: b.toStart, end: b.toEnd, slot: slot?.id ?? null, label: `${dateLabel(b.toDate)} ${hm(b.toStart)}–${hm(b.toEnd)}` }
      }
      const kind = b.action === 'move' ? 'reschedule' : 'absence'
      // Reuse the request already on this lesson (a student's pending ask, or an earlier change) so there is only ever one.
      const [existing] = await sql.query(`SELECT id FROM student_requests WHERE student_id = $1 AND lesson_date = $2::date AND kind <> 'change'
          AND status IN ('pending','approved') AND (from_lesson IS NULL OR from_lesson->>'start' = $3) ORDER BY created_at DESC LIMIT 1`, [sid, b.lessonDate, lesson.start])
      let rid
      if (existing) {
        await sql`
          UPDATE student_requests SET kind = ${kind}, status = 'approved', decided_at = now(), from_lesson = ${JSON.stringify(from)}::jsonb,
            to_date = ${to?.date ?? null}, to_weekday = ${to?.weekday ?? null}, to_start = ${to?.start ?? null}, to_end = ${to?.end ?? null},
            to_slot_id = ${to?.slot ?? null}, to_label = ${to?.label ?? null}, reply = COALESCE(reply, 'Changed by your tutor')
          WHERE id = ${existing.id}`
        rid = existing.id
      } else {
        const [row] = await sql`
          INSERT INTO student_requests (student_id, kind, lesson_date, from_lesson, to_slot_id, to_date, to_weekday, to_start, to_end, to_label, status, reply, decided_at)
          VALUES (${sid}, ${kind}, ${b.lessonDate}, ${JSON.stringify(from)}::jsonb, ${to?.slot ?? null}, ${to?.date ?? null}, ${to?.weekday ?? null},
            ${to?.start ?? null}, ${to?.end ?? null}, ${to?.label ?? null}, 'approved', 'Changed by your tutor', now())
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
        const lessons = await cleanLessons(sql, b.lessons)
        if (!lessons) return fail(res, 400, 'Check the weekly lesson times')
        f.lessons = JSON.stringify(lessons)
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
          const next = { weekday: rq.to_weekday, start: rq.to_start, end: rq.to_end, slot_id: rq.to_slot_id ?? null }
          const old = rq.from_lesson && rq.lesson_date && (before.lessons || []).find((l) => l.start === rq.from_lesson.start && covers(l, rq.lesson_date))
          // From that lesson on ("this and all following"); older requests replace the weekly lesson outright.
          const lessons = old
            ? splitSeries(before.lessons || [], old, rq.lesson_date, next, rq.to_date && rq.to_date < rq.lesson_date ? rq.to_date : rq.lesson_date)
            : sortLessons([...(before.lessons || []).filter((l) => !(rq.from_lesson && l.weekday === rq.from_lesson.weekday && l.start === rq.from_lesson.start)), next])
          await sql`UPDATE students SET lessons = ${JSON.stringify(lessons)}::jsonb WHERE id = ${rq.student_id}`
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
