// Weekly availability: add, edit, open/close slots and see who picked each one.
import { useMemo, useState } from 'react'
import { WEEKDAYS, WEEKDAYS_SHORT, SLOT_KINDS, SLOT_KIND_LABEL, formatRange, slotLabel } from '../../shared/constants.js'
import { Icon, KIND_SHORT, api, sortSlots, typeOf, useStored } from './lib.jsx'
import { AdminCalendar } from './Calendar.jsx'
import { Person } from './Enquiries.jsx'

const PRESETS = [
  ['17:30', '19:00'], ['19:00', '20:30'], ['20:30', '22:00'],
]

/* ------------------------------------------------------------------ */
/* timetable                                                           */
/* ------------------------------------------------------------------ */

export function SlotsTab({ slots, setSlots, enquiries, students = [], requests = [], setStudents, setRequests, refreshSlots, onEditStudent, onAuthError, notify, onOpen }) {
  const [view, setView] = useStored('kangyan-admin-tt-view', 'calendar')
  // Open enquiries (not closed) that picked each slot.
  const interest = useMemo(() => {
    const m = {}
    for (const r of enquiries) {
      if (r.status === 'closed') continue
      for (const p of r.preferred_slots || []) (m[p.id] ||= []).push(r)
    }
    return m
  }, [enquiries])
  const wantCount = (id, t) => (interest[id] || []).filter((r) => typeOf(r) === t).length

  // Editing one slot's day and time in place.
  const [edit, setEdit] = useState(null) // { id, weekday, start, end }
  const [saving, setSaving] = useState(false)
  const saveEdit = async (e) => {
    e.preventDefault()
    const slot = slots.find((x) => x.id === edit.id)
    if (!edit.start || !edit.end || edit.start >= edit.end) return notify('End time must be after start time', 'error')
    if (slot.weekday === edit.weekday && slot.start === edit.start && slot.end === edit.end) return setEdit(null)
    setSaving(true)
    try {
      const { slot: next } = await api('/api/admin/slots', { method: 'PATCH', body: { id: edit.id, weekday: edit.weekday, start: edit.start, end: edit.end } })
      setSlots((list) => sortSlots(list.map((x) => (x.id === next.id ? next : x))))
      setEdit(null)
      const n = (interest[next.id] || []).length
      notify(`Moved to ${slotLabel(next)}${n ? ` · ${n} enquir${n === 1 ? 'y' : 'ies'} now show the new time` : ''}`)
    } catch (err) {
      fail(err)
    } finally {
      setSaving(false)
    }
  }
  const groupWant = enquiries.filter((r) => r.lesson_type === 'group' && r.status !== 'closed').length

  const [days, setDays] = useState(() => new Set([0]))
  const [start, setStart] = useState('17:30')
  const [end, setEnd] = useState('19:00')
  const [kind, setKind] = useState('private')
  const [busy, setBusy] = useState(false)

  const fail = (e) => (e.unauthorized ? onAuthError() : notify(e.message, 'error'))

  const toggleDay = (i) =>
    setDays((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  const add = async (e) => {
    e.preventDefault()
    if (days.size === 0) return notify('Pick at least one day', 'error')
    if (!start || !end || start >= end) return notify('End time must be after start time', 'error')
    setBusy(true)
    try {
      const results = await Promise.allSettled(
        [...days].sort().map((weekday) => api('/api/admin/slots', { method: 'POST', body: { weekday, start, end, kind } })),
      )
      const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.some((r) => r.reason?.unauthorized)) return onAuthError()
      const got = ok.map((r) => r.slot)
      setSlots((s) => sortSlots([...s.filter((x) => !got.some((a) => a.id === x.id)), ...got]))
      const added = ok.filter((r) => !r.existed).length
      const existed = ok.length - added
      const parts = []
      if (added) parts.push(`Added ${SLOT_KIND_LABEL[kind].toLowerCase()} ${formatRange(start, end)} to ${added} day${added > 1 ? 's' : ''}`)
      if (existed) parts.push(`${existed} already existed (left unchanged)`)
      if (failed.length) parts.push(`${failed.length} failed: ${failed[0].reason?.message || 'error'}`)
      notify(parts.join(' · ') || 'Nothing added', failed.length ? 'error' : 'ok')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (slot) => {
    const status = slot.status === 'open' ? 'taken' : 'open'
    setSlots((s) => s.map((x) => (x.id === slot.id ? { ...x, status } : x)))
    try {
      await api('/api/admin/slots', { method: 'PATCH', body: { id: slot.id, status } })
    } catch (err) {
      setSlots((s) => s.map((x) => (x.id === slot.id ? slot : x)))
      fail(err)
    }
  }

  const setSlotKind = async (slot, next) => {
    if (slot.kind === next) return
    setSlots((s) => s.map((x) => (x.id === slot.id ? { ...x, kind: next } : x)))
    try {
      await api('/api/admin/slots', { method: 'PATCH', body: { id: slot.id, kind: next } })
      notify(`${WEEKDAYS_SHORT[slot.weekday]} ${formatRange(slot.start, slot.end)} is now ${SLOT_KIND_LABEL[next].toLowerCase()}`)
    } catch (err) {
      setSlots((s) => s.map((x) => (x.id === slot.id ? slot : x)))
      fail(err)
    }
  }

  const remove = async (slot) => {
    const label = `${WEEKDAYS[slot.weekday]} ${formatRange(slot.start, slot.end)}`
    if (!window.confirm(`Delete ${label}?`)) return
    try {
      await api('/api/admin/slots', { method: 'DELETE', body: { id: slot.id } })
      setSlots((s) => s.filter((x) => x.id !== slot.id))
      notify(`Deleted ${label}`)
    } catch (err) {
      fail(err)
    }
  }

  const openCount = slots.filter((s) => s.status === 'open').length
  const kindCount = (k) => slots.filter((s) => s.kind === k).length

  const viewPick = (
    <div className="viewpick tt-view" role="group" aria-label="View">
      {[['calendar', 'Calendar', 'calendar'], ['slots', 'Weekly slots', 'list']].map(([k, label, icon]) => (
        <button key={k} type="button" className={view === k ? 'is-on' : ''} aria-pressed={view === k} onClick={() => setView(k)}><Icon name={icon} /><span>{label}</span></button>
      ))}
    </div>
  )
  if (view === 'calendar') {
    return (
      <>
        {viewPick}
        <AdminCalendar slots={slots} setSlots={setSlots} students={students} setStudents={setStudents} requests={requests} setRequests={setRequests} refreshSlots={refreshSlots} notify={notify} onAuthError={onAuthError} onEditStudent={onEditStudent} />
      </>
    )
  }

  return (
    <>
      {viewPick}
      <form className="adm-card adm-add" onSubmit={add}>
        <h2 className="adm-add__title"><Icon name="plus" />Add a slot</h2>

        <div className="adm-add__row">
          <span className="adm-add__label">Days</span>
          <div className="daypick">
            {WEEKDAYS_SHORT.map((d, i) => (
              <button key={d} type="button" className={`daypick__b ${days.has(i) ? 'is-on' : ''}`} aria-pressed={days.has(i)} aria-label={WEEKDAYS[i]} onClick={() => toggleDay(i)}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="adm-add__row">
          <span className="adm-add__label">Time</span>
          <div className="adm-add__times">
            <input type="time" step="900" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start time" required />
            <span>to</span>
            <input type="time" step="900" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End time" required />
          </div>
        </div>

        <div className="adm-add__row">
          <span className="adm-add__label">Type</span>
          <div className="kindpick" role="group" aria-label="Class type">
            {SLOT_KINDS.map((k) => (
              <button key={k} type="button" className={`kindpick__b kindpick__b--${k} ${kind === k ? 'is-on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {KIND_SHORT[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="presets" aria-label="Quick times">
          {PRESETS.map(([s, e]) => (
            <button key={s} type="button" className={`preset ${start === s && end === e ? 'is-on' : ''}`} onClick={() => { setStart(s); setEnd(e) }}>
              {formatRange(s, e)}
            </button>
          ))}
        </div>

        <button className="btn btn--accent adm-add__go" disabled={busy}>
          {busy ? 'Adding…' : `Add to ${days.size || 0} day${days.size === 1 ? '' : 's'}`}
        </button>
      </form>

      <div className="adm-summary">
        <span><b>{openCount}</b> open</span>
        <span><b>{slots.length - openCount}</b> taken</span>
        <span><b>{kindCount('private')}</b> 1-to-1</span>
        <span><b>{kindCount('group')}</b> group</span>
        <span><b>{kindCount('both')}</b> both</span>
        <span><b>{groupWant}</b> want group</span>
        <span className="adm-summary__hint">Tap a time to change its day or hours. Set each slot to 1-to-1, Group or Both, and switch it off when it's taken. Under each slot you can see who picked it; tap a name to open their enquiry.</span>
      </div>

      <div className="adm-week">
        {WEEKDAYS.map((name, d) => {
          const day = slots.filter((s) => s.weekday === d)
          const open = day.filter((s) => s.status === 'open').length
          return (
            <section className="adm-day" key={d}>
              <header className="adm-day__head">
                <h3>{name}</h3>
                <span>{day.length ? `${open}/${day.length} open` : ''}</span>
              </header>
              {day.length === 0 ? (
                <p className="adm-day__empty">No slots</p>
              ) : (
                <ul>
                  {day.map((s) => {
                    const isOpen = s.status === 'open'
                    const range = formatRange(s.start, s.end)
                    return (
                      <li className={`adm-slot ${isOpen ? '' : 'is-taken'}`} key={s.id}>
                        {edit?.id === s.id ? (
                          <form className="slot-edit" onSubmit={saveEdit}>
                            <select value={edit.weekday} onChange={(e) => setEdit({ ...edit, weekday: Number(e.target.value) })} aria-label="Day">
                              {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
                            </select>
                            <div className="slot-edit__times">
                              <input type="time" step="900" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} aria-label="Start time" required autoFocus />
                              <span>to</span>
                              <input type="time" step="900" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} aria-label="End time" required />
                            </div>
                            <div className="slot-edit__acts">
                              <button className="btn btn--accent slot-edit__save" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                              <button type="button" className="act" onClick={() => setEdit(null)}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <div className="adm-slot__top">
                            <button type="button" className="adm-slot__time" onClick={() => setEdit({ id: s.id, weekday: s.weekday, start: s.start, end: s.end })} title="Change day or time">
                              {range}<Icon name="edit" />
                            </button>
                            {interest[s.id] && (
                              <span className="adm-slot__want" title="Open enquiries that picked this slot">
                                {wantCount(s.id, 'private') > 0 && <span className="want want--private">{wantCount(s.id, 'private')} 1-to-1</span>}
                                {wantCount(s.id, 'group') > 0 && <span className="want want--group">{wantCount(s.id, 'group')} group</span>}
                              </span>
                            )}
                            <button type="button" className="icon-btn icon-btn--danger" aria-label={`Delete ${name} ${range}`} onClick={() => remove(s)}>
                              <Icon name="trash" />
                            </button>
                          </div>
                        )}
                        {students.some((x) => x.active && (x.lessons || []).some((l) => l.slot_id === s.id)) && (
                          <p className="adm-slot__regular"><Icon name="users" />Regular: {students.filter((x) => x.active && (x.lessons || []).some((l) => l.slot_id === s.id)).map((x) => x.name).join(', ')}</p>
                        )}
                        {interest[s.id] && (
                          <div className="adm-slot__people">
                            {interest[s.id].map((r) => <Person key={r.id} r={r} onOpen={onOpen} />)}
                          </div>
                        )}
                        <div className="adm-slot__ctrls">
                          <div className="kindpick kindpick--sm" role="group" aria-label={`${name} ${range} class type`}>
                            {SLOT_KINDS.map((k) => (
                              <button key={k} type="button" className={`kindpick__b kindpick__b--${k} ${s.kind === k ? 'is-on' : ''}`} aria-pressed={s.kind === k} onClick={() => setSlotKind(s, k)}>
                                {KIND_SHORT[k]}
                              </button>
                            ))}
                          </div>
                          <button type="button" role="switch" aria-checked={isOpen} aria-label={`${name} ${range}: ${isOpen ? 'open' : 'taken'}`} className="switch" onClick={() => toggle(s)}>
                            <span className="switch__track"><span className="switch__thumb" /></span>
                            <span className="switch__txt">{isOpen ? 'Open' : 'Taken'}</span>
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}

