// Existing students: one row each, a profile with their details and parent, their weekly
// lessons, login PIN, and the requests they send from the student page.
import { useEffect, useMemo, useState } from 'react'
import { LEVEL_GROUPS, SUBJECTS, WEEKDAYS, WEEKDAYS_SHORT, slotLabel } from '../../shared/constants.js'
import { dateLabel, todayMY, firstOn, addDays, weekdayOf, kindOf, typeOf } from '../../shared/lessons.js'
import { STRINGS, shortRange } from '../i18n.jsx'
import { Icon, KIND_SHORT, STUDENT_KIND, api, fullDate, timeAgo, waLink } from './lib.jsx'
import { Drawer } from './Enquiries.jsx'
import TimeSelect from '../components/TimeSelect.jsx'
import { fill } from './templates.js'

const SITE = 'https://kangyan.work/student'
const KIND_LABEL = { reschedule: 'Move one lesson', absence: 'Absence', change: 'This and all following', break: 'Break' }
const STATUS = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected', cancelled: 'Withdrawn' }
const localPhone = (p) => (p?.startsWith('60') ? `0${p.slice(2)}` : p || '')
const first = (n) => n.trim().split(/\s+/)[0]
const weeklyText = (l) => `${WEEKDAYS[l.weekday]} · ${shortRange(l.start, l.end, 'en')}`
const KIND_LONG = { private: '1-to-1', group: 'Group class' }
const toT = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const toM = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function loginMessage(s, pin) {
  return fill('login', s.lang, { name: s.lang === 'zh' ? s.name : first(s.name), link: SITE, phone: localPhone(s.phone), pin })
}

/** Reminder of the student page for someone who already has a PIN (it can't be read back). */
export function pageMessage(s) {
  return fill('pageReminder', s.lang, { name: s.lang === 'zh' ? s.name : first(s.name), link: SITE, phone: localPhone(s.phone) })
}

/** The time a request asks for, in a language: 'Tue 3 Nov 7–8:30 PM' / 'every Tuesday 7–8:30 PM'. */
export function askedTime(r, lang = 'en') {
  if (!r.to_start) return r.to_label || ''
  const L = STRINGS[lang].labels
  const time = shortRange(r.to_start, r.to_end, lang)
  if (r.kind === 'change') {
    // "This and all following lessons" from a date.
    const from = r.to_date && r.lesson_date ? (r.to_date < r.lesson_date ? r.to_date : r.lesson_date) : r.lesson_date
    const start = from && firstOn(from, r.to_weekday ?? 0)
    const wd = L.weekdays[r.to_weekday ?? 0]
    if (lang === 'zh') return `每${wd} ${time}${start ? `（${dateLabel(start, 'zh')}起）` : ''}`
    return `every ${wd} ${time}${start ? `, from ${dateLabel(start)}` : ''}`
  }
  return `${r.to_date ? dateLabel(r.to_date, lang) : ''} ${time}`.trim()
}

function decisionMessage(r, s, approved) {
  const zh = s.lang === 'zh'
  const lang = zh ? 'zh' : 'en'
  const lesson = r.lesson_date ? dateLabel(r.lesson_date, lang) : ''
  const what = {
    reschedule: zh ? `${lesson} 的课改到 ${askedTime(r, lang)}` : `moving your lesson on ${lesson} to ${askedTime(r, lang)}`,
    absence: zh ? `${lesson} 请假${r.recording ? '（会发录影给你）' : ''}` : `your absence on ${lesson}${r.recording ? ' (I will send you the recording)' : ''}`,
    change: zh ? `这堂和之后所有的课改到${askedTime(r, lang)}` : `changing this and all following lessons to ${askedTime(r, lang)}`,
    break: zh ? `${lesson}至${r.to_date ? dateLabel(r.to_date, lang) : ''}暂停上课（不收学费）` : `a break from ${lesson} to ${r.to_date ? dateLabel(r.to_date, lang) : ''} (no lessons and no fee)`,
  }[r.kind]
  return fill(approved ? 'accepted' : 'declined', lang, { name: zh ? s.name : first(s.name), what, reply: r.reply ? `\n\n${r.reply}` : '', link: SITE })
}

export function requestText(r) {
  const at = r.from_lesson ? ` ${shortRange(r.from_lesson.start, r.from_lesson.end, 'en')}` : ''
  if (r.kind === 'reschedule') return `${dateLabel(r.lesson_date)}${at} → ${askedTime(r)}`
  if (r.kind === 'absence') return `${dateLabel(r.lesson_date)}${at}${r.recording ? ' · wants the recording' : ''}`
  if (r.kind === 'break') return `No lessons ${dateLabel(r.lesson_date)} – ${dateLabel(r.to_date)}`
  return `${r.from_lesson ? `${WEEKDAYS_SHORT[r.from_lesson.weekday]}${at}` : 'New weekly lesson'} → ${askedTime(r)}`
}

/**
 * Accept / decline a request, or change the time first (after agreeing it on WhatsApp).
 * Used on the Students tab and in the calendar details.
 */
