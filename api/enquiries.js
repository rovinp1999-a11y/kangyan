// POST /api/enquiries — a student/parent submits a tuition enquiry.
import { getSql } from './_db.js'
import { allow, readBody, send, fail } from './_http.js'
import { SUBJECTS, LEVELS, FORMATS, LESSON_TYPES, slotLabel } from '../shared/constants.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export default async function handler(req, res) {
  if (!allow(req, res, ['POST'])) return
  const b = readBody(req)

  // Honeypot: real users never fill this hidden field.
  if (str(b.website, 10)) return send(res, 200, { ok: true, id: 0 })

  const name = str(b.name, 80)
  const email = str(b.email, 120)
  const phone = str(b.phone, 30)
  const level = str(b.level, 40)
  const format = str(b.format, 20) || 'either'
  const lessonType = str(b.lessonType, 20) || 'private'
  const message = str(b.message, 2000)
  const subjects = Array.isArray(b.subjects) ? b.subjects.filter((s) => SUBJECTS.includes(s)) : []
  const slotIds = Array.isArray(b.preferredSlots)
    ? [...new Set(b.preferredSlots.map(Number).filter(Number.isInteger))].slice(0, 10)
    : []

  if (name.length < 2) return fail(res, 400, 'Please enter your name')
  const phoneDigits = phone.replace(/\D/g, '')
  if (!email && phoneDigits.length < 8) return fail(res, 400, 'Please give a WhatsApp number or an email')
  if (email && !EMAIL_RE.test(email)) return fail(res, 400, 'Please enter a valid email')
  if (phone && phoneDigits.length < 8) return fail(res, 400, 'Please enter a valid WhatsApp number')
  if (!LESSON_TYPES.includes(lessonType)) return fail(res, 400, 'Invalid lesson type')
  if (!LEVELS.includes(level)) return fail(res, 400, 'Please choose a level')
  if (subjects.length === 0) return fail(res, 400, 'Pick at least one subject')
  if (!FORMATS.some((f) => f.value === format)) return fail(res, 400, 'Invalid format')

  try {
    const sql = getSql()

    // Snapshot the chosen slots' labels so the enquiry stays readable even if
    // the availability is edited later.
    let preferred = []
    if (slotIds.length) {
      const rows = await sql`
        SELECT id, weekday, to_char(start_time,'HH24:MI') AS start, to_char(end_time,'HH24:MI') AS "end"
        FROM availability_slots WHERE id = ANY(${slotIds}) AND kind = ${lessonType}
        ORDER BY weekday, start_time`
      preferred = rows.map((r) => ({ id: r.id, label: slotLabel(r) }))
    }

    const [row] = await sql`
      INSERT INTO enquiries (student_name, email, phone, level, subjects, format, lesson_type, message, preferred_slots)
      VALUES (${name}, ${email || null}, ${phone || null}, ${level}, ${subjects}, ${format}, ${lessonType}, ${message || null}, ${JSON.stringify(preferred)}::jsonb)
      RETURNING id`
    return send(res, 201, { ok: true, id: row.id })
  } catch (err) {
    console.error('[api/enquiries]', err)
    return fail(res, 500, 'Could not save your enquiry. Please try again or email directly.')
  }
}
