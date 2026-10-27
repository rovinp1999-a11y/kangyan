import Reveal from './Reveal.jsx'
import { faqs, CONTACT } from '../data.js'
import Doodles from './Doodles.jsx'

export default function Faq() {
  return (
    <section className="section has-doodles" id="faq">
      <Doodles />
      <div className="container faq__wrap">
        <Reveal className="sec-head">
          <p className="kicker">FAQ</p>
          <h2>Questions parents often ask</h2>
          <p>
            Something else on your mind?{' '}
            <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">Message me on WhatsApp</a>.
          </p>
        </Reveal>
        <Reveal className="faq stagger">
          {faqs.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
