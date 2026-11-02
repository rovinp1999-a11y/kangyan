// Page for existing students and parents: log in with WhatsApp number + PIN, see the
// regular lesson and the next few weeks, and ask to move a lesson, report an absence
// or change the regular time. The tutor approves or rejects each request in the admin.
import { useCallback, useEffect, useState } from 'react'
import { useLang, shortRange } from '../i18n.jsx'
import { dateLabel, NOTICE_HOURS, startsAt, weekdayOf, firstOn } from '../../shared/lessons.js'
import WeekCalendar, { weekDates } from '../components/WeekCalendar.jsx'
import { S } from './strings.js'

const KEY = 'kangyan-student-token'
const getTok = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
const setTok = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch { /* ignore */ } }

async function call(token, body) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }
  const res = await fetch('/api/student', body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw Object.assign(new Error(data.code || 'server'), { code: data.code || 'server' })
  return data
}

function Login({ T, onToken }) {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const { token } = await call('', { action: 'login', phone, pin })
      onToken(token)
    } catch (e2) {
      setErr(T.errors[e2.code] || T.errors.server)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="stu-card stu-login" onSubmit={submit}>
      <h1>{T.login.h}</h1>
      <p>{T.login.p}</p>
      <label className="stu-field">
        <span>{T.login.phone}</span>
        <input type="tel" inputMode="tel" autoComplete="tel" placeholder={T.login.phonePh} value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </label>
      <label className="stu-field">
        <span>{T.login.pin}</span>
        <input type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} required />
      </label>
      {err && <p className="stu-err" role="alert">{err}</p>}
      <button className="btn btn--accent btn--full" disabled={busy}>{busy ? T.login.busy : T.login.go}</button>
      <p className="stu-small">{T.login.forgot}</p>
      <p className="stu-small">{T.login.notStudent} <a href="/">{T.login.enquire}</a></p>
    </form>
  )
}

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const toT = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
// Half-hour choices from 8 AM to 10 PM.
const TIMES = Array.from({ length: 29 }, (_, i) => toT(8 * 60 + i * 30))
const clock = (t, lang) => (lang === 'zh' ? shortRange(t, toT(toMin(t) + 30), 'zh').split('–')[0] : (() => { const h = Number(t.slice(0, 2)); const m = t.slice(3, 5); return `${h % 12 || 12}${m === '00' ? '' : `:${m}`} ${h < 12 ? 'AM' : 'PM'}` })())
const overlaps = (a, b) => a.start < b.end && b.start < a.end
/** Requested time of a request (any time now, or an older slot-based one). */
const reqTime = (r) => (r.to_start ? { start: r.to_start, end: r.to_end } : null)

