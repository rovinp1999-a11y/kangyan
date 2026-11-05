// "My calendar": the tutor's real classes with confirmed students, week by week — weekly
// lessons, one-week moves and cancellations, and requests still waiting. Enquiry slots
// (open / taken) live on their own tab. Tap an entry for details and quick actions.
import { useMemo, useState } from 'react'
import { WEEKDAYS, SLOT_KIND_LABEL, formatTime } from '../../shared/constants.js'
import { dateLabel, todayMY, weekdayOf, covers, kindOf } from '../../shared/lessons.js'
import { shortRange } from '../i18n.jsx'
import WeekCalendar, { weekDates } from '../components/WeekCalendar.jsx'
import { Icon, KIND_SHORT, api, waLink } from './lib.jsx'
import { Decide, askedTime } from './Students.jsx'

const WEEKS = 8
const ACTIVE = ['pending', 'approved']
const range = (a, b) => shortRange(a, b, 'en')

/** Who is in one lesson (a slot or a custom weekly time) on one date, and in what state. */
function peopleFor(date, match, students, requests) {
  const out = []
  for (const s of students) {
    if (!s.active || (s.start_date && date < s.start_date)) continue
    for (const l of (s.lessons || []).filter((x) => match(x) && covers(x, date))) {
      const r = requests.find((x) => x.student_id === s.id && x.lesson_date === date && x.kind !== 'change' && ACTIVE.includes(x.status) && (!x.from_lesson || x.from_lesson.start === l.start))
      const state = !r ? 'regular' : r.kind === 'absence' ? (r.status === 'approved' ? 'absent' : 'absentAsk') : (r.status === 'approved' ? 'movedOut' : 'moveOutAsk')
      out.push({ s, l, r, state, kind: kindOf(l, s) })
    }
  }
  return out
}

/** Lessons moved onto this date (to any time), each shown at its new time. */
function movedIn(date, students, requests) {
  return requests
    .filter((x) => x.kind === 'reschedule' && ACTIVE.includes(x.status) && x.to_date === date && x.to_start)
    .map((r) => ({ s: students.find((x) => x.id === r.student_id), r, state: r.status === 'approved' ? 'movedIn' : 'moveInAsk' }))
    .filter((p) => p.s)
    .map((p) => ({ ...p, kind: kindOf(movedFromLesson(p), p.s) }))
}

/** The weekly lesson a moved lesson came from (its type goes with it). */
const movedFromLesson = ({ s, r }) => (r.from_lesson?.kind ? r.from_lesson : r.from_lesson && (s.lessons || []).find((l) => l.start === r.from_lesson.start && covers(l, r.lesson_date)))

const HERE = ['regular', 'movedIn', 'absentAsk', 'moveOutAsk', 'moveInAsk']

function weekDays(week, slots, students, requests) {
  const today = todayMY()
  return weekDates(today, week, weekdayOf).map((date) => {
    const wd = weekdayOf(date)
    const events = []
    const make = (key, start, end, people, slot) => {
      const here = people.filter((p) => HERE.includes(p.state))
      // Nobody comes (absent, cancelled or moved away): leave the time empty.
      if (!here.length) return
      const pend = people.filter((p) => p.r?.status === 'pending').length
      const tone = here.some((p) => p.kind === 'private') ? 'lesson' : 'group'
      const title = here.map((p) => p.s.name.split(/\s+/)[0]).join(', ')
      // Drag to move works on a lesson with exactly one student in it (not a shared group slot).
      const movable = here.length === 1 && people.length === 1 && ['regular', 'movedIn'].includes(here[0].state) ? here[0] : null
      events.push({ key, start, end, tone, title, sub: range(start, end), badge: pend || undefined, dot: true, drag: !!movable && date >= today, info: { date, start, end, people, slot, movable } })
    }
    const ins = movedIn(date, students, requests)
    const placed = new Set()
    for (const sl of slots.filter((x) => x.weekday === wd)) {
      const here = ins.filter((p) => p.r.to_start === sl.start && p.r.to_end === sl.end)
      here.forEach((p) => placed.add(p.r.id))
      make(`s-${sl.id}-${date}`, sl.start, sl.end, [...peopleFor(date, (l) => l.slot_id === sl.id, students, requests), ...here], sl)
    }
    // Weekly lessons at times that aren't timetable slots (e.g. Saturday 10–12).
    const custom = new Map()
    for (const s of students) for (const l of s.lessons || []) if (!l.slot_id && covers(l, date)) custom.set(`${l.start}-${l.end}`, l)
    for (const [k, l] of custom) {
      const here = ins.filter((p) => !placed.has(p.r.id) && p.r.to_start === l.start && p.r.to_end === l.end)
      here.forEach((p) => placed.add(p.r.id))
      make(`c-${k}-${date}`, l.start, l.end, [...peopleFor(date, (x) => !x.slot_id && x.start === l.start && x.end === l.end, students, requests), ...here], null)
    }
    // Moves to a time that is neither a slot nor anyone's weekly lesson.
    for (const p of ins.filter((x) => !placed.has(x.r.id))) make(`m-${p.r.id}`, p.r.to_start, p.r.to_end, [p], null)
    return { date, head: WEEKDAYS[wd].slice(0, 3), sub: dateLabel(date).split(' ').slice(1).join(' '), past: date < today, events }
  })
}

