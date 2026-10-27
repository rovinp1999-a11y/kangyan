import { HeroArt } from './SciArt.jsx'

const TRUST = ['Reply within 48 hours', 'Online or in-person', 'Exam-focused practice']

export default function Hero() {
  return (
    <section className="hero" id="home">
      <div className="container hero__grid">
        <div className="hero__text">
          <p className="eyebrow"><span className="pulse" aria-hidden="true" />Taking new students · SPM &amp; IGCSE</p>
          <h1 className="hero__title">
            Science &amp; Maths tuition that <span className="hl">makes sense</span>.
          </h1>
          <p className="hero__lede">
            I'm <strong>Kangyan</strong>. I teach Physics, Chemistry, Biology, Science and
            Mathematics for Form 1–5 — clear explanations plus past-year practice, one-to-one
            or in small groups.
          </p>
          <div className="hero__actions">
            <a href="#enquire" className="btn btn--accent">Send an enquiry <span aria-hidden="true">→</span></a>
            <a href="#timetable" className="btn btn--ghost">See free slots</a>
          </div>
          <ul className="hero__trust">
            {TRUST.map((t) => (
              <li key={t}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="hero__art" aria-hidden="true">
          <HeroArt />
        </div>
      </div>
    </section>
  )
}
