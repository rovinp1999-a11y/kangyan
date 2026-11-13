import { useEffect, useRef, useState } from 'react'
import { addDays } from '../../shared/lessons.js'

// Week calendar shared by the student page and the admin: a time grid (days across, hours
// down) that scrolls up and down inside its frame, with the day headers kept in view. On
// phones it shows one day of the same grid at a time, picked from a strip of the week's days.
// The parent builds the entries and shows the details of whichever one is tapped.
//
//   days: [{ date: 'YYYY-MM-DD', head: 'Mon', sub: '2 Nov', past, events: [
//     { key, start: 'HH:MM', end: 'HH:MM', tone, title, sub?, badge?, faded? } ] }]
//   tone → colour class: mine | moved | off | pending | free | busy | open | taken | lesson | group
//   week: 0 = this week; `back` earlier weeks (negative `week`) and `weeks` weeks from this one can be shown
//   onEmpty(day, 'HH:MM' | null), optional: tapping an empty part of a day (rounded to the half hour)
//   onDrag(event, day, 'HH:MM'), optional: entries with `drag: true` can be dragged on the time grid
//     (snaps to half hours, keeps the length); a short tap still selects them. On touch screens an
//     entry is picked up by holding it for half a second (a quick swipe still scrolls)

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

export default function WeekCalendar({ days, week, weeks, back = 0, onWeek, selected, onSelect, onEmpty, onDrag, today, labels, from = 6, to = 23, title }) {
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
      <button type="button" className="icon-btn" onClick={() => onWeek(week - 1)} disabled={week <= -back} aria-label={labels.prev}>‹</button>
      <span className="wc__range">{title}</span>
      <button type="button" className="icon-btn" onClick={() => onWeek(week + 1)} disabled={week >= weeks - 1} aria-label={labels.next}>›</button>
      {week !== 0 && <button type="button" className="wc__today" onClick={() => onWeek(0)}>{labels.today}</button>}
    </div>
  )

  // Dragging an entry on the time grid: where it would land while the pointer moves.
  const cols = useRef([])
  const [drag, setDragState] = useState(null) // { e, d, x0, y0, dx, dy, x, moved }
  const dragRef = useRef(null) // the latest drag, for the window listeners
  const setDrag = (g) => { const next = typeof g === 'function' ? g(dragRef.current) : g; dragRef.current = next; setDragState(next) }
  const dragged = useRef(false)
  const landing = (g, x) => {
    const i = cols.current.findIndex((c) => c && x >= c.getBoundingClientRect().left && x < c.getBoundingClientRect().right)
    if (i < 0) return null
    const len = toMin(g.e.end) - toMin(g.e.start)
    const top = (toMin(g.e.start) - lo * 60) / 60 * ROW + g.dy
    let m = lo * 60 + Math.round((top / ROW) * 2) * 30
    m = Math.max(lo * 60, Math.min(hi * 60 - len, m))
    return { i, start: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, m }
  }
  useEffect(() => {
    if (!drag) return
    const move = (x, y) => {
      const dx = x - drag.x0
      const dy = y - drag.y0
      setDrag((g) => g && { ...g, dx, dy, moved: g.moved || Math.abs(dx) + Math.abs(dy) > 6, x })
    }
    const drop = (x, y) => {
      const g = dragRef.current
      setDrag(null)
      if (!g?.moved) return
      dragged.current = true
      setTimeout(() => { dragged.current = false }, 400) // a touch drag may not be followed by a click
      const at = landing({ ...g, dy: y - g.y0 }, x)
      if (at && !days[at.i].past && (days[at.i].date !== g.d.date || at.start !== g.e.start)) onDrag(g.e, days[at.i], at.start)
    }
    if (drag.touch) {
      // Held on a touch screen: follow the finger and keep the page from scrolling meanwhile.
      const tmove = (ev) => { ev.preventDefault(); move(ev.touches[0].clientX, ev.touches[0].clientY) }
      const tend = (ev) => drop(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY)
      window.addEventListener('touchmove', tmove, { passive: false })
      window.addEventListener('touchend', tend, { once: true })
      window.addEventListener('touchcancel', () => setDrag(null), { once: true })
      return () => { window.removeEventListener('touchmove', tmove); window.removeEventListener('touchend', tend) }
    }
    const pmove = (ev) => move(ev.clientX, ev.clientY)
    const pup = (ev) => drop(ev.clientX, ev.clientY)
    window.addEventListener('pointermove', pmove)
    window.addEventListener('pointerup', pup, { once: true })
    return () => { window.removeEventListener('pointermove', pmove); window.removeEventListener('pointerup', pup) }
  }, [drag?.e.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Touch: hold an entry for half a second to pick it up; moving or lifting sooner is a scroll or a tap.
  const hold = useRef(null)
  const holdStart = (e, d) => (ev) => {
    const t = ev.touches[0]
    const at = { x: t.clientX, y: t.clientY }
    clearTimeout(hold.current?.timer)
    hold.current = {
      at,
      timer: setTimeout(() => {
        hold.current = null
        navigator.vibrate?.(25)
        setDrag({ e, d, x0: at.x, y0: at.y, dx: 0, dy: 0, moved: true, touch: true })
      }, 500),
    }
  }
  const holdMove = (ev) => {
    const h = hold.current
    const t = ev.touches[0]
    if (h && Math.abs(t.clientX - h.at.x) + Math.abs(t.clientY - h.at.y) > 10) { clearTimeout(h.timer); hold.current = null }
  }
  const holdEnd = () => { if (hold.current) { clearTimeout(hold.current.timer); hold.current = null } }

  const chip = (e, d, style) => (
    <button
      type="button"
      key={e.key}
      className={`wc__ev wc__ev--${e.tone} ${selected === e.key ? 'is-sel' : ''} ${e.faded || d.past ? 'is-faded' : ''} ${e.drag && onDrag && style ? 'is-draggable' : ''} ${drag?.e.key === e.key && drag.moved ? 'is-dragging' : ''}`}
      style={drag?.e.key === e.key && drag.moved ? { ...style, transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 5 } : style}
      aria-pressed={selected === e.key}
      onPointerDown={e.drag && onDrag && style ? (ev) => { if (ev.button === 0 && ev.pointerType !== 'touch') setDrag({ e, d, x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0, moved: false }) } : undefined}
      onTouchStart={e.drag && onDrag && style ? holdStart(e, d) : undefined}
      onTouchMove={e.drag && onDrag && style ? holdMove : undefined}
      onTouchEnd={e.drag && onDrag && style ? holdEnd : undefined}
      onContextMenu={e.drag && onDrag ? (ev) => ev.preventDefault() : undefined}
      onClick={() => { if (dragged.current) { dragged.current = false; return } onSelect(e, d) }}
    >
      <span className="wc__ev-t">{e.title}</span>
      {e.sub && <span className="wc__ev-s">{e.sub}</span>}
      {e.badge && <span className="wc__badge">{e.badge}</span>}
    </button>
  )

  // Open scrolled to the earliest class of the week, so every class that week is in view
  // (or 4 PM when the week is empty), like a calendar app.
  const scroller = useRef(null)
  const inView = narrow ? (days[day] || days[0]).events : all // on phones, the day being shown
  const firstAt = inView.length ? Math.min(...inView.map((e) => toMin(e.start))) : 16 * 60
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, ((firstAt - lo * 60) / 60 - 0.5) * ROW)
  }, [week, narrow, day, firstAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const grid = (shown) => (
    <div className="wc__scroll" ref={scroller}>
      <div className="wc__grid" style={{ '--rows': hours.length, '--row': `${ROW}px`, '--cols': shown.length }}>
        <div className="wc__corner" />
        {shown.map((d) => (
          <div key={d.date} className={`wc__head ${d.date === today ? 'is-today' : ''} ${d.past ? 'is-past' : ''}`}><b>{d.head}</b><span>{d.sub}</span></div>
        ))}
        <div className="wc__hours">
          {hours.map((h) => <span key={h} style={{ height: ROW }}>{labels.hour(h)}</span>)}
        </div>
        {shown.map((d) => {
          const ci = days.indexOf(d)
          return (
            <div
              key={d.date}
              ref={(el) => { cols.current[ci] = el }}
              className={`wc__col ${d.past ? 'is-past' : ''} ${d.date === today ? 'is-today' : ''} ${onEmpty && !d.past ? 'is-pickable' : ''}`}
              style={{ height: hours.length * ROW }}
              onClick={onEmpty && !d.past ? (e) => {
                if (e.target !== e.currentTarget) return
                const m = lo * 60 + Math.floor(((e.clientY - e.currentTarget.getBoundingClientRect().top) / ROW) * 2) * 30
                const t = Math.min(Math.max(m, lo * 60), hi * 60 - 60)
                onEmpty(d, `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
              } : undefined}
            >
              {drag?.moved && (() => {
                const at = landing(drag, drag.x ?? drag.x0)
                if (!at || at.i !== ci) return null
                const len = toMin(drag.e.end) - toMin(drag.e.start)
                const h = Math.floor(at.m / 60)
                const label = `${h % 12 || 12}${at.m % 60 ? `:${String(at.m % 60).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
                return <div className="wc__ghost" style={{ top: ((at.m - lo * 60) / 60) * ROW, height: (len / 60) * ROW - 2 }}><span>{label}</span></div>
              })()}
              {lanes(d.events).map((e) => {
                const top = ((toMin(e.start) - lo * 60) / 60) * ROW
                const h = Math.max(22, ((toMin(e.end) - toMin(e.start)) / 60) * ROW - 2)
                return chip(e, d, { top, height: h, left: `calc(${(100 / e.of) * e.lane}% + 2px)`, width: `calc(${100 / e.of}% - 4px)` })
              })}
            </div>
          )
        })}
      </div>
    </div>
  )

  if (narrow) {
    const d = days[day] || days[0]
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
        {grid([d])}
        {onEmpty && !d.past && <button type="button" className="wc__ask" onClick={() => onEmpty(d, null)}>{labels.ask}</button>}
      </div>
    )
  }

  return (
    <div className="wc">
      {nav}
      {grid(days)}
    </div>
  )
}

/** Monday of the current Malaysia week plus `n` weeks, as 7 dates. */
export function weekDates(today, n, weekdayOf) {
  const monday = addDays(today, -weekdayOf(today) + n * 7)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
