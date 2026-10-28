import { useEffect, useMemo, useRef, useState } from 'react'
import { SUBJECTS, LEVEL_GROUPS, LEVELS, LESSON_TYPES, ENQUIRERS, slotFits, GROUP_FEE, feeStage } from '../../shared/constants.js'
import { useLang, shortRange } from '../i18n.jsx'
import { confettiBurst } from '../confetti.js'
import { subjectTiles } from '../data.js'
import SchoolPicker from './SchoolPicker.jsx'

// One-question-at-a-time enquiry flow:
// parent or student → name → level → private/group (priced for that level) → school → subjects → times (filtered by class type)
// → online/in person → contact + note → done.
const STEPS = ['who', 'name', 'level', 'type', 'school', 'subjects', 'times', 'format', 'contact']
const at = (id) => STEPS.indexOf(id)
const DRAFT_KEY = 'kangyan-enquiry-draft'
const EMAIL_RE = /^[^\s@?&=]+@[^\s@?&=]+\.[^\s@?&=]+$/ // same rule as the server
// Server error code → wizard step to send the student back to.
const CODE_STEP = { enquirer: 'who', name: 'name', lessonType: 'type', level: 'level', school: 'school', subjects: 'subjects', format: 'format', location: 'format', phone: 'contact', email: 'contact', contact: 'contact' }
const EMPTY = { enquirer: '', name: '', lessonType: '', level: '', school: '', subjects: [], slots: [], format: '', location: '', phone: '', email: '', message: '', website: '' }

const loadDraft = () => {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null')
    if (d && typeof d === 'object' && d.data && typeof d.data === 'object') {
      // Keep only well-formed, still-valid values (drafts can come from older builds).
      const r = d.data
      const s = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
      const data = {
        ...EMPTY,
        enquirer: ENQUIRERS.includes(r.enquirer) ? r.enquirer : '',
        name: s(r.name, 80),
        lessonType: LESSON_TYPES.includes(r.lessonType) ? r.lessonType : '',
        level: LEVELS.includes(r.level) ? r.level : '',
        school: s(r.school, 160),
        subjects: Array.isArray(r.subjects) ? r.subjects.filter((x) => SUBJECTS.includes(x)) : [],
        slots: Array.isArray(r.slots) ? r.slots.filter((x) => Number.isInteger(x)) : [],
        format: ['online', 'in-person', 'either'].includes(r.format) ? r.format : '',
        location: s(r.location, 200),
        phone: s(r.phone, 30),
        email: s(r.email, 120),
        message: s(r.message, 2000),
      }
      const step = Math.min(Math.max(0, d.step | 0), STEPS.length - 1)
      return { step: firstGap(data, step), data }
    }
  } catch { /* ignore */ }
  return { step: 0, data: EMPTY }
}

const firstName = (n) => n.trim().split(/\s+/)[0] || n.trim()

// Does each step have what it needs? (times is optional, contact is checked on submit)
const stepValid = (d) => ({
  who: !!d.enquirer,
  name: d.name.trim().length >= 2,
  type: !!d.lessonType,
  level: !!d.level,
  school: d.school.trim().length >= 2,
  subjects: d.subjects.length > 0,
  times: true,
  format: !!d.format && (d.format !== 'in-person' || d.location.trim().length >= 2), // 2 so 蕉赖 counts
  contact: true,
})

