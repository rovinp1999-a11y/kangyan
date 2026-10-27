// Faint science doodles that float behind a section. Decorative only.
const ITEMS = [
  { t: 'π', x: 6, y: 18, s: 2.4, d: 0 },
  { t: 'Σ', x: 88, y: 12, s: 2.2, d: -3 },
  { t: 'Δ', x: 76, y: 70, s: 2, d: -6 },
  { t: '√x', x: 14, y: 78, s: 1.8, d: -2 },
  { t: 'λ', x: 48, y: 8, s: 1.9, d: -5 },
  { t: 'H₂O', x: 92, y: 46, s: 1.4, d: -1 },
  { t: 'CO₂', x: 3, y: 50, s: 1.4, d: -4 },
  { hex: true, x: 62, y: 86, s: 3.2, d: -2.5 },
  { hex: true, x: 30, y: 30, s: 2.4, d: -7 },
]

export default function Doodles() {
  return (
    <div className="doodles" aria-hidden="true">
      {ITEMS.map((it, i) => (
        <span
          key={i}
          className="doodle"
          style={{ left: `${it.x}%`, top: `${it.y}%`, fontSize: `${it.s}rem`, animationDelay: `${it.d}s`, animationDuration: `${9 + (i % 4) * 2}s` }}
        >
          {it.hex ? (
            <svg viewBox="0 0 40 40" width="1em" height="1em">
              <polygon points="20,3 35,11.5 35,28.5 20,37 5,28.5 5,11.5" />
              <circle cx="20" cy="20" r="9" />
            </svg>
          ) : it.t}
        </span>
      ))}
    </div>
  )
}
