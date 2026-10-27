import { useEffect, useRef } from 'react'

// First screen on every new visit: pick English or 中文 before the enquiry starts.
// Written in both languages because nothing has been chosen yet.
export default function LanguageGate({ onPick, current }) {
  const first = useRef(null)
  useEffect(() => { first.current?.focus({ preventScroll: true }) }, [])

  const options = [
    { code: 'en', label: 'English', sub: 'Continue in English', lang: 'en' },
    { code: 'zh', label: '中文', sub: '使用中文继续', lang: 'zh-Hans' },
  ]
  // Offer the browser's likely language first.
  if (current === 'zh') options.reverse()

  return (
    <section className="gate" aria-labelledby="gate-title">
      <div className="gate__card">
        <p className="eyebrow"><span className="pulse" aria-hidden="true" />UEC · SPM · IGCSE</p>
        <h2 id="gate-title" className="gate__title">
          <span lang="en">Welcome!</span> <span lang="zh-Hans">欢迎！</span>
        </h2>
        <p className="gate__sub">
          <span lang="en">Choose your language</span>
          <span className="gate__dot" aria-hidden="true">·</span>
          <span lang="zh-Hans">请选择语言</span>
        </p>
        <div className="gate__opts">
          {options.map((o, i) => (
            <button
              type="button"
              key={o.code}
              ref={i === 0 ? first : undefined}
              className={`gate__opt gate__opt--${o.code}`}
              lang={o.lang}
              onClick={() => onPick(o.code)}
            >
              <span className="gate__label">{o.label}</span>
              <span className="gate__hint">{o.sub}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14 M13 6l6 6-6 6" /></svg>
            </button>
          ))}
        </div>
        <p className="gate__note">
          <span lang="en">You can switch any time at the top.</span>{' '}
          <span lang="zh-Hans">之后也可以在上方切换。</span>
        </p>
      </div>
    </section>
  )
}
