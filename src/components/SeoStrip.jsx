import { useLang } from '../i18n.jsx'

// Short, factual summary of what's taught, in the visitor's language.
// Gives search engines (and parents) the subjects and exam names in plain text.
export default function SeoStrip({ headingLevel = 2 }) {
  const { t } = useLang()
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section className="seo" aria-labelledby="seo-title">
      <div className="container seo__inner">
        <H id="seo-title" className="seo__title">{t.seo.title}</H>
        <p className="seo__intro">{t.seo.intro}</p>
        <ul className="seo__groups">
          {t.seo.groups.map((g) => (
            <li key={g.name}>
              <strong>{g.name}</strong>
              <span className="seo__levels">{g.levels}</span>
              <span className="seo__subjects">{g.subjects}</span>
            </li>
          ))}
        </ul>
        <div className="seo__pricing">
          <h3 className="seo__ptitle">{t.seo.pricing.title}</h3>
          <ul className="seo__prices">
            {t.seo.pricing.items.map((p) => (
              <li key={p.name}>
                <span className="seo__pname">{p.name}</span>
                <strong className="seo__pprice">{p.price}</strong>
                <span className="seo__pnote">{p.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
