// GET /api/slots — public weekly availability (open and taken slots).
import { getSql } from './_db.js'
import { allow, send, fail } from './_http.js'

export const SLOT_COLUMNS = `
  id, weekday,
  to_char(start_time, 'HH24:MI') AS start,
  to_char(end_time,   'HH24:MI') AS "end",
  status
`

export default async function handler(req, res) {
  if (!allow(req, res, ['GET'])) return
  try {
    const sql = getSql()
    const rows = await sql.query(
      `SELECT ${SLOT_COLUMNS} FROM availability_slots ORDER BY weekday, start_time`,
    )
    return send(res, 200, { ok: true, slots: rows })
  } catch (err) {
    console.error('[api/slots]', err)
    return fail(res, 500, 'Could not load availability')
  }
}
