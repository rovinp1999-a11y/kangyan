import { useState } from 'react'
import Reveal from './Reveal.jsx'

const POINTS = [
  'Bilingual & bicultural hosting',
  'Calm under pressure, sharp on timing',
  'Tailored scripts for every event',
  'Professional, reliable, prepared',
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
            The voice that <em>holds the room</em> — from the first welcome to the final toast.
          </p>
          <p>
            I'm an emcee, host and presenter who believes every event deserves a confident,
            charismatic guide. Whether I'm walking a couple down memory lane at their wedding
            or driving the momentum of a packed conference, my job is the same: read the room,
            honour the moment, and keep the energy exactly where it needs to be.
          </p>
          <p>
            I blend polished professionalism with genuine warmth — handling the run-of-show,
            improvising gracefully when plans shift, and making every guest feel seen.
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

          <a href="#contact" className="btn" data-magnetic>Let's work together <span className="arrow">→</span></a>
        </Reveal>
      </div>
    </section>
  )
}
