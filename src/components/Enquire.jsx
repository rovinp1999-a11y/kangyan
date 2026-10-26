import { useState } from 'react'
import Reveal from './Reveal.jsx'
import { confettiBurst } from '../confetti.js'
import { SUBJECTS, LEVELS, FORMATS, slotLabel } from '../../shared/constants.js'

const EMPTY = { name: '', email: '', phone: '', level: '', subjects: [], format: 'either', message: '', website: '' }

export default function Enquire({ selectedSlots, onRemoveSlot, onSubmitted }) {
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null) // { ok, text }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const update = (e) => set(e.target.name, e.target.value)
  const toggleSubject = (s) =>
    set('subjects', form.subjects.includes(s) ? form.subjects.filter((x) => x !== s) : [...form.subjects, s])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!e.target.checkValidity()) {
      e.target.reportValidity()
      return
    }
    if (form.subjects.length === 0) {
      setNote({ ok: false, text: 'Pick at least one subject.' })
      return
    }

    setBusy(true)
    setNote(null)
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, preferredSlots: selectedSlots.map((s) => s.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong')

      const btn = e.target.querySelector('button[type="submit"]')
      const r = btn.getBoundingClientRect()
      confettiBurst(r.left + r.width / 2, r.top + r.height / 2)

      setNote({ ok: true, text: `Thanks, ${form.name.split(' ')[0]}! Your enquiry is in. I'll reply within 48 hours to confirm a time.` })
      setForm(EMPTY)
      onSubmitted?.()
    } catch (err) {
      setNote({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section enquire" id="enquire">
      <div className="container enquire__grid">
        <Reveal className="enquire__text">
          <p className="label" style={{ '--accent': 'var(--green)' }}>Let's Talk</p>
          <h2 className="enquire__title">
            ENQUIRE<br /><span className="outline-text">TODAY</span>
          </h2>
          <p>
            Tell me about the student, the subjects and the times that suit you. I'll get
            back within 48 hours with availability and fees.
          </p>

          <ul className="enquire__details">
            <li>
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16v16H4z" /><path d="M22 6l-10 7L2 6" />
              </svg>
              <a href="mailto:girlychangkangyan@gmail.com">girlychangkangyan@gmail.com</a>
            </li>
            <li>
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <a href="tel:+60162241099">+60 16-224 1099</a>
            </li>
            <li>
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" />
              </svg>
              <a href="https://instagram.com/kangyan1204" target="_blank" rel="noopener noreferrer">@kangyan1204</a>
            </li>
          </ul>
        </Reveal>

        <Reveal as="form" className="form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">Student's name</label>
            <input id="name" name="name" type="text" placeholder="Full name" value={form.name} onChange={update} required minLength={2} />
          </div>
          <div className="field field--row">
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" placeholder="you@email.com" value={form.email} onChange={update} required />
            </div>
            <div>
              <label htmlFor="phone">Phone / WhatsApp</label>
              <input id="phone" name="phone" type="tel" placeholder="+60 12-345 6789" value={form.phone} onChange={update} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="level">Level</label>
            <select id="level" name="level" value={form.level} onChange={update} required>
              <option value="">Select…</option>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>

          <fieldset className="field">
            <legend>Subjects</legend>
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
            <legend>Lesson format</legend>
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
            <label>Preferred time slots</label>
            {selectedSlots.length === 0 ? (
              <p className="field__hint">
                None selected — <a href="#availability">pick from the timetable</a> or leave blank if you're flexible.
              </p>
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
            <label htmlFor="message">Anything else?</label>
            <textarea id="message" name="message" rows="4" placeholder="Current grades, exam date, topics you find hardest…" value={form.message} onChange={update}></textarea>
          </div>

          {/* Honeypot — hidden from humans, bots tend to fill it. */}
          <input type="text" name="website" value={form.website} onChange={update} className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

          <button type="submit" className="btn btn--accent btn--full" disabled={busy}>
            {busy ? 'Sending…' : 'Send Enquiry'}
          </button>
          {note && <p className={`form__note ${note.ok ? '' : 'is-error'}`} role="status">{note.text}</p>}
        </Reveal>
      </div>
    </section>
  )
}
