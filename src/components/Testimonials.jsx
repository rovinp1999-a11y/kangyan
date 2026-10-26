import Reveal from './Reveal.jsx'
import { testimonials } from '../data.js'

const initials = (name) =>
  name
    .replace(/&.*/, '')
    .trim()
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export default function Testimonials() {
  return (
    <section className="section" id="testimonials">
      <div className="container">
        <Reveal as="div" className="section-head">
          <div>
            <p className="label" style={{ '--accent': 'var(--yellow)' }}>Kind Words</p>
            <h2 className="section-head__title">What students and parents say.</h2>
          </div>
        </Reveal>

        <div className="quotes">
          {testimonials.map((t) => (
            <Reveal as="blockquote" className="quote" key={t.name} style={{ '--accent': t.accent }}>
              <span className="quote__mark">"</span>
              <p>{t.quote}</p>
              <footer>
                <span className="quote__avatar">{initials(t.name)}</span>
                <span>
                  <strong>{t.name}</strong>
                  <span>{t.event}</span>
                </span>
              </footer>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
