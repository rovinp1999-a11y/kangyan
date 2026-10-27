// Admin-only availability management.
//   POST   { weekday, start, end, kind? } → create an open slot ('private' default)
//   PATCH  { id, status?, kind? }         → 'open' | 'taken', 'private' | 'group'
//   DELETE { id }                   → remove
import { getSql } from '../_db.js'
import { requireAdmin } from '../_auth.js'
import { allow, readBody, send, fail } from '../_http.js'
import { SLOT_COLUMNS } from '../slots.js'
import { SLOT_STATUSES, LESSON_TYPES } from '../../shared/constants.js'

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
      const kind = b.kind || 'private'
      if (!LESSON_TYPES.includes(kind)) return fail(res, 400, 'Invalid class type')
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return fail(res, 400, 'Invalid weekday')
      if (!TIME_RE.test(start) || !TIME_RE.test(end) || start >= end) return fail(res, 400, 'End time must be after start time')
      const rows = await sql.query(
        `INSERT INTO availability_slots (weekday, start_time, end_time, kind)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (weekday, start_time, end_time) DO UPDATE SET status = 'open', kind = EXCLUDED.kind
         RETURNING ${SLOT_COLUMNS}`,
        [weekday, start, end, kind],
      )
      return send(res, 201, { ok: true, slot: rows[0] })
    }

    const id = Number(b.id)
    if (!Number.isInteger(id)) return fail(res, 400, 'Invalid id')

    if (req.method === 'PATCH') {
      const status = b.status ?? null
      const kind = b.kind ?? null
      if (status === null && kind === null) return fail(res, 400, 'Nothing to update')
      if (status !== null && !SLOT_STATUSES.includes(status)) return fail(res, 400, 'Invalid status')
      if (kind !== null && !LESSON_TYPES.includes(kind)) return fail(res, 400, 'Invalid class type')
      const rows = await sql.query(
        `UPDATE availability_slots
           SET status = COALESCE($1, status), kind = COALESCE($2, kind)
         WHERE id = $3 RETURNING ${SLOT_COLUMNS}`,
        [status, kind, id],
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
