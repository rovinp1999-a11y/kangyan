// Lightweight, dependency-free confetti burst (brand-coloured).
const COLORS = ['#7C3AED', '#2563EB', '#10B981', '#FACC15', '#15121C']

export function confettiBurst(x, y) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999'
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const parts = Array.from({ length: 110 }, () => {
    const ang = Math.random() * Math.PI * 2
    const sp = 4 + Math.random() * 8
    return {
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 7,
      g: 0.16 + Math.random() * 0.12,
      size: 6 + Math.random() * 8,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      life: 0,
      ttl: 90 + Math.random() * 50,
    }
  })

  let raf
  const tick = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    let alive = false
    for (const p of parts) {
      if (p.life > p.ttl) continue
      alive = true
      p.life++
      p.vy += p.g
      p.vx *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.ttl)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    }
    if (alive) raf = requestAnimationFrame(tick)
    else {
      cancelAnimationFrame(raf)
      canvas.remove()
    }
  }
  tick()
}
