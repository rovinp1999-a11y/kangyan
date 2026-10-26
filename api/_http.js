// Small helpers shared by the API functions (Node.js runtime, req/res style).

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(status).json(body)
}

export function fail(res, status, error) {
  return send(res, status, { ok: false, error })
}

/** Vercel parses JSON bodies into req.body; be tolerant of raw strings. */
export function readBody(req) {
  const b = req.body
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