/** Bottom sheet for one request: absence, move one lesson, or change a regular lesson. Any time can be asked for. */
function RequestSheet({ kind, lesson: given, preset, st, T, L, lang, token, onClose, onSent }) {
  const [pick, setPick] = useState(null) // which lesson to move, when started from the calendar
  const [from, setFrom] = useState(st.weekly.length === 1 ? st.weekly[0] : null) // which weekly lesson to change
  const lesson = given || pick
  const base = lesson || from || st.weekly[0] || { start: '17:30', end: '19:00' }
  const len = Math.max(30, toMin(base.end) - toMin(base.start))
  const startAt = preset?.start || base.start
  const [date, setDate] = useState(preset?.date || '')
  const [weekday, setWeekday] = useState(preset?.date ? weekdayOf(preset.date) : (from || st.weekly[0])?.weekday ?? 0)
  const [start, setStart] = useState(startAt)
  const [end, setEnd] = useState(toT(Math.min(22 * 60, toMin(startAt) + len)))
  const group = st.student.lessonType === 'group'
  // Like a calendar app: change only this lesson, or this and all following ones. Group classes only move as a whole.
  const [scope, setScope] = useState(group || kind === 'change' ? 'all' : 'one')
  const sendKind = kind === 'reschedule' && scope === 'all' ? 'change' : kind
  const movable = st.lessons.filter((l) => !l.request && (scope === 'all' || l.hours >= NOTICE_HOURS))
  const [note, setNote] = useState('')
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const label = (o) => `${L.weekdays[o.weekday]} · ${shortRange(o.start, o.end, lang)}`
  const timesOk = start < end
  const ready = kind === 'absence'
    || (kind === 'change' && timesOk && (from || !st.weekly.length))
    || (kind === 'reschedule' && timesOk && date && lesson && (scope === 'all' || lesson.hours >= NOTICE_HOURS))
  const d = lesson && `${dateLabel(lesson.date, lang)} ${shortRange(lesson.start, lesson.end, lang)}`
  // Warn (but still allow) when the asked-for time overlaps another student's lesson.
  const clash = kind === 'reschedule'
    ? date && st.busy.some((x) => x.date === date && overlaps(x, { start, end }))
    : kind === 'change' && st.busy.some((x) => weekdayOf(x.date) === weekday && overlaps(x, { start, end }))

  const setStartKeep = (v) => { setStart(v); setEnd(toT(Math.min(22 * 60, toMin(v) + (toMin(end) - toMin(start) || len)))) }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setErr('')
    try {
      await call(token, {
        action: 'request', kind: sendKind, lessonDate: lesson?.date, lessonStart: lesson?.start, fromWeekday: from?.weekday, fromStart: from?.start,
        toDate: kind === 'reschedule' ? date : undefined, toWeekday: kind === 'change' ? weekday : undefined, toStart: start, toEnd: end, recording, note,
      })
      onSent()
    } catch (e2) {
      setErr(T.errors[e2.code] || T.errors.server)
      if (e2.code === 'auth') onClose('auth')
    } finally {
      setBusy(false)
    }
  }

  const h = { absence: T.sheet.absenceH, reschedule: T.sheet.rescheduleH, change: T.sheet.changeH }[kind]
  const p = { absence: T.sheet.absenceP(d), reschedule: lesson ? T.sheet.rescheduleP(d) : T.sheet.moveHereP, change: T.sheet.changeP }[kind]
  return (
    <div className="stu-sheet" role="dialog" aria-modal="true" aria-label={h}>
      <div className="stu-sheet__bg" onClick={() => onClose()} />
      <form className="stu-sheet__panel" onSubmit={submit}>
        <h2>{h}</h2>
        <p className="stu-muted">{p}</p>

        {kind === 'absence' && !group && lesson.hours < NOTICE_HOURS && <p className="stu-warn">{T.sheet.absenceLate}</p>}
        {kind === 'absence' && group && (
          <>
            <p className="stu-note">{T.sheet.absenceGroup}</p>
            <label className="stu-check"><input type="checkbox" checked={recording} onChange={(e) => setRecording(e.target.checked)} />{T.sheet.recording}</label>
          </>
        )}

        {kind === 'change' && st.weekly.length > 1 && (
          <div className="stu-opts" role="radiogroup" aria-label={T.sheet.whichLesson}>
            <span className="stu-k">{T.sheet.whichLesson}</span>
            {st.weekly.map((w) => (
              <div key={`${w.weekday}-${w.start}`} className={`stu-opt ${from === w ? 'is-on' : ''}`}>
                <button type="button" role="radio" aria-checked={from === w} onClick={() => setFrom(w)}>{label(w)}</button>
              </div>
            ))}
          </div>
        )}

        {kind === 'reschedule' && (
          <div className="stu-scope" role="radiogroup" aria-label={T.sheet.scopeQ}>
            {!group && (
              <label className={`stu-scope__o ${scope === 'one' ? 'is-on' : ''}`}>
                <input type="radio" name="scope" checked={scope === 'one'} onChange={() => setScope('one')} />
                <span><b>{T.sheet.scopeOne}</b><small>{T.sheet.scopeOneP}</small></span>
              </label>
            )}
            <label className={`stu-scope__o ${scope === 'all' ? 'is-on' : ''}`}>
              <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
              <span><b>{T.sheet.scopeAll}</b><small>{group ? T.sheet.scopeAllGroup : T.sheet.scopeAllP}</small></span>
            </label>
          </div>
        )}
        {kind === 'reschedule' && given && scope === 'one' && given.hours < NOTICE_HOURS && <p className="stu-warn">{T.tooLate(NOTICE_HOURS)}</p>}

        {kind === 'reschedule' && !given && (
          <div className="stu-opts" role="radiogroup" aria-label={T.sheet.whichMove}>
            <span className="stu-k">{T.sheet.whichMove}</span>
            {movable.length ? movable.map((l) => (
              <div key={`${l.date}-${l.start}`} className={`stu-opt ${pick === l ? 'is-on' : ''}`}>
                <button type="button" role="radio" aria-checked={pick === l} onClick={() => setPick(l)}>{dateLabel(l.date, lang)} · {shortRange(l.start, l.end, lang)}</button>
              </div>
            )) : <p className="stu-note">{T.sheet.noneMovable}</p>}
          </div>
        )}

        {kind !== 'absence' && (
          <div className="stu-when">
            <span className="stu-k">{T.sheet.newTime}</span>
            <div className="stu-when__row">
              {kind === 'reschedule' ? (
                <label className="stu-field"><span>{T.sheet.date}</span>
                  <input type="date" value={date} min={st.today} max={st.lastDay} onChange={(e) => setDate(e.target.value)} required />
                </label>
              ) : (
                <label className="stu-field"><span>{T.sheet.day}</span>
                  <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                    {L.weekdays.map((x, i) => <option key={x} value={i}>{x}</option>)}
                  </select>
                </label>
              )}
              <label className="stu-field"><span>{T.sheet.from}</span>
                <select value={start} onChange={(e) => setStartKeep(e.target.value)}>
                  {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{clock(t, lang)}</option>)}
                </select>
              </label>
              <label className="stu-field"><span>{T.sheet.to}</span>
                <select value={end} onChange={(e) => setEnd(e.target.value)}>
                  {TIMES.filter((t) => t > start && toMin(t) - toMin(start) <= 240).map((t) => <option key={t} value={t}>{clock(t, lang)}</option>)}
                </select>
              </label>
            </div>
            {clash ? <p className="stu-warn">{T.sheet.clash}</p> : <p className="stu-small">{T.sheet.anyTime}</p>}
          </div>
        )}

        <label className="stu-field">
          <span>{T.sheet.note}</span>
          <textarea rows={2} maxLength={500} placeholder={T.sheet.notePh} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {err && <p className="stu-err" role="alert">{err}</p>}
        <div className="stu-sheet__acts">
          <button type="button" className="btn btn--ghost" onClick={() => onClose()}>{T.sheet.cancel}</button>
          <button className="btn btn--accent" disabled={!ready || busy}>{busy ? T.sheet.sending : T.sheet.send}</button>
        </div>
      </form>
    </div>
  )
}

