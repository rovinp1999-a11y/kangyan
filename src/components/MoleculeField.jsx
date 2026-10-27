import { useEffect, useRef } from 'react'

// Animated "molecule network": coloured atoms drift, bond to nearby atoms and
// move away from the pointer. Pure canvas, no dependencies.
// Pauses when off-screen or the tab is hidden; draws one still frame when the
// visitor prefers reduced motion.
const COLORS = ['#7C3AED', '#2563EB', '#10B981', '#FACC15']
const INK = '21, 18, 28'
const LINK = 118 // max bond length in CSS px
const PUSH = 110 // pointer repulsion radius

export default function MoleculeField({ className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pointer = { x: -9999, y: -9999 }
    let w = 0
    let h = 0
    let nodes = []
    let raf = 0
    let onScreen = true

    const seed = () => {
      const count = Math.round(Math.min(64, Math.max(16, (w * h) / 17000)))
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: 2.6 + Math.random() * 3.4,
        c: COLORS[i % COLORS.length],
        ring: Math.random() < 0.18, // a few atoms get an electron ring
        a: Math.random() * Math.PI * 2,
      }))
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width
      h = rect.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
      draw()
    }

    const step = () => {
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        n.a += 0.02
        if (n.x < -20) n.x = w + 20
        else if (n.x > w + 20) n.x = -20
        if (n.y < -20) n.y = h + 20
        else if (n.y > h + 20) n.y = -20
        const dx = n.x - pointer.x
        const dy = n.y - pointer.y
        const d2 = dx * dx + dy * dy
        if (d2 < PUSH * PUSH && d2 > 0.01) {
          const d = Math.sqrt(d2)
          const f = ((PUSH - d) / PUSH) * 1.1
          n.x += (dx / d) * f
          n.y += (dy / d) * f
        }
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.lineWidth = 1.2
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < LINK) {
            ctx.strokeStyle = `rgba(${INK}, ${(1 - d / LINK) * 0.28})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      for (const n of nodes) {
        if (n.ring) {
          ctx.strokeStyle = `rgba(${INK}, .35)`
          ctx.beginPath()
          ctx.ellipse(n.x, n.y, n.r * 3.2, n.r * 1.3, n.a, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.c
        ctx.fill()
        ctx.strokeStyle = `rgba(${INK}, .85)`
        ctx.stroke()
      }
    }

    const loop = () => {
      step()
      draw()
      raf = requestAnimationFrame(loop)
    }
    const start = () => {
      if (reduce || raf || !onScreen || document.hidden) return
      raf = requestAnimationFrame(loop)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect()
      pointer.x = e.clientX - r.left
      pointer.y = e.clientY - r.top
    }
    const onLeave = () => { pointer.x = -9999; pointer.y = -9999 }
    const onVis = () => (document.hidden ? stop() : start())

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
      onScreen ? start() : stop()
    })
    io.observe(canvas)
    const host = canvas.parentElement
    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVis)
    start()

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return <canvas ref={ref} className={`mfield ${className}`} aria-hidden="true" />
}
