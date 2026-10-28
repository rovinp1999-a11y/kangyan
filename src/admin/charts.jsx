// Small chart pieces for the dashboard, built from plain HTML so they stay light.
// Colours: 1-to-1 is purple and group is green everywhere on the site; magnitude
// (how many people picked a time) uses a single yellow ramp.
import { useState } from 'react'

export const SERIES = [
  { key: 'private', label: '1-to-1', color: 'var(--purple)' },
  { key: 'group', label: 'Group', color: 'var(--green)' },
]

/** Hover / focus tooltip that follows the pointer. */
export function useTip() {
  const [tip, setTip] = useState(null)
  const bind = (text) => ({
    onMouseEnter: (e) => setTip({ text, x: e.clientX, y: e.clientY }),
    onMouseMove: (e) => setTip({ text, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setTip(null),
    onFocus: (e) => {
      const r = e.currentTarget.getBoundingClientRect()
      setTip({ text, x: r.left + r.width / 2, y: r.top })
    },
    onBlur: () => setTip(null),
    tabIndex: 0,
    role: 'img',
    'aria-label': text,
  })
  return [tip, bind]
}

export function Tip({ tip }) {
  if (!tip) return null
  return <div className="ctip" role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>
}

export function Legend() {
  return (
    <div className="clegend">
      {SERIES.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
    </div>
  )
}

/** Horizontal bars split into 1-to-1 and group. rows: [{ label, sub?, private, group }] */
export function StackBars({ rows, empty }) {
  const [tip, bind] = useTip()
  if (!rows.length) return <p className="cempty">{empty}</p>
  const max = Math.max(1, ...rows.map((r) => r.private + r.group))
  return (
    <div className="sbars">
      {rows.map((r) => {
        const total = r.private + r.group
        return (
          <div className="sbar" key={r.label}>
            <span className="sbar__label">{r.label}{r.sub && <small>{r.sub}</small>}</span>
            <span className="sbar__track">
              <span className="sbar__fill" style={{ width: `${(total / max) * 100}%` }}>
                {SERIES.map((s) => r[s.key] > 0 && (
                  <span key={s.key} className="sbar__seg" style={{ flexGrow: r[s.key], background: s.color }} {...bind(`${r.label}: ${r[s.key]} ${s.label}`)} />
                ))}
              </span>
            </span>
            <b className="sbar__n">{total}</b>
          </div>
        )
      })}
      <Tip tip={tip} />
    </div>
  )
}

/** Vertical columns for a count over time. data: [{ key, label, value, title }] */
export function Columns({ data }) {
  const [tip, bind] = useTip()
  const max = Math.max(1, ...data.map((d) => d.value))
  const H = 140
  return (
    <div className="cols">
      <div className="cols__plot" style={{ height: H + 22 }}>
        {data.map((d) => (
          <div className="cols__band" key={d.key} {...bind(d.title)}>
            {d.value > 0 && <span className="cols__v">{d.value}</span>}
            <span className="cols__bar" style={{ height: d.value ? Math.max(4, (d.value / max) * H) : 0 }} />
          </div>
        ))}
      </div>
      <div className="cols__axis">{data.map((d) => <span key={d.key}>{d.label}</span>)}</div>
      <Tip tip={tip} />
    </div>
  )
}

/** One bar split by share, with a labelled legend underneath. parts: [{ key, label, value, color }] */
export function ShareBar({ parts, empty }) {
  const [tip, bind] = useTip()
  const total = parts.reduce((n, p) => n + p.value, 0)
  if (!total) return <p className="cempty">{empty}</p>
  return (
    <div className="share">
      <div className="share__bar">
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.key} style={{ flexGrow: p.value, background: p.color }} {...bind(`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`)} />
        ))}
      </div>
      <ul className="share__legend">
        {parts.map((p) => (
          <li key={p.key}><i style={{ background: p.color }} />{p.label}<b>{p.value}</b></li>
        ))}
      </ul>
      <Tip tip={tip} />
    </div>
  )
}

/** Yellow ramp for "how many people": 0 → white, max → full accent. */
export const heat = (n, max) => (n ? `rgba(250, 204, 21, ${0.18 + 0.62 * (n / Math.max(1, max))})` : undefined)
