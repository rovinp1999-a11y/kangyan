// Animated DNA helix used as a section divider. One period is 120 units wide;
// the strip slides left by exactly one period and loops seamlessly.
const P = 120
const AMP = 17
const MID = 28
const PERIODS = 14

function strand(phase) {
  const pts = []
  for (let x = 0; x <= P * PERIODS; x += 6) {
    pts.push(`${x},${(MID + AMP * Math.sin((2 * Math.PI * x) / P + phase)).toFixed(2)}`)
  }
  return `M${pts.join(' L')}`
}

const RUNGS = []
for (let k = 0; k < PERIODS * 4; k++) {
  const x = 15 + k * 30
  const y1 = MID + AMP * Math.sin((2 * Math.PI * x) / P)
  const y2 = MID + AMP * Math.sin((2 * Math.PI * x) / P + Math.PI)
  RUNGS.push({ x, y1, y2, c: k % 2 ? '#FACC15' : '#10B981' })
}
const A = strand(0)
const B = strand(Math.PI)

export default function Helix() {
  return (
    <div className="helix" aria-hidden="true">
      <svg viewBox="0 0 1200 56" preserveAspectRatio="xMidYMid slice">
        <g className="helix__track">
          {RUNGS.map((r) => (
            <line key={r.x} x1={r.x} x2={r.x} y1={r.y1} y2={r.y2} stroke={r.c} strokeWidth="4" strokeLinecap="round" />
          ))}
          <path d={A} fill="none" stroke="#7C3AED" strokeWidth="4" strokeLinecap="round" />
          <path d={B} fill="none" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}
