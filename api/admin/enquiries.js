// Admin-only. GET /api/admin/enquiries → list
//   PATCH { id, status?, notes? }            → status / private note
//   PATCH { id, details: { …enquiry fields } } → correct what the enquirer filled in
import { getSql } from '../_db.js'
import { requireAdmin } from '../_auth.js'
import { allow, readBody, send, fail, isDbId } from '../_http.js'
import { ENQUIRY_STATUSES, SUBJECTS, LEVELS, FORMATS, LESSON_TYPES, ENQUIRERS, slotLabel } from '../../shared/constants.js'

const EMAIL_RE = /^[^\s@?&=]+@[^\s@?&=]+\.[^\s@?&=]+$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Validated enquiry fields for an admin correction, or an error message. */
async function details(sql, d) {
  const name = str(d.name, 80)
  const email = str(d.email, 120)
  const phone = str(d.phone, 30)
  const format = str(d.format, 20)
  const location = str(d.location, 200)
  if (name.length < 2) return 'Please enter the name'
  if (!LEVELS.includes(d.level)) return 'Choose a level'
  if (!LESSON_TYPES.includes(d.lessonType)) return 'Choose 1-to-1 or group'
  if (!FORMATS.some((f) => f.value === format)) return 'Choose online or in person'
  if (d.enquirer != null && d.enquirer !== '' && !ENQUIRERS.includes(d.enquirer)) return 'Invalid enquirer'
  if (email && !EMAIL_RE.test(email)) return 'That email does not look right'
  if (phone && phone.replace(/\D/g, '').length < 8) return 'That WhatsApp number looks too short'
  if (!email && !phone) return 'Keep a WhatsApp number or an email'
  const subjects = Array.isArray(d.subjects) ? [...new Set(d.subjects.filter((x) => SUBJECTS.includes(x)))] : []
  if (!subjects.length) return 'Pick at least one subject'
  // Any timetable slot can be chosen here (the admin knows best); saved with its label like the website does.
  const ids = Array.isArray(d.preferredSlots) ? [...new Set(d.preferredSlots.map(Number).filter(isDbId))].slice(0, 50) : []
  const slots = ids.length ? await sql`
    SELECT id, weekday, to_char(start_time,'HH24:MI') AS start, to_char(end_time,'HH24:MI') AS "end"
    FROM availability_slots WHERE id = ANY(${ids}) ORDER BY weekday, start_time` : []
  const custom = format === 'in-person' && Array.isArray(d.customTimes)
    ? d.customTimes.filter((x) => x && Number.isInteger(x.weekday) && x.weekday >= 0 && x.weekday <= 6 && HHMM.test(x.start) && HHMM.test(x.end) && x.end > x.start)
      .map((x) => ({ weekday: x.weekday, start: x.start, end: x.end })).slice(0, 21)
    : []
  return {
    student_name: name, email: email || null, phone: phone || null, level: d.level, subjects, format,
    lesson_type: d.lessonType, location: format === 'online' ? null : location || null, school: str(d.school, 160) || null,
    enquirer: d.enquirer || null, message: str(d.message, 2000) || null,
    preferred_slots: JSON.stringify(format === 'in-person' ? [] : slots.map((x) => ({ id: x.id, label: slotLabel(x), weekday: x.weekday, start: x.start, end: x.end }))),
    custom_times: JSON.stringify(custom),
  }
}

const COLUMNS = `id, created_at, student_name, email, phone, level, subjects, format, lesson_type, location, school, lang, enquirer, message, preferred_slots, custom_times, status, admin_notes`

export default async function handler(req, res) {
  if (!allow(req, res, ['GET', 'PATCH'])) return
  if (!requireAdmin(req, res)) return
  const sql = getSql()

  try {
    if (req.method === 'GET') {
      const rows = await sql.query(`SELECT ${COLUMNS} FROM enquiries ORDER BY created_at DESC LIMIT 300`)
      return send(res, 200, { ok: true, enquiries: rows })
    }

    const b = readBody(req)
    const id = b.id
    if (b.details && typeof b.details === 'object') {
      if (!isDbId(id)) return fail(res, 400, 'Invalid id')
      const f = await details(sql, b.details)
      if (typeof f === 'string') return fail(res, 400, f)
      const keys = Object.keys(f)
      const cast = { preferred_slots: '::jsonb', custom_times: '::jsonb' }
      const rows = await sql.query(
        `UPDATE enquiries SET ${keys.map((k, i) => `${k} = $${i + 2}${cast[k] || ''}`).join(', ')} WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, ...keys.map((k) => f[k])],
      )
      if (!rows.length) return fail(res, 404, 'Enquiry not found')
      return send(res, 200, { ok: true, enquiry: rows[0] })
    }
    const status = b.status ?? null
    const notes = typeof b.notes === 'string' ? b.notes.slice(0, 4000) : null
    if (!isDbId(id)) return fail(res, 400, 'Invalid id')
    if (status === null && notes === null) return fail(res, 400, 'Nothing to update')
    if (status !== null && !ENQUIRY_STATUSES.includes(status)) return fail(res, 400, 'Invalid status')
    const rows = await sql`
      UPDATE enquiries SET status = COALESCE(${status}, status), admin_notes = COALESCE(${notes}, admin_notes)
      WHERE id = ${id} RETURNING id, status, admin_notes`
    if (!rows.length) return fail(res, 404, 'Enquiry not found')
    return send(res, 200, { ok: true, enquiry: rows[0] })
  } catch (err) {
    console.error('[api/admin/enquiries]', err)
    return fail(res, 500, 'Database error')
  }
}