export function Decide({ r, onDecide, withReply = true }) {
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [t, setT] = useState({ date: r.to_date || '', weekday: r.to_weekday ?? 0, start: r.to_start || '17:30', end: r.to_end || '19:00' })
  const go = async (status, time) => { setBusy(true); await onDecide(r, status, reply, time); setBusy(false) }
  const timesOk = t.start < t.end && (r.kind !== 'reschedule' || t.date)
  return (
    <div className="decide">
      {editing && (
        <div className="decide__time">
          {r.kind === 'reschedule'
            ? <input type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} aria-label="Date" />
            : <select value={t.weekday} onChange={(e) => setT({ ...t, weekday: Number(e.target.value) })} aria-label="Day">{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>}
          <TimeSelect value={t.start} onChange={(v) => { const len = toM(t.end) - toM(t.start); setT({ ...t, start: v, end: toT(Math.min(toM('23:59'), toM(v) + Math.max(30, len))) }) }} label="Start" />
          <span>to</span>
          <TimeSelect value={t.end} onChange={(v) => setT({ ...t, end: v })} label="End" />
        </div>
      )}
      {withReply && <input className="sreq__reply" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the student (optional)" maxLength={500} aria-label="Reply to the student" />}
      <div className="sreq__acts">
        <button type="button" className="act" disabled={busy} onClick={() => go('rejected')}>Decline</button>
        {r.kind !== 'absence' && r.kind !== 'break' && !editing && <button type="button" className="act" disabled={busy} onClick={() => setEditing(true)}><Icon name="edit" />Change time</button>}
        {editing
          ? <button type="button" className="btn btn--accent btn--sm" disabled={busy || !timesOk} onClick={() => go('approved', t)}>Accept new time</button>
          : <button type="button" className="btn btn--accent btn--sm" disabled={busy} onClick={() => go('approved')}>{r.kind === 'absence' ? 'Noted' : 'Accept'}</button>}
      </div>
    </div>
  )
}

/** Login details shown once after creating a student or giving a new PIN. */
function PinCard({ s, pin, onClose, notify }) {
  const msg = loginMessage(s, pin)
  const copy = async () => {
    try { await navigator.clipboard.writeText(msg); notify('Login details copied') } catch { notify('Could not copy', 'error') }
  }
  return (
    <div className="pin-card">
      <h2>Login details for {s.name}</h2>
      <p className="pin-card__note">This PIN is shown only now. Send it to the student or parent.</p>
      <dl>
        <dt>Page</dt><dd>{SITE.replace('https://', '')}</dd>
        <dt>WhatsApp</dt><dd>{localPhone(s.phone)}</dd>
        <dt>PIN</dt><dd className="pin-card__pin">{pin}</dd>
      </dl>
      <div className="pin-card__acts">
        <a className="act act--wa" href={waLink(s.phone, msg)} target="_blank" rel="noopener noreferrer"><Icon name="chat" />Send on WhatsApp</a>
        <button type="button" className="act" onClick={copy}><Icon name="copy" />Copy message</button>
        <button type="button" className="act" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

/** Form values for editing an existing student. */
export const formFromStudent = (s) => ({
  ...BLANK, id: s.id, name: s.name, phone: localPhone(s.phone), level: s.level || '', lessonType: s.lesson_type, subjects: s.subjects || [],
  // Keep from / until (set by "this and all following lessons"); lessons already over are left out.
  lessons: (s.lessons || []).filter((l) => !l.until || l.until >= todayMY()).map((l) => (l.once
    ? { once: true, date: l.from, weekday: l.weekday, start: l.start, end: l.end, kind: kindOf(l, s) }
    : { weekday: l.weekday, start: l.start, end: l.end, kind: kindOf(l, s), ...(l.from ? { from: l.from } : {}), ...(l.until ? { until: l.until } : {}) })),
  startDate: s.start_date || '', lang: s.lang, notes: s.notes || '', hourlyRate: s.hourly_rate ?? '',
  school: s.school || '', birthday: s.birthday || '', email: s.email || '', address: s.address || '',
  parentName: s.parent_name || '', parentRelation: s.parent_relation || '', parentPhone: localPhone(s.parent_phone),
})

const BLANK = {
  name: '', phone: '', level: '', lessonType: 'private', subjects: [], lessons: [], startDate: '', lang: 'en', notes: '', hourlyRate: '',
  school: '', birthday: '', email: '', address: '', parentName: '', parentRelation: '', parentPhone: '',
}
const RELATION = { mother: 'Mother', father: 'Father', guardian: 'Guardian' }
const lessonsNow = (s) => (s.lessons || []).filter((l) => !l.until || l.until >= todayMY())
const ageOn = (birthday) => {
  if (!birthday) return null
  const t = todayMY()
  return Number(t.slice(0, 4)) - Number(birthday.slice(0, 4)) - (t.slice(5) < birthday.slice(5) ? 1 : 0)
}
const birthdayText = (b) => {
  const [y, m, d] = b.split('-').map(Number)
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y} · ${ageOn(b)} years old`
}
const parentLabel = (s) => [s.parent_name, RELATION[s.parent_relation]].filter(Boolean).join(' · ')

/** A new lesson happens once, on the next day after `after` (or today); "Repeat weekly" is the tutor's choice. */
const newLesson = (last) => {
  const date = last?.once && last.date ? addDays(last.date, 1) : todayMY()
  return { once: true, date, weekday: weekdayOf(date), start: last?.start || '17:30', end: last?.end || '19:00', kind: last?.kind || 'private' }
}

/** One row per lesson: once on a date, or weekly on a day; times; 1-to-1 or group. Shows when it matches a timetable slot. */
function LessonRows({ value, onChange, slots, own = [] }) {
  const setRow = (i, k, v) => onChange(value.map((l, j) => {
    if (j !== i) return l
    const next = { ...l, [k]: k === 'weekday' ? Number(v) : v }
    if (k === 'date' && v) next.weekday = weekdayOf(v)
    // Switching between once and weekly keeps the day: a one-off lesson's date, or the next date on that weekday.
    if (k === 'once' && v) { next.date = l.from && l.from >= todayMY() ? l.from : firstOn(todayMY(), l.weekday); delete next.from }
    if (k === 'once' && !v) next.from = l.date && l.date > todayMY() ? l.date : undefined
    // Moving the start keeps the length; an end before the start is pushed back.
    if (k === 'start') next.end = toT(Math.min(toM('23:59'), toM(v) + (toM(l.end) - toM(l.start))))
    if (toM(next.end) <= toM(next.start)) next.end = toT(Math.min(toM('23:59'), toM(next.start) + 30))
    return next
  }))
  return (
    <div className="wl">
      {value.map((l, i) => {
        const slot = !l.once && slots.find((x) => x.weekday === l.weekday && x.start === l.start && x.end === l.end)
        const mins = toM(l.end) - toM(l.start)
        return (
          <div className="wl__row" key={i}>
            <div className="wl__top">
              <div className="kindpick kindpick--sm" role="group" aria-label={`Lesson ${i + 1} repeats`}>
                <button type="button" className={`kindpick__b ${l.once ? 'is-on is-once' : ''}`} aria-pressed={!!l.once} onClick={() => setRow(i, 'once', true)}>Once</button>
                <button type="button" className={`kindpick__b ${!l.once ? 'is-on is-weekly' : ''}`} aria-pressed={!l.once} onClick={() => setRow(i, 'once', false)}><Icon name="repeat" />Weekly</button>
              </div>
              <div className="kindpick kindpick--sm" role="group" aria-label={`Lesson ${i + 1} class type`}>
                {['private', 'group'].map((k) => (
                  <button key={k} type="button" className={`kindpick__b kindpick__b--${k} ${l.kind === k ? 'is-on' : ''}`} aria-pressed={l.kind === k} onClick={() => setRow(i, 'kind', k)}>{KIND_LONG[k]}</button>
                ))}
              </div>
              <button type="button" className="icon-btn icon-btn--danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove lesson ${i + 1}`}><Icon name="x" /></button>
            </div>
            <div className="wl__when">
              {l.once ? (
                <input type="date" className="wl__date" value={l.date || ''} onChange={(e) => setRow(i, 'date', e.target.value)} aria-label={`Lesson ${i + 1} date`} required />
              ) : (
                <select className="wl__day" value={l.weekday} onChange={(e) => setRow(i, 'weekday', e.target.value)} aria-label={`Lesson ${i + 1} day`}>
                  {WEEKDAYS.map((d, k) => <option key={d} value={k}>Every {d}</option>)}
                </select>
              )}
              <TimeSelect className="wl__start" value={l.start} onChange={(v) => setRow(i, 'start', v)} label={`Lesson ${i + 1} start`} />
              <span className="wl__endwrap">
                <span className="wl__to">to</span>
                <TimeSelect className="wl__end" value={l.end} onChange={(v) => setRow(i, 'end', v)} label={`Lesson ${i + 1} end`} />
              </span>
            </div>
            {!l.once && (
              // Leave empty to start right away; a start already passed isn't shown (it's kept).
              <label className="wl__from"><span>Starts</span>
                <input type="date" value={l.from && l.from >= todayMY() ? l.from : ''} min={todayMY()} onChange={(e) => setRow(i, 'from', e.target.value || undefined)} aria-label={`Lesson ${i + 1} first date`} />
              </label>
            )}
            <small className="wl__info">
              {mins / 60} hour{mins === 60 ? '' : 's'}
              {l.once ? (l.date ? ` · one lesson on ${dateLabel(l.date)}${l.date < todayMY() ? ' (already past, still counted in that month\'s fee)' : ''}` : ' · pick a date')
                : <>
                  {l.from && l.from > todayMY() && ` · starts ${dateLabel(l.from)}`}
                  {l.until && ` · last lesson ${dateLabel(l.until)}`}
                  {!slot ? ' · not one of your timetable slots'
                    : slot.status === 'taken' && !own.some((o) => o.weekday === l.weekday && o.start === l.start && o.end === l.end)
                      ? ' · this timetable slot is already taken'
                      : ` · matches your timetable slot${l.kind === 'private' ? ' (will be marked taken)' : ''}`}
                </>}
            </small>
          </div>
        )
      })}
      <button type="button" className="act wl__add" onClick={() => onChange([...value, newLesson(value[value.length - 1])])}>
        <Icon name="plus" />{value.length ? 'Add another lesson' : 'Add a lesson'}
      </button>
    </div>
  )
}

