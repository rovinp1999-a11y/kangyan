// Single-password admin auth. The password lives in the ADMIN_PASSWORD env var.
// A successful login returns a signed, time-limited token the admin page sends
// back as `Authorization: Bearer <token>`.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { fail } from './_http.js'

const TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

function secret() {
  const p = process.env.ADMIN_PASSWORD
  if (!p) throw new Error('ADMIN_PASSWORD is not set')
  return p
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

function sign(exp) {
  return createHmac('sha256', `${secret()}|admin-session`).update(String(exp)).digest('hex')
}

export function checkPassword(input) {
  return safeEqual(input ?? '', secret())
}

export function issueToken() {
  const exp = Date.now() + TTL_MS
  return { token: `${exp}.${sign(exp)}`, expiresAt: exp }
}

export function verifyToken(token) {
  if (typeof token !== 'string') return false
  const [expStr, sig] = token.split('.')
  const exp = Number(expStr)
  if (!exp || !sig || exp < Date.now()) return false
  return safeEqual(sig, sign(exp))
}

/** Returns true if the request carries a valid admin token, else responds 401. */
export function requireAdmin(req, res) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''
  if (verifyToken(token)) return true
  fail(res, 401, 'Unauthorized')
  return false
}
