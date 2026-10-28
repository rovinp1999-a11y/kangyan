// Week calendar of everything that is booked: timetable slots, each student's weekly
// lessons, absences, moved lessons and requests still waiting. Tap an entry for details
// and quick actions (WhatsApp, edit student, approve / reject, open / close the slot).
import { useMemo, useState } from 'react'
import { WEEKDAYS, SLOT_KIND_LABEL } from '../../shared/constants.js'
import { dateLabel, todayMY, weekdayOf } from '../../shared/lessons.js'
import { shortRange } from '../i18n.jsx'
import WeekCalendar, { weekDates } from '../components/WeekCalendar.jsx'
import { Icon, KIND_SHORT, api, waLink } from './lib.jsx'

const WEEKS = 8
const ACTIVE = ['pending', 'approved']
const range = (a, b) => shortRange(a, b, 'en')

/** Who is in one lesson (a slot or a custom weekly time) on one date, and in what state. */
function peopleFor(date, match, students, requests, slotId) {
  const out = []
  for (const s of students) {
    if (!s.active || (s.start_date && date < s.start_date)) continue
    for (const l of (s.lessons || []).filter(match)) {
      const r = requests.find((x) => x.student_id === s.id && x.lesson_date === date && x.kind !== 'change' && ACTIVE.includes(x.status) && (!x.from_lesson || x.from_lesson.start === l.start))
      const state = !r ? 'regular' : r.kind === 'absence' ? (r.status === 'approved' ? 'absent' : 'absentAsk') : (r.status === 'approved' ? 'movedOut' : 'moveOutAsk')
      out.push({ s, l, r, state })
    }
  }
  if (slotId) {
    for (const r of requests.filter((x) => x.kind === 'reschedule' && ACTIVE.includes(x.status) && x.to_slot_id === slotId && x.to_date === date)) {
      const s = students.find((x) => x.id === r.student_id)
      if (s) out.push({ s, r, state: r.status === 'approved' ? 'movedIn' : 'moveInAsk' })
    }
  }
  return out
}

const HERE = ['regular', 'movedIn', 'absentAsk', 'moveOutAsk', 'moveInAsk']

