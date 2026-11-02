// Admin auth. The password starts as ADMIN_PASSWORD (Vercel settings); once it is changed
// from the dashboard, its scrypt hash is kept in admin_settings and checked instead.
// A successful login returns a signed, time-limited token the admin page sends back as
// `Authorization: Bearer <token>`. Changing the password signs every other device out.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getSql } from './_db.js'
import { fail } from './_http.js'

const TTL_MS = 12 * 60 * 60 * 1000 // 12 hours
const KEY = 'admin_password'

function envPassword() {
  const p = process.env.ADMIN_PASSWORD
  if (!p) throw new Error('ADMIN_PASSWORD is not set')
  return p
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

// The saved hash, cached briefly so every admin request doesn't need a database read.
let cache = { at: 0, hash: undefined }
async function storedHash() {
  if (cache.hash !== undefined && Date.now() - cache.at < 30_000) return cache.hash
  const [row] = await getSql()`SELECT value FROM admin_settings WHERE key = ${KEY}`
  cache = { at: Date.now(), hash: row?.value || null }
  return cache.hash
}

async function sign(exp) {
  const hash = (await storedHash()) || ''
  return createHmac('sha256', `${envPassword()}|${hash}|admin-session`).update(String(exp)).digest('hex')
}

export async function checkPassword(input) {
  const hash = await storedHash()
  if (!hash) return safeEqual(input ?? '', envPassword())
  const [salt, h] = hash.split(':')
  const a = scryptSync(String(input ?? ''), salt, 32)
  const b = Buffer.from(h, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Save a new admin password (min 8 characters). */
export async function setPassword(next) {
  const salt = randomBytes(16).toString('hex')
  const value = `${salt}:${scryptSync(next, salt, 32).toString('hex')}`
  await getSql()`
    INSERT INTO admin_settings (key, value) VALUES (${KEY}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
  cache = { at: Date.now(), hash: value }
}

export async function issueToken() {
  const exp = Date.now() + TTL_MS
  return { token: `${exp}.${await sign(exp)}`, expiresAt: exp }
}

export async function verifyToken(token) {
  if (typeof token !== 'string') return false
  const [expStr, sig] = token.split('.')
  const exp = Number(expStr)
  if (!exp || !sig || exp < Date.now()) return false
  return safeEqual(sig, await sign(exp))
}

/** Resolves true if the request carries a valid admin token, else responds 401. */
export async function requireAdmin(req, res) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''
  if (await verifyToken(token)) return true
  fail(res, 401, 'Unauthorized')
  return false
}
