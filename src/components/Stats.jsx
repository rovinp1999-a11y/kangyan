import { useEffect, useRef, useState } from 'react'
import { stats } from '../data.js'

function Counter({ target, suffix = '' }) {
  const ref = useRef(null)
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const animate = () => {
      if (started.current) return
      started.current = true
      const dur = 1600
      let startTime = null
      const step = (now) => {
        if (startTime === null) startTime = now
        const p = Math.min((now - startTime) / dur, 1)
        const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
        setValue(Math.round(eased * target))
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }

    if (!('IntersectionObserver' in window)) {
      setValue(target)
      return
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && animate()),
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [target])

  return (
    <span className="stat__num" ref={ref}>
      {value}
      {suffix}
    </span>
  )
}

export default function Stats() {
  return (
    <section className="stats" data-spotlight>
      <div className="container stats__grid">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <Counter target={s.num} suffix={s.suffix} />
            <span className="stat__label">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
