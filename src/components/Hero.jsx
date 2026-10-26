import { useState } from 'react'

// Split a word into animated character spans. `start` offsets the entrance delay
// so letters cascade continuously across both headline lines.
function chars(text, start = 0) {
  return [...text].map((c, i) => (
    <span className="ch" key={i} style={{ animationDelay: `${(start + i) * 0.045 + 0.15}s` }}>
      <span>{c}</span>
    </span>
  ))
}

export default function Hero() {
  const [missing, setMissing] = useState(false)

  return (
    <section className="hero" id="home">
      <div className="container hero__grid">
        <div className="hero__text">
          <p className="label hero__eyebrow" style={{ '--accent': 'var(--purple)' }}>
            Science &amp; Maths Tutor · SPM · IGCSE
          </p>
          <h1 className="hero__headline" aria-label="Science & Maths">
            <span className="line" aria-hidden="true">{chars('SCIENCE', 0)}</span>
            <span className="line line--2" aria-hidden="true">
              {chars('&', 7)} <span className="hero__star">{chars('MATHS', 8)}</span>
            </span>
          </h1>

          <div className="hero__sub">
            <p className="hero__lede">
              I'm <strong>Kangyan</strong> — I tutor Physics, Chemistry, Biology, Science
              and Mathematics for Form 1–5, SPM and IGCSE students. Clear explanations,
              exam-focused practice, real progress.
            </p>
          </div>

          <div className="hero__actions">
            <a href="#availability" className="btn btn--accent btn--lg" data-magnetic>
              Check my availability <span className="arrow">→</span>
            </a>
            <a href="#enquire" className="btn btn--ghost btn--lg" data-magnetic>Send an enquiry</a>
          </div>
        </div>

        <div className="hero__media">
          <span className="hero__tag">Taking new students</span>
          <div className="hero__photo" data-tilt="7">
            {/* 📸 REPLACE: public/assets/kangyan-hero.jpg */}
            {!missing ? (
              <img
                src="/assets/kangyan-hero.jpg"
                alt="Kangyan, science and maths tutor"
                onError={() => setMissing(true)}
              />
            ) : (
              <div className="photo-fallback">
                <span>Your photo here</span>
                <small>public/assets/kangyan-hero.jpg</small>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