// A restored draft must not land past an unanswered question.
const firstGap = (d, upTo) => {
  const v = stepValid(d)
  for (let i = 0; i < upTo; i++) if (!v[STEPS[i]]) return i
  return upTo
}

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
  parent: 'M8 7a3 3 0 100-6 3 3 0 000 6z M17 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M2 21v-2a5 5 0 015-5h2a5 5 0 015 5v2 M14 21v-1.5a4 4 0 013.5-4h.5a4 4 0 014 4V21',
  student: 'M22 9L12 4 2 9l10 5 10-5z M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5 M22 9v6',
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
  // Error text is language-specific; drop it when the language changes.
  useEffect(() => { setError('') }, [lang])

  // Any edit clears a stale error message.
  const set = (k, v) => { setError(''); setData((d) => ({ ...d, [k]: v })) }
  const toggleIn = (k, v) => { setError(''); setData((d) => ({ ...d, [k]: d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v] })) }

  const kindSlots = slots.filter((s) => slotFits(s.kind, data.lessonType))
  // Only open slots can be sent, even if a picked one has since filled up.
  const pickedSlots = kindSlots.filter((s) => s.status === 'open' && data.slots.includes(s.id))

  // Open slots per class type. Unknown until the timetable has loaded.
  const loaded = slotsState === 'ok'
  const openCount = (k) => slots.filter((s) => slotFits(s.kind, k) && s.status === 'open').length
  const avail = loaded ? { private: openCount('private'), group: openCount('group') } : null
  const allFull = !!avail && avail.private + avail.group === 0
  // A class type is unavailable when it has no open slots but the other one does.
  const typeOff = (k) => !!avail && !allFull && avail[k] === 0

  const valid = stepValid(data)

  // If the chosen class type has become unavailable (e.g. a restored draft), clear it
  // and bring the student back to that question.
  useEffect(() => {
    if (!avail || !data.lessonType || !typeOff(data.lessonType)) return
    setData((d) => ({ ...d, lessonType: '', slots: [] }))
    if (step > at('type')) { setDir('back'); setStep(at('type')) }
  }, [slotsState]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setError('')
    setData((d) => ({ ...d, [k]: v, ...(k === 'lessonType' && d.lessonType !== v ? { slots: [] } : {}) }))
    clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => go(step + 1), 260)
  }
  // Lesson mode: online moves on; in person / either need a location first.
  const chooseFormat = (k) => {
    if (k === 'online') return choose('format', k)
    clearTimeout(advanceTimer.current)
    set('format', k)
  }
  const switchToPrivate = () => {
    setData((d) => ({ ...d, lessonType: 'private', slots: [] }))
  }

  const submit = async () => {
    const phone = data.phone.trim()
    const email = data.email.trim()
    if (!phone && !email) return setError(w.contact.needContact)
    if (email && !EMAIL_RE.test(email)) return setError(w.contact.badEmail)
    if (phone && phone.replace(/\D/g, '').length < 8) return setError(w.contact.badPhone)
    const gap = firstGap(data, STEPS.length - 1)
    if (gap < STEPS.length - 1) return go(gap)
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name, email, phone, level: data.level, school: data.school.trim(), subjects: data.subjects,
          format: data.format || 'either', lessonType: data.lessonType, message: data.message,
          location: data.format === 'online' ? '' : data.location.trim(),
          lang,
          enquirer: data.enquirer,
          preferredSlots: pickedSlots.map((s) => s.id), website: data.website,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        // Validation problem: show a translated message on the step that needs fixing.
        if (json.code && json.code in CODE_STEP) {
          const to = at(CODE_STEP[json.code])
          if (to !== step) go(to)
          setError(w.errors[json.code])
          return
        }
        throw new Error(w.failed)
      }
      const btn = document.querySelector('.wz__submit')
      if (btn) {
        const r = btn.getBoundingClientRect()
        confettiBurst(r.left + r.width / 2, r.top + r.height / 2)
      }
      moved.current = true
      setDone({ name, who: data.enquirer })
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
          <h2 tabIndex={-1}>{w.done.title(done.name, done.who)}</h2>
          <p className="wz__help">{w.done.text(done.name, done.who)}</p>
          <div className="wz__doneacts">
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
    case 'who':
      body = (
        <>
          <h2 tabIndex={-1}>{w.who.q}</h2>
          <p className="wz__help">{w.who.help}</p>
          <div className="wz__cards">
            {ENQUIRERS.map((k) => (
              <button type="button" key={k} className={`wz__card ${data.enquirer === k ? 'is-on' : ''}`} aria-pressed={data.enquirer === k} onClick={() => choose('enquirer', k)}>
                <span className="wz__cardic" data-k={k}><Icon d={k === 'parent' ? ICON.parent : ICON.student} /></span>
                <span className="wz__cardtxt"><strong>{w.who[k].title}</strong><span>{w.who[k].desc}</span></span>
              </button>
            ))}
          </div>
        </>
      )
      break
    case 'name': {
      const who = data.enquirer || 'student'
      body = (
        <>
          <h2 tabIndex={-1}>{w.name.q[who]}</h2>
          <p className="wz__help">{w.name.help}</p>
          <input className="wz__input" type="text" autoComplete={who === 'student' ? 'name' : 'off'} placeholder={w.name.ph[who]} value={data.name} onChange={(e) => set('name', e.target.value)} aria-label={w.name.q[who]} maxLength={80} />
        </>
      )
      break
    }
    case 'type':
      body = (
        <>
          <h2 tabIndex={-1}>{w.type.q(name, data.enquirer)}</h2>
          <p className="wz__help">{w.type.help}</p>
          <div className="wz__cards">
            {['private', 'group'].map((k) => {
              const off = typeOff(k)
              return (
                <button
                  type="button"
                  key={k}
                  className={`wz__card ${data.lessonType === k ? 'is-on' : ''} ${off ? 'is-off' : ''}`}
                  aria-pressed={data.lessonType === k}
                  disabled={off}
                  onClick={() => choose('lessonType', k)}
                >
                  <span className="wz__cardic" data-k={k}><Icon d={k === 'private' ? ICON.one : ICON.group} /></span>
                  <span className="wz__cardtxt">
                    <strong>{w.type[k].title}</strong>
                    <span>{off ? w.type.unavailable : w.type[k].desc}</span>
                    {!off && <span className="wz__price">{k === 'group' ? w.type.group.price(GROUP_FEE[feeStage(data.level)]) : w.type.private.price}</span>}
                  </span>
                  {off && <span className="wz__badge">{w.type.fullBadge}</span>}
                </button>
              )
            })}
          </div>
          {typeOff('group') && <p className="wz__note">{w.type.noGroup}</p>}
          {typeOff('private') && <p className="wz__note">{w.type.noPrivate}</p>}
          {allFull && <p className="wz__note">{w.type.allFull}</p>}
        </>
      )
      break
    case 'level':
      body = (
        <>
          <h2 tabIndex={-1}>{w.level.q(name, data.enquirer)}</h2>
          <p className="wz__help">{w.level.help}</p>
          <div className="wz__levels">
            {LEVEL_GROUPS.map((g) => (
              <div className="wz__lgroup" key={g.key} role="group" aria-label={L.levelGroups[g.key]}>
                {g.key !== 'other' && <span className="wz__lhead">{L.levelGroups[g.key]}</span>}
                <div className={`wz__grid wz__grid--${g.key}`}>
                  {g.levels.map((l) => (
                    <button type="button" key={l} className={`wz__opt ${data.level === l ? 'is-on' : ''}`} aria-pressed={data.level === l} onClick={() => choose('level', l)}>
                      {L.levels[l] || l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )
      break
    case 'school':
      body = (
        <>
          <h2 tabIndex={-1}>{w.school.q(name, data.enquirer)}</h2>
          <p className="wz__help">{w.school.help}</p>
          <SchoolPicker value={data.school} onChange={(v) => set('school', v)} t={w.school} typeLabels={L.schoolTypes} lang={lang} label={w.school.q(name, data.enquirer)} />
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
          {loaded && days.length === 0 && (
            <div className="wz__note">
              <p>{data.lessonType === 'group' && avail.private > 0 ? w.times.noGroup : w.times.empty(typeLabel)}</p>
              {data.lessonType === 'group' && avail.private > 0 && (
                <button type="button" className="btn btn--ghost btn--sm wz__notebtn" onClick={switchToPrivate}>{w.times.switchPrivate}</button>
              )}
            </div>
          )}
          {loaded && days.length > 0 && openCount(data.lessonType) === 0 && <p className="wz__note">{w.times.allTaken(typeLabel)}</p>}
          {days.length > 0 && (
            <div className="wz__tt">
              {days.map(({ d, list }) => (
                <div className="wz__ttrow" key={d}>
                  <span className="wz__ttday" title={L.weekdays[d]}>{L.weekdaysShort[d]}</span>
                  <div className="wz__ttslots">
                    {list.map((s) => {
                      const taken = s.status === 'taken'
                      const on = !taken && data.slots.includes(s.id)
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
          {data.lessonType === 'private' && <p className="wz__help">{w.format.privateHelp}</p>}
          <div className="wz__cards wz__cards--3">
            {['online', 'in-person', 'either'].map((k) => (
              <button type="button" key={k} className={`wz__card ${data.format === k ? 'is-on' : ''}`} aria-pressed={data.format === k} onClick={() => chooseFormat(k)}>
                <span className="wz__cardic" data-k={k}><Icon d={k === 'online' ? ICON.online : k === 'in-person' ? ICON.person : ICON.either} /></span>
                <span className="wz__cardtxt"><strong>{w.format.opts[k][0]}</strong><span>{w.format.opts[k][1]}</span></span>
              </button>
            ))}
          </div>
          {(data.format === 'in-person' || data.format === 'either') && (
            <label className="wz__field wz__loc">
              <span>
                {w.format.location}{' '}
                {data.format === 'either' && <small>{w.contact.optional}</small>}
              </span>
              <input
                className="wz__input"
                type="text"
                autoComplete="address-level2"
                placeholder={w.format.locationPh}
                value={data.location}
                onChange={(e) => set('location', e.target.value)}
                maxLength={200}
                autoFocus
              />
              <small className="wz__hint">{w.format.locationHint}</small>
            </label>
          )}
        </>
      )
      break
    default: {
      const summary = [
        { label: L.enquirers[data.enquirer] || '', to: at('who') },
        { label: L.levels[data.level] || data.level, to: at('level') },
        { label: typeLabel, to: at('type') },
        { label: data.school.trim(), to: at('school') },
        { label: data.subjects.map((s) => L.subjects[s]).join(' · '), to: at('subjects') },
        { label: pickedSlots.length ? w.times.picked(pickedSlots.length) : w.contact.flexible, to: at('times') },
        { label: (L.formats[data.format] || L.formats.either) + (data.format !== 'online' && data.location.trim() ? ` · ${data.location.trim()}` : ''), to: at('format') },
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
              <button type="button" className="wz__chip" onClick={() => go(at('name'))}>{data.name.trim()}</button>
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
  const optionalStep = id === 'times' && days.length > 0 && openCount(data.lessonType) > 0
  const autoStep = id === 'who' || id === 'type' || id === 'level' || id === 'format'
  // Auto-advancing steps only show Continue once something is chosen.
  const chosen = { who: data.enquirer, type: data.lessonType, level: data.level, format: data.format }[id]

  return (
    <form className="wz" onSubmit={onSubmit} noValidate>
      <div className="wz__top">
        <button type="button" className="wz__back" onClick={back} disabled={step === 0 || busy} aria-label={w.back}>
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
        {(!autoStep || chosen) && (
          <button type="submit" className={`btn btn--accent ${isLast ? 'wz__submit' : ''}`} disabled={!valid[id] || busy}>
            {isLast ? (busy ? w.sending : w.submit) : w.next}
            {!isLast && <Icon d={ICON.next} />}
          </button>
        )}
      </div>
    </form>
  )
}
