import Reveal from './Reveal.jsx'
import { steps } from '../data.js'

export default function How() {
  return (
    <section className="section section--tight" id="how">
      <div className="container">
        <Reveal className="sec-head">
          <p className="kicker">How it works</p>
          <h2>From enquiry to first lesson in three steps.</h2>
        </Reveal>
        <Reveal as="ol" className="steps">
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
      </div>
    </section>
  )
}
