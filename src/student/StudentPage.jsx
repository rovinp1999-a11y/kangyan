// Page for existing students and parents: log in with WhatsApp number + PIN, then a small
// dashboard: home (next lesson, this month, fees, requests), calendar, history & fees,
// requests, and their own profile. The tutor approves or rejects each request in the admin.
import { useCallback, useEffect, useState } from 'react'
import { useLang, shortRange } from '../i18n.jsx'
import { dateLabel, NOTICE_HOURS, startsAt, weekdayOf, firstOn, addDays } from '../../shared/lessons.js'
import WeekCalendar, { weekDates } from '../components/WeekCalendar.jsx'
import { S } from './strings.js'
import { Icon } from '../components/Icon.jsx'
import TimeSelect from '../components/TimeSelect.jsx'

const KEY = 'kangyan-student-token'
const TAB_KEY = 'kangyan-student-tab'
const TABS = ['home', 'calendar', 'history', 'requests', 'profile']
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
const clock = (t, lang) => (lang === 'zh' ? shortRange(t, toT(toMin(t) + 30), 'zh').split('–')[0] : (() => { const h = Number(t.slice(0, 2)); const m = t.slice(3, 5); return `${h % 12 || 12}${m === '00' ? '' : `:${m}`} ${h < 12 ? 'AM' : 'PM'}` })())
const overlaps = (a, b) => a.start < b.end && b.start < a.end
/** Requested time of a request (any time now, or an older slot-based one). */
const reqTime = (r) => (r.to_start ? { start: r.to_start, end: r.to_end } : null)

/** Bottom sheet for telling the tutor they'll miss one lesson. */
function AbsenceSheet({ lesson, st, T, lang, token, onClose, onSent }) {
  const group = lesson.kind === 'group'
  const [note, setNote] = useState('')
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const d = `${dateLabel(lesson.date, lang)} ${shortRange(lesson.start, lesson.end, lang)}`

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await call(token, { action: 'request', kind: 'absence', lessonDate: lesson.date, lessonStart: lesson.start, recording, note })
      onSent()
    } catch (e2) {
      setErr(T.errors[e2.code] || T.errors.server)
      if (e2.code === 'auth') onClose('auth')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stu-sheet" role="dialog" aria-modal="true" aria-label={T.sheet.absenceH}>
      <div className="stu-sheet__bg" onClick={() => onClose()} />
      <form className="stu-sheet__panel" onSubmit={submit}>
        <h2>{T.sheet.absenceH}</h2>
        <p className="stu-muted">{T.sheet.absenceP(d)}</p>
        {!group && lesson.hours < NOTICE_HOURS && <p className="stu-warn">{T.sheet.absenceLate}</p>}
        {group && (
          <>
            <p className="stu-note">{T.sheet.absenceGroup}</p>
            <label className="stu-check"><input type="checkbox" checked={recording} onChange={(e) => setRecording(e.target.checked)} />{T.sheet.recording}</label>
          </>
        )}
        <label className="stu-field">
          <span>{T.sheet.note}</span>
          <textarea rows={2} maxLength={500} placeholder={T.sheet.notePh} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {err && <p className="stu-err" role="alert">{err}</p>}
        <div className="stu-sheet__acts">
          <button type="button" className="btn btn--ghost" onClick={() => onClose()}>{T.sheet.cancel}</button>
          <button className="btn btn--accent" disabled={busy}>{busy ? T.sheet.sending : T.sheet.send}</button>
        </div>
      </form>
    </div>
  )
}

/** Which calendar week (0 = this one) a date falls in. */
const weekOf = (today, date) => Math.floor(daysBetween(addDays(today, -weekdayOf(today)), date) / 7)

/**
 * Moving a lesson, done on the calendar itself: the lesson being moved is marked, the new time
 * shows as a block wherever they tap (or drag it), and this panel under the calendar confirms it.
 * "This and all following" sends a new regular time instead of one move.
 */
