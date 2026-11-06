// A time ('HH:MM') picked like a phone clock: hour, minute (any minute) and AM / PM dropdowns.
const pad = (n) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const HALF = { en: ['AM', 'PM'], zh: ['上午', '下午'] }

export default function TimeSelect({ value, onChange, label, lang = 'en', disabled, className = '' }) {
  const [h, m] = (value || '00:00').split(':').map(Number)
  const pm = h >= 12
  const set = (hour12, minute, isPm) => onChange(`${pad((hour12 % 12) + (isPm ? 12 : 0))}:${pad(minute)}`)
  const half = HALF[lang] || HALF.en
  return (
    <span className={`tsel ${className}`} role="group" aria-label={label}>
      <select value={h % 12 || 12} onChange={(e) => set(Number(e.target.value), m, pm)} aria-label={`${label}: hour`} disabled={disabled}>
        {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="tsel__sep" aria-hidden="true">:</span>
      <select value={m} onChange={(e) => set(h % 12 || 12, Number(e.target.value), pm)} aria-label={`${label}: minute`} disabled={disabled}>
        {MINUTES.map((x) => <option key={x} value={x}>{pad(x)}</option>)}
      </select>
      <select value={pm ? 'pm' : 'am'} onChange={(e) => set(h % 12 || 12, m, e.target.value === 'pm')} aria-label={`${label}: AM or PM`} disabled={disabled}>
        <option value="am">{half[0]}</option>
        <option value="pm">{half[1]}</option>
      </select>
    </span>
  )
}