const toM = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const toT = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const TIMES = Array.from({ length: 31 }, (_, i) => toT(7 * 60 + i * 30))

/** Pick a date and times for a move, then choose: only this lesson, or this and all following. */
function TimePick({ init, onSave, onSeries, onCancel, busy, title }) {
  const [t, setT] = useState(init)
  return (
    <div className="decide__time acal-pick">
      <input type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} aria-label="Date" />
      <select value={t.start} onChange={(e) => { const len = Math.max(30, toM(t.end) - toM(t.start)); setT({ ...t, start: e.target.value, end: toT(Math.min(toM('22:00'), toM(e.target.value) + len)) }) }} aria-label="Start">
        {TIMES.slice(0, -1).map((x) => <option key={x} value={x}>{formatTime(x)}</option>)}
      </select>
      <span>to</span>
      <select value={t.end} onChange={(e) => setT({ ...t, end: e.target.value })} aria-label="End">
        {TIMES.filter((x) => x > t.start).map((x) => <option key={x} value={x}>{formatTime(x)}</option>)}
      </select>
      {title && <p className="acal-pick__title">{title}</p>}
      <div className="acal-pick__acts">
        <button type="button" className="btn btn--accent btn--sm" disabled={busy || !t.date || t.start >= t.end} onClick={() => onSave(t)}>Only this lesson</button>
        {onSeries && <button type="button" className="btn btn--ghost btn--sm" disabled={busy || !t.date || t.start >= t.end} onClick={() => onSeries(t)}>This and all following lessons</button>}
        <button type="button" className="act" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

const STATE = {
  regular: () => 'Regular lesson',
  absent: () => 'Absent',
  absentAsk: () => 'Reported absent · waiting for you',
  movedOut: (p, t) => `Moved to ${t(p.r)}`,
  moveOutAsk: (p, t) => `Asks to move to ${t(p.r)}`,
  movedIn: (p) => `Moved here from ${dateLabel(p.r.lesson_date)}`,
  moveInAsk: (p) => `Asks to move here from ${dateLabel(p.r.lesson_date)}`,
}

function Detail({ ev, slots, onDecide, onEdit, onMove, onMoveSeries, onCancelLesson, onUndo, dropped }) {
  // Whose lesson is being moved; a drag in the calendar opens it straight away at the dropped time.
  const [picking, setPicking] = useState(dropped ? `${dropped.p.s.id}-${dropped.p.state}-${dropped.p.r?.id || ''}` : null)
  const [busy, setBusy] = useState(false)
  const act = async (fn) => { setBusy(true); await fn(); setBusy(false); setPicking(null) }
  const { date, start, end, people, slot } = ev.info
  const target = (r) => askedTime(r)
  return (
    <div className="acal-detail">
      <header>
        <div>
          <b>{dateLabel(date)} · {range(start, end)}</b>
          <p>{slot ? `Your ${SLOT_KIND_LABEL[slot.kind].toLowerCase()} slot · ${slot.status === 'open' ? 'still offered to enquiries' : 'not offered to enquiries'}` : 'Not one of your enquiry slots'}</p>
        </div>
      </header>
      {people.length === 0 ? <p className="acal-detail__none">No students in this slot{slot?.status === 'open' ? ' yet. New enquiries can pick it.' : '.'}</p> : (
        <ul>
          {people.map((p) => (
            <li key={`${p.s.id}-${p.state}-${p.r?.id || ''}`} className={`acal-p acal-p--${p.state}`}>
              <div className="acal-p__who">
                <b>{p.s.name}</b>
                <span>{[p.s.level, KIND_SHORT[p.kind]].filter(Boolean).join(' · ')}</span>
              </div>
              <span className="acal-p__state">{STATE[p.state](p, target)}</span>
              {p.r?.note && <span className="acal-p__note">“{p.r.note}”</span>}
              {p.r?.status === 'pending' && <Decide r={p.r} onDecide={onDecide} withReply={false} />}
              {(() => {
                const key = `${p.s.id}-${p.state}-${p.r?.id || ''}`
                // The weekly lesson this entry stands for: the original one for moved lessons.
                const orig = p.r ? { date: p.r.lesson_date, start: p.r.from_lesson?.start, end: p.r.from_lesson?.end } : { date, start: p.l.start, end: p.l.end }
                if (picking === key) {
                  const init = dropped && dropped.p === p ? dropped.t
                    : p.state === 'movedIn' ? { date: p.r.to_date, start: p.r.to_start, end: p.r.to_end } : { date, start: orig.start, end: orig.end }
                  return (
                    <TimePick
                      init={init} busy={busy} title={`Move ${p.s.name.split(/\s+/)[0]}'s lesson to:`}
                      onCancel={() => setPicking(null)}
                      onSave={(t) => act(() => onMove(p.s, orig, t))}
                      onSeries={(t) => act(() => onMoveSeries(p.s, orig, t))}
                    />
                  )
                }
                if (p.r?.status === 'pending' || !orig.start) return null
                return (
                  <div className="acal-p__once">
                    {p.state === 'regular' && (
                      <>
                        <button type="button" className="act" onClick={() => setPicking(key)}><Icon name="calendar" />Move…</button>
                        {date < todayMY()
                          ? <button type="button" className="act" disabled={busy} onClick={() => act(() => onCancelLesson(p.s, orig, true))}>Mark absent</button>
                          : <button type="button" className="act" disabled={busy} onClick={() => window.confirm(`Cancel ${p.s.name}'s lesson on ${dateLabel(date)}? Other weeks stay the same.`) && act(() => onCancelLesson(p.s, orig))}>Cancel this week</button>}
                      </>
                    )}
                    {p.state === 'movedIn' && <button type="button" className="act" onClick={() => setPicking(key)}><Icon name="edit" />Move…</button>}
                    {['movedIn', 'movedOut', 'absent'].includes(p.state) && (
                      <button type="button" className="act" disabled={busy} onClick={() => act(() => onUndo(p.r))}>{p.state === 'absent' ? (date < todayMY() ? 'Mark attended' : 'Undo cancel') : 'Undo move'}</button>
                    )}
                  </div>
                )
              })()}
              <div className="acal-p__acts">
                <a className="act act--wa" href={waLink(p.s.phone)} target="_blank" rel="noopener noreferrer"><Icon name="chat" />WhatsApp</a>
                <button type="button" className="act" onClick={() => onEdit(p.s)}><Icon name="edit" />Edit</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AdminCalendar({ slots, setSlots, students, setStudents, requests, setRequests, refreshSlots, notify, onAuthError, onEditStudent }) {
  const [week, setWeek] = useState(0)
  const [sel, setSel] = useState(null)
  const days = useMemo(() => weekDays(week, slots, students, requests), [week, slots, students, requests])
  const picked = days.flatMap((d) => d.events).find((e) => e.key === sel)
  const fail = (e) => (e.unauthorized ? onAuthError() : notify(e.message, 'error'))
  const waiting = requests.filter((r) => r.status === 'pending').length

  const decide = async (r, status, reply, time) => {
    try {
      const { request, student } = await api('/api/admin/students', { method: 'POST', body: { action: 'decide', id: r.id, status, reply, time } })
      setRequests((list) => list.map((x) => (x.id === request.id ? request : x)))
      if (student) { setStudents((list) => list.map((x) => (x.id === student.id ? student : x))); refreshSlots() }
      notify(status === 'approved' ? (time ? 'Accepted at the new time' : 'Accepted') : 'Declined')
    } catch (e) { fail(e) }
  }
  // One-week changes made by the tutor: stored as an approved move / absence on that single lesson.
  const oneOff = async (body, text) => {
    try {
      const { request } = await api('/api/admin/students', { method: 'POST', body })
      setRequests((list) => (list.some((x) => x.id === request.id) ? list.map((x) => (x.id === request.id ? request : x)) : [request, ...list]))
      notify(text)
      setSel(null)
    } catch (e) { fail(e) }
  }
  const move = (s, orig, t) => oneOff({ action: 'move', studentId: s.id, lessonDate: orig.date, lessonStart: orig.start, toDate: t.date, toStart: t.start, toEnd: t.end }, `Moved ${s.name}'s lesson to ${dateLabel(t.date)} ${range(t.start, t.end)}`)
  const cancelLesson = (s, orig, absent = false) => oneOff({ action: 'cancelLesson', studentId: s.id, lessonDate: orig.date, lessonStart: orig.start, absent },
    absent ? `${s.name} marked absent on ${dateLabel(orig.date)}` : `Cancelled ${s.name}'s lesson on ${dateLabel(orig.date)}`)
  const undo = (r) => oneOff({ action: 'undo', id: r.id }, 'Undone: back to the usual time')
  const moveSeries = async (s, orig, t) => {
    try {
      const { student, cleared } = await api('/api/admin/students', { method: 'POST', body: { action: 'moveSeries', studentId: s.id, lessonDate: orig.date, lessonStart: orig.start, toDate: t.date, toStart: t.start, toEnd: t.end } })
      setStudents((list) => list.map((x) => (x.id === student.id ? student : x)))
      if (cleared) setRequests((await api('/api/admin/students')).requests)
      refreshSlots()
      notify(`${s.name}: every ${WEEKDAYS[weekdayOf(t.date)]} ${range(t.start, t.end)} from ${dateLabel(t.date < orig.date ? t.date : orig.date)}`)
      setSel(null)
    } catch (e) { fail(e) }
  }
  // Dropping a dragged lesson opens its details with the move already filled in.
  const [dropped, setDropped] = useState(null)
  const onDrag = (ev, day, start) => {
    const p = ev.info.movable
    const len = (Number(ev.end.slice(0, 2)) * 60 + Number(ev.end.slice(3))) - (Number(ev.start.slice(0, 2)) * 60 + Number(ev.start.slice(3)))
    const m = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + len
    const end = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    setDropped({ p, t: { date: day.date, start, end } })
    setSel(ev.key)
  }

  return (
    <section className="acal">
      <div className="acal__head">
        <ul className="stu-legend">
          <li><i className="wc__dot wc__dot--lesson" />1-to-1</li>
          <li><i className="wc__dot wc__dot--group" />Group</li>
          <li><span className="wc__badge acal__badge">1</span>Request waiting</li>
        </ul>
        {waiting > 0 && <span className="acal__wait">{waiting} request{waiting === 1 ? '' : 's'} waiting</span>}
      </div>
      <WeekCalendar
        days={days} week={week} weeks={WEEKS} onWeek={(n) => { setWeek(n); setSel(null) }}
        selected={sel} onSelect={(e) => { setDropped(null); setSel(e.key === sel ? null : e.key) }} today={todayMY()} onDrag={onDrag}
        title={`${days[0].sub} – ${days[6].sub}`}
        labels={{ prev: 'Previous week', next: 'Next week', today: 'This week', empty: 'Nothing on this day.', hour: (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}` }}
      />
      {picked ? <Detail key={`${picked.key}-${dropped ? dropped.t.date + dropped.t.start : ''}`} ev={picked} slots={slots} dropped={dropped && picked.info.movable === dropped.p ? dropped : null} onDecide={decide} onEdit={onEditStudent} onMove={move} onMoveSeries={moveSeries} onCancelLesson={cancelLesson} onUndo={undo} />
        : <p className="acal__hint">Only your classes with confirmed students show here; this is the schedule they see as “occupied”. Drag a lesson to a new time (on a computer), or tap it and choose Move. You'll be asked whether it's only this lesson or this and all following lessons. Open enquiry slots are on the Enquiry slots tab.</p>}
    </section>
  )
}
