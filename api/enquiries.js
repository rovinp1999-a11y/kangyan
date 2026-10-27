// POST /api/enquiries — a student/parent submits a tuition enquiry.
import { getSql } from './_db.js'
import { allow, readBody, send, fail, isDbId } from './_http.js'
import { SUBJECTS, LEVELS, FORMATS, LESSON_TYPES, ENQUIRERS, slotLabel } from '../shared/constants.js'

// No ? & = so an address can't smuggle extra parameters into a mailto: link.
const EMAIL_RE = /^[^\s@?&=]+@[^\s@?&=]+\.[^\s@?&=]+$/
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
  const location = str(b.location, 200)
  const lang = b.lang === 'zh' ? 'zh' : 'en'
  // Optional for pages cached before this question existed; must be valid if sent.
  const enquirer = b.enquirer == null || b.enquirer === '' ? null : str(b.enquirer, 10)
  const message = str(b.message, 2000)
  const subjects = Array.isArray(b.subjects) ? b.subjects.filter((s) => SUBJECTS.includes(s)) : []
  const slotIds = Array.isArray(b.preferredSlots)
    ? [...new Set(b.preferredSlots.map(Number).filter(isDbId))].slice(0, 50)
    : []

  const phoneDigits = phone.replace(/\D/g, '')
  // Checked in wizard order, so the client can send the student to the first problem.
  if (enquirer !== null && !ENQUIRERS.includes(enquirer)) return fail(res, 400, 'Please say who is filling this in', 'enquirer')
  if (name.length < 2) return fail(res, 400, 'Please enter your name', 'name')
  if (!LESSON_TYPES.includes(lessonType)) return fail(res, 400, 'Invalid lesson type', 'lessonType')
  if (!LEVELS.includes(level)) return fail(res, 400, 'Please choose a level', 'level')
  if (subjects.length === 0) return fail(res, 400, 'Pick at least one subject', 'subjects')
  if (!FORMATS.some((f) => f.value === format)) return fail(res, 400, 'Invalid format', 'format')
  if (format === 'in-person' && location.length < 2) return fail(res, 400, 'Please enter the lesson location', 'location')
  if (phone && phoneDigits.length < 8) return fail(res, 400, 'Please enter a valid WhatsApp number', 'phone')
  if (email && !EMAIL_RE.test(email)) return fail(res, 400, 'Please enter a valid email', 'email')
  if (!email && !phone) return fail(res, 400, 'Please give a WhatsApp number or an email', 'contact')

  try {
    const sql = getSql()

    // Snapshot the chosen slots' labels so the enquiry stays readable even if
    // the availability is edited later.
    let preferred = []
    if (slotIds.length) {
      const rows = await sql`
        SELECT id, weekday, to_char(start_time,'HH24:MI') AS start, to_char(end_time,'HH24:MI') AS "end"
        FROM availability_slots WHERE id = ANY(${slotIds}) AND kind = ${lessonType} AND status = 'open'
        ORDER BY weekday, start_time`
      preferred = rows.map((r) => ({ id: r.id, label: slotLabel(r), weekday: r.weekday, start: r.start, end: r.end }))
    }

    const [row] = await sql`
      INSERT INTO enquiries (student_name, email, phone, level, subjects, format, lesson_type, location, lang, enquirer, message, preferred_slots)
      VALUES (${name}, ${email || null}, ${phone || null}, ${level}, ${subjects}, ${format}, ${lessonType}, ${format === 'online' ? null : location || null}, ${lang}, ${enquirer}, ${message || null}, ${JSON.stringify(preferred)}::jsonb)
      RETURNING id`
    return send(res, 201, { ok: true, id: row.id })
  } catch (err) {
    console.error('[api/enquiries]', err)
    return fail(res, 500, 'Could not save your enquiry. Please try again or email directly.')
  }
}