/** One week of the student's calendar: their lessons, plus other students' lessons as "occupied". */
function studentWeek(st, week, T, L, lang) {
  const ACTIVE = ['pending', 'approved']
  const short = (d) => (lang === 'zh' ? dateLabel(d, 'zh').split('（')[0] : dateLabel(d, 'en').split(' ').slice(1).join(' '))
  return weekDates(st.today, week, weekdayOf).map((date) => {
    const wd = weekdayOf(date)
    const events = []
    for (const l of st.lessons.filter((x) => x.date === date)) {
      const r = l.request
      const tone = !r ? 'mine' : r.status === 'pending' ? 'pending' : r.kind === 'absence' ? 'off' : 'moved'
      events.push({ key: `m-${date}-${l.start}`, start: l.start, end: l.end, tone, dot: true, title: T.cal.mine, sub: r ? `${shortRange(l.start, l.end, lang)} · ${T.cal.tone[tone]}` : shortRange(l.start, l.end, lang), info: { type: 'mine', lesson: l } })
    }
    for (const r of st.requests.filter((x) => x.kind === 'reschedule' && ACTIVE.includes(x.status) && x.to_date === date)) {
      const t = reqTime(r)
      if (t) events.push({ key: `in-${r.id}`, start: t.start, end: t.end, tone: r.status === 'approved' ? 'mine' : 'pending', dot: true, title: T.cal.movedIn, sub: r.status === 'approved' ? shortRange(t.start, t.end, lang) : `${shortRange(t.start, t.end, lang)} · ${T.cal.tone.pending}`, info: { type: 'in', request: r } })
    }
    st.busy.filter((x) => x.date === date).forEach((x, i) => {
      events.push({ key: `b-${date}-${x.start}-${i}`, start: x.start, end: x.end, tone: 'busy', title: T.cal.busy, sub: shortRange(x.start, x.end, lang), info: { type: 'busy', date, start: x.start, end: x.end } })
    })
    return { date, head: L.weekdaysShort[wd], sub: short(date), past: date < st.today, events }
  })
}

