import Reveal from './Reveal.jsx'
import { subjects } from '../data.js'

export default function Subjects() {
  return (
    <section className="section" id="subjects">
      <div className="container">
        <Reveal as="div" className="section-head">
          <div>
            <p className="label" style={{ '--accent': 'var(--blue)' }}>What I Teach</p>
            <h2 className="section-head__title">Five subjects, one clear method.</h2>
          </div>
          <p className="section-sub">
            Form 1 to Form 5, SPM and IGCSE. One-to-one or small groups, online or in person.
          </p>
        </Reveal>

        <div className="bento">
          {subjects.map((s) => (
            <Reveal as="article" className={`tile tile--${s.tile}`} key={s.title} data-tilt="6">
              <div className="tile__top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="tile__num">{s.num}</span>
                <span className="tile__icon">
                  <svg viewBox="0 0 24 24"><path d={s.icon} /></svg>
                </span>
              </div>
              <div className="tile__body">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </Reveal>
          ))}

          <Reveal as="article" className="tile tile--f">
            <div className="tile__inner">
              <h3>Not sure where to start? Tell me the subject and I'll suggest a plan.</h3>
              <a href="#enquire" className="btn btn--accent" data-magnetic>
                Send an enquiry <span className="arrow">→</span>
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
