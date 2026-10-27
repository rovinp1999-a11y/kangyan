import { useEffect, useMemo, useRef, useState } from 'react'
import { SUBJECTS, LEVELS } from '../../shared/constants.js'
import { useLang, shortRange } from '../i18n.jsx'
import { confettiBurst } from '../confetti.js'
import { subjectTiles, CONTACT } from '../data.js'

// One-question-at-a-time enquiry flow:
// name → private/group → level → subjects → times (filtered by class type)
// → online/in person → contact + note → done.
const STEPS = ['name', 'type', 'level', 'subjects', 'times', 'format', 'contact']
const DRAFT_KEY = 'kangyan-enquiry-draft'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMPTY = { name: '', lessonType: '', level: '', subjects: [], slots: [], format: '', phone: '', email: '', message: '', website: '' }

const loadDraft = () => {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null')
    if (d && typeof d === 'object' && d.data) return { step: Math.min(Math.max(0, d.step | 0), STEPS.length - 1), data: { ...EMPTY, ...d.data } }
  } catch { /* ignore */ }
  return { step: 0, data: EMPTY }
}

const firstName = (n) => n.trim().split(/\s+/)[0] || n.trim()

function Icon({ d }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
}
const ICON = {
  back: 'M15 18l-6-6 6-6',
  next: 'M5 12h14 M13 6l6 6-6 6',
  check: 'M20 6L9 17l-5-5',
  one: 'M12 11a4 4 0 100-8 4 4 0 000 8z M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1',
  group: 'M9 11a4 4 0 100-8 4 4 0 000 8z M2 21v-1a6 6 0 016-6h2a6 6 0 016 6v1 M17 3.5a4 4 0 010 7.5 M22 21v-1a6 6 0 00-4-5.6',
  online: 'M3 5h18v11H3z M8 20h8 M12 16v4',
  person: 'M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  either: 'M7 16l-4-4 4-4 M17 8l4 4-4 4 M3 12h18',
}