/** What shows under the calendar for the tapped entry or empty time. */
function CalDetail({ ev, st, T, L, lang, onSheet, onCancel }) {
  const { info } = ev
  const priv = st.student.lessonType === 'private'
  const when = (date, a, b) => `${dateLabel(date, lang)} · ${shortRange(a, b, lang)}`
  if (info.type === 'mine') {
    const l = info.lesson
    const r = l.request
    const late = l.hours < st.noticeHours
    const t = r && reqTime(r)
    return (
      <div className={`stu-detail stu-detail--${ev.tone}`}>
        <span className="stu-k">{T.cal.mine}</span>
        <b>{when(l.date, l.start, l.end)}</b>
        {r ? (
          <>
            <p>{r.kind === 'absence' ? T.status.absent[r.status] : T.status.moved[r.status](t && r.to_date ? when(r.to_date, t.start, t.end) : r.to_label)}</p>
            {r.status === 'pending' && <button type="button" className="stu-link" onClick={() => onCancel(r.id)}>{T.withdraw}</button>}
            {r.status === 'approved' && <p className="stu-small">{T.cal.askTutor}</p>}
          </>
        ) : (
          <>
            <div className="stu-detail__acts">
              <button type="button" className="act" onClick={() => onSheet({ kind: 'absence', lesson: l })}>{T.cantMake}</button>
              <button type="button" className="act act--main" onClick={() => onSheet({ kind: 'reschedule', lesson: l })}>{T.reschedule}</button>
            </div>
            {priv && late && <p className="stu-late">{T.tooLateAll(st.noticeHours)}</p>}
          </>
        )}
      </div>
    )
  }
  if (info.type === 'in') {
    const r = info.request
    const t = reqTime(r)
    return (
      <div className={`stu-detail stu-detail--${ev.tone}`}>
        <span className="stu-k">{T.cal.movedIn}</span>
        <b>{t ? when(r.to_date, t.start, t.end) : r.to_label}</b>
        <p>{T.cal.movedFrom(dateLabel(r.lesson_date, lang))} · {T.reqStatus[r.status]}</p>
        {r.status === 'pending' && <button type="button" className="stu-link" onClick={() => onCancel(r.id)}>{T.withdraw}</button>}
        {r.status === 'approved' && <p className="stu-small">{T.cal.askTutor}</p>}
      </div>
    )
  }
  // An occupied time, or an empty time they tapped: they can still ask for it.
  const { date, start, end } = info
  const past = date < st.today
  return (
    <div className={`stu-detail stu-detail--${info.type === 'busy' ? 'busy' : 'free'}`}>
      <span className="stu-k">{info.type === 'busy' ? T.cal.busy : T.cal.askH}</span>
      <b>{end ? when(date, start, end) : `${dateLabel(date, lang)} · ${clock(start, lang)}`}</b>
      <p>{past ? T.cal.pastP : info.type === 'busy' ? T.cal.busyP : T.cal.askP}</p>
      {!past && (
        <div className="stu-detail__acts">
          <button type="button" className="act act--main" onClick={() => onSheet({ kind: 'reschedule', preset: { date, start } })}>{T.cal.moveHere}</button>
        </div>
      )}
    </div>
  )
}

