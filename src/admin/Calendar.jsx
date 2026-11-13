// "My calendar": the tutor's real classes with confirmed students, week by week — weekly
// lessons, one-week moves and cancellations, and requests still waiting. Enquiry slots
// (open / taken) live on their own tab. Tap an entry for details and quick actions.
import { useMemo, useState } from 'react'
import { WEEKDAYS, SLOT_KIND_LABEL } from '../../shared/constants.js'
import { dateLabel, todayMY, weekdayOf, covers, kindOf, onBreak } from '../../shared/lessons.js'
import { shortRange } from '../i18n.jsx'
import WeekCalendar, { weekDates } from '../components/WeekCalendar.jsx'
import TimeSelect from '../components/TimeSelect.jsx'
import { Icon, KIND_SHORT, api, waLink } from './lib.jsx'
import { Decide, askedTime, BreakPanel, saveBreaksFor } from './Students.jsx'

const WEEKS = 8
const WEEKS_BACK = 26 // how far back My calendar can go
const ACTIVE = ['pending', 'approved']
const range = (a, b) => shortRange(a, b, 'en')

/** Who is in one lesson (a slot or a custom weekly time) on one date, and in what state. */
function peopleFor(date, match, students, requests) {
  const out = []
  for (const s of students) {
    if (!s.active || (s.start_date && date < s.start_date) || onBreak(s, date)) continue // on a break: not in the calendar
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
      // Drag to move works when everyone coming can be moved (a group class moves together).
      const movable = here.every((p) => ['regular', 'movedIn'].includes(p.state)) ? here : null
      events.push({ key, start, end, tone, title, sub: range(start, end), badge: pend || undefined, dot: true, drag: !!movable && date >= today, info: { date, start, end, people, slot, movable } })
    }
    // Everyone at the same time on this date is one class, whether it's an enquiry slot, a weekly
    // time of their own or a lesson moved here.
    const groups = new Map()
    const add = (start, end, p) => {
      const k = `${start}-${end}`
      if (!groups.has(k)) groups.set(k, { start, end, people: [] })
      groups.get(k).people.push(p)
    }
    for (const p of peopleFor(date, () => true, students, requests)) add(p.l.start, p.l.end, p)
    for (const p of movedIn(date, students, requests)) add(p.r.to_start, p.r.to_end, p)
    for (const [k, g] of groups) {
      const slot = slots.find((x) => x.weekday === wd && x.start === g.start && x.end === g.end) || null
      make(`t-${k}-${date}`, g.start, g.end, g.people, slot)
    }
    return { date, head: WEEKDAYS[wd].slice(0, 3), sub: dateLabel(date).split(' ').slice(1).join(' '), past: date < today, events }
  })
}

