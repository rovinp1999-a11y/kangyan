// Admin-only. GET /api/admin/enquiries → list; PATCH { id, status } → update.
import { getSql } from '../_db.js'
import { requireAdmin } from '../_auth.js'
import { allow, readBody, send, fail } from '../_http.js'
import { ENQUIRY_STATUSES } from '../../shared/constants.js'

export default async function handler(req, res) {
  if (!allow(req, res, ['GET', 'PATCH'])) return
  if (!requireAdmin(req, res)) return
  const sql = getSql()

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, created_at, student_name, email, phone, level, subjects, format, message, preferred_slots, status
        FROM enquiries ORDER BY created_at DESC LIMIT 300`
      return send(res, 200, { ok: true, enquiries: rows })
    }

    const { id, status } = readBody(req)
    if (!Number.isInteger(id) || !ENQUIRY_STATUSES.includes(status)) return fail(res, 400, 'Invalid id or status')
    const rows = await sql`UPDATE enquiries SET status = ${status} WHERE id = ${id} RETURNING id, status`
    if (!rows.length) return fail(res, 404, 'Enquiry not found')
    return send(res, 200, { ok: true, enquiry: rows[0] })
  } catch (err) {
    console.error('[api/admin/enquiries]', err)
    return fail(res, 500, 'Database error')
  }
}
