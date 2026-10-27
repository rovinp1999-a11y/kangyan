// POST /api/admin/login { password } → { token, expiresAt }
// Failed attempts are counted per IP; after MAX_FAILS in WINDOW the IP must wait.
import { checkPassword, issueToken } from '../_auth.js'
import { getSql } from '../_db.js'
import { allow, readBody, send, fail, clientIp } from '../_http.js'

const MAX_FAILS = 8
const WINDOW_MIN = 15

export default async function handler(req, res) {
  if (!allow(req, res, ['POST'])) return
  const { password } = readBody(req)
  const ip = clientIp(req)
  const sql = getSql()

  try {
    const [{ fails }] = await sql`
      SELECT count(*)::int AS fails FROM admin_login_attempts
      WHERE ip = ${ip} AND at > now() - make_interval(mins => ${WINDOW_MIN})`
    if (fails >= MAX_FAILS) {
      return fail(res, 429, `Too many attempts. Try again in ${WINDOW_MIN} minutes.`)
    }

    // Small fixed delay blunts rapid guessing.
    await new Promise((r) => setTimeout(r, 400))

    if (!checkPassword(password)) {
      await sql`INSERT INTO admin_login_attempts (ip) VALUES (${ip})`
      return fail(res, 401, 'Wrong password')
    }
    await sql`DELETE FROM admin_login_attempts WHERE ip = ${ip} OR at < now() - interval '1 day'`
    return send(res, 200, { ok: true, ...issueToken() })
  } catch (err) {
    console.error('[api/admin/login]', err)
    return fail(res, 500, 'Login is unavailable right now')
  }
}
