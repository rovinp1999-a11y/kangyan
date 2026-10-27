import { useEffect, useState } from 'react'
import { HeroArt } from './SciArt.jsx'
import MoleculeField from './MoleculeField.jsx'
import { useLang } from '../i18n.jsx'

// Types each word, pauses, deletes it, moves to the next. Static under reduced motion.
// Restarts from the first word whenever the word list (language) changes.
function useTypewriter(words) {
  const [text, setText] = useState(words[0])
  useEffect(() => {
    setText(words[0])
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const chars = (w) => [...w] // safe for Chinese characters
    let i = 0
    let n = chars(words[0]).length
    let deleting = false
    let t
    const tick = () => {
      const word = chars(words[i])
      if (!deleting && n === word.length) {
        deleting = true
        t = setTimeout(tick, 1700)
        return
      }
      if (deleting && n === 0) {
        deleting = false
        i = (i + 1) % words.length
        t = setTimeout(tick, 220)
        return
      }
      n += deleting ? -1 : 1
      setText(chars(words[i]).slice(0, n).join(''))
      t = setTimeout(tick, deleting ? 50 : word.length <= 2 ? 160 : 85)
    }
    t = setTimeout(tick, 1700)
    return () => clearTimeout(t)
  }, [words])
  return text
}

export default function Hero() {
  const { t } = useLang()
  const h = t.hero
  const word = useTypewriter(h.words)

  return (
    <section className="hero" id="home">
      <MoleculeField />
      <div className="container hero__grid">
        <div className="hero__text">
          <p className="eyebrow"><span className="pulse" aria-hidden="true" />{h.eyebrow}</p>
          <h1 className="hero__title">
            <span className="sr-only">{h.sr}</span>
            <span aria-hidden="true">
              <span className="hero__line">{h.line1}</span>
              <span className="hero__line"><span className="type">{word}<i className="type__caret" /></span>{h.afterWord}</span>
              <span className="hero__line"><span className="hl">{h.line3}</span>{h.line3End}</span>
            </span>
          </h1>
          <p className="hero__lede">
            {h.lede[0]}<strong>{h.lede[1]}</strong>{h.lede[2]}
          </p>
          <div className="hero__actions">
            <a href="#enquire" className="btn btn--accent">{h.cta} <span aria-hidden="true">→</span></a>
            <a href="#timetable" className="btn btn--ghost">{h.cta2}</a>
          </div>
          <p className="hero__fine">{h.fine}</p>
          <ul className="hero__trust">
            {h.trust.map((x) => (
              <li key={x}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="hero__art" aria-hidden="true">
          <HeroArt />
        </div>
      </div>
    </section>
  )
}
