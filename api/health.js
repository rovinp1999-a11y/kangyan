// GET /api/health — confirms the function can reach the database.
import { getSql } from './_db.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const sql = getSql()
    const [row] = await sql`SELECT now() AS now, current_database() AS db, version() AS version`
    return res.status(200).json({
      ok: true,
      db: row.db,
      serverTime: row.now,
      postgres: row.version.split(' on ')[0],
    })
  } catch (err) {
    console.error('[api/health]', err)
    return res.status(500).json({ ok: false, error: 'Database unreachable' })
  }
}
