// Student accounts: WhatsApp number + 6-digit PIN, and a signed session token.
import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { getSql } from './_db.js'
import { fail } from './_http.js'

const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days: parents shouldn't have to log in every week

/** Malaysian numbers in one form: digits only, leading 0 → 60, 00 prefix dropped. */
export function normalPhone(v) {
  let d = String(v || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = `60${d.slice(1)}`
  return d
}

export const newPin = () => String(randomInt(0, 1000000)).padStart(6, '0')
export const isPin = (v) => typeof v === 'string' && /^\d{6}$/.test(v)

export function hashPin(pin) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`
}

export function checkPin(pin, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash || !isPin(pin)) return false
  const a = scryptSync(pin, salt, 32)
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function secret() {
  const p = process.env.ADMIN_PASSWORD
  if (!p) throw new Error('ADMIN_PASSWORD is not set')
  return `${p}|student-session`
}
// The token carries part of the PIN hash, so a new PIN logs out old sessions.
const sign = (id, exp, pinHash) => createHmac('sha256', secret()).update(`${id}.${exp}.${pinHash.slice(-16)}`).digest('hex')

export function issueStudentToken(student) {
  const exp = Date.now() + TTL_MS
  return `${student.id}.${exp}.${sign(student.id, exp, student.pin_hash)}`
}

/** The logged-in, active student for this request, or null after sending 401. */
export async function requireStudent(req, res) {
  const h = req.headers.authorization || ''
  const [idStr, expStr, sig] = (h.startsWith('Bearer ') ? h.slice(7) : '').split('.')
  const id = Number(idStr)
  const exp = Number(expStr)
  if (id > 0 && exp > Date.now() && sig) {
    const [s] = await getSql()`SELECT * FROM students WHERE id = ${id} AND active`
    if (s) {
      const want = Buffer.from(sign(s.id, exp, s.pin_hash))
      const got = Buffer.from(sig)
      if (want.length === got.length && timingSafeEqual(want, got)) return s
    }
  }
  fail(res, 401, 'Please log in again', 'auth')
  return null
}