function StudentForm({ initial, slots, onSave, onCancel, busy }) {
  const [f, setF] = useState(initial)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const editing = !!initial.id
  const type = typeOf(f.lessons, f.lessonType)
  return (
    <form className="sform" onSubmit={(e) => { e.preventDefault(); onSave({ ...f, lessonType: type }) }}>
      <h2>{editing ? `Edit ${initial.name}` : initial.enquiryId ? 'Add student from enquiry' : 'Add a student'}</h2>
      {!editing && initial.enquiryId && <p className="sform__note">Filled in from the enquiry. Check the details, add their lessons, then save. The enquiry is marked confirmed.</p>}

      <fieldset className="sform__sec">
        <legend>Student</legend>
        <label className="sform__f"><span>Name</span><input value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={80} /></label>
        <div className="sform__row">
          <label className="sform__f"><span>School</span><input value={f.school} onChange={(e) => set('school', e.target.value)} maxLength={120} /></label>
          <label className="sform__f"><span>Birthday</span><input type="date" value={f.birthday} max={todayMY()} onChange={(e) => set('birthday', e.target.value)} /></label>
        </div>
        <div className="sform__row">
          <label className="sform__f"><span>Level</span>
            <select value={f.level} onChange={(e) => set('level', e.target.value)}>
              <option value="">—</option>
              {LEVEL_GROUPS.map((g) => <optgroup key={g.key} label={g.key.toUpperCase()}>{g.levels.map((l) => <option key={l} value={l}>{l}</option>)}</optgroup>)}
            </select>
          </label>
        </div>
        <div className="sform__f"><span>Subjects</span>
          <div className="sform__subs">
            {SUBJECTS.map((x) => (
              <label key={x} className={`sform__sub ${f.subjects.includes(x) ? 'is-on' : ''}`}>
                <input type="checkbox" checked={f.subjects.includes(x)} onChange={() => set('subjects', f.subjects.includes(x) ? f.subjects.filter((y) => y !== x) : [...f.subjects, x])} />{x}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="sform__sec">
        <legend>Contact &amp; login</legend>
        <label className="sform__f"><span>Student's WhatsApp (used to log in)</span><input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} required placeholder="012-345 6789" /></label>
        <div className="sform__row">
          <label className="sform__f"><span>Email</span><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} maxLength={120} /></label>
          <label className="sform__f"><span>Messages in</span>
            <select value={f.lang} onChange={(e) => set('lang', e.target.value)}><option value="en">English</option><option value="zh">中文</option></select>
          </label>
        </div>
        <label className="sform__f"><span>Address (for in-person lessons)</span><input value={f.address} onChange={(e) => set('address', e.target.value)} maxLength={300} /></label>
      </fieldset>

      <fieldset className="sform__sec">
        <legend>Parent / guardian</legend>
        <div className="sform__row">
          <label className="sform__f"><span>Name</span><input value={f.parentName} onChange={(e) => set('parentName', e.target.value)} maxLength={80} placeholder="e.g. Mrs Tan" /></label>
          <label className="sform__f"><span>Relation</span>
            <select value={f.parentRelation} onChange={(e) => set('parentRelation', e.target.value)}>
              <option value="">—</option>{Object.entries(RELATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <label className="sform__f"><span>Parent's WhatsApp</span>
          <input type="tel" value={f.parentPhone} onChange={(e) => set('parentPhone', e.target.value)} placeholder="012-345 6789" />
          <small>Fee reminders are sent here. Can be the same as the student's number.</small>
        </label>
      </fieldset>

      <fieldset className="sform__sec">
        <legend>Lessons &amp; fees</legend>
        <p className="sform__hint">Add each lesson once on a date, or set it to repeat weekly. Each one is 1-to-1 or group; a student can have both.</p>
        <LessonRows value={f.lessons} onChange={(v) => set('lessons', v)} slots={slots} own={initial.id ? initial.lessons : []} />
        {type !== 'group' && (
          <label className="sform__f"><span>Hourly rate (RM, for the fee suggestion)</span>
            <input inputMode="numeric" value={f.hourlyRate} placeholder="70" onChange={(e) => set('hourlyRate', e.target.value.replace(/[^\d]/g, ''))} />
            <small>{type === 'both'
              ? 'They have 1-to-1 and group lessons, so every lesson, group ones too, is charged at this rate × that month\'s hours (no group fee).'
              : 'Their monthly fee is suggested as this rate × that month\'s hours.'} You can still change any month on the Fees tab.</small>
          </label>
        )}
        {type === 'group' && <p className="sform__hint">Group-only students pay the monthly group fee for their level.</p>}
      </fieldset>

      <label className="sform__f"><span>Private notes</span><textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} /></label>
      <div className="sform__acts">
        <button type="button" className="act" onClick={onCancel}>Cancel</button>
        <button className="btn btn--accent" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add student & create PIN'}</button>
      </div>
    </form>
  )
}

const monthEnd = (d) => addDays(`${addDays(`${d.slice(0, 7)}-28`, 4).slice(0, 7)}-01`, -1)
/** The break going on now or the next one coming (for labels like "On break · back 5 Jan"). */
export const currentBreak = (s, today = todayMY()) => (s.breaks || []).find((b) => b.until >= today) || null
export const breakLabel = (b, today = todayMY()) => (b.from <= today ? `On break · back ${dateLabel(addDays(b.until, 1))}` : `Break from ${dateLabel(b.from)}`)

/**
 * Pause a student's lessons from one date to another: no lessons (so the time is free for other
 * classes) and no fee for those dates. Lists their breaks with End early / Remove.
 */
export function BreakPanel({ s, from: startFrom, onSave }) {
  const today = todayMY()
  const [open, setOpen] = useState(!!startFrom)
  const [from, setFrom] = useState(startFrom || today)
  const [until, setUntil] = useState(monthEnd(startFrom || today))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const breaks = (s.breaks || []).filter((b) => b.until >= today)
  const nextMonth = addDays(monthEnd(today), 1)
  const ok = from && until && until >= from
  const save = async (list) => { setBusy(true); const done = await onSave(s, list); setBusy(false); return done }
  const add = async () => { if (ok && await save([...(s.breaks || []), { from, until, note }])) { setOpen(false); setNote('') } }
  // Ending early: lessons start again tomorrow (a break that hasn't started yet is just removed).
  const endEarly = (b) => save((s.breaks || []).flatMap((x) => (x !== b ? [x] : b.from < today ? [{ ...b, until: addDays(today, -1) }] : [])))
  return (
    <div className="brk">
      {breaks.map((b) => (
        <div className="brk__item" key={`${b.from}-${b.until}`}>
          <span><b>{dateLabel(b.from)} – {dateLabel(b.until)}</b>{b.note && <small>{b.note}</small>}<small>{b.from <= today ? `On break now · lessons start again ${dateLabel(addDays(b.until, 1))}` : 'Coming up'}</small></span>
          <button type="button" className="act" disabled={busy} onClick={() => endEarly(b)}>{b.from <= today ? 'End early' : 'Remove'}</button>
        </div>
      ))}
      {open ? (
        <div className="brk__form">
          <div className="brk__quick">
            <button type="button" className="act" onClick={() => { setFrom(today); setUntil(monthEnd(today)) }}>Rest of this month</button>
            <button type="button" className="act" onClick={() => { setFrom(nextMonth); setUntil(monthEnd(nextMonth)) }}>Next month</button>
          </div>
          <div className="brk__dates">
            <label><span>From</span><input type="date" value={from} min={today} onChange={(e) => { setFrom(e.target.value); if (until < e.target.value) setUntil(e.target.value) }} /></label>
            <label><span>To</span><input type="date" value={until} min={from} onChange={(e) => setUntil(e.target.value)} /></label>
          </div>
          <label className="brk__note"><span>Note (optional)</span><input value={note} maxLength={120} placeholder="e.g. Exams, family trip" onChange={(e) => setNote(e.target.value)} /></label>
          {ok && <p className="brk__preview">No lessons and no fee from {dateLabel(from)} to {dateLabel(until)}. Lessons start again {dateLabel(addDays(until, 1))}. Their time is free for other classes meanwhile.</p>}
          <div className="acal-pick__acts">
            <button type="button" className="btn btn--accent btn--sm" disabled={!ok || busy} onClick={add}>{busy ? 'Saving…' : 'Pause lessons'}</button>
            <button type="button" className="act" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : <button type="button" className="act" onClick={() => setOpen(true)}><Icon name="clock" />Pause lessons for a while</button>}
    </div>
  )
}

/** Save a student's breaks; returns true when saved (used by the profile and My calendar). */
export async function saveBreaksFor(s, breaks, setStudents, notify, fail) {
  try {
    const { student } = await api('/api/admin/students', { method: 'POST', body: { action: 'setBreaks', studentId: s.id, breaks } })
    setStudents((list) => list.map((x) => (x.id === student.id ? student : x)))
    const b = currentBreak(student)
    notify(b ? `${s.name}: ${breakLabel(b)}` : `${s.name}: no breaks coming up`)
    return true
  } catch (e) { fail(e); return false }
}

/** Everything about one student, opened from their row. */
function StudentProfile({ s, waiting, pin, onEdit, onShowPin, onNewPin, onSendLogin, onActive, onDelete, onBreaks }) {
  const lessons = lessonsNow(s)
  const Row = ({ k, children }) => (children ? <><dt>{k}</dt><dd>{children}</dd></> : null)
  return (
    <div className="sprof">
      <header className="sprof__head">
        <span className={`savatar savatar--${s.lesson_type}`} aria-hidden="true">{s.name.trim()[0]?.toUpperCase()}</span>
        <div>
          <h2>{s.name}</h2>
          <p>{[s.level, STUDENT_KIND[s.lesson_type], (s.subjects || []).join(', ')].filter(Boolean).join(' · ')}</p>
          {!s.active && <span className="sprof__off">Deactivated · can't log in</span>}
        </div>
      </header>
      <div className="sprof__acts">
        <button type="button" className="btn btn--accent btn--sm" onClick={onEdit}><Icon name="edit" />Edit profile</button>
        {s.last_login
          ? <a className="act act--wa" href={waLink(s.phone, pageMessage(s))} target="_blank" rel="noopener noreferrer"><Icon name="chat" />WhatsApp student</a>
          : <button type="button" className="act act--wa" onClick={onSendLogin}><Icon name="chat" />Send login details</button>}
        {s.parent_phone && <a className="act act--wa" href={waLink(s.parent_phone)} target="_blank" rel="noopener noreferrer"><Icon name="chat" />WhatsApp parent</a>}
      </div>
      {waiting > 0 && <p className="sprof__wait">{waiting} request{waiting === 1 ? '' : 's'} waiting — see Requests waiting above.</p>}

      <section className="sprof__sec">
        <h3>Lessons</h3>
        {lessons.length ? lessons.map((l) => (
          <p className="scard__slot" key={`${l.weekday}-${l.start}-${l.from || ''}`}>
            <Icon name={l.once ? 'calendar' : 'repeat'} />{l.once ? `${dateLabel(l.from)} · ${shortRange(l.start, l.end, 'en')}` : `Every ${weeklyText(l)}`}<span className={`kchip kchip--${kindOf(l, s)}`}>{KIND_SHORT[kindOf(l, s)]}</span>
            {!l.once && ((l.from && l.from > todayMY()) || l.until) ? <small className="scard__range">{l.from && l.from > todayMY() ? `from ${dateLabel(l.from)}` : ''}{l.until ? ` until ${dateLabel(l.until)}` : ''}</small> : null}
          </p>
        )) : <p className="scard__slot is-none"><Icon name="calendar" />No lessons coming up</p>}
        {s.lesson_type !== 'group' && <p className="sprof__small">Hourly rate RM{s.hourly_rate || 70}{s.hourly_rate ? '' : ' (default)'}{s.lesson_type === 'both' ? ', group lessons included' : ''}</p>}
      </section>

      <section className="sprof__sec">
        <h3>Breaks</h3>
        <BreakPanel s={s} onSave={onBreaks} />
      </section>

      <section className="sprof__sec">
        <h3>Student</h3>
        <dl className="sprof__dl">
          <Row k="School">{s.school}</Row>
          <Row k="Birthday">{s.birthday && birthdayText(s.birthday)}</Row>
          <Row k="WhatsApp"><a href={`tel:+${s.phone}`}>{localPhone(s.phone)}</a> <small>login</small></Row>
          <Row k="Email">{s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}</Row>
          <Row k="Address">{s.address}</Row>
          <Row k="Messages">{s.lang === 'zh' ? '中文' : 'English'}</Row>
        </dl>
      </section>

      <section className="sprof__sec">
        <h3>Parent / guardian</h3>
        {s.parent_name || s.parent_phone ? (
          <dl className="sprof__dl">
            <Row k="Name">{parentLabel(s)}</Row>
            <Row k="WhatsApp">{s.parent_phone && <a href={`tel:+${s.parent_phone}`}>{localPhone(s.parent_phone)}</a>}</Row>
          </dl>
        ) : <p className="sprof__empty">No parent added. <button type="button" className="adm-clear" onClick={onEdit}>Add parent</button><br />Fee reminders go to the student's number until you add one.</p>}
      </section>

      {s.notes && <section className="sprof__sec"><h3>Private notes</h3><p className="scard__notes">{s.notes}</p></section>}

      <section className="sprof__sec">
        <h3>Login</h3>
        <p className="sprof__small">{s.last_login ? `Last seen ${timeAgo(s.last_login)}` : 'Not logged in yet'}</p>
        {pin !== undefined && (pin
          ? <p className="scard__pin">PIN <b>{pin}</b></p>
          : <p className="scard__pin is-none">This PIN was set before PINs could be viewed. Press New PIN to give them one you can see.</p>)}
        <div className="sprof__row">
          <button type="button" className="act" onClick={onShowPin}><Icon name="key" />{pin !== undefined ? 'Hide PIN' : 'Show PIN'}</button>
          <button type="button" className="act" onClick={onNewPin}>New PIN</button>
        </div>
      </section>

      <footer className="sprof__foot">
        <button type="button" className="act" onClick={onActive}>{s.active ? 'Deactivate' : 'Reactivate'}</button>
        <button type="button" className="act act--danger" onClick={onDelete}><Icon name="trash" />Delete student</button>
      </footer>
    </div>
  )
}

function RequestCard({ r, s, onDecide }) {
  return (
    <article className={`sreq sreq--${r.kind}`}>
      <header>
        <b>{s?.name || 'Removed student'}</b>
        <span className="sreq__kind">{KIND_LABEL[r.kind]}</span>
        <time dateTime={r.created_at} title={fullDate(r.created_at)}>{timeAgo(r.created_at)}</time>
      </header>
      <p className="sreq__what">{requestText(r)}</p>
      {r.note && <p className="sreq__note">“{r.note}”</p>}
      <Decide r={r} onDecide={onDecide} />
    </article>
  )
}

export function StudentsTab({ students, setStudents, requests, setRequests, slots, refreshSlots, prefill, clearPrefill, onCreated, notify, onAuthError }) {
  const [form, setForm] = useState(null) // form initial values
  const [busy, setBusy] = useState(false)
  const [pin, setPin] = useState(null) // { s, pin }
  const [told, setTold] = useState(null) // { r, s, approved } → WhatsApp link after a decision
  const [q, setQ] = useState('')
  const [pins, setPins] = useState({}) // student id → PIN being shown (or null when it can't be)
  const [openId, setOpenId] = useState(null) // student whose profile is open
  const [show, setShow] = useState('active')
  const [kind, setKind] = useState('')
  const fail = (e) => (e.unauthorized ? onAuthError() : notify(e.message, 'error'))

  useEffect(() => { if (prefill) { setForm({ ...BLANK, ...prefill }); clearPrefill() } }, [prefill, clearPrefill])

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const pending = requests.filter((r) => r.status === 'pending')
  const history = requests.filter((r) => r.status !== 'pending').slice(0, 40)
  const needle = q.trim().toLowerCase()
  const shown = students
    .filter((s) => (show === 'all' || (show === 'break' ? s.active && currentBreak(s) : (show === 'active') === s.active)) && (!kind || s.lesson_type === kind || (s.lesson_type === 'both' && kind !== 'both')))
    .filter((s) => !needle || [s.name, s.phone, localPhone(s.phone), s.level, s.school, s.parent_name, s.parent_phone, localPhone(s.parent_phone), ...(s.subjects || [])]
      .filter(Boolean).some((v) => v.toLowerCase().includes(needle)))
  const open = openId != null ? byId.get(openId) : null

  const save = async (f) => {
    setBusy(true)
    try {
      const body = { ...f, lessons: f.lessons.map(({ once, date, weekday, start, end, kind, from, until }) => (once ? { once, date, start, end, kind } : { weekday, start, end, kind, from, until })), startDate: null, hourlyRate: f.hourlyRate === '' ? null : Number(f.hourlyRate) }
      if (f.id) {
        const { student, cleared } = await api('/api/admin/students', { method: 'POST', body: { action: 'update', ...body } })
        setStudents((list) => list.map((x) => (x.id === student.id ? student : x)))
        if (cleared) {
          // Some one-week changes belonged to their old weekly time and were cleared; reload them.
          const fresh = await api('/api/admin/students')
          setRequests(fresh.requests)
        }
        notify(cleared ? `Student saved · ${cleared} one-week change${cleared === 1 ? '' : 's'} for the old time cleared` : 'Student saved')
      } else {
        const { student, pin: p } = await api('/api/admin/students', { method: 'POST', body: { action: 'create', ...body } })
        setStudents((list) => [...list, student].sort((a, b) => a.name.localeCompare(b.name)))
        setPin({ s: student, pin: p })
        setOpenId(student.id)
        onCreated?.(student)
      }
      setForm(null)
      refreshSlots()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const resetPin = async (s) => {
    if (!window.confirm(`Give ${s.name} a new PIN? The old PIN stops working.`)) return
    try {
      const { pin: p } = await api('/api/admin/students', { method: 'POST', body: { action: 'resetPin', id: s.id } })
      setPin({ s, pin: p })
      setPins((m) => (s.id in m ? { ...m, [s.id]: p } : m))
    } catch (e) { fail(e) }
  }
  // Never logged in: make a fresh PIN and open WhatsApp with the full login details.
  const sendLogin = async (s) => {
    if (!window.confirm(`Send ${s.name} their login details? This creates a new PIN; any PIN sent before stops working.`)) return
    const win = window.open('', '_blank') // opened now so the browser doesn't block it after the wait
    try {
      const { pin: p } = await api('/api/admin/students', { method: 'POST', body: { action: 'resetPin', id: s.id } })
      if (win) win.location.href = waLink(s.phone, loginMessage(s, p))
      setPin({ s, pin: p })
    } catch (e) {
      win?.close()
      fail(e)
    }
  }
  const showPin = async (s) => {
    if (s.id in pins) return setPins(({ [s.id]: _, ...rest }) => rest)
    try {
      const { pin: p } = await api('/api/admin/students', { method: 'POST', body: { action: 'showPin', id: s.id } })
      setPins((m) => ({ ...m, [s.id]: p }))
    } catch (e) { fail(e) }
  }
  const saveBreaks = (s, breaks) => saveBreaksFor(s, breaks, setStudents, notify, fail)
  const setActive = async (s, active) => {
    try {
      const { student } = await api('/api/admin/students', { method: 'POST', body: { action: 'update', id: s.id, active } })
      setStudents((list) => list.map((x) => (x.id === student.id ? student : x)))
      notify(active ? `${s.name} is active again` : `${s.name} can no longer log in`)
      refreshSlots()
    } catch (e) { fail(e) }
  }
  const remove = async (s) => {
    if (!window.confirm(`Delete ${s.name} and all their requests? This can't be undone.`)) return
    try {
      await api('/api/admin/students', { method: 'POST', body: { action: 'delete', id: s.id } })
      setStudents((list) => list.filter((x) => x.id !== s.id))
      setOpenId(null)
      setRequests((list) => list.filter((x) => x.student_id !== s.id))
      notify(`Deleted ${s.name}`)
      refreshSlots()
    } catch (e) { fail(e) }
  }
  const decide = async (r, status, reply, time) => {
    try {
      const { request, student } = await api('/api/admin/students', { method: 'POST', body: { action: 'decide', id: r.id, status, reply, time } })
      setRequests((list) => list.map((x) => (x.id === request.id ? request : x)))
      if (student) { setStudents((list) => list.map((x) => (x.id === student.id ? student : x))); refreshSlots() }
      const s = byId.get(r.student_id)
      if (s) setTold({ r: request, s: student || s, approved: status === 'approved' })
      notify(status === 'approved' ? (time ? 'Accepted at the new time' : 'Accepted') : 'Declined')
    } catch (e) { fail(e) }
  }

  return (
    <>
      <section className="sblock">
        <header className="sblock__head">
          <h2>Requests waiting <span className="badge">{pending.length}</span></h2>
        </header>
        {told && (
          <div className="sreq-told">
            <span>Let {first(told.s.name)} know:</span>
            <a className="act act--wa" href={waLink(told.s.phone, decisionMessage(told.r, told.s, told.approved))} target="_blank" rel="noopener noreferrer"><Icon name="chat" />WhatsApp {told.approved ? 'confirmation' : 'reply'}</a>
            <button type="button" className="icon-btn" onClick={() => setTold(null)} aria-label="Dismiss"><Icon name="x" /></button>
          </div>
        )}
        {pending.length ? (
          <div className="sreqs">{pending.map((r) => <RequestCard key={r.id} r={r} s={byId.get(r.student_id)} onDecide={decide} />)}</div>
        ) : <p className="cempty">No requests waiting. When a student asks to move a lesson, reports an absence or wants a new regular time, it appears here.</p>}
      </section>

      <section className="sblock">
        <header className="sblock__head">
          <h2>Students <span className="sblock__n">{students.filter((s) => s.active).length} active</span></h2>
          <button type="button" className="btn btn--accent btn--sm" onClick={() => setForm(BLANK)}><Icon name="plus" />Add student</button>
        </header>
        {students.length > 0 && (
          <div className="adm-filters">
            <label className="adm-search"><Icon name="search" /><input type="search" placeholder="Search name, school, parent, phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" /></label>
            <select className="adm-select" value={show} onChange={(e) => setShow(e.target.value)} aria-label="Show">
              <option value="active">Active</option><option value="break">On break</option><option value="off">Deactivated</option><option value="all">All students</option>
            </select>
            <select className="adm-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Class">
              <option value="">1-to-1 &amp; group</option><option value="private">{KIND_SHORT.private}</option><option value="group">{KIND_SHORT.group}</option><option value="both">Both</option>
            </select>
          </div>
        )}
        {students.length === 0 ? (
          <p className="cempty">No students yet. Add one here, or use “Add as student” on a confirmed enquiry.</p>
        ) : !shown.length ? (
          <p className="cempty">No students match. <button type="button" className="adm-clear" onClick={() => { setQ(''); setShow('all'); setKind('') }}>Show everyone</button></p>
        ) : (
          <div className="srows" role="table" aria-label="Students">
            <div className="srow srow--head" role="row">
              <span role="columnheader">Student</span><span role="columnheader">Lessons</span><span role="columnheader">Parent</span><span role="columnheader">Login</span>
            </div>
            {shown.map((s) => {
              const waiting = pending.filter((r) => r.student_id === s.id).length
              const lessons = lessonsNow(s)
              return (
                <button type="button" role="row" key={s.id} className={`srow ${s.active ? '' : 'is-off'}`} onClick={() => setOpenId(s.id)} aria-label={`Open ${s.name}`}>
                  <span className="srow__who" role="cell">
                    <span className={`savatar savatar--${s.lesson_type}`} aria-hidden="true">{s.name.trim()[0]?.toUpperCase()}</span>
                    <span className="srow__name">
                      <b>{s.name}{waiting > 0 && <span className="badge" title="Requests waiting">{waiting}</span>}</b>
                      <small>{[s.level, STUDENT_KIND[s.lesson_type], (s.subjects || []).join(', ')].filter(Boolean).join(' · ')}</small>
                      {currentBreak(s) && <span className="brk__chip">{breakLabel(currentBreak(s))}</span>}
                    </span>
                  </span>
                  <span className="srow__lessons" role="cell">
                    {lessons.length ? lessons.map((l) => <span key={`${l.weekday}-${l.start}-${l.from || ''}`} className={s.lesson_type === 'both' ? `is-${kindOf(l, s)}` : ''}>{l.once ? dateLabel(l.from) : WEEKDAYS_SHORT[l.weekday]} {shortRange(l.start, l.end, 'en')}</span>) : <span className="is-none">No lessons</span>}
                  </span>
                  <span className="srow__parent" role="cell">
                    {s.parent_name || s.parent_phone
                      ? <><b>{parentLabel(s) || 'Parent'}</b><small>{localPhone(s.parent_phone)}</small></>
                      : <small className="is-none">No parent added</small>}
                  </span>
                  <span className="srow__login" role="cell">
                    <small>{!s.active ? 'Deactivated' : s.last_login ? `seen ${timeAgo(s.last_login)}` : 'not logged in yet'}</small>
                  </span>
                  <Icon name="chevron" />
                </button>
              )
            })}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <details className="sblock shist">
          <summary>Past requests ({history.length})</summary>
          <ul>
            {history.map((r) => {
              const s = byId.get(r.student_id)
              return (
                <li key={r.id}>
                  <span className={`shist__st shist__st--${r.status}`}>{STATUS[r.status]}</span>
                  <b>{s?.name || '—'}</b>
                  <span>{KIND_LABEL[r.kind]}: {requestText(r)}</span>
                  {r.reply && <small>Reply: {r.reply}</small>}
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {form ? (
        <Drawer onClose={() => setForm(null)} label="Student details">
          <StudentForm initial={form} slots={slots} busy={busy} onSave={save} onCancel={() => setForm(null)} />
        </Drawer>
      ) : open && !pin && (
        <Drawer onClose={() => setOpenId(null)} label={`${open.name}'s profile`}>
          <StudentProfile
            s={open} waiting={pending.filter((r) => r.student_id === open.id).length} pin={pins[open.id]}
            onEdit={() => setForm(formFromStudent(open))} onShowPin={() => showPin(open)} onNewPin={() => resetPin(open)}
            onSendLogin={() => sendLogin(open)} onActive={() => setActive(open, !open.active)} onDelete={() => remove(open)}
            onBreaks={saveBreaks}
          />
        </Drawer>
      )}
      {pin && (
        <Drawer onClose={() => setPin(null)} label="Login details">
          <PinCard s={pin.s} pin={pin.pin} notify={notify} onClose={() => setPin(null)} />
        </Drawer>
      )}
    </>
  )
}
