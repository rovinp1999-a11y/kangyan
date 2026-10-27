import { useEffect, useState } from 'react'
import { HeroArt } from './SciArt.jsx'
import MoleculeField from './MoleculeField.jsx'

const TRUST = ['Online or in-person', 'One-to-one or small groups', 'Progress updates for parents']
const WORDS = ['Physics', 'Chemistry', 'Biology', 'Maths', 'Science']

// Types each word, pauses, deletes it, moves to the next. Static under reduced motion.
function useTypewriter(words) {
  const [text, setText] = useState(words[0])
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let i = 0
    let n = words[0].length
    let deleting = false
    let t
    const tick = () => {
      const word = words[i]
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
      setText(words[i].slice(0, n))
      t = setTimeout(tick, deleting ? 45 : 85)
    }
    t = setTimeout(tick, 1700)
    return () => clearTimeout(t)
  }, [words])
  return text
}

export default function Hero() {
  const word = useTypewriter(WORDS)

  return (
    <section className="hero" id="home">
      <MoleculeField />
      <div className="container hero__grid">
        <div className="hero__text">
          <p className="eyebrow"><span className="pulse" aria-hidden="true" />Now accepting new students</p>
          <h1 className="hero__title">
            <span className="sr-only">SPM and IGCSE Science and Maths tuition, taught so it clicks.</span>
            <span aria-hidden="true">
              <span className="hero__line">SPM &amp; IGCSE</span>
              <span className="hero__line"><span className="type">{word}<i className="type__caret" /></span> tuition,</span>
              <span className="hero__line"><span className="hl">taught so it clicks</span>.</span>
            </span>
          </h1>
          <p className="hero__lede">
            Hi, I'm <strong>Kangyan</strong>. I tutor Physics, Chemistry, Biology, Science and
            Mathematics for Form 1–5 (KSSM) and IGCSE. Lessons pair clear explanations with
            past-year paper practice, so students understand the topic and know how to answer
            it in the exam.
          </p>
          <div className="hero__actions">
            <a href="#enquire" className="btn btn--accent">Send an enquiry <span aria-hidden="true">→</span></a>
            <a href="#timetable" className="btn btn--ghost">Check my free slots</a>
          </div>
          <p className="hero__fine">Free to enquire · No commitment · Reply within 48 hours</p>
          <ul className="hero__trust">
            {TRUST.map((t) => (
              <li key={t}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                {t}
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