function MovePlanner({ move, setMove, st, T, L, lang, token, onDone, onCancel }) {
  const { lesson } = move
  const fixed = lesson.kind === 'group' ? 'all' : lesson.once ? 'one' : null // group classes move as a whole; a one-off lesson only by itself
  const scope = fixed || move.scope
  const movable = st.lessons.filter((l) => !l.request && startsAt(l.date, l.start) > Date.now())
  const len = toMin(lesson.end) - toMin(lesson.start)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const late = scope === 'one' && lesson.hours < NOTICE_HOURS
  const has = !!move.date
  const same = has && move.date === lesson.date && move.start === lesson.start && move.end === lesson.end
  const clash = has && st.busy.some((x) => (scope === 'all' ? weekdayOf(x.date) === weekdayOf(move.date) && x.date >= move.date : x.date === move.date) && overlaps(x, move))
  const order = has && move.start >= move.end
  const tooLong = has && !order && toMin(move.end) - toMin(move.start) > Math.max(4 * 60, len)
  const ready = has && !same && !late && !order && !tooLong
  const when = (date, a, b) => `${dateLabel(date, lang)} · ${shortRange(a, b, lang)}`
  const setStart = (v) => setMove({ ...move, start: v, end: toT(Math.min(23 * 60 + 59, toMin(v) + (toMin(move.end) - toMin(move.start) || len))) })
  const pickLesson = (key) => {
    const l = movable.find((x) => `${x.date}|${x.start}` === key)
    if (l) setMove({ ...move, lesson: l, ...(move.date ? { end: toT(Math.min(23 * 60 + 59, toMin(move.start) + toMin(l.end) - toMin(l.start))) } : {}) })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setErr('')
    try {
      await call(token, {
        action: 'request', kind: scope === 'all' ? 'change' : 'reschedule', lessonDate: lesson.date, lessonStart: lesson.start,
        toDate: move.date, toStart: move.start, toEnd: move.end, note,
      })
      onDone()
    } catch (e2) {
      setErr(T.errors[e2.code] || T.errors.server)
      if (e2.code === 'auth') onCancel('auth')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stu-move" onSubmit={submit} aria-label={T.move.h}>
      <div className="stu-move__route">
        <div className="stu-move__end stu-move__end--from">
          <span className="stu-k">{T.move.from}</span>
          {movable.length > 1 ? (
            <select value={`${lesson.date}|${lesson.start}`} onChange={(e) => pickLesson(e.target.value)} aria-label={T.move.pickLesson}>
              {movable.map((l) => <option key={`${l.date}|${l.start}`} value={`${l.date}|${l.start}`}>{when(l.date, l.start, l.end)}</option>)}
            </select>
          ) : <b>{when(lesson.date, lesson.start, lesson.end)}</b>}
        </div>
        <span className="stu-move__arrow" aria-hidden="true"><Icon name="chevron" /></span>
        <div className={`stu-move__end stu-move__end--to ${has ? '' : 'is-empty'}`}>
          <span className="stu-k">{T.move.to}</span>
          <b className="stu-move__cap">{has ? (scope === 'all' ? T.everyFrom(L.weekdays[weekdayOf(move.date)], shortRange(move.start, move.end, lang), dateLabel(move.date, lang)) : when(move.date, move.start, move.end)) : T.move.noTime}</b>
        </div>
      </div>

      <div className="stu-move__times">
        <label className="stu-field"><span>{T.sheet.date}</span>
          <input type="date" value={move.date || ''} min={st.today} max={st.lastDay} onChange={(e) => e.target.value && setMove({ ...move, date: e.target.value, jump: true })} />
        </label>
        <label className="stu-field"><span>{T.sheet.from}</span>
          <TimeSelect value={move.start} onChange={setStart} label={T.sheet.from} lang={lang} disabled={!has} />
        </label>
        <label className="stu-field"><span>{T.sheet.to}</span>
          <TimeSelect value={move.end} onChange={(v) => setMove({ ...move, end: v })} label={T.sheet.to} lang={lang} disabled={!has} />
        </label>
      </div>

      {fixed ? <p className="stu-note">{fixed === 'all' ? T.sheet.scopeAllGroup : T.move.onceOnly}</p> : (
        <div className="stu-scope" role="radiogroup" aria-label={T.sheet.scopeQ}>
          {[['one', T.sheet.scopeOne, T.sheet.scopeOneP], ['all', T.sheet.scopeAll, T.sheet.scopeAllP]].map(([k, h, p]) => (
            <label key={k} className={`stu-scope__o ${scope === k ? 'is-on' : ''}`}>
              <input type="radio" name="scope" checked={scope === k} onChange={() => setMove({ ...move, scope: k })} />
              <span><b>{h}</b><small>{p}</small></span>
            </label>
          ))}
        </div>
      )}
      {late && <p className="stu-warn">{lesson.once ? T.tooLate(NOTICE_HOURS) : T.tooLateAll(NOTICE_HOURS)}</p>}
      {same && <p className="stu-warn">{T.errors.same}</p>}
      {order && <p className="stu-warn">{T.move.order}</p>}
      {tooLong && <p className="stu-warn">{T.move.tooLong}</p>}
      {clash && <p className="stu-warn">{T.sheet.clash}</p>}

      <label className="stu-field">
        <span>{T.sheet.note}</span>
        <textarea rows={2} maxLength={500} placeholder={T.sheet.notePh} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {err && <p className="stu-err" role="alert">{err}</p>}
      <div className="stu-sheet__acts">
        <button type="button" className="btn btn--ghost" onClick={() => onCancel()}>{T.sheet.cancel}</button>
        <button className="btn btn--accent" disabled={!ready || busy}>{busy ? T.sheet.sending : T.sheet.send}</button>
      </div>
    </form>
  )
}

/** One week of the student's calendar: their lessons, plus other students' lessons as "occupied". */
/**
 * While moving a lesson (`move`, with its effective `scope`), the lesson being moved (and with
 * "all following", the same weekly lesson after it) is marked, and the new time shows as a block.
 */
function studentWeek(st, week, T, L, lang, move) {
  const ACTIVE = ['pending', 'approved']
  const short = (d) => (lang === 'zh' ? dateLabel(d, 'zh').split('（')[0] : dateLabel(d, 'en').split(' ').slice(1).join(' '))
  return weekDates(st.today, week, weekdayOf).map((date) => {
    const wd = weekdayOf(date)
    const events = []
    for (const l of st.lessons.filter((x) => x.date === date)) {
      const r = l.request
      const tone = !r ? 'mine' : r.status === 'pending' ? 'pending' : r.kind === 'absence' ? 'off' : 'moved'
      const label = tone === 'off' && r.by_tutor ? T.cal.tone.cancelled : T.cal.tone[tone]
      events.push({ key: `m-${date}-${l.start}`, start: l.start, end: l.end, tone, dot: true, title: T.cal.mine, sub: r ? `${shortRange(l.start, l.end, lang)} · ${label}` : shortRange(l.start, l.end, lang), info: { type: 'mine', lesson: l } })
    }
    for (const r of st.requests.filter((x) => x.kind === 'reschedule' && ACTIVE.includes(x.status) && x.to_date === date)) {
      const t = reqTime(r)
      if (t) events.push({ key: `in-${r.id}`, start: t.start, end: t.end, tone: r.status === 'approved' ? 'mine' : 'pending', dot: true, title: T.cal.movedIn, sub: r.status === 'approved' ? shortRange(t.start, t.end, lang) : `${shortRange(t.start, t.end, lang)} · ${T.cal.tone.pending}`, info: { type: 'in', request: r } })
    }
    // Other students' lessons, except the group class this student is in (that is their own lesson).
    st.busy.filter((x) => x.date === date && !st.lessons.some((l) => l.date === date && l.start === x.start && l.end === x.end)).forEach((x, i) => {
      events.push({ key: `b-${date}-${x.start}-${i}`, start: x.start, end: x.end, tone: 'busy', title: T.cal.busy, sub: shortRange(x.start, x.end, lang), info: { type: 'busy', date, start: x.start, end: x.end } })
    })
    if (move) {
      const m = move.lesson
      const all = move.scope === 'all'
      const moving = (l) => l.date === m.date ? l.start === m.start : all && !l.once && l.date > m.date && l.weekday === m.weekday && l.start === m.start
      events.forEach((e, i) => {
        if (e.info.type === 'mine' && !e.info.lesson.request && moving(e.info.lesson)) events[i] = { ...e, tone: 'from', title: T.move.movingFrom, sub: shortRange(e.start, e.end, lang) }
      })
      if (move.date && (date === move.date || (all && date > move.date && wd === weekdayOf(move.date)))) {
        events.push({ key: date === move.date ? 'ghost' : `ghost-${date}`, start: move.start, end: move.end, tone: 'new', dot: true, drag: date === move.date, title: T.move.newTime, sub: shortRange(move.start, move.end, lang), info: { type: 'ghost' } })
      }
    }
    return { date, head: L.weekdaysShort[wd], sub: short(date), past: date < st.today, events }
  })
}

/** What shows under the calendar for the tapped entry or empty time. */
function CalDetail({ ev, st, T, L, lang, onSheet, onCancel }) {
  const { info } = ev
  const priv = info.lesson?.kind === 'private'
  const when = (date, a, b) => `${dateLabel(date, lang)} · ${shortRange(a, b, lang)}`
  if (info.type === 'mine') {
    const l = info.lesson
    const r = l.request
    const late = l.hours < st.noticeHours
    const past = startsAt(l.date, l.start) <= Date.now()
    const t = r && reqTime(r)
    return (
      <div className={`stu-detail stu-detail--${ev.tone}`}>
        <span className="stu-k">{T.cal.mine}</span>
        <b>{when(l.date, l.start, l.end)}</b>
        {r ? (
          <>
            <p>{r.kind === 'absence' ? (r.by_tutor && r.status === 'approved' ? T.cal.tone.cancelled : T.status.absent[r.status]) : T.status.moved[r.status](t && r.to_date ? when(r.to_date, t.start, t.end) : r.to_label)}</p>
            {r.status === 'pending' && !past && <button type="button" className="stu-link" onClick={() => onCancel(r.id)}>{T.withdraw}</button>}
            {r.status === 'approved' && !past && <p className="stu-small">{T.cal.askTutor}</p>}
          </>
        ) : past ? <p>{T.cal.done}</p> : (
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
      <button type="button" className="act" onClick={() => setOpen((o) => !o)} aria-expanded={open}><Icon name="calendarPlus" />{T.calLink.btn}</button>
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

const localPhone = (p) => (p?.startsWith('60') ? `0${p.slice(2)}` : p || '')

/** Their own details: school, birthday, contact and parent. Name, level and login number stay with the tutor. */
function ProfileForm({ st, T, L, token, notify, onSaved }) {
  const P = T.profile
  const p = st.profile || {}
  const init = () => ({
    school: p.school || '', birthday: p.birthday || '', email: p.email || '', address: p.address || '',
    parentName: p.parent_name || '', parentRelation: p.parent_relation || '', parentPhone: localPhone(p.parent_phone), lang: p.lang || 'en',
  })
  const [f, setF] = useState(init)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const dirty = JSON.stringify(f) !== JSON.stringify(init())
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await call(token, { action: 'profile', ...f })
      notify(P.saved)
      onSaved()
    } catch (e2) {
      setErr(T.errors[e2.code] || T.errors.server)
    } finally {
      setBusy(false)
    }
  }
  const field = (k, label, props = {}, hint) => (
    <label className="stu-field">
      <span>{label}</span>
      <input value={f[k]} onChange={set(k)} {...props} />
      {hint && <small className="stu-small">{hint}</small>}
    </label>
  )
  return (
    <form className="stu-card stu-prof" onSubmit={submit}>
      <p className="stu-muted">{P.p}</p>
      <fieldset className="stu-prof__sec">
        <legend>{P.student}</legend>
        <dl className="stu-prof__fixed">
          <dt>{P.name}</dt><dd>{p.name}</dd>
          {st.student.level && <><dt>{P.level}</dt><dd>{L.levels[st.student.level] || st.student.level}</dd></>}
          <dt>{P.login}</dt><dd>{localPhone(p.phone)}</dd>
        </dl>
        <p className="stu-small">{P.fixed}</p>
        <div className="stu-prof__row">
          {field('school', P.school, { maxLength: 120 })}
          {field('birthday', P.birthday, { type: 'date', max: st.today })}
        </div>
        {field('email', P.email, { type: 'email', maxLength: 120 })}
        {field('address', P.address, { maxLength: 300 }, P.addressHint)}
      </fieldset>
      <fieldset className="stu-prof__sec">
        <legend>{P.parent}</legend>
        <div className="stu-prof__row">
          {field('parentName', P.parentName, { maxLength: 80 })}
          <label className="stu-field">
            <span>{P.relation}</span>
            <select value={f.parentRelation} onChange={set('parentRelation')}>
              <option value="">—</option>
              {Object.entries(P.relations).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        {field('parentPhone', P.parentPhone, { type: 'tel', placeholder: T.login.phonePh }, P.parentHint)}
      </fieldset>
      <label className="stu-field">
        <span>{P.lang}</span>
        <select value={f.lang} onChange={set('lang')}><option value="en">English</option><option value="zh">中文</option></select>
      </label>
      {err && <p className="stu-err" role="alert">{err}</p>}
      <button className="btn btn--accent stu-prof__save" disabled={busy || !dirty}>{busy ? P.saving : P.save}</button>
    </form>
  )
}

/** The next lesson that will actually happen: weekly ones without an approved change, or one moved in. */
function nextLesson(st) {
  const now = Date.now()
  const weekly = st.lessons
    .filter((l) => !(l.request && l.request.status === 'approved'))
    .map((l) => ({ date: l.date, start: l.start, end: l.end, lesson: l }))
  const movedIn = st.requests
    .filter((r) => r.status === 'approved' && r.kind === 'reschedule' && r.to_date && r.to_start)
    .map((r) => ({ date: r.to_date, start: r.to_start, end: r.to_end, moved: true }))
  return [...weekly, ...movedIn]
    .filter((x) => startsAt(x.date, x.end) > now)
    .sort((a, b) => startsAt(a.date, a.start) - startsAt(b.date, b.start))[0] || null
}
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5)

function Home({ st, T, L, lang, token, notify, go, onSheet }) {
  const H = T.home
  const next = nextLesson(st)
  const fee = st.fees?.[0]
  const owing = st.fees?.filter((f) => f.state === 'due' || f.state === 'overdue') || []
  const waiting = st.requests.filter((r) => r.status === 'pending').length
  const p = st.progress
  const canMove = next?.lesson && !next.lesson.request && next.lesson.hours >= NOTICE_HOURS
  return (
    <>
      <div className="stu-tiles">
        <section className="stu-tile stu-tile--next">
          <span className="stu-k">{H.next}</span>
          {next ? (
            <>
              <b>{dateLabel(next.date, lang)}</b>
              <span>{shortRange(next.start, next.end, lang)} · {H.inDays(daysBetween(st.today, next.date))}</span>
              {next.lesson && !next.lesson.request && (
                <div className="stu-tile__acts">
                  <button type="button" className="act" onClick={() => onSheet({ kind: 'absence', lesson: next.lesson })}>{T.cantMake}</button>
                  {canMove && next.lesson.kind !== 'group' && <button type="button" className="act" onClick={() => onSheet({ kind: 'reschedule', lesson: next.lesson })}>{T.reschedule}</button>}
                </div>
              )}
            </>
          ) : <span className="stu-muted">{H.noNext}</span>}
        </section>
        <button type="button" className="stu-tile" onClick={() => go('history')}>
          <span className="stu-k">{H.month}</span>
          <b>{p.total ? H.monthOf(p.done, p.total) : '—'}</b>
          {p.total > 0 && <div className="stu-hist__bar" aria-hidden="true"><i style={{ width: `${(p.done / p.total) * 100}%` }} /></div>}
        </button>
        <button type="button" className={`stu-tile ${owing.some((f) => f.state === 'overdue') ? 'is-alert' : ''}`} onClick={() => go('history')}>
          <span className="stu-k">{H.fee}</span>
          {fee ? (
            <>
              <b>{fee.amount == null ? '—' : `RM${owing.length ? owing.reduce((n, f) => n + (f.amount || 0), 0) : fee.amount}`}</b>
              <span className={`stu-chip stu-chip--fee-${owing.length ? (owing.some((f) => f.state === 'overdue') ? 'overdue' : 'due') : fee.state}`}>
                {T.fees.state[owing.length ? (owing.some((f) => f.state === 'overdue') ? 'overdue' : 'due') : fee.state]}
              </span>
            </>
          ) : <b>{H.noFee}</b>}
        </button>
        <button type="button" className="stu-tile" onClick={() => go('requests')}>
          <span className="stu-k">{H.pending}</span>
          <b>{waiting}</b>
          <span>{H.pendingN(waiting)}</span>
        </button>
      </div>

      <div className="stu-cols">
        <section className="stu-card stu-regular">
          <span className="stu-k">{T.regular}</span>
          {st.weekly.length ? (
            <>
              {st.weekly.map((w) => <b key={`${w.weekday}-${w.start}`}>{T.every(L.weekdays[w.weekday])} · {shortRange(w.start, w.end, lang)}{st.student.lessonType === 'both' ? ` · ${T.types[w.kind]}` : ''}</b>)}
              <span className="stu-muted">
                {[T.types[st.student.lessonType], st.student.level && (L.levels[st.student.level] || st.student.level), st.student.subjects.map((x) => L.subjects[x] || x).join(lang === 'zh' ? '、' : ', ')].filter(Boolean).join(' · ')}
              </span>
            </>
          ) : <span className="stu-muted">{T.noSlot}</span>}
        </section>
        <section className="stu-card stu-quick">
          <span className="stu-k">{H.quick}</span>
          <button type="button" className="act" onClick={() => go('calendar')}><Icon name="calendar" />{H.seeCal}</button>
          {st.weekly.length > 0 && <button type="button" className="act" onClick={() => onSheet({ kind: 'change' })}><Icon name="repeat" />{T.changeBtn}</button>}
          <CalendarLink T={T} token={st.calendarToken} notify={notify} />
        </section>
      </div>
    </>
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
  const [sheet, setSheet] = useState(null) // { kind: 'absence', lesson }
  const [move, setMove] = useState(null) // { lesson, scope, date, start, end }: moving a lesson on the calendar
  const [week, setWeek] = useState(0)
  const [pinOpen, setPinOpen] = useState(false)
  const [tab, setTab] = useState(() => { try { const t = sessionStorage.getItem(TAB_KEY); return TABS.includes(t) ? t : 'home' } catch { return 'home' } })
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

  const go = (t) => { setTab(t); try { sessionStorage.setItem(TAB_KEY, t) } catch { /* ignore */ } window.scrollTo({ top: 0 }) }
  const showWeek = (date) => setWeek(Math.max(-(st?.weeksBack || 0), Math.min((st?.weeksAhead || 1) - 1, weekOf(st.today, date))))

  // Absences use the sheet; moving a lesson (one, or a new regular time) happens on the calendar.
  const openRequest = (x) => {
    if (x.kind === 'absence') return setSheet(x)
    const movable = st.lessons.filter((l) => !l.request && startsAt(l.date, l.start) > Date.now())
    const lesson = x.lesson || (x.kind === 'change' ? movable.find((l) => !l.once) : movable.find((l) => l.hours >= NOTICE_HOURS) || movable[0])
    if (!lesson) return notify(T.sheet.noneMovable)
    const start = x.preset?.start || lesson.start
    setMove({ lesson, scope: x.kind === 'change' ? 'all' : 'one', date: x.preset?.date || null, start, end: toT(Math.min(23 * 60 + 59, toMin(start) + toMin(lesson.end) - toMin(lesson.start))) })
    setSel(null)
    showWeek(x.preset?.date || lesson.date)
    go('calendar')
  }
  const moveTo = (date, start) => setMove((m) => ({ ...m, date, start, end: toT(Math.min(23 * 60 + 59, toMin(start) + toMin(m.end) - toMin(m.start))) }))
  useEffect(() => { if (move?.jump) { showWeek(move.date); setMove((m) => ({ ...m, jump: false })) } }, [move?.jump]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab !== 'calendar') setMove(null) }, [tab])
  const waiting = st ? st.requests.filter((r) => r.status === 'pending').length : 0
  const owing = st ? (st.fees || []).some((f) => f.state === 'due' || f.state === 'overdue') : false
  const NAV = [
    { key: 'home', icon: 'home' },
    { key: 'calendar', icon: 'calendar' },
    { key: 'history', icon: 'chart', dot: owing },
    { key: 'requests', icon: 'inbox', n: waiting },
    { key: 'profile', icon: 'user' },
  ]

  const header = (
    <header className="stu-top">
      <a href="/" className="admin__logo">Kangyan<span className="dot" aria-hidden="true" /><small>{T.title}</small></a>
      <div className="stu-top__acts">
        <button type="button" className="stu-lang" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>{lang === 'zh' ? 'EN' : '中文'}</button>
        {token && <button type="button" className="stu-lang" onClick={logout}>{T.logout}</button>}
      </div>
    </header>
  )

  if (!token) return <div className="stu">{header}<main className="stu-main"><Login T={T} onToken={saveToken} /></main></div>

  const moveScope = move && (move.lesson.kind === 'group' ? 'all' : move.lesson.once ? 'one' : move.scope)
  const calendar = st && (
    <section className={`stu-card stu-cal ${move ? 'is-moving' : ''}`}>
      {move ? (
        <div className="stu-move__banner" role="status">
          <Icon name="repeat" />
          <span>
            <b>{T.move.banner(`${dateLabel(move.lesson.date, lang)} ${shortRange(move.lesson.start, move.lesson.end, lang)}`)}</b>
            <small>{move.date ? T.move.adjust : T.move.tapHint}</small>
          </span>
          <button type="button" className="act" onClick={() => setMove(null)}>{T.sheet.cancel}</button>
        </div>
      ) : null}
      <div className="stu-cal__head">
        <ul className="stu-legend">
          {(move ? ['from', 'new', 'busy'] : ['mine', 'pending', 'busy']).map((k) => <li key={k}><i className={`wc__dot wc__dot--${k}`} />{T.cal.legend[k]}</li>)}
        </ul>
      </div>
      {(() => {
        const days = studentWeek(st, week, T, L, lang, move && { ...move, scope: moveScope })
        const picked = !move && (sel?.startsWith('ask:')
          ? { key: sel, tone: 'free', info: { type: 'ask', date: sel.split(':')[1], start: sel.split(':').slice(2).join(':') || st.weekly[0]?.start || '17:30' } }
          : days.flatMap((d) => d.events).find((e) => e.key === sel))
        const labels = { prev: T.cal.prev, next: T.cal.next, today: T.cal.thisWeek, empty: T.cal.empty, ask: move ? T.move.ask : T.cal.askDay, hour: (h) => (lang === 'zh' ? `${h}点` : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`) }
        return (
          <>
            <WeekCalendar
              days={days} week={week} weeks={st.weeksAhead} back={st.weeksBack || 0} onWeek={(n) => { setWeek(n); setSel(null) }} today={st.today}
              title={`${days[0].sub} – ${days[6].sub}`} labels={labels}
              {...(move ? {
                // Tapping a free (or occupied) time puts the new time there; the new-time block can also be dragged.
                selected: 'ghost',
                onSelect: (e) => { if (e.info.type === 'busy') moveTo(e.info.date, e.start) },
                onEmpty: (d, t) => moveTo(d.date, t || move.start),
                onDrag: (e, d, t) => { if (e.key === 'ghost') moveTo(d.date, t) },
              } : {
                selected: sel,
                onSelect: (e) => setSel(e.key === sel ? null : e.key),
                onEmpty: (d, t) => setSel(`ask:${d.date}:${t || ''}`),
              })}
            />
            {move
              ? <MovePlanner key={`${move.lesson.date}-${move.lesson.start}`} move={move} setMove={setMove} st={st} T={T} L={L} lang={lang} token={token}
                  onCancel={(why) => { setMove(null); if (why === 'auth') logout() }}
                  onDone={() => { setMove(null); notify(T.sheet.sent); load() }} />
              : picked ? <CalDetail ev={picked} st={st} T={T} L={L} lang={lang} onSheet={openRequest} onCancel={cancel} /> : <p className="stu-muted stu-cal__hint">{st.lessons.length ? T.cal.hint : T.noSlot}</p>}
          </>
        )
      })()}
      {!move && <CalendarLink T={T} token={st.calendarToken} notify={notify} />}
    </section>
  )

  const requestList = st && (
    <section className="stu-card">
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
  )

  return (
    <div className="stu stu--dash">
      {header}
      <div className="stu-dash">
        {st && (
          <nav className="stu-nav" aria-label={T.title}>
            {NAV.map((n) => (
              <button key={n.key} type="button" className={`stu-nav__b ${tab === n.key ? 'is-on' : ''}`} aria-current={tab === n.key ? 'page' : undefined} onClick={() => go(n.key)}>
                <Icon name={n.icon} className="stu-nav__i" />
                <span className="stu-nav__t">{T.nav[n.key]}</span>
                {n.n > 0 && <span className="badge">{n.n}</span>}
                {n.dot && <span className="stu-nav__dot" aria-hidden="true" />}
              </button>
            ))}
          </nav>
        )}
        <main className="stu-main">
          {loadErr ? (
            <div className="stu-card"><p className="stu-err">{loadErr}</p><button type="button" className="btn btn--accent" onClick={load}>↻</button></div>
          ) : !st ? (
            <div className="adm-skel" aria-busy="true"><span /><span /></div>
          ) : (
            <>
              <div className="stu-head">
                <h1>{tab === 'home' ? T.hi(st.student.name) : T.nav[tab]}</h1>
                {tab === 'home' && (
                  <p className="stu-muted">{[T.types[st.student.lessonType], st.student.level && (L.levels[st.student.level] || st.student.level)].filter(Boolean).join(' · ')}</p>
                )}
              </div>

              {/* A break going on now or coming up: lessons paused between the dates. */}
              {(tab === 'home' || tab === 'calendar') && (st.breaks || []).slice(0, 1).map((b) => (
                <section key={b.from} className="stu-news stu-news--break" role="note">
                  <b><Icon name="clock" />{b.from <= st.today ? T.brk.now(dateLabel(addDays(b.until, 1), lang)) : T.brk.soon(dateLabel(b.from, lang), dateLabel(b.until, lang))}</b>
                  <p>{T.brk.p}</p>
                </section>
              ))}

              {tab === 'home' && st.announcements?.map((a) => (
                <section key={a.id} className="stu-news" role="note">
                  <b><Icon name="megaphone" />{a.title}</b>
                  {a.body && <p>{a.body}</p>}
                </section>
              ))}

              {tab === 'home' && <Home st={st} T={T} L={L} lang={lang} token={token} notify={notify} go={go} onSheet={openRequest} />}
              {tab === 'calendar' && calendar}
              {tab === 'history' && (
                <div className="stu-cols">
                  <Fees st={st} T={T} lang={lang} />
                  <History st={st} T={T} L={L} lang={lang} />
                </div>
              )}
              {tab === 'requests' && requestList}
              {tab === 'profile' && (
                <>
                  <ProfileForm key={JSON.stringify(st.profile)} st={st} T={T} L={L} token={token} notify={notify} onSaved={load} />
                  <PinForm T={T} token={token} onToken={saveToken} notify={notify} open={pinOpen} setOpen={setPinOpen} />
                </>
              )}
            </>
          )}
        </main>
      </div>

      {sheet && st && (
        <AbsenceSheet
          lesson={sheet.lesson}
          st={st} T={T} lang={lang} token={token}
          onClose={(why) => { setSheet(null); if (why === 'auth') logout() }}
          onSent={() => { setSheet(null); notify(T.sheet.sent); load() }}
        />
      )}
      {toast && <div key={toast.id} className="toast" role="status">{toast.text}</div>}
    </div>
  )
}
