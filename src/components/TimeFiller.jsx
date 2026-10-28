import { useState } from 'react'
import { shortRange } from '../i18n.jsx'

// In-person lessons: the student fills in their own times instead of picking a
// timetable slot. Pick a day, pick a start time (2 hours by default), add it, repeat.
// Each added time can be made 30 minutes shorter or longer, or removed.
export const DAY_START = 8 // 8 AM
export const DAY_END = 22 // 10 PM
const STEP = 30 // minutes
const DEFAULT_MIN = 120
const MIN_MIN = 60
const MAX_TIMES = 12

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
/** One clock time: '10 AM' / '上午10点'. */
const clock = (m, lang) => {
  if (lang === 'zh') return shortRange(toTime(m), toTime(m + STEP), 'zh').split('–')[0]
  const h = Math.floor(m / 60)
  return `${h % 12 || 12}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}
const STARTS = Array.from({ length: ((DAY_END - DAY_START) * 60 - MIN_MIN) / STEP + 1 }, (_, i) => DAY_START * 60 + i * STEP)

/** Add a time, merging it with any overlapping or touching time on the same day. */
function addTime(list, t) {
  let m = { weekday: t.weekday, s: toMin(t.start), e: toMin(t.end) }
  const rest = []
  for (const x of list) {
    const s = toMin(x.start)
    const e = toMin(x.end)
    if (x.weekday === m.weekday && s <= m.e && m.s <= e) m = { ...m, s: Math.min(s, m.s), e: Math.max(e, m.e) }
    else rest.push(x)
  }
  return [...rest, { weekday: m.weekday, start: toTime(m.s), end: toTime(m.e) }]
    .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
}

export default function TimeFiller({ value, onChange, t, L, lang }) {
  const [day, setDay] = useState(null)
  const [start, setStart] = useState(10 * 60) // 10 AM
  const end = Math.min(DAY_END * 60, start + DEFAULT_MIN)
  const full = value.length >= MAX_TIMES

  const add = () => {
    if (day == null || full) return
    onChange(addTime(value, { weekday: day, start: toTime(start), end: toTime(end) }))
    setDay(null)
  }
  const resize = (i, delta) => {
    const x = value[i]
    const e = Math.min(DAY_END * 60, Math.max(toMin(x.start) + MIN_MIN, toMin(x.end) + delta))
    onChange(value.map((y, j) => (j === i ? { ...y, end: toTime(e) } : y)).reduce(addTime, []))
  }
  const hours = (a, b) => {
    const h = (toMin(b) - toMin(a)) / 60
    return lang === 'zh' ? `${h} 小时` : `${h} hour${h === 1 ? '' : 's'}`
  }

  return (
    <div className="tf">
      <div className="tf__pick">
        <span className="tf__k">{t.day}</span>
        <div className="tf__days" role="radiogroup" aria-label={t.day}>
          {L.weekdaysShort.map((x, d) => (
            <button type="button" key={x} role="radio" aria-checked={day === d} aria-label={L.weekdays[d]} className={`tf__day ${day === d ? 'is-on' : ''}`} onClick={() => setDay(d)}>
              {x}
            </button>
          ))}
        </div>

        <span className="tf__k">{t.start}</span>
        <div className="tf__time">
          <select value={start} onChange={(e) => setStart(Number(e.target.value))} aria-label={t.start}>
            {STARTS.map((m) => <option key={m} value={m}>{clock(m, lang)}</option>)}
          </select>
          <span className="tf__range">{shortRange(toTime(start), toTime(end), lang)} · {hours(toTime(start), toTime(end))}</span>
        </div>

        <button type="button" className="btn btn--accent tf__add" disabled={day == null || full} onClick={add}>
          {day == null ? t.pickDay : t.add(L.weekdays[day])}
        </button>
      </div>

      <div className="tf__list" aria-live="polite">
        <span className="tf__k">{t.yours}</span>
        {value.length === 0 ? <p className="tf__none">{t.none}</p> : (
          <ul>
            {value.map((x, i) => (
              <li key={`${x.weekday}-${x.start}`}>
                <b>{L.weekdays[x.weekday]}</b>
                <span>{shortRange(x.start, x.end, lang)}<small>{hours(x.start, x.end)}</small></span>
                <div className="tf__acts">
                  <button type="button" onClick={() => resize(i, -STEP)} disabled={toMin(x.end) - toMin(x.start) <= MIN_MIN} aria-label={t.shorter}>−</button>
                  <button type="button" onClick={() => resize(i, STEP)} disabled={toMin(x.end) >= DAY_END * 60} aria-label={t.longer}>+</button>
                  <button type="button" className="tf__x" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={t.remove}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
