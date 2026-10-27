// Creates/updates the tables (idempotent) and seeds the weekday timetable if empty.
//   node scripts/migrate.js            → uses .env.local
//   node scripts/migrate.js --env path → uses another env file
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

const envPath = process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : '.env.local'
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
if (!process.env.DATABASE_URL) throw new Error(`DATABASE_URL not found in ${envPath}`)
const sql = neon(process.env.DATABASE_URL)

const statements = [
  `CREATE TABLE IF NOT EXISTS availability_slots (
     id          SERIAL PRIMARY KEY,
     weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
     start_time  TIME NOT NULL,
     end_time    TIME NOT NULL CHECK (end_time > start_time),
     status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','taken')),
     kind        TEXT NOT NULL DEFAULT 'private' CHECK (kind IN ('private','group')),
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (weekday, start_time, end_time)
   )`,
  `CREATE TABLE IF NOT EXISTS enquiries (
     id              SERIAL PRIMARY KEY,
     created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
     student_name    TEXT NOT NULL,
     email           TEXT,
     phone           TEXT,
     level           TEXT NOT NULL,
     subjects        TEXT[] NOT NULL,
     format          TEXT NOT NULL DEFAULT 'either',
     lesson_type     TEXT NOT NULL DEFAULT 'private' CHECK (lesson_type IN ('private','group')),
     location        TEXT,
     lang            TEXT NOT NULL DEFAULT 'en',
     message         TEXT,
     preferred_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
     status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','confirmed','closed'))
   )`,
  `CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries (created_at DESC)`,
  // upgrades for databases created before slot kinds / lesson types existed
  `ALTER TABLE availability_slots ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'private' CHECK (kind IN ('private','group'))`,
  `ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS lesson_type TEXT NOT NULL DEFAULT 'private' CHECK (lesson_type IN ('private','group'))`,
  `ALTER TABLE enquiries ALTER COLUMN email DROP NOT NULL`,
  `ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS location TEXT`,
  `ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'en'`,
]
for (const s of statements) await sql.query(s)

const [{ count }] = await sql.query('SELECT count(*)::int AS count FROM availability_slots')
if (count === 0) {
  // Weekday evenings, Monday–Friday. Mark slots taken or group in /admin.
  const seed = []
  for (const d of [0, 1, 2, 3, 4]) seed.push([d, '17:30', '19:00'], [d, '19:00', '20:30'], [d, '20:30', '22:00'])
  for (const [w, s, e] of seed) {
    await sql.query('INSERT INTO availability_slots (weekday, start_time, end_time) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [w, s, e])
  }
  console.log(`Seeded ${seed.length} starter slots.`)
} else {
  console.log(`availability_slots already has ${count} rows; not seeding.`)
}
console.log('Migration complete.')
