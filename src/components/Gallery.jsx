import { useState } from 'react'
import Reveal from './Reveal.jsx'
import { gallery } from '../data.js'

function Shot({ item }) {
  const [missing, setMissing] = useState(false)
  return (
    <figure className={`shot ${missing ? 'is-missing' : ''}`} data-c={item.c}>
      {!missing && (
        <img src={item.src} alt="Kangyan hosting" onError={() => setMissing(true)} />
      )}
      <figcaption>{item.label}</figcaption>
    </figure>
  )
}

export default function Gallery() {
  return (
    <section className="section" id="gallery">
      <div className="container">
        <Reveal as="div" className="section-head">
          <div>
            <p className="label" style={{ '--accent': 'var(--green)' }}>On Stage</p>
            <h2 className="section-head__title">Moments from the mic.</h2>
          </div>
        </Reveal>

        <Reveal className="gallery__grid">
          {gallery.map((item) => (
            <Shot key={item.src} item={item} />
          ))}
        </Reveal>
      </div>
    </section>
  )
}