const toM = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const toT = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Pick a date and times for a move, then choose: only this lesson, or this and all following. */
function TimePick({ init, onSave, onSeries, onCancel, busy, title }) {
  const [t, setT] = useState(init)
  return (
    <div className="decide__time acal-pick">
      <input type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} aria-label="Date" />
      <TimeSelect value={t.start} onChange={(v) => { const len = Math.max(30, toM(t.end) - toM(t.start)); setT({ ...t, start: v, end: toT(Math.min(toM('23:59'), toM(v) + len)) }) }} label="Start" />
      <span>to</span>
      <TimeSelect value={t.end} onChange={(v) => setT({ ...t, end: v })} label="End" />
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

/** Cancel one lesson, or this and all following (a weekly lesson stops); `many` = everyone in a group class. */
function CancelChoice({ who, date, weekly, many, busy, onOnce, onFollowing, onClose }) {
  return (
    <div className="acal-cancel" role="group" aria-label={`Cancel ${who}`}>
      <p>Cancel {who} on {dateLabel(date)}:</p>
      <div className="acal-pick__acts">
        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={onOnce}>Only this lesson</button>
        {weekly && <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={onFollowing}>This and all following</button>}
        <button type="button" className="act" onClick={onClose}>Keep</button>
      </div>
      <small>{weekly ? `“This and all following” stops ${many ? 'their weekly lessons' : 'the weekly lesson'} from ${dateLabel(date)}; earlier lessons and fees stay.` : 'This is a one-off lesson.'}</small>
    </div>
  )
}

/** The weekly lesson an entry stands for: the original one for moved lessons. */
const origOf = (p, date) => (p.r ? { date: p.r.lesson_date, start: p.r.from_lesson?.start, end: p.r.from_lesson?.end } : { date, start: p.l.start, end: p.l.end })

function Detail({ ev, slots, onDecide, onEdit, onMove, onMoveSeries, onCancelLesson, onEndSeries, onUndo, onAdd, onMoveClass, onBreaks, dropped }) {
  // Whose lesson is being moved ('all' = the whole class); a drag opens it straight away at the dropped time.
  const [picking, setPicking] = useState(!dropped ? null : dropped.list.length > 1 ? 'all' : `${dropped.list[0].s.id}-${dropped.list[0].state}-${dropped.list[0].r?.id || ''}`)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(null) // whose lesson (or 'all') is being cancelled
  const act = async (fn) => { setBusy(true); await fn(); setBusy(false); setPicking(null); setCancelling(null) }
  const { date, start, end, people, slot } = ev.info
  const regulars = date >= todayMY() ? people.filter((p) => p.state === 'regular' && p.l) : []
  const together = ev.info.movable && ev.info.movable.length > 1 && date >= todayMY() ? ev.info.movable : null // a class that moves as one
  const allFor = (fn) => act(async () => { for (const p of regulars) await fn(p) })
  const target = (r) => askedTime(r)
  return (
    <div className="acal-detail">
      <header>
        <div>
          <b>{dateLabel(date)} · {range(start, end)}</b>
          <p>{slot ? `Your ${SLOT_KIND_LABEL[slot.kind].toLowerCase()} slot · ${slot.status === 'open' ? 'still offered to enquiries' : 'not offered to enquiries'}` : 'Not one of your enquiry slots'}</p>
        </div>
        <div className="acal-detail__top">
          {date >= todayMY() && <button type="button" className="act" onClick={() => onAdd(date, start, end)}><Icon name="plus" />Add a student</button>}
          {together && <button type="button" className="act" onClick={() => setPicking(picking === 'all' ? null : 'all')}><Icon name="calendar" />Move class…</button>}
          {regulars.length > 1 && <button type="button" className="act act--danger" onClick={() => setCancelling(cancelling === 'all' ? null : 'all')}>Cancel class for everyone</button>}
        </div>
      </header>
      {together && picking === 'all' && (
        <TimePick
          init={dropped && dropped.list.length > 1 ? dropped.t : { date, start, end }} busy={busy} title={`Move the class for all ${together.length} students to:`}
          onCancel={() => setPicking(null)}
          onSave={(t) => act(() => onMoveClass(together, t, false, date))}
          onSeries={together.some((p) => p.state === 'regular' && !p.l?.once) ? (t) => act(() => onMoveClass(together, t, true, date)) : null}
        />
      )}
      {cancelling === 'all' && (
        <CancelChoice who={`the class for all ${regulars.length} students`} date={date} many busy={busy} weekly={regulars.some((p) => !p.l.once)}
          onOnce={() => allFor((p) => onCancelLesson(p.s, { date, start: p.l.start }))}
          onFollowing={() => allFor((p) => (p.l.once ? onCancelLesson(p.s, { date, start: p.l.start }) : onEndSeries(p.s, { date, start: p.l.start })))}
          onClose={() => setCancelling(null)} />
      )}
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
                const orig = origOf(p, date)
                if (picking === key) {
                  const init = dropped && dropped.list[0] === p ? dropped.t
                    : p.state === 'movedIn' ? { date: p.r.to_date, start: p.r.to_start, end: p.r.to_end } : { date, start: orig.start, end: orig.end }
                  return (
                    <TimePick
                      init={init} busy={busy} title={`Move ${p.s.name.split(/\s+/)[0]}'s lesson to:`}
                      onCancel={() => setPicking(null)}
                      onSave={(t) => act(() => onMove(p.s, orig, t))}
                      onSeries={p.l?.once ? null : (t) => act(() => onMoveSeries(p.s, orig, t))}
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
                          : <button type="button" className="act" disabled={busy} onClick={() => setCancelling(cancelling === key ? null : key)}>Cancel…</button>}
                        {date >= todayMY() && <button type="button" className="act" onClick={() => setCancelling(cancelling === `pause-${key}` ? null : `pause-${key}`)}><Icon name="clock" />Pause…</button>}
                      </>
                    )}
                    {cancelling === `pause-${key}` && <BreakPanel s={p.s} from={date} onSave={async (st, list) => { const done = await onBreaks(st, list); if (done) setCancelling(null); return done }} />}
                    {cancelling === key && (
                      <CancelChoice who={`${p.s.name.split(/\s+/)[0]}'s lesson`} date={date} busy={busy} weekly={!p.l?.once}
                        onOnce={() => act(() => onCancelLesson(p.s, orig))} onFollowing={() => act(() => onEndSeries(p.s, orig))} onClose={() => setCancelling(null)} />
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

/**
 * A class drafted by clicking an empty time (like Google Calendar): it shows on the calendar as a
 * block that can be dragged, and here you pick the student and save it as an extra class (or weekly).
 */
function DraftClass({ draft, setDraft, students, onSave, onCancel }) {
  const active = students.filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name))
  const [busy, setBusy] = useState(false)
  const who = active.find((s) => s.id === draft.studentId)
  const ok = who && draft.date && draft.start < draft.end
  const pickStudent = (id) => {
    const s = active.find((x) => x.id === Number(id))
    setDraft({ ...draft, studentId: s?.id ?? null, kind: s ? (s.lesson_type === 'group' ? 'group' : 'private') : draft.kind })
  }
  const setStart = (v) => setDraft({ ...draft, start: v, end: toT(Math.min(toM('23:59'), toM(v) + Math.max(30, toM(draft.end) - toM(draft.start)))) })
  const save = async (e) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    await onSave(draft, who)
    setBusy(false)
  }
  return (
    <form className="acal-detail acal-draft" onSubmit={save}>
      <header>
        <div>
          <b>New class · {dateLabel(draft.date)} · {range(draft.start, draft.end)}</b>
          <p>Drag the block on the calendar or change the time here.</p>
        </div>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close"><Icon name="x" /></button>
      </header>
      <div className="kindpick kindpick--sm" role="group" aria-label="Repeats">
        <button type="button" className={`kindpick__b ${!draft.weekly ? 'is-on is-once' : ''}`} aria-pressed={!draft.weekly} onClick={() => setDraft({ ...draft, weekly: false })}>Extra class (once)</button>
        <button type="button" className={`kindpick__b ${draft.weekly ? 'is-on is-weekly' : ''}`} aria-pressed={!!draft.weekly} onClick={() => setDraft({ ...draft, weekly: true })}><Icon name="repeat" />Every {WEEKDAYS[weekdayOf(draft.date)]}</button>
      </div>
      <label className="acal-draft__f"><span>Student</span>
        <select value={draft.studentId ?? ''} onChange={(e) => pickStudent(e.target.value)} required>
          <option value="">Choose a student…</option>
          {active.map((s) => <option key={s.id} value={s.id}>{[s.name, s.level].filter(Boolean).join(' · ')}</option>)}
        </select>
      </label>
      <div className="acal-draft__when">
        <input type="date" value={draft.date} min={todayMY()} onChange={(e) => e.target.value && setDraft({ ...draft, date: e.target.value })} aria-label="Date" />
        <TimeSelect value={draft.start} onChange={setStart} label="Start" />
        <span>to</span>
        <TimeSelect value={draft.end} onChange={(v) => setDraft({ ...draft, end: v })} label="End" />
      </div>
      <div className="kindpick kindpick--sm" role="group" aria-label="Class type">
        {['private', 'group'].map((k) => (
          <button key={k} type="button" className={`kindpick__b kindpick__b--${k} ${draft.kind === k ? 'is-on' : ''}`} aria-pressed={draft.kind === k} onClick={() => setDraft({ ...draft, kind: k })}>{k === 'group' ? 'Group class' : '1-to-1'}</button>
        ))}
      </div>
      {draft.start >= draft.end && <p className="acal-draft__warn">The end time is before the start.</p>}
      <div className="acal-pick__acts">
        <button className="btn btn--accent btn--sm" disabled={!ok || busy}>{busy ? 'Saving…' : who ? `Add ${who.name.split(/\s+/)[0]}'s ${draft.weekly ? 'weekly lesson' : 'extra class'}` : 'Save'}</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export function AdminCalendar({ slots, setSlots, students, setStudents, requests, setRequests, refreshSlots, notify, onAuthError, onEditStudent }) {
  const [week, setWeek] = useState(0)
  const [sel, setSel] = useState(null)
  const [draft, setDraft] = useState(null) // { date, start, end, studentId, kind, weekly }: a class being added
  const built = useMemo(() => weekDays(week, slots, students, requests), [week, slots, students, requests])
  // The drafted class shows as its own block (on the following weeks too when it repeats).
  const days = draft ? built.map((d) => (d.date === draft.date || (draft.weekly && d.date > draft.date && weekdayOf(d.date) === weekdayOf(draft.date))
    ? { ...d, events: [...d.events, { key: d.date === draft.date ? 'draft' : `draft-${d.date}`, start: draft.start, end: draft.end, tone: 'new', dot: true, drag: d.date === draft.date, title: draft.studentId ? students.find((x) => x.id === draft.studentId)?.name.split(/\s+/)[0] || 'New class' : 'New class', sub: range(draft.start, draft.end), info: { type: 'draft' } }] }
    : d)) : built
  const picked = !draft && days.flatMap((d) => d.events).find((e) => e.key === sel)
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
      if (text) notify(text)
      setSel(null)
    } catch (e) { fail(e) }
  }
  const move = (s, orig, t, quiet) => oneOff({ action: 'move', studentId: s.id, lessonDate: orig.date, lessonStart: orig.start, toDate: t.date, toStart: t.start, toEnd: t.end }, !quiet && `Moved ${s.name}'s lesson to ${dateLabel(t.date)} ${range(t.start, t.end)}`)
  const cancelLesson = (s, orig, absent = false) => oneOff({ action: 'cancelLesson', studentId: s.id, lessonDate: orig.date, lessonStart: orig.start, absent },
    absent ? `${s.name} marked absent on ${dateLabel(orig.date)}` : `Cancelled ${s.name}'s lesson on ${dateLabel(orig.date)}`)
  const undo = (r) => oneOff({ action: 'undo', id: r.id }, 'Undone: back to the usual time')
  const endSeries = async (s, orig) => {
    try {
      const { student, cleared } = await api('/api/admin/students', { method: 'POST', body: { action: 'endSeries', studentId: s.id, lessonDate: orig.date, lessonStart: orig.start } })
      setStudents((list) => list.map((x) => (x.id === student.id ? student : x)))
      if (cleared) setRequests((await api('/api/admin/students')).requests)
      refreshSlots()
      notify(`${s.name}: lessons cancelled from ${dateLabel(orig.date)} on`)
      setSel(null)
    } catch (e) { fail(e) }
  }
  const moveSeries = async (s, orig, t, quiet) => {
    try {
      const { student, cleared } = await api('/api/admin/students', { method: 'POST', body: { action: 'moveSeries', studentId: s.id, lessonDate: orig.date, lessonStart: orig.start, toDate: t.date, toStart: t.start, toEnd: t.end } })
      setStudents((list) => list.map((x) => (x.id === student.id ? student : x)))
      if (cleared) setRequests((await api('/api/admin/students')).requests)
      refreshSlots()
      if (!quiet) notify(`${s.name}: every ${WEEKDAYS[weekdayOf(t.date)]} ${range(t.start, t.end)} from ${dateLabel(t.date < orig.date ? t.date : orig.date)}`)
      setSel(null)
    } catch (e) { fail(e) }
  }
  // A group class moves as one: each student's lesson goes to the new time (this and all following
  // for weekly lessons when `series`; lessons already moved here, or one-off ones, just move).
  const moveClass = async (list, t, series, date) => {
    for (const p of list) {
      const orig = origOf(p, date)
      if (series && p.state === 'regular' && !p.l?.once) await moveSeries(p.s, orig, t, true)
      else await move(p.s, orig, t, true)
    }
    notify(series
      ? `Class moved to every ${WEEKDAYS[weekdayOf(t.date)]} ${range(t.start, t.end)} for ${list.length} students`
      : `Class moved to ${dateLabel(t.date)} ${range(t.start, t.end)} for ${list.length} students`)
    setSel(null)
  }
  // Dropping a dragged lesson opens its details with the move already filled in.
  const [dropped, setDropped] = useState(null)
  const onDrag = (ev, day, start) => {
    if (ev.info.type === 'draft') {
      setDraft((x) => ({ ...x, date: day.date, start, end: toT(Math.min(toM('23:59'), toM(start) + toM(x.end) - toM(x.start))) }))
      return
    }
    const list = ev.info.movable
    const len = (Number(ev.end.slice(0, 2)) * 60 + Number(ev.end.slice(3))) - (Number(ev.start.slice(0, 2)) * 60 + Number(ev.start.slice(3)))
    const m = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + len
    const end = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    setDropped({ list, t: { date: day.date, start, end } })
    setSel(ev.key)
  }

  // Clicking an empty time drafts a 1½-hour class there.
  const startDraft = (day, t) => {
    const start = t || '17:00'
    setSel(null)
    setDropped(null)
    setDraft((x) => ({ studentId: x?.studentId ?? null, kind: x?.kind || 'private', weekly: false, date: day.date, start, end: toT(Math.min(toM('23:59'), toM(start) + 90)) }))
  }
  const addLesson = async (d, s) => {
    try {
      const { student } = await api('/api/admin/students', { method: 'POST', body: { action: 'addLesson', studentId: s.id, date: d.date, start: d.start, end: d.end, kind: d.kind, weekly: !!d.weekly } })
      setStudents((list) => list.map((x) => (x.id === student.id ? student : x)))
      refreshSlots()
      notify(d.weekly ? `${s.name}: every ${WEEKDAYS[weekdayOf(d.date)]} ${range(d.start, d.end)} from ${dateLabel(d.date)}` : `Extra class for ${s.name} on ${dateLabel(d.date)} ${range(d.start, d.end)}`)
      setDraft(null)
    } catch (e) { fail(e) }
  }

  return (
    <section className="acal">
      <div className="acal__head">
        <ul className="stu-legend">
          <li><i className="wc__dot wc__dot--lesson" />1-to-1</li>
          <li><i className="wc__dot wc__dot--group" />Group</li>
          <li><span className="wc__badge acal__badge acal__badge--key" aria-hidden="true" />Request waiting</li>
        </ul>
        {waiting > 0 && <span className="acal__wait">{waiting} request{waiting === 1 ? '' : 's'} waiting</span>}
      </div>
      <WeekCalendar
        days={days} week={week} weeks={WEEKS} back={WEEKS_BACK} onWeek={(n) => { setWeek(n); setSel(null) }}
        selected={draft ? 'draft' : sel} today={todayMY()} onDrag={onDrag} onEmpty={startDraft}
        onSelect={(e) => { if (e.info.type === 'draft') return; setDraft(null); setDropped(null); setSel(e.key === sel ? null : e.key) }}
        title={`${days[0].sub} – ${days[6].sub}`}
        labels={{ prev: 'Previous week', next: 'Next week', today: 'This week', empty: 'Nothing on this day.', ask: '+ Add a class on this day', hour: (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}` }}
      />
      {draft ? <DraftClass draft={draft} setDraft={setDraft} students={students} onSave={addLesson} onCancel={() => setDraft(null)} />
        : picked ? <Detail key={`${picked.key}-${dropped ? dropped.t.date + dropped.t.start : ''}`} ev={picked} slots={slots} dropped={dropped && picked.info.movable === dropped.list ? dropped : null} onDecide={decide} onEdit={onEditStudent} onMove={move} onMoveSeries={moveSeries} onCancelLesson={cancelLesson} onEndSeries={endSeries} onUndo={undo} onMoveClass={moveClass} onBreaks={(s, list) => saveBreaksFor(s, list, setStudents, notify, fail)}
          onAdd={(date, start, end) => { startDraft({ date }, start); setDraft((x) => ({ ...x, end })) }} />
        : <p className="acal__hint">Click any empty time to add a class there, then pick the student. Only your classes with confirmed students show here; this is the schedule they see as “occupied”. Drag a lesson to a new time (on a computer), or tap it and choose Move. You'll be asked whether it's only this lesson or this and all following lessons. Open enquiry slots are on the Enquiry slots tab.</p>}
    </section>
  )
}
