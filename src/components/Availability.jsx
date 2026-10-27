import { useLang, shortRange } from '../i18n.jsx'

// Weekly timetable: one row per day, slots as tappable chips.
export default function Availability({ slots, selected, onToggle, loading, error }) {
  const { t, lang } = useLang()
  const L = t.labels
  const count = selected.size
  return (
    <div className="panel" id="timetable">
      <h3 className="panel__step"><span>1</span>{t.tt.title} <small>{t.tt.optional}</small></h3>

      {error && <p className="tt__note">{t.tt.error}</p>}

      <div className="tt" aria-busy={loading}>
        {L.weekdaysShort.map((d, i) => {
          const day = slots.filter((s) => s.weekday === i)
          return (
            <div className="tt__row" key={i}>
              <span className="tt__day" title={L.weekdays[i]}>{d}</span>
              <div className="tt__slots">
                {loading ? (
                  <span className="tt__empty">{t.tt.loading}</span>
                ) : day.length === 0 ? (
                  <span className="tt__empty">{t.tt.none}</span>
                ) : (
                  day.map((s) => {
                    const taken = s.status === 'taken'
                    const on = selected.has(s.id)
                    const label = shortRange(s.start, s.end, lang)
                    return (
                      <button
                        type="button"
                        key={s.id}
                        className={`slot ${on ? 'is-selected' : ''} ${taken ? 'is-taken' : ''}`}
                        disabled={taken}
                        aria-pressed={on}
                        aria-label={`${L.weekdays[i]} ${label}${taken ? `, ${t.tt.taken}` : ''}`}
                        onClick={() => onToggle(s.id)}
                      >
                        {label}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="tt__foot">
        <span>{count ? t.tt.selected(count) : t.tt.hint}</span>
        <span className="tt__legend"><i className="lg lg--sel" />{t.tt.legendSel} <i className="lg lg--taken" />{t.tt.legendTaken}</span>
      </p>
    </div>
  )
}
