import { useState } from 'react'
import Reveal from './Reveal.jsx'

const POINTS = [
  'SPM & IGCSE syllabus coverage',
  'Past-year papers & exam technique',
  'Patient, step-by-step explanations',
  'Progress updates for parents',
]

export default function About() {
  const [missing, setMissing] = useState(false)

  return (
    <section className="section" id="about">
      <div className="container about__grid">
        <Reveal className="about__media">
          <div className="about__photo">
            {/* 📸 REPLACE: public/assets/kangyan-about.jpg */}
            {!missing ? (
              <img
                src="/assets/kangyan-about.jpg"
                alt="Portrait of Kangyan"
                onError={() => setMissing(true)}
              />
            ) : (
              <div className="photo-fallback">
                <span>Portrait</span>
                <small>public/assets/kangyan-about.jpg</small>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal className="about__text">
          <p className="label" style={{ '--accent': 'var(--purple)' }}>About Kangyan</p>
          <p className="about__quote">
            Science should <em>make sense</em> — not just be memorised.
          </p>
          <p>
            I tutor secondary students in Physics, Chemistry, Biology, Science and Mathematics,
            preparing them for SPM and IGCSE. Every lesson starts from what you already understand
            and builds up, one clear step at a time, until the hard topics feel obvious.
          </p>
          <p>
            Lessons blend concept teaching with timed past-year practice, so you learn the
            material and the exam at the same time. Parents get regular updates on what we
            covered and where to focus next.
          </p>

          <ul className="about__list">
            {POINTS.map((p) => (
              <li key={p}>
                <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {p}
              </li>
            ))}
          </ul>

          <a href="#enquire" className="btn" data-magnetic>Start with an enquiry <span className="arrow">→</span></a>
        </Reveal>
      </div>
    </section>
  )
}
