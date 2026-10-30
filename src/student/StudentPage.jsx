// Page for existing students and parents: log in with WhatsApp number + PIN, see the
// regular lesson and the next few weeks, and ask to move a lesson, report an absence
// or change the regular time. The tutor approves or rejects each request in the admin.
import { useCallback, useEffect, useState } from 'react'
import { useLang, shortRange } from '../i18n.jsx'
import { dateLabel, NOTICE_HOURS, startsAt, weekdayOf } from '../../shared/lessons.js'
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

/** Bottom sheet for one request: absence, reschedule (one lesson) or a new regular time. */
function RequestSheet({ kind, lesson: given, preset, st, T, L, lang, token, onClose, onSent }) {
  const [slotId, setSlotId] = useState(preset?.slotId ?? null)
  const [pick, setPick] = useState(null) // which lesson to move, when started from a free slot
  const [from, setFrom] = useState(st.weekly.length === 1 ? st.weekly[0] : null) // which weekly lesson to change
  const [date, setDate] = useState(preset?.date ?? null)
  const lesson = given || pick
  // Lessons that can still be moved (12 hours' notice, no request yet).
  const movable = st.lessons.filter((l) => !l.request && l.hours >= NOTICE_HOURS)
  const [note, setNote] = useState('')
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const group = st.student.lessonType === 'group'
  const options = kind === 'reschedule' ? st.options.filter((o) => o.dates.length) : st.options
  const label = (o) => `${L.weekdays[o.weekday]} · ${shortRange(o.start, o.end, lang)}`
  const ready = kind === 'absence' || (kind === 'change' && slotId && (from || !st.weekly.length)) || (kind === 'reschedule' && slotId && date && lesson)
  const presetSlot = preset && st.options.find((o) => o.id === preset.slotId)
  const d = lesson && `${dateLabel(lesson.date, lang)} ${shortRange(lesson.start, lesson.end, lang)}`

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
      await call(token, { action: 'request', kind, lessonDate: lesson?.date, lessonStart: lesson?.start, fromWeekday: from?.weekday, fromStart: from?.start, toSlotId: slotId, toDate: date, recording, note })
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
            <span className="stu-k">{T.sheet.newTime}</span>
          </div>
        )}

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

        {presetSlot && (
          <div className="stu-opts">
            <span className="stu-k">{T.sheet.newTime}</span>
            <div className="stu-opt is-on"><button type="button" disabled>{kind === 'reschedule' && date ? `${dateLabel(date, lang)} · ${shortRange(presetSlot.start, presetSlot.end, lang)}` : label(presetSlot)}</button></div>
          </div>
        )}

        {kind !== 'absence' && !presetSlot && (options.length ? (
          <div className="stu-opts" role="radiogroup" aria-label={h}>
            {options.map((o) => (
              <div key={o.id} className={`stu-opt ${slotId === o.id ? 'is-on' : ''}`}>
                <button type="button" role="radio" aria-checked={slotId === o.id} onClick={() => { setSlotId(o.id); setDate(kind === 'reschedule' ? o.dates[0] : null) }}>
                  {label(o)}
                </button>
                {kind === 'reschedule' && slotId === o.id && (
                  <div className="stu-dates" role="radiogroup" aria-label={T.sheet.pickDate}>
                    {o.dates.map((x) => (
                      <button type="button" key={x} role="radio" aria-checked={date === x} className={date === x ? 'is-on' : ''} onClick={() => setDate(x)}>{dateLabel(x, lang)}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="stu-note">{T.sheet.noOptions}</p>)}

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

/** One week of the student's calendar: their lessons, plus the tutor's slots as free / occupied. */
function studentWeek(st, week, T, L, lang) {
  const now = Date.now()
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
      const t = st.times[r.to_slot_id]
      if (t) events.push({ key: `in-${r.id}`, start: t.start, end: t.end, tone: r.status === 'approved' ? 'mine' : 'pending', dot: true, title: T.cal.movedIn, sub: r.status === 'approved' ? shortRange(t.start, t.end, lang) : `${shortRange(t.start, t.end, lang)} · ${T.cal.tone.pending}`, info: { type: 'in', request: r } })
    }
    for (const sl of st.calendar.slots.filter((x) => x.weekday === wd)) {
      if (st.weekly.some((w) => w.weekday === wd && w.start === sl.start && w.end === sl.end)) continue // their own regular lesson
      const b = st.calendar.booked.find((x) => x.slotId === sl.id && x.date === date)
      if (b?.mine) continue // shown above as a moved-in lesson
      const started = startsAt(date, sl.start) <= now
      const free = sl.status === 'open' && !b && !started
      events.push({ key: `s-${sl.id}-${date}`, start: sl.start, end: sl.end, tone: free ? 'free' : 'busy', faded: started, title: free ? T.cal.free : T.cal.busy, sub: shortRange(sl.start, sl.end, lang), info: { type: free ? 'free' : 'busy', slot: sl, date } })
    }
    return { date, head: L.weekdaysShort[wd], sub: short(date), past: date < st.today, events }
  })
}

/** What shows under the calendar for the tapped entry. */
function CalDetail({ ev, st, T, L, lang, onSheet, onCancel }) {
  const { info } = ev
  const priv = st.student.lessonType === 'private'
  const when = (date, a, b) => `${dateLabel(date, lang)} · ${shortRange(a, b, lang)}`
  if (info.type === 'mine') {
    const l = info.lesson
    const r = l.request
    const late = l.hours < st.noticeHours
    return (
      <div className={`stu-detail stu-detail--${ev.tone}`}>
        <span className="stu-k">{T.cal.mine}</span>
        <b>{when(l.date, l.start, l.end)}</b>
        {r ? (
          <>
            <p>{r.kind === 'absence' ? T.status.absent[r.status] : T.status.moved[r.status](r.to_date ? when(r.to_date, st.times[r.to_slot_id]?.start || '', st.times[r.to_slot_id]?.end || '') : r.to_label)}</p>
            {r.status === 'pending' && <button type="button" className="stu-link" onClick={() => onCancel(r.id)}>{T.withdraw}</button>}
          </>
        ) : (
          <>
            <div className="stu-detail__acts">
              <button type="button" className="act" onClick={() => onSheet({ kind: 'absence', lesson: l })}>{T.cantMake}</button>
              {priv && <button type="button" className="act act--main" disabled={late} onClick={() => onSheet({ kind: 'reschedule', lesson: l })}>{T.reschedule}</button>}
            </div>
            {priv && late && <p className="stu-late">{T.tooLate(st.noticeHours)}</p>}
          </>
        )}
      </div>
    )
  }
  if (info.type === 'in') {
    const r = info.request
    const t = st.times[r.to_slot_id]
    return (
      <div className={`stu-detail stu-detail--${ev.tone}`}>
        <span className="stu-k">{T.cal.movedIn}</span>
        <b>{t ? when(r.to_date, t.start, t.end) : r.to_label}</b>
        <p>{T.cal.movedFrom(dateLabel(r.lesson_date, lang))} · {T.reqStatus[r.status]}</p>
        {r.status === 'pending' && <button type="button" className="stu-link" onClick={() => onCancel(r.id)}>{T.withdraw}</button>}
      </div>
    )
  }
  if (info.type === 'free') {
    const { slot, date } = info
    const canMove = priv && st.options.some((o) => o.id === slot.id && o.dates.includes(date))
    return (
      <div className="stu-detail stu-detail--free">
        <span className="stu-k">{T.cal.free}</span>
        <b>{when(date, slot.start, slot.end)}</b>
        <p>{T.cal.freeP}</p>
        <div className="stu-detail__acts">
          {canMove && <button type="button" className="act act--main" onClick={() => onSheet({ kind: 'reschedule', preset: { slotId: slot.id, date } })}>{T.cal.moveHere}</button>}
          <button type="button" className="act" onClick={() => onSheet({ kind: 'change', preset: { slotId: slot.id } })}>{T.cal.makeRegular(L.weekdays[slot.weekday])}</button>
        </div>
      </div>
    )
  }
  return (
    <div className="stu-detail stu-detail--busy">
      <span className="stu-k">{T.cal.busy}</span>
      <b>{when(info.date, info.slot.start, info.slot.end)}</b>
      <p>{ev.faded ? T.cal.pastP : T.cal.busyP}</p>
    </div>
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

  const timeOf = (slotId, date) => {
    const x = st?.times[slotId]
    if (!x) return ''
    return `${date ? dateLabel(date, lang) : L.weekdays[x.weekday]} ${shortRange(x.start, x.end, lang)}`
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

            <section className="stu-card stu-cal">
              <div className="stu-cal__head">
                <h2>{T.cal.title}</h2>
                <ul className="stu-legend">
                  {['mine', 'pending', 'free', 'busy'].map((k) => <li key={k}><i className={`wc__dot wc__dot--${k}`} />{T.cal.legend[k]}</li>)}
                </ul>
              </div>
              {(() => {
                const days = studentWeek(st, week, T, L, lang)
                const picked = days.flatMap((d) => d.events).find((e) => e.key === sel)
                return (
                  <>
                    <WeekCalendar
                      days={days} week={week} weeks={st.weeksAhead} onWeek={(n) => { setWeek(n); setSel(null) }}
                      selected={sel} onSelect={(e) => setSel(e.key === sel ? null : e.key)} today={st.today}
                      title={`${days[0].sub} – ${days[6].sub}`}
                      labels={{ prev: T.cal.prev, next: T.cal.next, today: T.cal.thisWeek, empty: T.cal.empty, hour: (h) => (lang === 'zh' ? `${h}点` : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`) }}
                    />
                    {picked ? <CalDetail ev={picked} st={st} T={T} L={L} lang={lang} onSheet={setSheet} onCancel={cancel} /> : <p className="stu-muted stu-cal__hint">{st.weekly.length ? T.cal.hint : T.noSlot}</p>}
                  </>
                )
              })()}
            </section>

            <section className="stu-card stu-change">
              <div>
                <h2>{T.changeH}</h2>
                <p className="stu-muted">{T.changeP}</p>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => setSheet({ kind: 'change' })}>{T.changeBtn}</button>
            </section>

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
                        {r.to_slot_id && <> {T.to(timeOf(r.to_slot_id, r.to_date) || r.to_label)}</>}
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
