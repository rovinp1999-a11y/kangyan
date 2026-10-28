// Admin-only: existing students and their requests.
//   GET                                       → { students, requests }
//   POST { action: 'create', ...student }     → { student, pin }   (PIN is shown once)
//   POST { action: 'update', id, ...fields }  → { student }
//   POST { action: 'resetPin', id }           → { pin }
//   POST { action: 'delete', id }             → removes the student and their requests
//   POST { action: 'decide', id, status, reply } → approve / reject a pending request
// A 1-to-1 student's regular slot is marked taken, and freed again when nobody uses it.
import { getSql } from '../_db.js'
import { requireAdmin } from '../_auth.js'
import { allow, readBody, send, fail, isDbId } from '../_http.js'
import { normalPhone, newPin, hashPin, checkPin } from '../_students.js'
import { LEVELS, SUBJECTS, LESSON_TYPES } from '../../shared/constants.js'
import { isDate } from '../../shared/lessons.js'

const STUDENT_COLUMNS = `s.id, s.created_at, s.name, s.phone, s.level, s.lesson_type, s.subjects, s.slot_id,
  to_char(s.start_date, 'YYYY-MM-DD') AS start_date, s.active, s.enquiry_id, s.lang, s.notes, s.last_login`
const REQUEST_COLUMNS = `r.id, r.created_at, r.student_id, r.kind, to_char(r.lesson_date, 'YYYY-MM-DD') AS lesson_date,
  r.to_slot_id, to_char(r.to_date, 'YYYY-MM-DD') AS to_date, r.to_label, r.recording, r.note, r.status, r.reply, r.decided_at`
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

/** Keep the timetable in step with 1-to-1 students' regular slots. */
async function syncSlots(sql, lessonType, oldSlot, newSlot) {
  if (lessonType !== 'private') return
  if (newSlot) await sql`UPDATE availability_slots SET status = 'taken' WHERE id = ${newSlot}`
  if (oldSlot && oldSlot !== newSlot) {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM students WHERE slot_id = ${oldSlot} AND active AND lesson_type = 'private'`
    if (!n) await sql`UPDATE availability_slots SET status = 'open' WHERE id = ${oldSlot}`
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
  if (has('slotId')) { const n = Number(b.slotId); out.slot_id = b.slotId == null || b.slotId === '' ? null : isDbId(n) ? n : NaN; if (Number.isNaN(out.slot_id)) return 'Invalid slot' }
  if (has('startDate')) { out.start_date = b.startDate ? (isDate(b.startDate) ? b.startDate : NaN) : null; if (Number.isNaN(out.start_date)) return 'Invalid start date' }
  if (has('notes')) out.notes = str(b.notes, 2000) || null
  if (has('lang')) out.lang = b.lang === 'zh' ? 'zh' : 'en'
  if (partial && 'active' in b) out.active = b.active === true
  return out
}

export default async function handler(req, res) {
  if (!allow(req, res, ['GET', 'POST'])) return
  if (!requireAdmin(req, res)) return
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
      const enquiryId = isDbId(Number(b.enquiryId)) ? Number(b.enquiryId) : null
      const pin = await uniquePin(sql, f.phone)
      const [row] = await sql`
        INSERT INTO students (name, phone, pin_hash, level, lesson_type, subjects, slot_id, start_date, enquiry_id, lang, notes)
        VALUES (${f.name}, ${f.phone}, ${hashPin(pin)}, ${f.level}, ${f.lesson_type}, ${f.subjects}, ${f.slot_id}, ${f.start_date}, ${enquiryId}, ${f.lang}, ${f.notes})
        RETURNING id`
      await syncSlots(sql, f.lesson_type, null, f.slot_id)
      if (enquiryId) await sql`UPDATE enquiries SET status = 'confirmed' WHERE id = ${enquiryId}`
      return send(res, 201, { ok: true, student: await getStudent(sql, row.id), pin })
    }

    if (!isDbId(id)) return fail(res, 400, 'Invalid id')

    if (b.action === 'update') {
      const before = await getStudent(sql, id)
      if (!before) return fail(res, 404, 'Student not found')
      const f = fields(b, true)
      if (typeof f === 'string') return fail(res, 400, f)
      const keys = Object.keys(f)
      if (!keys.length) return fail(res, 400, 'Nothing to update')
      await sql.query(`UPDATE students SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...keys.map((k) => f[k])])
      const after = await getStudent(sql, id)
      // Free or take slots when the slot, class type or active state changed.
      const was = before.active && before.lesson_type === 'private' ? before.slot_id : null
      const now = after.active && after.lesson_type === 'private' ? after.slot_id : null
      if (was !== now) await syncSlots(sql, 'private', was, now)
      return send(res, 200, { ok: true, student: after })
    }

    if (b.action === 'resetPin') {
      const s = await getStudent(sql, id)
      if (!s) return fail(res, 404, 'Student not found')
      const pin = await uniquePin(sql, s.phone, id)
      await sql`UPDATE students SET pin_hash = ${hashPin(pin)} WHERE id = ${id}`
      return send(res, 200, { ok: true, pin })
    }

    if (b.action === 'delete') {
      const s = await getStudent(sql, id)
      if (!s) return fail(res, 404, 'Student not found')
      await sql`DELETE FROM students WHERE id = ${id}`
      if (s.active) await syncSlots(sql, s.lesson_type, s.slot_id, null)
      return send(res, 200, { ok: true, id })
    }

    if (b.action === 'decide') {
      if (!['approved', 'rejected'].includes(b.status)) return fail(res, 400, 'Invalid decision')
      const reply = str(b.reply, 500) || null
      const [r] = await sql`
        UPDATE student_requests SET status = ${b.status}, reply = ${reply}, decided_at = now()
        WHERE id = ${id} AND status = 'pending' RETURNING id, student_id, kind, to_slot_id`
      if (!r) return fail(res, 409, 'This request was already answered or withdrawn')
      let student = null
      if (b.status === 'approved' && r.kind === 'change' && r.to_slot_id) {
        const before = await getStudent(sql, r.student_id)
        await sql`UPDATE students SET slot_id = ${r.to_slot_id} WHERE id = ${r.student_id}`
        if (before?.active) await syncSlots(sql, before.lesson_type, before.slot_id, r.to_slot_id)
        student = await getStudent(sql, r.student_id)
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
