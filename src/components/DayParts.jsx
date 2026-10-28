import { useRef, useState } from 'react'

// In-person lessons: instead of timetable slots, the student picks the days that
// work and the times of day that work (morning / afternoon / evening). The tutor
// confirms the exact time with them. Saved as day + time ranges, e.g. Sat 09:00–12:00.
export const PARTS = [
  { key: 'morning', start: '09:00', end: '12:00' },
  { key: 'afternoon', start: '12:00', end: '17:00' },
  { key: 'evening', start: '17:00', end: '21:00' },
]
export const DAY_START = 9
export const DAY_END = 21

/** Every chosen day × every chosen part, with touching parts joined (morning + afternoon → 9–5). */
function toTimes(days, parts) {
  const ranges = PARTS.filter((p) => parts.includes(p.key)).reduce((out, p) => {
    const last = out[out.length - 1]
    if (last && last.end === p.start) last.end = p.end
    else out.push({ start: p.start, end: p.end })
    return out
  }, [])
  return [...days].sort((a, b) => a - b).flatMap((weekday) => ranges.map((r) => ({ weekday, ...r })))
}

/** Read the choices back from saved times (a restored draft). */
function fromTimes(times) {
  const days = [...new Set(times.map((t) => t.weekday))]
  const parts = PARTS.filter((p) => times.some((t) => t.start < p.end && p.start < t.end)).map((p) => p.key)
  return { days, parts }
}

export default function DayParts({ value, onChange, t, L }) {
  // Several days and several times of day can be picked; every combination is saved.
  const [pick, setPick] = useState(() => fromTimes(value))
  const latest = useRef(pick) // quick taps in a row each build on the one before
  const pendingDays = pick.days
  const pendingParts = pick.parts
  const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const flip = (key, v) => {
    const next = { ...latest.current, [key]: toggle(latest.current[key], v) }
    latest.current = next
    setPick(next)
    onChange(next.days.length && next.parts.length ? toTimes(next.days, next.parts) : [])
  }

  const summary = pendingDays.length && pendingParts.length
    ? t.summary(
      [...pendingDays].sort((a, b) => a - b).map((d) => L.weekdaysShort[d]),
      PARTS.filter((p) => pendingParts.includes(p.key)).map((p) => t.parts[p.key][0]),
    )
    : pendingDays.length ? t.needPart : pendingParts.length ? t.needDay : null

  return (
    <div className="dp">
      <div className="dp__q">
        <span className="dp__k">{t.daysQ} <small>{t.many}</small></span>
        <div className="dp__days">
          {L.weekdaysShort.map((x, d) => (
            <button type="button" key={x} aria-pressed={pendingDays.includes(d)} aria-label={L.weekdays[d]}
              className={`dp__day ${d >= 5 ? 'is-weekend' : ''} ${pendingDays.includes(d) ? 'is-on' : ''}`}
              onClick={() => flip('days', d)}>
              {x}
            </button>
          ))}
        </div>
      </div>

      <div className="dp__q">
        <span className="dp__k">{t.partsQ} <small>{t.many}</small></span>
        <div className="dp__parts">
          {PARTS.map((p) => (
            <button type="button" key={p.key} aria-pressed={pendingParts.includes(p.key)}
              className={`dp__part ${pendingParts.includes(p.key) ? 'is-on' : ''}`}
              onClick={() => flip('parts', p.key)}>
              <b>{t.parts[p.key][0]}</b>
              <span>{t.parts[p.key][1]}</span>
            </button>
          ))}
        </div>
      </div>

      {summary && <p className={`dp__sum ${value.length ? 'is-ok' : ''}`} aria-live="polite">{summary}</p>}
    </div>
  )
}
