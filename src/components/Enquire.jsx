import { useEffect, useRef, useState } from 'react'
import { confettiBurst } from '../confetti.js'
import { SUBJECTS, LEVELS, FORMATS } from '../../shared/constants.js'
import { useLang, shortRange } from '../i18n.jsx'

const EMPTY = { name: '', email: '', phone: '', level: '', subjects: [], format: 'either', message: '', website: '' }

export default function Enquire({ selectedSlots, onRemoveSlot, onSubmitted }) {
  const { t, lang } = useLang()
  const f = t.form
  const L = t.labels
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const doneRef = useRef(null)

  // The success card is much shorter than the form, so bring it into view.
  useEffect(() => {
    if (done) doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [done])

  const slotText = (s) => `${L.weekdaysShort[s.weekday]} ${shortRange(s.start, s.end, lang)}`
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }))
  const update = (e) => set(e.target.name, e.target.value)
  const toggleSubject = (s) =>
    set('subjects', form.subjects.includes(s) ? form.subjects.filter((x) => x !== s) : [...form.subjects, s])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!e.target.checkValidity()) {
      e.target.reportValidity()
      return
    }
    if (form.subjects.length === 0) {
      setError(f.needSubject)
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, preferredSlots: selectedSlots.map((s) => s.id) }),
      })
      const data = await res.json().catch(() => ({}))
      // Server messages are English; show them in English mode, a translated fallback otherwise.
      if (!res.ok || !data.ok) throw new Error(lang === 'en' && data.error ? data.error : f.failed)

      const btn = e.target.querySelector('button[type="submit"]')
      const r = btn.getBoundingClientRect()
      confettiBurst(r.left + r.width / 2, r.top + r.height / 2)

      setDone(form.name.trim().split(/\s+/)[0])
      setForm(EMPTY)
      onSubmitted?.()
    } catch (err) {
      setError(err.message || f.failed)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="panel done" role="status" ref={doneRef}>
        <span className="done__ic" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
        <h3>{f.doneTitle(done)}</h3>
        <p>{f.doneText}</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDone(null)}>{f.again}</button>
      </div>
    )
  }

  return (
    <form className="panel form" onSubmit={handleSubmit} noValidate>
      <h3 className="panel__step"><span>2</span>{f.title}</h3>

      <div className="field">
        <label htmlFor="name">{f.name}</label>
        <input id="name" name="name" type="text" autoComplete="name" placeholder={f.namePh} value={form.name} onChange={update} required minLength={2} />
      </div>
      <div className="field field--row">
        <div>
          <label htmlFor="email">{f.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@email.com" value={form.email} onChange={update} required />
        </div>
        <div>
          <label htmlFor="phone">{f.phone} <small>{f.optional}</small></label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="012-345 6789" value={form.phone} onChange={update} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="level">{f.level}</label>
        <select id="level" name="level" value={form.level} onChange={update} required>
          <option value="">{f.levelPh}</option>
          {LEVELS.map((l) => <option key={l} value={l}>{L.levels[l] || l}</option>)}
        </select>
      </div>

      <fieldset className="field">
        <legend>{f.subjects}</legend>
        <div className="pills">
          {SUBJECTS.map((s) => {
            const on = form.subjects.includes(s)
            return (
              <label key={s} className={`pill ${on ? 'is-on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => toggleSubject(s)} />
                {L.subjects[s] || s}
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>{f.format}</legend>
        <div className="pills">
          {FORMATS.map((x) => (
            <label key={x.value} className={`pill ${form.format === x.value ? 'is-on' : ''}`}>
              <input type="radio" name="format" value={x.value} checked={form.format === x.value} onChange={update} />
              {L.formats[x.value] || x.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <span className="field__label">{f.times}</span>
        {selectedSlots.length === 0 ? (
          <p className="field__hint">{f.timesNone[0]}<a href="#timetable">{f.timesNone[1]}</a>{f.timesNone[2]}</p>
        ) : (
          <div className="chips">
            {selectedSlots.map((s) => (
              <span className="chip" key={s.id}>
                {slotText(s)}
                <button type="button" aria-label={`${f.remove} ${slotText(s)}`} onClick={() => onRemoveSlot(s.id)}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="message">{f.message} <small>{f.optional}</small></label>
        <textarea id="message" name="message" rows="3" placeholder={f.messagePh} value={form.message} onChange={update} />
      </div>

      {/* Honeypot — hidden from humans, bots tend to fill it. */}
      <input type="text" name="website" value={form.website} onChange={update} className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <button type="submit" className="btn btn--accent btn--full" disabled={busy}>
        {busy ? f.sending : f.submit}
      </button>
      <p className="form__fine">{f.fine}</p>
      {error && <p className="form__note is-error" role="alert">{error}</p>}
    </form>
  )
}
