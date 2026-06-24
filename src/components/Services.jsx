import Reveal from './Reveal.jsx'
import { services } from '../data.js'

export default function Services() {
  return (
    <section className="section" id="services">
      <div className="container">
        <Reveal as="div" className="section-head">
          <div>
            <p className="label" style={{ '--accent': 'var(--blue)' }}>What I Host</p>
            <h2 className="section-head__title">Every occasion, hosted with heart.</h2>
          </div>
          <p className="section-sub">
            From the first welcome to the final toast — I bring the flow, the timing
            and the spark to any stage.
          </p>
        </Reveal>

        <div className="bento">
          {services.map((s) => (
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
              <h3>Something else in mind? Let's build the perfect run-of-show.</h3>
              <a href="#contact" className="btn btn--accent" data-magnetic>
                Start a booking <span className="arrow">→</span>
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
