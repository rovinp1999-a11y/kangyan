// Admin-only. GET /api/admin/enquiries → list; PATCH { id, status?, notes? } → update.
import { getSql } from '../_db.js'
import { requireAdmin } from '../_auth.js'
import { allow, readBody, send, fail, isDbId } from '../_http.js'
import { ENQUIRY_STATUSES } from '../../shared/constants.js'

export default async function handler(req, res) {
  if (!allow(req, res, ['GET', 'PATCH'])) return
  if (!requireAdmin(req, res)) return
  const sql = getSql()

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, created_at, student_name, email, phone, level, subjects, format, lesson_type, location, school, lang, enquirer, message, preferred_slots, custom_times, status, admin_notes
        FROM enquiries ORDER BY created_at DESC LIMIT 300`
      return send(res, 200, { ok: true, enquiries: rows })
    }

    const b = readBody(req)
    const id = b.id
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
