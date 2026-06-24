import { useState } from 'react'
import Reveal from './Reveal.jsx'
import { confettiBurst } from '../confetti.js'

const EVENT_TYPES = [
  'Wedding',
  'Corporate Event',
  'Gala / Awards',
  'Product Launch',
  'Concert / Show',
  'Private Celebration',
  'Other',
]

const EMPTY = { name: '', email: '', date: '', type: '', message: '' }

export default function Contact() {
  const [form, setForm] = useState(EMPTY)
  const [note, setNote] = useState('')

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!e.target.checkValidity()) {
      e.target.reportValidity()
      return
    }

    // 🎉 Celebrate the booking from the submit button's position.
    const btn = e.target.querySelector('button[type="submit"]')
    const r = btn.getBoundingClientRect()
    confettiBurst(r.left + r.width / 2, r.top + r.height / 2)

    const subject = encodeURIComponent(`Booking request — ${form.type || 'Event'} from ${form.name}`)
    const body = encodeURIComponent(
      `Name: ${form.name}\n` +
        `Email: ${form.email}\n` +
        `Event date: ${form.date || 'TBD'}\n` +
        `Event type: ${form.type || 'Not specified'}\n\n` +
        form.message,
    )
    window.location.href = `mailto:girlychangkangyan@gmail.com?subject=${subject}&body=${body}`
    setNote(`Thanks, ${form.name || 'there'}! Your email app is opening — hit send and I’ll reply within 48 hours.`)
    setForm(EMPTY)
  }

  return (
    <section className="section contact" id="contact" data-spotlight>
      <div className="container contact__grid">
        <Reveal className="contact__text">
          <p className="label" style={{ '--accent': 'var(--yellow)', color: 'var(--paper)' }}>Let's Talk</p>
          <h2 className="contact__title">
            BOOK<br /><span className="outline-text">KANGYAN</span>
          </h2>
          <p>
            Tell me about your occasion and I'll get back to you within 48 hours with
            availability and a tailored quote.
          </p>

          <ul className="contact__details">
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

        <Reveal as="form" className="contact__form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" type="text" placeholder="Jane Doe" value={form.name} onChange={update} required />
          </div>
          <div className="field field--row">
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" placeholder="jane@email.com" value={form.email} onChange={update} required />
            </div>
            <div>
              <label htmlFor="date">Event date</label>
              <input id="date" name="date" type="date" value={form.date} onChange={update} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="type">Event type</label>
            <select id="type" name="type" value={form.type} onChange={update}>
              <option value="">Select…</option>
              {EVENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="message">Tell me about your event</label>
            <textarea id="message" name="message" rows="4" placeholder="Date, location, guest count, vibe…" value={form.message} onChange={update}></textarea>
          </div>
          <button type="submit" className="btn btn--accent btn--full">Send Booking Request</button>
          {note && <p className="form__note">{note}</p>}
        </Reveal>
      </div>
    </section>
  )
}
