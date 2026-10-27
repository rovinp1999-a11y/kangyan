// One-off: replace the whole timetable with Mon–Fri 5:30–7, 7–8:30, 8:30–10 PM.
//   node scripts/set-timetable.js
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const sql = neon(process.env.DATABASE_URL)

const TIMES = [['17:30', '19:00'], ['19:00', '20:30'], ['20:30', '22:00']]
const removed = await sql`DELETE FROM availability_slots RETURNING id`
for (const d of [0, 1, 2, 3, 4]) {
  for (const [s, e] of TIMES) {
    await sql.query('INSERT INTO availability_slots (weekday, start_time, end_time) VALUES ($1,$2,$3)', [d, s, e])
  }
}
const rows = await sql`SELECT weekday, to_char(start_time,'HH24:MI') s, to_char(end_time,'HH24:MI') e, kind, status FROM availability_slots ORDER BY weekday, start_time`
console.log(`removed ${removed.length} old slots, now ${rows.length}:`)
console.log(rows.map((r) => `${r.weekday} ${r.s}-${r.e} ${r.kind} ${r.status}`).join('\n'))
