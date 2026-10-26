// 6 words (even count) duplicated → seamless -50% loop with a consistent
// alternating filled/outlined rhythm via :nth-child(even) in CSS.
const WORDS = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Science', 'SPM · IGCSE']

export default function Marquee() {
  const loop = [...WORDS, ...WORDS]
  return (
    <div className="marquee" role="presentation" aria-hidden="true">
      <div className="marquee__track">
        {loop.map((w, i) => (
          <span className="marquee__item" key={i}>
            {w} <span className="sep">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}