export default function Wizard() {
  const { t, lang } = useLang()
  const w = t.wz
  const L = t.labels
  const initial = useMemo(loadDraft, [])
  const [step, setStep] = useState(initial.step)
  const [data, setData] = useState(initial.data)
  const [dir, setDir] = useState('fwd')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [slots, setSlots] = useState([])
  const [slotsState, setSlotsState] = useState('loading')
  const bodyRef = useRef(null)
  const moved = useRef(false)
  const advanceTimer = useRef(null)

  const id = STEPS[step]
  const name = firstName(data.name)

  useEffect(() => {
    let alive = true
    fetch('/api/slots')
      .then((r) => r.json())
      .then((d) => { if (!alive) return; if (d.ok) { setSlots(d.slots); setSlotsState('ok') } else setSlotsState('error') })
      .catch(() => alive && setSlotsState('error'))
    return () => { alive = false }
  }, [])

  // Keep progress if the page is refreshed mid-way.
  useEffect(() => {
    try { done ? sessionStorage.removeItem(DRAFT_KEY) : sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, data })) } catch { /* ignore */ }
  }, [step, data, done])

  // Move focus to the new question for keyboard and screen-reader users.
  useEffect(() => {
    if (!moved.current) return
    const el = bodyRef.current
    if (!el) return
    const target = el.querySelector('input:not([type=hidden]):not(.hp), textarea') || el.querySelector('h2')
    target?.focus({ preventScroll: true })
    el.closest('.wz')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [step, done])

  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const set = (k, v) => setData((d) => ({ ...d, [k]: v }))
  const toggleIn = (k, v) => setData((d) => ({ ...d, [k]: d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v] }))

  const kindSlots = slots.filter((s) => s.kind === data.lessonType)
  const pickedSlots = kindSlots.filter((s) => data.slots.includes(s.id))

  const valid = {
    name: data.name.trim().length >= 2,
    type: !!data.lessonType,
    level: !!data.level,
    subjects: data.subjects.length > 0,
    times: true,
    format: !!data.format,
    contact: true,
  }

  const go = (to) => {
    clearTimeout(advanceTimer.current)
    moved.current = true
    setError('')
    setDir(to > step ? 'fwd' : 'back')
    setStep(to)
  }
  const next = () => { if (valid[id] && step < STEPS.length - 1) go(step + 1) }
  const back = () => { if (step > 0) go(step - 1) }

  // Single-choice steps move on by themselves after a short beat.
  const choose = (k, v) => {
    set(k, v)
    clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => go(step + 1), 260)
  }

  const submit = async () => {
    const phone = data.phone.trim()
    const email = data.email.trim()
    if (!phone && !email) return setError(w.contact.needContact)
    if (email && !EMAIL_RE.test(email)) return setError(w.contact.badEmail)
    if (phone && phone.replace(/\D/g, '').length < 8) return setError(w.contact.badPhone)
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name, email, phone, level: data.level, subjects: data.subjects,
          format: data.format || 'either', lessonType: data.lessonType, message: data.message,
          preferredSlots: pickedSlots.map((s) => s.id), website: data.website,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(lang === 'en' && json.error ? json.error : w.failed)
      const btn = document.querySelector('.wz__submit')
      if (btn) {
        const r = btn.getBoundingClientRect()
        confettiBurst(r.left + r.width / 2, r.top + r.height / 2)
      }
      moved.current = true
      setDone(name)
      setData(EMPTY)
      setStep(0)
    } catch (e) {
      setError(e.message || w.failed)
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (id === 'contact') submit()
    else next()
  }

  /* ----------------------------- done ----------------------------- */
  if (done) {
    return (
      <div className="wz wz--done" role="status">
        <div className="wz__body" ref={bodyRef}>
          <span className="wz__doneic" aria-hidden="true"><Icon d={ICON.check} /></span>
          <h2 tabIndex={-1}>{w.done.title(done)}</h2>
          <p className="wz__help">{w.done.text}</p>
          <div className="wz__doneacts">
            <a className="btn btn--accent" href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">{w.done.whatsapp}</a>
            <button type="button" className="btn btn--ghost" onClick={() => { moved.current = true; setDone(null) }}>{w.done.again}</button>
          </div>
        </div>
      </div>
    )
  }

  /* ----------------------------- steps ----------------------------- */
  const typeLabel = L.lessonTypes[data.lessonType] || ''
  const days = [0, 1, 2, 3, 4, 5, 6]
    .map((d) => ({ d, list: kindSlots.filter((s) => s.weekday === d) }))
    .filter((x) => x.list.length)

  let body
  switch (id) {
    case 'name':
      body = (
        <>
          <h2 tabIndex={-1}>{w.name.q}</h2>
          <p className="wz__help">{w.name.help}</p>
          <input className="wz__input" type="text" autoComplete="name" placeholder={w.name.ph} value={data.name} onChange={(e) => set('name', e.target.value)} aria-label={w.name.q} maxLength={80} />
        </>
      )
      break
    case 'type':
      body = (
        <>
          <h2 tabIndex={-1}>{w.type.q(name)}</h2>
          <p className="wz__help">{w.type.help}</p>
          <div className="wz__cards">
            {['private', 'group'].map((k) => (
              <button type="button" key={k} className={`wz__card ${data.lessonType === k ? 'is-on' : ''}`} aria-pressed={data.lessonType === k} onClick={() => choose('lessonType', k)}>
                <span className="wz__cardic" data-k={k}><Icon d={k === 'private' ? ICON.one : ICON.group} /></span>
                <span className="wz__cardtxt"><strong>{w.type[k].title}</strong><span>{w.type[k].desc}</span></span>
              </button>
            ))}
          </div>
        </>
      )
      break
    case 'level':
      body = (
        <>
          <h2 tabIndex={-1}>{w.level.q(name)}</h2>
          <p className="wz__help">{w.level.help}</p>
          <div className="wz__grid">
            {LEVELS.map((l) => (
              <button type="button" key={l} className={`wz__opt ${data.level === l ? 'is-on' : ''}`} aria-pressed={data.level === l} onClick={() => choose('level', l)}>
                {L.levels[l] || l}
              </button>
            ))}
          </div>
        </>
      )
      break
    case 'subjects':
      body = (
        <>
          <h2 tabIndex={-1}>{w.subjects.q}</h2>
          <p className="wz__help">{w.subjects.help}</p>
          <div className="wz__elems">
            {SUBJECTS.map((s, i) => {
              const tile = subjectTiles[s]
              const on = data.subjects.includes(s)
              return (
                <button type="button" key={s} className={`wz__elem ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggleIn('subjects', s)} style={{ '--c': tile.c, '--fg': tile.fg }}>
                  <span className="wz__elemtile" aria-hidden="true"><em>{i + 1}</em>{tile.sym}</span>
                  <span className="wz__elemname">{L.subjects[s]}</span>
                  <span className="wz__tick" aria-hidden="true"><Icon d={ICON.check} /></span>
                </button>
              )
            })}
          </div>
        </>
      )
      break
    case 'times':
      body = (
        <>
          <h2 tabIndex={-1}>{w.times.q}</h2>
          <p className="wz__help">{w.times.help[data.lessonType] || w.times.help.private}</p>
          {slotsState === 'loading' && <p className="wz__note">{w.times.loading}</p>}
          {slotsState === 'error' && <p className="wz__note">{w.times.error}</p>}
          {slotsState === 'ok' && days.length === 0 && <p className="wz__note">{w.times.empty(typeLabel)}</p>}
          {days.length > 0 && (
            <div className="wz__tt">
              {days.map(({ d, list }) => (
                <div className="wz__ttrow" key={d}>
                  <span className="wz__ttday" title={L.weekdays[d]}>{L.weekdaysShort[d]}</span>
                  <div className="wz__ttslots">
                    {list.map((s) => {
                      const taken = s.status === 'taken'
                      const on = data.slots.includes(s.id)
                      const label = shortRange(s.start, s.end, lang)
                      return (
                        <button
                          type="button"
                          key={s.id}
                          className={`wz__slot ${on ? 'is-on' : ''} ${taken ? 'is-taken' : ''}`}
                          disabled={taken}
                          aria-pressed={on}
                          aria-label={`${L.weekdays[d]} ${label}${taken ? `, ${w.times.taken}` : ''}`}
                          onClick={() => toggleIn('slots', s.id)}
                        >
                          {label}
                          {taken && <small>{w.times.taken}</small>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="wz__count">{pickedSlots.length ? w.times.picked(pickedSlots.length) : w.times.none}</p>
        </>
      )
      break
    case 'format':
      body = (
        <>
          <h2 tabIndex={-1}>{w.format.q}</h2>
          <div className="wz__cards wz__cards--3">
            {['online', 'in-person', 'either'].map((k) => (
              <button type="button" key={k} className={`wz__card ${data.format === k ? 'is-on' : ''}`} aria-pressed={data.format === k} onClick={() => choose('format', k)}>
                <span className="wz__cardic" data-k={k}><Icon d={k === 'online' ? ICON.online : k === 'in-person' ? ICON.person : ICON.either} /></span>
                <span className="wz__cardtxt"><strong>{w.format.opts[k][0]}</strong><span>{w.format.opts[k][1]}</span></span>
              </button>
            ))}
          </div>
        </>
      )
      break
    default: {
      const summary = [
        { label: typeLabel, to: 1 },
        { label: L.levels[data.level] || data.level, to: 2 },
        { label: data.subjects.map((s) => L.subjects[s]).join(' · '), to: 3 },
        { label: pickedSlots.length ? w.times.picked(pickedSlots.length) : w.contact.flexible, to: 4 },
        { label: L.formats[data.format] || L.formats.either, to: 5 },
      ]
      body = (
        <>
          <h2 tabIndex={-1}>{w.contact.q}</h2>
          <p className="wz__help">{w.contact.help}</p>
          <div className="wz__fields">
            <label className="wz__field">
              <span>{w.contact.phone}</span>
              <input className="wz__input" type="tel" inputMode="tel" autoComplete="tel" placeholder="012-345 6789" value={data.phone} onChange={(e) => set('phone', e.target.value)} maxLength={30} />
            </label>
            <label className="wz__field">
              <span>{w.contact.email}</span>
              <input className="wz__input" type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" value={data.email} onChange={(e) => set('email', e.target.value)} maxLength={120} />
            </label>
            <label className="wz__field">
              <span>{w.contact.message} <small>{w.contact.optional}</small></span>
              <textarea className="wz__input" rows="2" placeholder={w.contact.messagePh} value={data.message} onChange={(e) => set('message', e.target.value)} maxLength={2000} />
            </label>
            {/* Honeypot — hidden from humans, bots tend to fill it. */}
            <input type="text" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={data.website} onChange={(e) => set('website', e.target.value)} />
          </div>
          <div className="wz__summary">
            <span className="wz__summarytitle">{w.contact.summary}</span>
            <div className="wz__chips">
              <button type="button" className="wz__chip" onClick={() => go(0)}>{data.name.trim()}</button>
              {summary.map((x) => (
                <button type="button" key={x.to} className="wz__chip" onClick={() => go(x.to)}>{x.label}</button>
              ))}
            </div>
          </div>
        </>
      )
    }
  }

  const isLast = id === 'contact'
  const optionalStep = id === 'times'
  const autoStep = id === 'type' || id === 'level' || id === 'format'

  return (
    <form className="wz" onSubmit={onSubmit} noValidate>
      <div className="wz__top">
        <button type="button" className="wz__back" onClick={back} disabled={step === 0} aria-label={w.back}>
          <Icon d={ICON.back} />
        </button>
        <div className="wz__progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={w.stepOf(step + 1, STEPS.length)}>
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <span className="wz__stepof">{step + 1}/{STEPS.length}</span>
      </div>

      <div className={`wz__body wz__body--${dir}`} key={`${id}-${lang}`} ref={bodyRef}>
        {body}
      </div>

      {error && <p className="wz__error" role="alert">{error}</p>}

      <div className="wz__actions">
        {optionalStep && (
          <button type="button" className="btn btn--ghost" onClick={() => { set('slots', []); go(step + 1) }}>
            {w.times.flexible}
          </button>
        )}
        {(!autoStep || valid[id]) && (
          <button type="submit" className={`btn btn--accent ${isLast ? 'wz__submit' : ''}`} disabled={!valid[id] || busy}>
            {isLast ? (busy ? w.sending : w.submit) : w.next}
            {!isLast && <Icon d={ICON.next} />}
          </button>
        )}
      </div>
    </form>
  )
}