/** Subscribe their phone calendar to their lessons (updates by itself, reminds 1 hour before). */
function CalendarLink({ T, token, notify }) {
  const [open, setOpen] = useState(false)
  if (!token) return null
  const host = window.location.host
  const https = `${window.location.protocol}//${host}/cal/${token}.ics`
  const webcal = `webcal://${host}/cal/${token}.ics`
  const copy = async () => { try { await navigator.clipboard.writeText(https); notify(T.calLink.copied) } catch { notify(https) } }
  return (
    <div className="stu-callink">
      <button type="button" className="act" onClick={() => setOpen((o) => !o)} aria-expanded={open}>📅 {T.calLink.btn}</button>
      {open && (
        <div className="stu-callink__box">
          <p>{T.calLink.p}</p>
          <div className="stu-detail__acts">
            <a className="act act--main" href={webcal}>{T.calLink.apple}</a>
            <a className="act" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">{T.calLink.google}</a>
            <button type="button" className="act" onClick={copy}>{T.calLink.copy}</button>
          </div>
          <p className="stu-small">{T.calLink.note}</p>
        </div>
      )}
    </div>
  )
}

const FEE_MONTH = (m, lang) => (lang === 'zh' ? `${m.slice(0, 4)}年${Number(m.slice(5))}月` : new Date(`${m}-15T00:00:00Z`).toLocaleDateString('en-MY', { month: 'long', year: 'numeric', timeZone: 'UTC' }))

function Fees({ st, T, lang }) {
  if (!st.fees?.length) return null
  return (
    <section className="stu-card stu-fees">
      <h2>{T.fees.h}</h2>
      <ul>
        {st.fees.map((f) => (
          <li key={f.month} className={`stu-fee stu-fee--${f.state}`}>
            <div>
              <b>{FEE_MONTH(f.month, lang)}</b>
              <span>{f.amount == null ? T.fees.tbc : `RM${f.amount}`}</span>
            </div>
            <span className={`stu-chip stu-chip--fee-${f.state}`}>{T.fees.state[f.state]}</span>
          </li>
        ))}
      </ul>
      <p className="stu-small">{T.fees.note}</p>
    </section>
  )
}

function History({ st, T, L, lang }) {
  const p = st.progress
  return (
    <section className="stu-card stu-hist">
      <h2>{T.hist.h}</h2>
      {p.total > 0 && (
        <div className="stu-hist__month">
          <span>{T.hist.month(p.done, p.total)}</span>
          <div className="stu-hist__bar" role="img" aria-label={T.hist.month(p.done, p.total)}><i style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
        </div>
      )}
      {st.history.length ? (
        <ul>
          {st.history.slice(0, 12).map((o) => (
            <li key={`${o.date}-${o.start}`}>
              <span>{dateLabel(o.date, lang)} · {shortRange(o.start, o.end, lang)}</span>
              <span className={`stu-chip stu-chip--h-${o.status}`}>{T.hist.state[o.status]}{o.movedFrom ? ` · ${T.hist.movedFrom(dateLabel(o.movedFrom, lang))}` : ''}</span>
            </li>
          ))}
        </ul>
      ) : <p className="stu-muted">{T.hist.none}</p>}
    </section>
  )
}

function PinForm({ T, token, onToken, notify, open, setOpen }) {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const { token: t } = await call(token, { action: 'pin', current: cur, next })
      onToken(t)
      setCur('')
      setNext('')
      notify(T.pinSaved)
      setOpen(false)
    } catch (e2) {
      setErr(T.errors[e2.code] || T.errors.server)
    } finally {
      setBusy(false)
    }
  }
  const pinInput = (v, set, label) => (
    <label className="stu-field">
      <span>{label}</span>
      <input type="password" inputMode="numeric" maxLength={6} value={v} onChange={(e) => set(e.target.value.replace(/\D/g, ''))} required />
    </label>
  )
  return (
    <details className="stu-card stu-pin" id="change-pin" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{T.pinH}</summary>
      <form onSubmit={submit}>
        {pinInput(cur, setCur, T.pinCurrent)}
        {pinInput(next, setNext, T.pinNew)}
        {err && <p className="stu-err" role="alert">{err}</p>}
        <button className="btn btn--accent" disabled={busy || cur.length !== 6 || next.length !== 6}>{T.pinSave}</button>
      </form>
    </details>
  )
}

