// POST /api/admin/login { password } → { token, expiresAt }
import { checkPassword, issueToken } from '../_auth.js'
import { allow, readBody, send, fail } from '../_http.js'

export default async function handler(req, res) {
  if (!allow(req, res, ['POST'])) return
  const { password } = readBody(req)
  // Small fixed delay blunts brute-force attempts.
  await new Promise((r) => setTimeout(r, 400))
  if (!checkPassword(password)) return fail(res, 401, 'Wrong password')
  return send(res, 200, { ok: true, ...issueToken() })
}
