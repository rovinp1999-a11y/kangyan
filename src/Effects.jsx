import { useEffect } from 'react'

// Mounts once. Renders the scroll-progress bar and wires up all global pointer
// interactions. Everything heavy is gated behind a fine-pointer + no-reduced-motion
// check so touch/accessibility users are unaffected.
export default function Effects() {
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cleanups = []
    const add = (el, ev, fn, opts) => {
      el.addEventListener(ev, fn, opts)
      cleanups.push(() => el.removeEventListener(ev, fn, opts))
    }

    /* ---- Scroll progress bar ---- */
    const bar = document.getElementById('progressBar')
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      const p = max > 0 ? h.scrollTop / max : 0
      if (bar) bar.style.transform = `scaleX(${p})`
    }
    onScroll()
    add(window, 'scroll', onScroll, { passive: true })

    /* ---- Scroll-spy active nav link ---- */
    const links = [...document.querySelectorAll('.nav__links a[href^="#"]')]
    const map = new Map()
    links.forEach((a) => {
      const s = document.getElementById(a.getAttribute('href').slice(1))
      if (s) map.set(s, a)
    })
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) => l.classList.remove('is-active'))
            map.get(e.target)?.classList.add('is-active')
          }
        })
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    map.forEach((_, s) => spy.observe(s))
    cleanups.push(() => spy.disconnect())

    /* ---- Hero headline: each letter picks a random colour on hover ---- */
    const HOVER_COLORS = ['#FACC15', '#7C3AED', '#10B981', '#2563EB', '#F97316'] // yellow, purple, green, blue, orange
    document.querySelectorAll('.hero__headline .ch').forEach((ch) => {
      const span = ch.querySelector('span')
      if (!span) return
      const onEnter = () => { span.style.color = HOVER_COLORS[(Math.random() * HOVER_COLORS.length) | 0] }
      const onLeave = () => { span.style.color = '' }
      add(ch, 'pointerenter', onEnter)
      add(ch, 'pointerleave', onLeave)
    })

    /* ---- Cursor spotlight on [data-spotlight] sections (works wherever a pointer moves) ---- */
    document.querySelectorAll('[data-spotlight]').forEach((el) => {
      const onMove = (e) => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      }
      add(el, 'pointermove', onMove, { passive: true })
    })

    if (fine && !reduce) {
      /* ---- Magnetic elements ---- */
      document.querySelectorAll('[data-magnetic]').forEach((el) => {
        const onM = (e) => {
          const r = el.getBoundingClientRect()
          const mx = e.clientX - (r.left + r.width / 2)
          const my = e.clientY - (r.top + r.height / 2)
          el.style.transform = `translate(${mx * 0.3}px, ${my * 0.45}px)`
        }
        const onL = () => { el.style.transform = '' }
        add(el, 'mousemove', onM)
        add(el, 'mouseleave', onL)
      })

      /* ---- 3D tilt elements ---- */
      document.querySelectorAll('[data-tilt]').forEach((el) => {
        const max = parseFloat(el.dataset.tilt) || 8
        const onM = (e) => {
          const r = el.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width - 0.5
          const py = (e.clientY - r.top) / r.height - 0.5
          el.style.transform = `perspective(820px) rotateX(${-py * max}deg) rotateY(${px * max}deg)`
        }
        const onL = () => { el.style.transform = '' }
        add(el, 'mousemove', onM)
        add(el, 'mouseleave', onL)
      })
    }

    return () => cleanups.forEach((fn) => fn())
  }, [])

  return (
    <div className="progress" aria-hidden="true">
      <span id="progressBar" className="progress__bar"></span>
    </div>
  )
}
