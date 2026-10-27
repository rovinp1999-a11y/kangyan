import Reveal from './Reveal.jsx'
import Doodles from './Doodles.jsx'
import { CONTACT } from '../data.js'
import { useLang } from '../i18n.jsx'

export default function Faq() {
  const { t } = useLang()
  return (
    <section className="section has-doodles" id="faq">
      <Doodles />
      <div className="container faq__wrap">
        <Reveal className="sec-head">
          <p className="kicker">{t.faqSec.kicker}</p>
          <h2>{t.faqSec.title}</h2>
          <p>
            {t.faqSec.sub}{' '}
            <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">{t.faqSec.subLink}</a>.
          </p>
        </Reveal>
        <Reveal className="faq stagger">
          {t.faqs.map((f) => (
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