export default function StudentPage() {
  const { t: site, lang, setLang } = useLang()
  const T = S[lang]
  const L = site.labels
  const [token, setToken] = useState(getTok)
  const [st, setSt] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [sheet, setSheet] = useState(null) // { kind, lesson?, preset? }
  const [week, setWeek] = useState(0)
  const [pinOpen, setPinOpen] = useState(false)
  // The top-bar PIN button opens the form at the bottom and scrolls to it.
  const openPin = () => {
    setPinOpen(true)
    setTimeout(() => document.getElementById('change-pin')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }
  const [sel, setSel] = useState(null) // key of the tapped calendar entry
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  const notify = useCallback((text) => {
    setToast({ text, id: Date.now() })
    setTimeout(() => setToast((x) => (x && Date.now() - x.id >= 2500 ? null : x)), 2700)
  }, [])
  const saveToken = useCallback((t) => { setTok(t); setToken(t) }, [])
  const logout = useCallback(() => { saveToken(''); setSt(null) }, [saveToken])

  const load = useCallback(async () => {
    if (!token) return
    setLoadErr('')
    try {
      const data = await call(token)
      setSt(data)
      if (data.student.lang && !localStorage.getItem('kangyan-lang')) setLang(data.student.lang)
    } catch (e) {
      if (e.code === 'auth') logout()
      else setLoadErr(T.errors[e.code] || T.errors.server)
    }
  }, [token, logout]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const cancel = async (id) => {
    try {
      await call(token, { action: 'cancel', id })
      load()
    } catch (e) {
      notify(T.errors[e.code] || T.errors.server)
      load()
    }
  }

  // Requested time in the page's language: a date for one lesson, a weekday for a regular one.
  const timeOf = (r) => {
    const t = reqTime(r)
    if (!t) return r.to_label || ''
    if (r.kind === 'change') {
      const from = r.to_date && r.lesson_date ? (r.to_date < r.lesson_date ? r.to_date : r.lesson_date) : r.lesson_date
      return T.everyFrom(L.weekdays[r.to_weekday ?? 0], shortRange(t.start, t.end, lang), from ? dateLabel(firstOn(from, r.to_weekday ?? 0), lang) : '')
    }
    return `${r.to_date ? dateLabel(r.to_date, lang) : L.weekdays[r.to_weekday ?? 0]} ${shortRange(t.start, t.end, lang)}`
  }

  const header = (
    <header className="stu-top">
      <a href="/" className="admin__logo">Kangyan<span className="dot" aria-hidden="true" /><small>{T.title}</small></a>
      <div className="stu-top__acts">
        <button type="button" className="stu-lang" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>{lang === 'zh' ? 'EN' : '中文'}</button>
        {token && st && <button type="button" className="stu-lang" onClick={openPin} aria-label={T.pinH}><span className="stu-full">{T.pinBtn}</span><span className="stu-short">PIN</span></button>}
        {token && <button type="button" className="stu-lang" onClick={logout}>{T.logout}</button>}
      </div>
    </header>
  )

  if (!token) return <div className="stu">{header}<main className="stu-main"><Login T={T} onToken={saveToken} /></main></div>

  return (
    <div className="stu">
      {header}
      <main className="stu-main">
        {loadErr ? (
          <div className="stu-card"><p className="stu-err">{loadErr}</p><button type="button" className="btn btn--accent" onClick={load}>↻</button></div>
        ) : !st ? (
          <div className="adm-skel" aria-busy="true"><span /><span /></div>
        ) : (
          <>
            <section className="stu-hero">
              <h1>{T.hi(st.student.name)}</h1>
              <div className="stu-card stu-regular">
                <span className="stu-k">{T.regular}</span>
                {st.weekly.length ? (
                  <>
                    {st.weekly.map((w) => <b key={`${w.weekday}-${w.start}`}>{T.every(L.weekdays[w.weekday])} · {shortRange(w.start, w.end, lang)}</b>)}
                    <span className="stu-muted">
                      {[T.types[st.student.lessonType], st.student.level && (L.levels[st.student.level] || st.student.level), st.student.subjects.map((x) => L.subjects[x] || x).join(lang === 'zh' ? '、' : ', ')].filter(Boolean).join(' · ')}
                    </span>
                  </>
                ) : <span className="stu-muted">{T.noSlot}</span>}
              </div>
            </section>

            {st.announcements?.map((a) => (
              <section key={a.id} className="stu-news" role="note">
                <b>📢 {a.title}</b>
                {a.body && <p>{a.body}</p>}
              </section>
            ))}

            <Fees st={st} T={T} lang={lang} />

            <section className="stu-card stu-cal">
              <div className="stu-cal__head">
                <h2>{T.cal.title}</h2>
                <ul className="stu-legend">
                  {['mine', 'pending', 'busy'].map((k) => <li key={k}><i className={`wc__dot wc__dot--${k}`} />{T.cal.legend[k]}</li>)}
                </ul>
              </div>
              <CalendarLink T={T} token={st.calendarToken} notify={notify} />
              {(() => {
                const days = studentWeek(st, week, T, L, lang)
                const picked = sel?.startsWith('ask:')
                  ? { key: sel, tone: 'free', info: { type: 'ask', date: sel.split(':')[1], start: sel.split(':').slice(2).join(':') || st.weekly[0]?.start || '17:30' } }
                  : days.flatMap((d) => d.events).find((e) => e.key === sel)
                return (
                  <>
                    <WeekCalendar
                      days={days} week={week} weeks={st.weeksAhead} onWeek={(n) => { setWeek(n); setSel(null) }}
                      selected={sel} onSelect={(e) => setSel(e.key === sel ? null : e.key)} today={st.today}
                      onEmpty={(d, t) => setSel(`ask:${d.date}:${t || ''}`)}
                      title={`${days[0].sub} – ${days[6].sub}`}
                      labels={{ prev: T.cal.prev, next: T.cal.next, today: T.cal.thisWeek, empty: T.cal.empty, ask: T.cal.askDay, hour: (h) => (lang === 'zh' ? `${h}点` : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`) }}
                    />
                    {picked ? <CalDetail ev={picked} st={st} T={T} L={L} lang={lang} onSheet={setSheet} onCancel={cancel} /> : <p className="stu-muted stu-cal__hint">{st.weekly.length ? T.cal.hint : T.noSlot}</p>}
                  </>
                )
              })()}
            </section>

            <History st={st} T={T} L={L} lang={lang} />

            <section className="stu-card">
              <h2>{T.requests}</h2>
              {st.requests.length ? (
                <ul className="stu-reqs">
                  {st.requests.map((r) => (
                    <li key={r.id} className={`stu-req is-${r.status}`}>
                      <div className="stu-req__top">
                        <b>{T.kinds[r.kind]}</b>
                        <span className={`stu-chip stu-chip--${r.status}`}>{T.reqStatus[r.status]}</span>
                      </div>
                      <p>
                        {r.lesson_date && T.lessonOn(`${dateLabel(r.lesson_date, lang)}${r.from_lesson ? ` ${shortRange(r.from_lesson.start, r.from_lesson.end, lang)}` : ''}`)}
                        {!r.lesson_date && r.from_lesson && `${L.weekdays[r.from_lesson.weekday]} ${shortRange(r.from_lesson.start, r.from_lesson.end, lang)}`}
                        {(r.to_start || r.to_label) && <> {T.to(timeOf(r))}</>}
                        {r.recording && <> · {T.recordingAsked}</>}
                      </p>
                      {r.note && <p className="stu-muted">“{r.note}”</p>}
                      {r.reply && <p className="stu-reply"><span>{T.reply}</span>{r.reply}</p>}
                      {r.status === 'pending' && <button type="button" className="stu-link" onClick={() => cancel(r.id)}>{T.withdraw}</button>}
                    </li>
                  ))}
                </ul>
              ) : <p className="stu-muted">{T.noRequests}</p>}
            </section>

            <PinForm T={T} token={token} onToken={saveToken} notify={notify} open={pinOpen} setOpen={setPinOpen} />
          </>
        )}
      </main>

      {sheet && st && (
        <RequestSheet
          {...sheet}
          st={st} T={T} L={L} lang={lang} token={token}
          onClose={(why) => { setSheet(null); if (why === 'auth') logout() }}
          onSent={() => { setSheet(null); notify(T.sheet.sent); load() }}
        />
      )}
      {toast && <div key={toast.id} className="toast" role="status">{toast.text}</div>}
    </div>
  )
}
