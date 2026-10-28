import { useEffect, useState } from 'react'
import { addDays } from '../../shared/lessons.js'

// Week calendar shared by the student page and the admin. On wide screens it is a
// time grid (days across, hours down); on phones it is a strip of days with the
// chosen day's entries listed underneath. The parent builds the entries and shows
// the details of whichever one is tapped.
//
//   days: [{ date: 'YYYY-MM-DD', head: 'Mon', sub: '2 Nov', past, events: [
//     { key, start: 'HH:MM', end: 'HH:MM', tone, title, sub?, badge?, faded? } ] }]
//   tone → colour class: mine | moved | off | pending | free | busy | open | taken | lesson | group

const ROW = 44 // px per hour on the time grid
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

function useNarrow(q = '(max-width: 760px)') {
  const get = () => typeof window !== 'undefined' && window.matchMedia(q).matches
  const [narrow, setNarrow] = useState(get)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [q])
  return narrow
}

/** Side-by-side lanes for entries that overlap on the same day. */
function lanes(events) {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end))
  const ends = []
  const out = sorted.map((e) => {
    let lane = ends.findIndex((end) => end <= e.start)
    if (lane < 0) { lane = ends.length; ends.push(e.end) } else ends[lane] = e.end
    return { ...e, lane }
  })
  return out.map((e) => ({ ...e, of: Math.max(...out.filter((o) => o.start < e.end && e.start < o.end).map((o) => o.lane)) + 1 }))
}

export default function WeekCalendar({ days, week, weeks, onWeek, selected, onSelect, today, labels, from = 8, to = 22, title }) {
  const narrow = useNarrow()
  const [day, setDay] = useState(() => Math.max(0, days.findIndex((d) => d.date === today)))
  useEffect(() => { setDay(week === 0 ? Math.max(0, days.findIndex((d) => d.date === today)) : 0) }, [week]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fit the grid to what is on it, but keep at least the usual teaching hours.
  const all = days.flatMap((d) => d.events)
  const lo = Math.min(from, ...all.map((e) => Math.floor(toMin(e.start) / 60)))
  const hi = Math.max(to, ...all.map((e) => Math.ceil(toMin(e.end) / 60)))
  const hours = Array.from({ length: hi - lo }, (_, i) => lo + i)

  const nav = (
    <div className="wc__nav">
      <button type="button" className="icon-btn" onClick={() => onWeek(week - 1)} disabled={week <= 0} aria-label={labels.prev}>‹</button>
      <span className="wc__range">{title}</span>
      <button type="button" className="icon-btn" onClick={() => onWeek(week + 1)} disabled={week >= weeks - 1} aria-label={labels.next}>›</button>
      {week > 0 && <button type="button" className="wc__today" onClick={() => onWeek(0)}>{labels.today}</button>}
    </div>
  )

  const chip = (e, d, style) => (
    <button
      type="button"
      key={e.key}
      className={`wc__ev wc__ev--${e.tone} ${selected === e.key ? 'is-sel' : ''} ${e.faded || d.past ? 'is-faded' : ''}`}
      style={style}
      aria-pressed={selected === e.key}
      onClick={() => onSelect(e, d)}
    >
      <span className="wc__ev-t">{e.title}</span>
      {e.sub && <span className="wc__ev-s">{e.sub}</span>}
      {e.badge && <span className="wc__badge">{e.badge}</span>}
    </button>
  )

  if (narrow) {
    const d = days[day] || days[0]
    const list = [...d.events].sort((a, b) => a.start.localeCompare(b.start))
    return (
      <div className="wc wc--narrow">
        {nav}
        <div className="wc__strip" role="tablist">
          {days.map((x, i) => (
            <button type="button" role="tab" key={x.date} aria-selected={i === day} className={`wc__sday ${i === day ? 'is-on' : ''} ${x.date === today ? 'is-today' : ''} ${x.past ? 'is-past' : ''}`} onClick={() => setDay(i)}>
              <b>{x.head}</b>
              <span>{x.sub}</span>
              <i className="wc__dots">{x.events.filter((e) => e.dot).slice(0, 3).map((e) => <em key={e.key} className={`wc__dot wc__dot--${e.tone}`} />)}</i>
            </button>
          ))}
        </div>
        <div className="wc__list">
          {list.length ? list.map((e) => chip(e, d)) : <p className="wc__empty">{labels.empty}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="wc">
      {nav}
      <div className="wc__grid" style={{ '--rows': hours.length, '--row': `${ROW}px` }}>
        <div className="wc__corner" />
        {days.map((d) => (
          <div key={d.date} className={`wc__head ${d.date === today ? 'is-today' : ''} ${d.past ? 'is-past' : ''}`}><b>{d.head}</b><span>{d.sub}</span></div>
        ))}
        <div className="wc__hours">
          {hours.map((h) => <span key={h} style={{ height: ROW }}>{labels.hour(h)}</span>)}
        </div>
        {days.map((d) => (
          <div key={d.date} className={`wc__col ${d.past ? 'is-past' : ''} ${d.date === today ? 'is-today' : ''}`} style={{ height: hours.length * ROW }}>
            {lanes(d.events).map((e) => {
              const top = ((toMin(e.start) - lo * 60) / 60) * ROW
              const h = Math.max(22, ((toMin(e.end) - toMin(e.start)) / 60) * ROW - 2)
              return chip(e, d, { top, height: h, left: `calc(${(100 / e.of) * e.lane}% + 2px)`, width: `calc(${100 / e.of}% - 4px)` })
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Monday of the current Malaysia week plus `n` weeks, as 7 dates. */
export function weekDates(today, n, weekdayOf) {
  const monday = addDays(today, -weekdayOf(today) + n * 7)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
