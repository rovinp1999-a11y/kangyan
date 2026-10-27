import Reveal from './Reveal.jsx'
import Doodles from './Doodles.jsx'
import { useLang } from '../i18n.jsx'

export default function How() {
  const { t } = useLang()
  const h = t.how
  return (
    <section className="section section--tight has-doodles" id="how">
      <Doodles />
      <div className="container">
        <Reveal className="sec-head">
          <p className="kicker">{h.kicker}</p>
          <h2>{h.title}</h2>
        </Reveal>
        <Reveal as="ol" className="steps stagger">
          {h.steps.map((s, i) => (
            <li className="step" key={i}>
              <span className="step__n">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </li>
          ))}
        </Reveal>

        <Reveal className="why">
          <h3 className="why__title">{h.whyTitle}</h3>
          <ul className="why__list">
            {h.why.map((w) => (
              <li key={w}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                {w}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
