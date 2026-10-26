// Admin-only availability management.
//   POST   { weekday, start, end }  → create an open slot
//   PATCH  { id, status }           → 'open' | 'taken'
//   DELETE { id }                   → remove
import { getSql } from '../_db.js'
import { requireAdmin } from '../_auth.js'
import { allow, readBody, send, fail } from '../_http.js'
import { SLOT_COLUMNS } from '../slots.js'
import { SLOT_STATUSES } from '../../shared/constants.js'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export default async function handler(req, res) {
  if (!allow(req, res, ['POST', 'PATCH', 'DELETE'])) return
  if (!requireAdmin(req, res)) return
  const sql = getSql()
  const b = readBody(req)

  try {
    if (req.method === 'POST') {
      const weekday = Number(b.weekday)
      const { start, end } = b
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return fail(res, 400, 'Invalid weekday')
      if (!TIME_RE.test(start) || !TIME_RE.test(end) || start >= end) return fail(res, 400, 'End time must be after start time')
      const rows = await sql.query(
        `INSERT INTO availability_slots (weekday, start_time, end_time)
         VALUES ($1, $2, $3)
         ON CONFLICT (weekday, start_time, end_time) DO UPDATE SET status = 'open'
         RETURNING ${SLOT_COLUMNS}`,
        [weekday, start, end],
      )
      return send(res, 201, { ok: true, slot: rows[0] })
    }

    const id = Number(b.id)
    if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id')

    if (req.method === 'PATCH') {
      if (!SLOT_STATUSES.includes(b.status)) return fail(res, 400, 'Invalid status')
      const rows = await sql.query(
        `UPDATE availability_slots SET status = $1 WHERE id = $2 RETURNING ${SLOT_COLUMNS}`,
        [b.status, id],
      )
      if (!rows.length) return fail(res, 404, 'Slot not found')
      return send(res, 200, { ok: true, slot: rows[0] })
    }

    const rows = await sql`DELETE FROM availability_slots WHERE id = ${id} RETURNING id`
    if (!rows.length) return fail(res, 404, 'Slot not found')
    return send(res, 200, { ok: true, id })
  } catch (err) {
    console.error('[api/admin/slots]', err)
    return fail(res, 500, 'Database error')
  }
}
