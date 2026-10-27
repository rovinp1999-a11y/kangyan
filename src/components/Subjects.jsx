import Reveal from './Reveal.jsx'
import { subjects } from '../data.js'

// Subjects styled as periodic-table tiles.
export default function Subjects() {
  return (
    <section className="section has-grid" id="subjects">
      <div className="container">
        <Reveal className="sec-head">
          <p className="kicker">Subjects</p>
          <h2>What I teach</h2>
          <p>Form 1–5 KSSM and Cambridge IGCSE. Tell me the subject and level, and I'll shape the lessons around it.</p>
        </Reveal>
        <Reveal className="subjects stagger">
          {subjects.map((s, i) => (
            <article className="subj" key={s.title} style={{ '--c': s.c, '--fg': s.fg }}>
              <div className="elem" aria-hidden="true">
                <span className="elem__num">{i + 1}</span>
                <span className="elem__sym">{s.sym}</span>
                <svg className="elem__ic" viewBox="0 0 24 24"><path d={s.icon} /></svg>
              </div>
              <div>
                <h3>{s.title}</h3>
                <span className="subj__syll">{s.syll}</span>
                <p>{s.desc}</p>
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
