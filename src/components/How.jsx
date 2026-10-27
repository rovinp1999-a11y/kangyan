import Reveal from './Reveal.jsx'
import { steps, why } from '../data.js'
import Doodles from './Doodles.jsx'

export default function How() {
  return (
    <section className="section section--tight has-doodles" id="how">
      <Doodles />
      <div className="container">
        <Reveal className="sec-head">
          <p className="kicker">How it works</p>
          <h2>Getting started is simple</h2>
        </Reveal>
        <Reveal as="ol" className="steps stagger">
          {steps.map((s, i) => (
            <li className="step" key={s.title}>
              <span className="step__n">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </li>
          ))}
        </Reveal>

        <Reveal className="why">
          <h3 className="why__title">Why students learn with me</h3>
          <ul className="why__list">
            {why.map((w) => (
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
