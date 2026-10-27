// Search over public/schools.json (built by scripts/build-schools.py).
// Each entry: { n: name, z?: Chinese name, a?: other Chinese form, t: type, p?: place }.
// Matching is word-prefix for Latin text ("smk dam" finds SMK Damansara Jaya) and
// substring for Chinese ("宽柔" finds 新山宽柔中学), across name, Chinese name and place.

// Words people use for each school type that the official names leave out.
const ALIAS = {
  dz: 'independent high school private chinese secondary persendirian 独中 独立中学 华文独中',
  smjk: 'smjk sekolah menengah jenis kebangsaan national type chinese secondary school 国民型 华中 国民型中学',
  gov: 'smk sekolah menengah kebangsaan secondary school national 国中',
  mrsm: 'maktab rendah sains mara college',
  intl: 'international private school 国际学校 私立',
}
const CJK = /[㐀-鿿]/

export const norm = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

let cache = null
export function loadSchools() {
  if (!cache) {
    cache = fetch('/schools.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('schools'))))
      .then((list) =>
        list.map((s) => ({ ...s, nn: norm(s.n), h: ' ' + norm([s.n, s.z, s.a, s.p, ALIAS[s.t]].join(' ')) })),
      )
      .catch((e) => { cache = null; throw e })
  }
  return cache
}

// What gets saved on the enquiry, e.g. "SM Foon Yew Johor Bahru (新山宽柔中学), Johor".
export const schoolLabel = (s) => `${s.n}${s.z ? ` (${s.z})` : ''}${s.p ? `, ${s.p}` : ''}`

export function searchSchools(list, query, limit = 8) {
  const q = norm(query)
  if (!q || !list) return []
  const tokens = q.split(' ')
  const hits = []
  for (const s of list) {
    let ok = true
    for (const t of tokens) {
      if (CJK.test(t) ? !s.h.includes(t) : !s.h.includes(' ' + t)) { ok = false; break }
    }
    if (!ok) continue
    // Rank: name or Chinese name starts with the query, then contains it, then the rest.
    const z = s.z || ''
    // Chinese names put the town first (新山宽柔中学), so for Chinese queries "contains" counts as a direct hit.
    const rank = CJK.test(q)
      ? (z.includes(q) || (s.a || '').includes(q) ? 0 : 2)
      : s.nn.startsWith(q) ? 0 : s.nn.includes(q) ? 1 : 2
    hits.push([rank, s.n.length, s])
  }
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return hits.slice(0, limit).map((x) => x[2])
}
