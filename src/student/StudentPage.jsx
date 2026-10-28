// Page for existing students and parents: log in with WhatsApp number + PIN, see the
// regular lesson and the next few weeks, and ask to move a lesson, report an absence
// or change the regular time. The tutor approves or rejects each request in the admin.
import { useCallback, useEffect, useState } from 'react'
import { useLang, shortRange } from '../i18n.jsx'
import { dateLabel, NOTICE_HOURS } from '../../shared/lessons.js'
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
function RequestSheet({ kind, lesson, st, T, L, lang, token, onClose, onSent }) {
  const [slotId, setSlotId] = useState(null)
  const [date, setDate] = useState(null)
  const [note, setNote] = useState('')
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const group = st.student.lessonType === 'group'
  const options = kind === 'reschedule' ? st.options.filter((o) => o.dates.length) : st.options
  const label = (o) => `${L.weekdays[o.weekday]} · ${shortRange(o.start, o.end, lang)}`
  const ready = kind === 'absence' || (kind === 'change' && slotId) || (kind === 'reschedule' && slotId && date)
  const d = lesson && dateLabel(lesson.date, lang)

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
      await call(token, { action: 'request', kind, lessonDate: lesson?.date, toSlotId: slotId, toDate: date, recording, note })
      onSent()
    } catch (e2) {
      setErr(T.errors[e2.code] || T.errors.server)
      if (e2.code === 'auth') onClose('auth')
    } finally {
      setBusy(false)
    }
  }

  const h = { absence: T.sheet.absenceH, reschedule: T.sheet.rescheduleH, change: T.sheet.changeH }[kind]
  const p = { absence: T.sheet.absenceP(d), reschedule: T.sheet.rescheduleP(d), change: T.sheet.changeP }[kind]
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

        {kind !== 'absence' && (options.length ? (
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

function PinForm({ T, token, onToken, notify }) {
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
    <details className="stu-card stu-pin">
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
  const [sheet, setSheet] = useState(null) // { kind, lesson? }
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
  const lessonState = (r) => (r.kind === 'absence'
    ? T.status.absent[r.status]
    : T.status.moved[r.status](timeOf(r.to_slot_id, r.to_date) || r.to_label))

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

  const priv = st?.student.lessonType === 'private'
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
                {st.slot ? (
                  <>
                    <b>{T.every(L.weekdays[st.slot.weekday])} · {shortRange(st.slot.start, st.slot.end, lang)}</b>
                    <span className="stu-muted">
                      {[T.types[st.student.lessonType], st.student.level && (L.levels[st.student.level] || st.student.level), st.student.subjects.map((x) => L.subjects[x] || x).join(lang === 'zh' ? '、' : ', ')].filter(Boolean).join(' · ')}
                    </span>
                  </>
                ) : <span className="stu-muted">{T.noSlot}</span>}
              </div>
            </section>

            <section className="stu-card">
              <h2>{T.upcoming}</h2>
              {st.lessons.length ? (
                <ul className="stu-lessons">
                  {st.lessons.map((l) => {
                    const late = l.hours < st.noticeHours
                    return (
                      <li key={l.date} className={`stu-lesson ${l.request ? `is-${l.request.kind}` : ''}`}>
                        <div className="stu-lesson__when">
                          <b>{dateLabel(l.date, lang)}</b>
                          <span>{shortRange(l.start, l.end, lang)}</span>
                        </div>
                        {l.request ? (
                          <span className={`stu-chip stu-chip--${l.request.status}`}>{lessonState(l.request)}</span>
                        ) : (
                          <div className="stu-lesson__acts">
                            <button type="button" className="act" onClick={() => setSheet({ kind: 'absence', lesson: l })}>{T.cantMake}</button>
                            {priv && <button type="button" className="act act--main" disabled={late} onClick={() => setSheet({ kind: 'reschedule', lesson: l })}>{T.reschedule}</button>}
                          </div>
                        )}
                        {!l.request && priv && late && <p className="stu-late">{T.tooLate(st.noticeHours)}</p>}
                      </li>
                    )
                  })}
                </ul>
              ) : <p className="stu-muted">{st.slot ? T.noLessons : T.noSlot}</p>}
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
                        {r.lesson_date && T.lessonOn(dateLabel(r.lesson_date, lang))}
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

            <PinForm T={T} token={token} onToken={saveToken} notify={notify} />
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
