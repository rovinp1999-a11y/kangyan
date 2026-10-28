import { useLang } from '../i18n.jsx'

// Common questions about classes, fees and policies, in the visitor's language.
// Native <details> keeps it accessible and works before any script runs.
export default function Faq() {
  const { t } = useLang()
  return (
    <section className="faq" aria-labelledby="faq-title">
      <div className="container faq__inner">
        <div className="faq__head">
          <h2 id="faq-title" className="faq__title">{t.faq.title}</h2>
          <p className="faq__intro">{t.faq.intro}</p>
        </div>
        <div className="faq__list">
          {t.faq.items.map((f) => (
            <details className="faq__item" key={f.q}>
              <summary>{f.q}</summary>
              <div className="faq__a">
                {f.a.map((p) => <p key={p}>{p}</p>)}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
