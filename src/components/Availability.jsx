import Reveal from './Reveal.jsx'
import { WEEKDAYS, formatRange } from '../../shared/constants.js'

// Weekly availability grid. Students tick the open slots they prefer; the
// selection is passed down to the enquiry form.
export default function Availability({ slots, selected, onToggle, loading, error }) {
  const byDay = WEEKDAYS.map((_, d) => slots.filter((s) => s.weekday === d))
  const count = selected.size

  return (
    <section className="section availability" id="availability" data-spotlight>
      <div className="container">
        <Reveal as="div" className="section-head">
          <div>
            <p className="label" style={{ '--accent': 'var(--yellow)' }}>Weekly Timetable</p>
            <h2 className="section-head__title">Pick the times that suit you.</h2>
          </div>
          <p className="section-sub">
            These are my regular weekly slots. Tick one or more you'd prefer, then send an
            enquiry — I'll confirm the final time with you.
          </p>
        </Reveal>

        {error && <p className="availability__note">Couldn't load the timetable right now. You can still send an enquiry below.</p>}

        <Reveal className="week" aria-busy={loading}>
          {byDay.map((daySlots, d) => (
            <div className="day" key={d}>
              <h3 className="day__name">{WEEKDAYS[d]}</h3>
              <div className="day__list">
                {loading && daySlots.length === 0 && <span className="day__empty">Loading…</span>}
                {!loading && daySlots.length === 0 && <span className="day__empty">No slots</span>}
                {daySlots.map((s) => {
                  const taken = s.status === 'taken'
                  const on = selected.has(s.id)
                  return (
                    <button
                      type="button"
                      key={s.id}
                      className={`slot ${on ? 'is-selected' : ''} ${taken ? 'is-taken' : ''}`}
                      disabled={taken}
                      aria-pressed={on}
                      onClick={() => onToggle(s.id)}
                      title={taken ? 'Already taken' : on ? 'Click to unselect' : 'Click to select'}
                    >
                      <span>{formatRange(s.start, s.end)}</span>
                      <span className="slot__badge">{taken ? 'Taken' : on ? '✓' : 'Open'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </Reveal>

        <Reveal className="availability__bar">
          <div className="availability__legend">
            <span className="lg-open">Open</span>
            <span className="lg-sel">Selected</span>
            <span className="lg-taken">Taken</span>
          </div>
          <div className="availability__cta">
            <span className="availability__count">
              {count === 0 ? 'No slot selected yet — that\'s fine, you can stay flexible.' : `${count} slot${count > 1 ? 's' : ''} selected`}
            </span>
            <a href="#enquire" className="btn btn--accent" data-magnetic>
              Continue to enquiry <span className="arrow">↓</span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