function weekDays(week, slots, students, requests) {
  const today = todayMY()
  return weekDates(today, week, weekdayOf).map((date) => {
    const wd = weekdayOf(date)
    const events = []
    const make = (key, start, end, people, slot) => {
      const here = people.filter((p) => HERE.includes(p.state))
      const pend = people.filter((p) => p.r?.status === 'pending').length
      const tone = here.length ? (here.some((p) => p.s.lesson_type === 'private') ? 'lesson' : 'group')
        : people.length ? 'off' : slot?.status === 'taken' ? 'taken' : 'open'
      const title = here.length ? here.map((p) => p.s.name.split(/\s+/)[0]).join(', ') : people.length ? 'Absent / moved' : slot?.status === 'taken' ? 'Taken' : 'Open'
      events.push({ key, start, end, tone, title, sub: range(start, end), badge: pend || undefined, dot: here.length > 0 || pend > 0, info: { date, start, end, people, slot } })
    }
    for (const sl of slots.filter((x) => x.weekday === wd)) {
      make(`s-${sl.id}-${date}`, sl.start, sl.end, peopleFor(date, (l) => l.slot_id === sl.id, students, requests, sl.id), sl)
    }
    // Weekly lessons at times that aren't timetable slots (e.g. Saturday 10–12).
    const custom = new Map()
    for (const s of students) for (const l of s.lessons || []) if (!l.slot_id && l.weekday === wd) custom.set(`${l.start}-${l.end}`, l)
    for (const [k, l] of custom) {
      make(`c-${k}-${date}`, l.start, l.end, peopleFor(date, (x) => !x.slot_id && x.weekday === wd && x.start === l.start && x.end === l.end, students, requests), null)
    }
    return { date, head: WEEKDAYS[wd].slice(0, 3), sub: dateLabel(date).split(' ').slice(1).join(' '), past: date < today, events: events.filter((e) => e.info.slot || e.info.people.length) }
  })
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

function Detail({ ev, slots, onDecide, onSlot, onEdit }) {
  const { date, start, end, people, slot } = ev.info
  const target = (r) => {
    const t = slots.find((x) => x.id === r.to_slot_id)
    return t ? `${dateLabel(r.to_date)} ${range(t.start, t.end)}` : r.to_label
  }
  return (
    <div className="acal-detail">
      <header>
        <div>
          <b>{dateLabel(date)} · {range(start, end)}</b>
          <p>{slot ? `${SLOT_KIND_LABEL[slot.kind]} slot · ${slot.status === 'open' ? 'open for enquiries' : 'taken'}` : 'Custom weekly time (not a timetable slot)'}</p>
        </div>
        {slot && (
          <button type="button" className="act" onClick={() => onSlot(slot)}>
            {slot.status === 'open' ? 'Mark slot taken' : 'Mark slot open'}
          </button>
        )}
      </header>
      {people.length === 0 ? <p className="acal-detail__none">No students in this slot{slot?.status === 'open' ? ' yet. New enquiries can pick it.' : '.'}</p> : (
        <ul>
          {people.map((p) => (
            <li key={`${p.s.id}-${p.state}-${p.r?.id || ''}`} className={`acal-p acal-p--${p.state}`}>
              <div className="acal-p__who">
                <b>{p.s.name}</b>
                <span>{[p.s.level, KIND_SHORT[p.s.lesson_type]].filter(Boolean).join(' · ')}</span>
              </div>
              <span className="acal-p__state">{STATE[p.state](p, target)}</span>
              {p.r?.note && <span className="acal-p__note">“{p.r.note}”</span>}
              <div className="acal-p__acts">
                {p.r?.status === 'pending' && (
                  <>
                    <button type="button" className="btn btn--accent btn--sm" onClick={() => onDecide(p.r, 'approved')}>{p.r.kind === 'absence' ? 'Noted' : 'Approve'}</button>
                    <button type="button" className="act" onClick={() => onDecide(p.r, 'rejected')}>Reject</button>
                  </>
                )}
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

  const decide = async (r, status) => {
    try {
      const { request, student } = await api('/api/admin/students', { method: 'POST', body: { action: 'decide', id: r.id, status } })
      setRequests((list) => list.map((x) => (x.id === request.id ? request : x)))
      if (student) { setStudents((list) => list.map((x) => (x.id === student.id ? student : x))); refreshSlots() }
      notify(status === 'approved' ? 'Approved' : 'Rejected')
    } catch (e) { fail(e) }
  }
  const toggleSlot = async (slot) => {
    const status = slot.status === 'open' ? 'taken' : 'open'
    setSlots((list) => list.map((x) => (x.id === slot.id ? { ...x, status } : x)))
    try {
      await api('/api/admin/slots', { method: 'PATCH', body: { id: slot.id, status } })
      notify(`${WEEKDAYS[slot.weekday]} ${range(slot.start, slot.end)} is now ${status}`)
    } catch (e) {
      setSlots((list) => list.map((x) => (x.id === slot.id ? slot : x)))
      fail(e)
    }
  }

  return (
    <section className="acal">
      <div className="acal__head">
        <ul className="stu-legend">
          <li><i className="wc__dot wc__dot--lesson" />1-to-1</li>
          <li><i className="wc__dot wc__dot--group" />Group</li>
          <li><i className="wc__dot wc__dot--open" />Open slot</li>
          <li><i className="wc__dot wc__dot--taken" />Taken, no student</li>
          <li><i className="wc__dot wc__dot--off" />Absent / moved</li>
          <li><span className="wc__badge acal__badge">1</span>Request waiting</li>
        </ul>
        {waiting > 0 && <span className="acal__wait">{waiting} request{waiting === 1 ? '' : 's'} waiting</span>}
      </div>
      <WeekCalendar
        days={days} week={week} weeks={WEEKS} onWeek={(n) => { setWeek(n); setSel(null) }}
        selected={sel} onSelect={(e) => setSel(e.key === sel ? null : e.key)} today={todayMY()}
        title={`${days[0].sub} – ${days[6].sub}`}
        labels={{ prev: 'Previous week', next: 'Next week', today: 'This week', empty: 'Nothing on this day.', hour: (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}` }}
      />
      {picked ? <Detail ev={picked} slots={slots} onDecide={decide} onSlot={toggleSlot} onEdit={onEditStudent} />
        : <p className="acal__hint">Tap a lesson or slot to see who is in it and act on requests.</p>}
    </section>
  )
}
