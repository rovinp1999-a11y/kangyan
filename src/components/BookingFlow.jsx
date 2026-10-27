import { useEffect, useMemo, useRef, useState } from 'react'
import Reveal from './Reveal.jsx'
import Availability from './Availability.jsx'
import Enquire from './Enquire.jsx'
import { CONTACT } from '../data.js'

// Timetable + enquiry form side by side, plus a sticky mobile CTA.
export default function BookingFlow() {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [showCta, setShowCta] = useState(false)
  const formCol = useRef(null)

  useEffect(() => {
    let alive = true
    fetch('/api/slots')
      .then((r) => r.json())
      .then((d) => { if (!alive) return; d.ok ? setSlots(d.slots) : setError(true) })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  // Sticky CTA: visible after scrolling past the hero, hidden while the form is on screen.
  useEffect(() => {
    let formVisible = false
    const update = () => setShowCta(window.scrollY > 480 && !formVisible)
    const io = new IntersectionObserver(([e]) => { formVisible = e.isIntersecting; update() }, { threshold: 0.15 })
    if (formCol.current) io.observe(formCol.current)
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => { io.disconnect(); window.removeEventListener('scroll', update) }
  }, [])

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const remove = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  const selectedSlots = useMemo(() => slots.filter((s) => selected.has(s.id)), [slots, selected])
  const n = selected.size

  return (
    <section className="section book" id="enquire">
      <div className="container">
        <Reveal className="sec-head">
          <p className="kicker">Enquire</p>
          <h2>Check my timetable, then send an enquiry</h2>
          <p>Choosing times is optional. Enquiring is free and doesn't commit you to anything.</p>
        </Reveal>

        <div className="book__grid">
          <Availability slots={slots} selected={selected} onToggle={toggle} loading={loading} error={error} />
          <div className="book__form" id="enquire-form" ref={formCol}>
            <Enquire selectedSlots={selectedSlots} onRemoveSlot={remove} onSubmitted={() => setSelected(new Set())} />
            <p className="book__contact">
              Rather message directly?{' '}
              <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a> ·{' '}
              <a href={`mailto:${CONTACT.email}`}>Email</a> ·{' '}
              <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
            </p>
          </div>
        </div>
      </div>

      <div className={`sticky-cta ${showCta ? 'is-on' : ''}`} aria-hidden={!showCta}>
        <a href="#enquire-form" className="btn btn--accent btn--full" tabIndex={showCta ? 0 : -1}>
          {n ? `Send enquiry · ${n} time${n > 1 ? 's' : ''} picked` : 'Send an enquiry'}
        </a>
      </div>
    </section>
  )
}
