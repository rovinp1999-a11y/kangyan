import Reveal from './Reveal.jsx'
import { subjectTiles } from '../data.js'
import { useLang } from '../i18n.jsx'

// Subjects styled as periodic-table tiles.
export default function Subjects() {
  const { t } = useLang()
  return (
    <section className="section has-grid" id="subjects">
      <div className="container">
        <Reveal className="sec-head">
          <p className="kicker">{t.subjectsSec.kicker}</p>
          <h2>{t.subjectsSec.title}</h2>
          <p>{t.subjectsSec.sub}</p>
        </Reveal>
        <Reveal className="subjects stagger">
          {t.subjects.map((s, i) => {
            const tile = subjectTiles[i]
            return (
              <article className="subj" key={tile.sym} style={{ '--c': tile.c, '--fg': tile.fg }}>
                <div className="elem" aria-hidden="true">
                  <span className="elem__num">{i + 1}</span>
                  <span className="elem__sym">{tile.sym}</span>
                  <svg className="elem__ic" viewBox="0 0 24 24"><path d={tile.icon} /></svg>
                </div>
                <div>
                  <h3>{s.title}</h3>
                  <span className="subj__syll">{s.syll}</span>
                  <p>{s.desc}</p>
                </div>
              </article>
            )
          })}
        </Reveal>
      </div>
    </section>
  )
}
