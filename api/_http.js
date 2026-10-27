// Small helpers shared by the API functions (Node.js runtime, req/res style).

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(status).json(body)
}

// `code` lets the client show its own translated message and jump to the right step.
export function fail(res, status, error, code) {
  return send(res, status, code ? { ok: false, error, code } : { ok: false, error })
}

/** Positive integers that fit a Postgres INTEGER column. */
export const isDbId = (n) => Number.isInteger(n) && n > 0 && n <= 2147483647

/** Client IP as seen by Vercel (first hop of x-forwarded-for). */
export function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '')
  return (xf.split(',')[0] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').trim().slice(0, 64)
}

/** Vercel parses JSON bodies into req.body; be tolerant of raw strings. */
export function readBody(req) {
  let b
  try {
    b = req.body // Vercel's getter throws on malformed JSON
  } catch {
    return {}
  }
  if (b == null) return {}
  if (typeof b === 'string') {
    try { return JSON.parse(b) } catch { return {} }
  }
  return b
}

export function allow(req, res, methods) {
  if (methods.includes(req.method)) return true
  res.setHeader('Allow', methods.join(', '))
  fail(res, 405, 'Method not allowed')
  return false
}
