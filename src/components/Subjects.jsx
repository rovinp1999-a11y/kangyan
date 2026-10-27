import Reveal from './Reveal.jsx'
import { subjects } from '../data.js'

export default function Subjects() {
  return (
    <section className="section" id="subjects">
      <div className="container">
        <Reveal className="sec-head">
          <p className="kicker">Subjects</p>
          <h2>Five subjects, one clear method.</h2>
        </Reveal>
        <Reveal className="subjects">
          {subjects.map((s) => (
            <article className="subj" key={s.title}>
              <span className="subj__ic" style={{ background: s.c, color: s.fg }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={s.icon} /></svg>
              </span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
