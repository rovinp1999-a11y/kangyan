// Excel-style views of who picked which time: a week grid (days × times) and a
// student × slot matrix, so overlaps are visible at a glance.
import { useMemo, useState } from 'react'
import { WEEKDAYS, WEEKDAYS_SHORT, formatRange, slotLabel } from '../../shared/constants.js'
import { Icon, KIND_SHORT, sortSlots, typeOf, useStored } from './lib.jsx'
import { heat } from './charts.jsx'

const MODES = [['grid', 'Week grid', 'grid'], ['matrix', 'Student list', 'list']]

function NameChip({ r, onOpen }) {
  return (
    <button type="button" className={`sname sname--${typeOf(r)} ${r.status === 'new' ? 'is-new' : ''}`} onClick={() => onOpen(r.id)} title={`${r.student_name} · ${r.level} · ${KIND_SHORT[typeOf(r)]}`}>
      <i />{r.student_name}
    </button>
  )
}

function WeekGrid({ slots, picks, onOpen }) {
  const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => slots.some((s) => s.weekday === d))
  const ranges = [...new Map(slots.map((s) => [`${s.start}-${s.end}`, s])).values()]
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
  const max = Math.max(1, ...[...picks.values()].map((l) => l.length))
  const dayTotal = (d) => slots.filter((s) => s.weekday === d).reduce((n, s) => n + (picks.get(s.id)?.length || 0), 0)

  if (!slots.length) return <div className="adm-empty"><strong>No slots yet</strong>Add slots in the Timetable tab first.</div>
  return (
    <>
      <div className="sgrid-wrap">
        <table className="sgrid">
          <thead>
            <tr>
              <th className="sgrid__corner">Time</th>
              {days.map((d) => <th key={d}>{WEEKDAYS_SHORT[d]}<small>{dayTotal(d)} pick{dayTotal(d) === 1 ? '' : 's'}</small></th>)}
            </tr>
          </thead>
          <tbody>
            {ranges.map((rg) => (
              <tr key={`${rg.start}-${rg.end}`}>
                <th scope="row">{formatRange(rg.start, rg.end)}</th>
                {days.map((d) => {
                  const s = slots.find((x) => x.weekday === d && x.start === rg.start && x.end === rg.end)
                  if (!s) return <td key={d} className="sgrid__none" aria-label="No slot" />
                  const list = picks.get(s.id) || []
                  return (
                    <td key={d} className={`sgrid__cell ${s.status === 'open' ? '' : 'is-taken'}`} style={{ background: heat(list.length, max) }}>
                      <div className="sgrid__top">
                        <b>{list.length || '–'}</b>
                        <span className="bt-kind">{KIND_SHORT[s.kind]}</span>
                        {s.status !== 'open' && <span className="bt-taken">Taken</span>}
                      </div>
                      {list.length > 0 && <div className="sgrid__names">{list.map((r) => <NameChip key={r.id} r={r} onOpen={onOpen} />)}</div>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="skey">
        <span className="skey__scale">Fewer<i style={{ background: heat(1, 4) }} /><i style={{ background: heat(2, 4) }} /><i style={{ background: heat(3, 4) }} /><i style={{ background: heat(4, 4) }} />More people</span>
        <span className="skey__dot skey__dot--private"><i />1-to-1</span>
        <span className="skey__dot skey__dot--group"><i />Group</span>
        <span className="skey__new"><i />Bold = new, not replied yet</span>
      </div>
    </>
  )
}

function Matrix({ people, slots, picks, onOpen }) {
  const [hl, setHl] = useState(null)
  const cols = sortSlots(slots.filter((s) => picks.has(s.id)))
  const flexible = people.filter((r) => !r.preferred_slots.some((p) => p.live))
  if (!people.length) return null
  return (
    <>
      <p className="smatrix__hint">{hl ? 'Showing who picked the highlighted time. Tap it again to clear.' : 'Tap a time at the top to highlight everyone who picked it.'}</p>
      <div className="smatrix-wrap">
        <table className="smatrix">
          <thead>
            <tr>
              <th className="smatrix__corner">Student</th>
              {cols.map((s) => (
                <th key={s.id} className={hl === s.id ? 'is-hl' : ''}>
                  <button type="button" onClick={() => setHl(hl === s.id ? null : s.id)} aria-pressed={hl === s.id}>
                    {WEEKDAYS_SHORT[s.weekday]}<small>{formatRange(s.start, s.end)}</small>
                  </button>
                </th>
              ))}
              <th className="smatrix__flex">Flexible</th>
            </tr>
          </thead>
          <tbody>
            {people.map((r) => {
              const ids = new Set(r.preferred_slots.filter((p) => p.live).map((p) => p.id))
              const t = typeOf(r)
              return (
                <tr key={r.id} className={hl && !ids.has(hl) ? 'is-dim' : ''}>
                  <th scope="row">
                    <button type="button" className="etable__name" onClick={() => onOpen(r.id)}>{r.student_name}</button>
                    <small>{r.level} · {KIND_SHORT[t]}</small>
                  </th>
                  {cols.map((s) => (
                    <td key={s.id} className={hl === s.id ? 'is-hl' : ''}>
                      {ids.has(s.id) && <span className={`mk mk--${t}`} role="img" aria-label={`${r.student_name} picked ${slotLabel(s)}`}><Icon name="check" /></span>}
                    </td>
                  ))}
                  <td>{!ids.size && <span className="mk mk--flex" role="img" aria-label="Flexible on time"><Icon name="check" /></span>}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {cols.map((s) => <td key={s.id} className={hl === s.id ? 'is-hl' : ''}>{picks.get(s.id).length}</td>)}
              <td>{flexible.length}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}

function downloadMatrix(people, slots, picks) {
  const cols = sortSlots(slots.filter((s) => picks.has(s.id)))
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Student', 'Level', 'Class', 'Status', ...cols.map(slotLabel), 'Flexible']
  const lines = people.map((r) => {
    const ids = new Set(r.preferred_slots.filter((p) => p.live).map((p) => p.id))
    return [r.student_name, r.level, KIND_SHORT[typeOf(r)], r.status, ...cols.map((s) => (ids.has(s.id) ? 'Yes' : '')), ids.size ? '' : 'Yes']
  })
  lines.push(['Total', '', '', '', ...cols.map((s) => picks.get(s.id).length), people.filter((r) => !r.preferred_slots.some((p) => p.live)).length])
  const csv = [head, ...lines].map((l) => l.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `kangyan-schedule-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Schedule({ rows, slots, onOpen, notify }) {
  const [mode, setMode] = useStored('kangyan-admin-schedule', 'grid')
  const [kind, setKind] = useState('all')
  const [withClosed, setWithClosed] = useState(false)

  const { people, picks } = useMemo(() => {
    const people = rows
      .filter((r) => (withClosed || r.status !== 'closed') && (kind === 'all' || typeOf(r) === kind))
      .sort((a, b) => (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) || a.student_name.localeCompare(b.student_name))
    const picks = new Map()
    for (const r of people) {
      for (const p of r.preferred_slots) {
        if (!p.live) continue
        if (!picks.has(p.id)) picks.set(p.id, [])
        picks.get(p.id).push(r)
      }
    }
    return { people, picks }
  }, [rows, kind, withClosed])

  const sorted = sortSlots(slots)
  const busiest = [...picks.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  const busiestSlot = busiest && slots.find((s) => s.id === busiest[0])

  return (
    <>
      <div className="adm-filters">
        <div className="viewpick" role="group" aria-label="View">
          {MODES.map(([k, label, icon]) => (
            <button key={k} type="button" className={mode === k ? 'is-on' : ''} aria-pressed={mode === k} onClick={() => setMode(k)}>
              <Icon name={icon} /><span>{label}</span>
            </button>
          ))}
        </div>
        <select className="adm-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Class type">
          <option value="all">All classes</option>
          <option value="private">1-to-1 only</option>
          <option value="group">Group only</option>
        </select>
        <label className="adm-check">
          <input type="checkbox" checked={withClosed} onChange={(e) => setWithClosed(e.target.checked)} />
          Include closed
        </label>
        <div className="adm-filters__end">
          <button type="button" className="icon-btn" disabled={!people.length} onClick={() => { downloadMatrix(people, slots, picks); notify('Schedule exported') }} title="Export the student × time grid as CSV" aria-label="Export CSV">
            <Icon name="download" />
          </button>
        </div>
      </div>

      <p className="adm-showing">
        {people.length} student{people.length === 1 ? '' : 's'} · {picks.size} of {slots.length} slots picked
        {busiestSlot && ` · busiest: ${slotLabel(busiestSlot)} (${busiest[1].length})`}
      </p>

      {!people.length ? (
        <div className="adm-empty">
          <strong>No enquiries to show</strong>
          {rows.length ? 'Try including closed enquiries or another class type.' : 'When students pick times, you will see them here.'}
        </div>
      ) : mode === 'matrix' ? (
        <Matrix people={people} slots={sorted} picks={picks} onOpen={onOpen} />
      ) : (
        <WeekGrid slots={sorted} picks={picks} onOpen={onOpen} />
      )}
    </>
  )
}
