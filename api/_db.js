// Shared database helper for Vercel Functions.
// Files prefixed with "_" inside api/ are not exposed as routes.
import { neon } from '@neondatabase/serverless'

let _sql = null

/**
 * Returns a tagged-template SQL client bound to the Neon database.
 * Lazily created so importing this module never throws when DATABASE_URL
 * is missing (e.g. during `vite build`).
 *
 *   const sql = getSql()
 *   const rows = await sql`SELECT * FROM things WHERE id = ${id}`
 */
export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set. Run `vercel env pull .env.local`.')
    _sql = neon(url)
  }
  return _sql
}
