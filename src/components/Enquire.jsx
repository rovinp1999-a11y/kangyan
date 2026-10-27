import { useEffect, useRef, useState } from 'react'
import { confettiBurst } from '../confetti.js'
import { SUBJECTS, LEVELS, FORMATS, slotLabel } from '../../shared/constants.js'

const EMPTY = { name: '', email: '', phone: '', level: '', subjects: [], format: 'either', message: '', website: '' }

export default function Enquire({ selectedSlots, onRemoveSlot, onSubmitted }) {
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const doneRef = useRef(null)

  // The success card is much shorter than the form, so bring it into view.
  useEffect(() => {
    if (done) doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [done])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
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
      setError('Please choose at least one subject.')
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
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong. Please try again.')

      const btn = e.target.querySelector('button[type="submit"]')
      const r = btn.getBoundingClientRect()
      confettiBurst(r.left + r.width / 2, r.top + r.height / 2)

      setDone(form.name.split(' ')[0])
      setForm(EMPTY)
      onSubmitted?.()
    } catch (err) {
      setError(err.message)
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
        <h3>Thank you, {done}!</h3>
        <p>Your enquiry has been sent. I'll get back to you within 48 hours by WhatsApp or email with a suggested time and the fees.</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDone(null)}>Send another enquiry</button>
      </div>
    )
  }

  return (
    <form className="panel form" onSubmit={handleSubmit} noValidate>
      <h3 className="panel__step"><span>2</span>Tell me about the student</h3>

      <div className="field">
        <label htmlFor="name">Student's name</label>
        <input id="name" name="name" type="text" autoComplete="name" placeholder="Full name" value={form.name} onChange={update} required minLength={2} />
      </div>
      <div className="field field--row">
        <div>
          <label htmlFor="email">Parent or student email</label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@email.com" value={form.email} onChange={update} required />
        </div>
        <div>
          <label htmlFor="phone">WhatsApp number <small>optional</small></label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="012-345 6789" value={form.phone} onChange={update} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="level">Current level</label>
        <select id="level" name="level" value={form.level} onChange={update} required>
          <option value="">Choose a level…</option>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>

      <fieldset className="field">
        <legend>Subjects needed</legend>
        <div className="pills">
          {SUBJECTS.map((s) => {
            const on = form.subjects.includes(s)
            return (
              <label key={s} className={`pill ${on ? 'is-on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => toggleSubject(s)} />
                {s}
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Lesson type</legend>
        <div className="pills">
          {FORMATS.map((f) => (
            <label key={f.value} className={`pill ${form.format === f.value ? 'is-on' : ''}`}>
              <input type="radio" name="format" value={f.value} checked={form.format === f.value} onChange={update} />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <span className="field__label">Preferred times</span>
        {selectedSlots.length === 0 ? (
          <p className="field__hint">None chosen yet. <a href="#timetable">Pick from the timetable</a>, or leave it and I'll suggest times.</p>
        ) : (
          <div className="chips">
            {selectedSlots.map((s) => (
              <span className="chip" key={s.id}>
                {slotLabel(s)}
                <button type="button" aria-label={`Remove ${slotLabel(s)}`} onClick={() => onRemoveSlot(s.id)}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="message">What would you like help with? <small>optional</small></label>
        <textarea id="message" name="message" rows="3" placeholder="e.g. Form 4, finds electricity hard, sitting SPM next year" value={form.message} onChange={update} />
      </div>

      {/* Honeypot — hidden from humans, bots tend to fill it. */}
      <input type="text" name="website" value={form.website} onChange={update} className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <button type="submit" className="btn btn--accent btn--full" disabled={busy}>
        {busy ? 'Sending…' : 'Send enquiry'}
      </button>
      <p className="form__fine">Free and no commitment. I'll reply within 48 hours.</p>
      {error && <p className="form__note is-error" role="alert">{error}</p>}
    </form>
  )
}
