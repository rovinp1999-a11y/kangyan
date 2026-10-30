// At-a-glance numbers and charts: how many enquiries, which times and levels are in demand.
import { useMemo } from 'react'
import { LEVELS, SUBJECTS, SLOT_KIND_LABEL, slotLabel } from '../../shared/constants.js'
import { STATUS_META, FORMAT_LABEL, timeAgo, typeOf } from './lib.jsx'
import { Columns, Legend, ShareBar, StackBars } from './charts.jsx'
import { sameTimeGroups } from './Schedule.jsx'

const DAY = 864e5
const mondayOf = (t) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}
const short = (t) => new Date(t).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })

function Card({ title, sub, children, wide, legend }) {
  return (
    <section className={`ov-card ${wide ? 'ov-card--wide' : ''}`}>
      <header className="ov-card__head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {legend && <Legend />}
      </header>
      {children}
    </section>
  )
}

export function Overview({ rows, slots, onOpen, go }) {
  const data = useMemo(() => {
    const open = rows.filter((r) => r.status !== 'closed')
    const tally = (list, keyOf) => {
      const m = new Map()
      for (const r of list) {
        for (const k of [].concat(keyOf(r))) {
          const c = m.get(k) || { private: 0, group: 0 }
          c[typeOf(r)]++
          m.set(k, c)
        }
      }
      return m
    }

    // Enquiries per week, last 8 weeks (Monday to Sunday).
    const thisWeek = mondayOf(Date.now())
    const weeks = Array.from({ length: 8 }, (_, i) => thisWeek - (7 - i) * 7 * DAY)
    const perWeek = weeks.map((w) => {
      const n = rows.filter((r) => { const t = new Date(r.created_at).getTime(); return t >= w && t < w + 7 * DAY }).length
      return { key: w, label: `${new Date(w).getDate()}/${new Date(w).getMonth() + 1}`, value: n, title: `Week of ${short(w)}: ${n} enquir${n === 1 ? 'y' : 'ies'}` }
    })

    const bySlot = tally(open, (r) => r.preferred_slots.filter((p) => p.live).map((p) => p.id))
    const slotRows = slots
      .filter((s) => bySlot.has(s.id))
      .map((s) => ({ label: slotLabel(s), sub: s.status === 'taken' ? 'Taken' : SLOT_KIND_LABEL[s.kind], ...bySlot.get(s.id) }))
      .sort((a, b) => b.private + b.group - (a.private + a.group))
      .slice(0, 8)

    const byLevel = tally(open, (r) => r.level)
    const levelRows = LEVELS.filter((l) => byLevel.has(l)).map((l) => ({ label: l, ...byLevel.get(l) }))
    const bySubject = tally(open, (r) => r.subjects)
    const subjectRows = SUBJECTS.filter((x) => bySubject.has(x)).map((x) => ({ label: x, ...bySubject.get(x) }))
    const byFormat = tally(open, (r) => r.format)
    const formatRows = ['online', 'in-person', 'either'].filter((f) => byFormat.has(f)).map((f) => ({ label: FORMAT_LABEL[f], ...byFormat.get(f) }))

    const status = ['new', 'contacted', 'confirmed', 'closed'].map((k) => ({ key: k, label: STATUS_META[k].label, value: rows.filter((r) => r.status === k).length, color: STATUS_META[k].color }))
    const waiting = rows.filter((r) => r.status === 'new').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const flexible = open.filter((r) => !r.preferred_slots.length && !r.custom_times.length).length

    // Times where 2+ open enquiries at the same stage overlap: candidate group classes.
    const picks = new Map()
    for (const r of open) for (const p of r.preferred_slots) if (p.live) picks.set(p.id, [...(picks.get(p.id) || []), r])
    const ideas = sameTimeGroups(slots, picks)
      .flatMap((g) => g.groups.map((x) => ({ slot: g.slot, ...x })))
      .sort((a, b) => b.people.length - a.people.length)

    return {
      perWeek, slotRows, ideas, levelRows, subjectRows, formatRows, status, waiting, flexible,
      kpi: {
        total: rows.length,
        newCount: waiting.length,
        week: rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * DAY).length,
        group: open.filter((r) => typeOf(r) === 'group').length,
        priv: open.filter((r) => typeOf(r) === 'private').length,
        confirmed: rows.filter((r) => r.status === 'confirmed').length,
      },
    }
  }, [rows, slots])

  const { kpi } = data
  const tiles = [
    ['Total enquiries', kpi.total, 'all time', () => go('enquiries')],
    ['Waiting for a reply', kpi.newCount, 'status: new', () => go('enquiries', 'new')],
    ['Last 7 days', kpi.week, 'new enquiries', null],
    ['Want 1-to-1', kpi.priv, 'open enquiries', null],
    ['Want group', kpi.group, 'open enquiries', null],
    ['Confirmed', kpi.confirmed, 'students', () => go('enquiries', 'confirmed')],
  ]

  return (
    <div className="ov">
      <div className="ov-kpis">
        {tiles.map(([label, n, sub, onClick]) => {
          const Tag = onClick ? 'button' : 'div'
          return (
            <Tag key={label} className={`ov-kpi ${onClick ? 'is-link' : ''}`} {...(onClick ? { type: 'button', onClick } : {})}>
              <span className="ov-kpi__l">{label}</span>
              <span className="ov-kpi__n">{n}</span>
              <span className="ov-kpi__s">{sub}</span>
            </Tag>
          )
        })}
      </div>

      <div className="ov-grid">
        <Card title="Group class ideas" sub="Same time, same subject and same level" wide>
          {data.ideas.length ? (
            <ul className="ov-ideas">
              {data.ideas.slice(0, 6).map((g) => (
                <li key={`${g.slot.id}-${g.level}-${g.subject}`}>
                  <button type="button" onClick={() => go('schedule')}>
                    <span className="ov-ideas__n">{g.people.length}</span>
                    <span className="ov-ideas__body">
                      <b>{g.level} · {g.subject}</b>
                      <span>{slotLabel(g.slot)}</span>
                      <small>{g.people.map((r) => r.student_name).join(', ')}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="cempty">No matches yet. When 2 or more students at the same level pick the same time for the same subject, they appear here.</p>}
          {data.ideas.length > 0 && <button type="button" className="ov-link" onClick={() => go('schedule')}>See every shared time →</button>}
        </Card>

        <Card title="Enquiries per week" sub="Last 8 weeks, Monday to Sunday">
          <Columns data={data.perWeek} />
        </Card>

        <Card title="Waiting for a reply" sub={data.waiting.length ? 'Oldest first' : undefined}>
          {data.waiting.length ? (
            <ul className="ov-wait">
              {data.waiting.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => onOpen(r.id)}>
                    <b>{r.student_name}</b>
                    <span>{r.level} · {typeOf(r) === 'group' ? 'Group' : '1-to-1'}</span>
                    <time dateTime={r.created_at}>{timeAgo(r.created_at)}</time>
                  </button>
                </li>
              ))}
              {data.waiting.length > 6 && <li className="ov-wait__more"><button type="button" onClick={() => go('enquiries', 'new')}>See all {data.waiting.length}</button></li>}
            </ul>
          ) : <p className="cempty">All caught up. Nothing waiting.</p>}
        </Card>

        <Card title="Most wanted times" sub={`Open enquiries per slot${data.flexible ? ` · ${data.flexible} flexible on time` : ''}`} legend wide>
          <StackBars rows={data.slotRows} empty="No one has picked a time yet." />
          <button type="button" className="ov-link" onClick={() => go('schedule')}>Open the full schedule grid →</button>
        </Card>

        <Card title="Levels" sub="Open enquiries" legend>
          <StackBars rows={data.levelRows} empty="No open enquiries yet." />
        </Card>

        <Card title="Subjects" sub="Open enquiries · a student can pick several" legend>
          <StackBars rows={data.subjectRows} empty="No open enquiries yet." />
        </Card>

        <Card title="Progress" sub="Every enquiry by status">
          <ShareBar parts={data.status} empty="No enquiries yet." />
        </Card>

        <Card title="Online or in person" sub="Open enquiries" legend>
          <StackBars rows={data.formatRows} empty="No open enquiries yet." />
        </Card>
      </div>
    </div>
  )
}
