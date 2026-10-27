import { WEEKDAYS, WEEKDAYS_SHORT, formatRange } from '../../shared/constants.js'

// '16:00','18:00' → '4–6 PM'; '10:00','12:00' → '10 AM–12 PM'; keeps minutes when not :00.
function shortRange(start, end) {
  const part = (t) => {
    const [h, m] = t.split(':').map(Number)
    const h12 = h % 12 === 0 ? 12 : h % 12
    return { t: m ? `${h12}:${String(m).padStart(2, '0')}` : `${h12}`, p: h >= 12 ? 'PM' : 'AM' }
  }
  const a = part(start)
  const b = part(end)
  return a.p === b.p ? `${a.t}–${b.t} ${b.p}` : `${a.t} ${a.p}–${b.t} ${b.p}`
}

// Weekly timetable: one row per day, slots as tappable chips.
export default function Availability({ slots, selected, onToggle, loading, error }) {
  const count = selected.size
  return (
    <div className="panel" id="timetable">
      <h3 className="panel__step"><span>1</span>Pick your times <small>optional</small></h3>

      {error && <p className="tt__note">The timetable didn't load. You can still send an enquiry and I'll suggest times.</p>}

      <div className="tt" aria-busy={loading}>
        {WEEKDAYS_SHORT.map((d, i) => {
          const day = slots.filter((s) => s.weekday === i)
          return (
            <div className="tt__row" key={d}>
              <span className="tt__day" title={WEEKDAYS[i]}>{d}</span>
              <div className="tt__slots">
                {loading ? (
                  <span className="tt__empty">Loading…</span>
                ) : day.length === 0 ? (
                  <span className="tt__empty">No slots</span>
                ) : (
                  day.map((s) => {
                    const taken = s.status === 'taken'
                    const on = selected.has(s.id)
                    return (
                      <button
                        type="button"
                        key={s.id}
                        className={`slot ${on ? 'is-selected' : ''} ${taken ? 'is-taken' : ''}`}
                        disabled={taken}
                        aria-pressed={on}
                        aria-label={`${WEEKDAYS[i]} ${formatRange(s.start, s.end)}${taken ? ', taken' : ''}`}
                        onClick={() => onToggle(s.id)}
                      >
                        {shortRange(s.start, s.end)}
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
        <span>{count ? `${count} time${count > 1 ? 's' : ''} selected` : 'Tap any times that work. Pick as many as you like.'}</span>
        <span className="tt__legend"><i className="lg lg--sel" />Selected <i className="lg lg--taken" />Taken</span>
      </p>
    </div>
  )
}
