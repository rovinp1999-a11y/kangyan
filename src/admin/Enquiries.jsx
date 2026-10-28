// Enquiry list: cards or table, filters, notes, status, and the side panel.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ENQUIRY_STATUSES, LESSON_TYPE_LABEL, ENQUIRER_LABEL, SUBJECTS } from '../../shared/constants.js'
import {
  Icon, STATUS_META, FORMAT_LABEL, KIND_SHORT, SYSTEM_LABEL, StatusDot, draftMessage, downloadCsv, fullDate, initials, levelSystem, timeAgo, typeOf, useStored, waLink,
} from './lib.jsx'

/* ------------------------------------------------------------------ */
/* status dropdown (popover on desktop, bottom sheet on mobile)        */
/* ------------------------------------------------------------------ */

export function StatusMenu({ value, onChange, name }) {
  const [open, setOpen] = useState(false)
  const btn = useRef(null)
  const items = useRef([])

  useEffect(() => {
    if (!open) return
    items.current[ENQUIRY_STATUSES.indexOf(value)]?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btn.current?.focus()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const n = ENQUIRY_STATUSES.length
        const i = items.current.indexOf(document.activeElement)
        items.current[e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n]?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, value])

  const pick = (s) => {
    setOpen(false)
    btn.current?.focus()
    if (s !== value) onChange(s)
  }

  return (
    <div className={`smenu ${open ? 'is-open' : ''}`} style={{ '--c': STATUS_META[value].color }}>
      <button
        ref={btn}
        type="button"
        className="smenu__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Status for ${name}: ${STATUS_META[value].label}. Change status`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dot" />
        {STATUS_META[value].label}
        <Icon name="chevron" className="chev" />
      </button>

      {open && (
        <>
          <div className="smenu__backdrop" onClick={() => setOpen(false)} />
          <div className="smenu__list" role="listbox" aria-label={`Set status for ${name}`}>
            <p className="smenu__title">Set status · {name}</p>
            {ENQUIRY_STATUSES.map((s, i) => (
              <button
                key={s}
                ref={(el) => { items.current[i] = el }}
                type="button"
                role="option"
                aria-selected={s === value}
                className="smenu__item"
                style={{ '--c': STATUS_META[s].color }}
                onClick={() => pick(s)}
              >
                <span className="dot" />
                {STATUS_META[s].label}
                {s === value && <Icon name="check" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* enquiries                                                           */
/* ------------------------------------------------------------------ */

export function EnquiryCard({ r, onStatus, onNotes, onMakeStudent, notify }) {
  const [more, setMore] = useState(false)
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(r.admin_notes || '')
  useEffect(() => { if (!editing) setNote(r.admin_notes || '') }, [r.admin_notes, editing])
  const saveNote = (value) => {
    setEditing(false)
    if (value.trim() !== (r.admin_notes || '').trim()) onNotes(r.id, value.trim())
  }
  const long = (r.message || '').length > 140 || (r.message || '').split('\n').length > 3
  const subject = encodeURIComponent(`Tuition enquiry — ${r.subjects.join(', ')}`)

  const copyWhat = r.email || r.phone
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyWhat)
      notify(r.email ? 'Email copied' : 'Number copied')
    } catch {
      notify('Could not copy', 'error')
    }
  }

  return (
    <article className={`enq ${r.status === 'closed' ? 'is-closed' : ''}`} style={{ '--c': STATUS_META[r.status].color }}>
      <header className="enq__head">
        <div className="enq__who">
          <span className="enq__avatar" aria-hidden="true">{initials(r.student_name)}</span>
          <div className="enq__id">
            <h3>{r.student_name}</h3>
            <p>
              {r.level} · <time dateTime={r.created_at} title={fullDate(r.created_at)}>{timeAgo(r.created_at)}</time>
            </p>
          </div>
        </div>
        <StatusMenu value={r.status} name={r.student_name} onChange={(s) => onStatus(r.id, s)} />
      </header>

      <div className="enq__tags">
        {r.enquirer && <span className={`tag-e tag-e--${r.enquirer}`}>{ENQUIRER_LABEL[r.enquirer]}</span>}
        <span className={`tag-k tag-k--${r.lesson_type || 'private'}`}>{LESSON_TYPE_LABEL[r.lesson_type] || LESSON_TYPE_LABEL.private}</span>
        {r.subjects.map((s) => <span className="tag-s" key={s}>{s}</span>)}
        <span className="tag-f">{FORMAT_LABEL[r.format] || r.format}</span>
      </div>

      {r.school && (
        <p className="enq__loc enq__school"><Icon name="school" />{r.school}</p>
      )}
      {r.location && (
        <p className="enq__loc"><Icon name="pin" />{r.location}</p>
      )}

      <div className="enq__slots">
        <span className="enq__k">{r.custom_labels.length ? 'Own times' : 'Prefers'}</span>
        {r.custom_labels.map((x) => <span className="slot-chip slot-chip--custom" key={x} title="Suggested by the student for in-person lessons">{x}</span>)}
        {r.custom_labels.length ? null : r.preferred_slots.length
          ? r.preferred_slots.map((s) => (
            <span className={`slot-chip ${s.live ? '' : 'is-gone'}`} key={s.id} title={s.live ? undefined : 'This slot has since been deleted'}>{s.label}</span>
          ))
          : <span className="enq__flex">Flexible on time</span>}
      </div>

      {r.message && (
        <div>
          <p className={`enq__msg ${more ? 'is-open' : ''}`}>{r.message}</p>
          {long && (
            <button type="button" className="enq__more" onClick={() => setMore((m) => !m)}>
              {more ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      <div className="enq__notes">
        {editing ? (
          <textarea
            className="enq__notearea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={(e) => saveNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setNote(r.admin_notes || ''); setEditing(false) } }}
            placeholder="Private note, e.g. trial lesson booked for Tue 7 PM"
            aria-label={`Private note for ${r.student_name}`}
            rows={3}
            maxLength={4000}
            autoFocus
          />
        ) : r.admin_notes ? (
          <button type="button" className="enq__note" onClick={() => setEditing(true)} title="Edit note">
            <Icon name="note" /><span>{r.admin_notes}</span>
          </button>
        ) : (
          <button type="button" className="enq__addnote" onClick={() => setEditing(true)}><Icon name="note" />Add a private note</button>
        )}
      </div>

      <p className="enq__contact">
        {[r.phone, r.email].filter(Boolean).join(' · ')}
      </p>

      <footer className="enq__actions">
        {r.phone && (
          <a className="act act--wa" href={waLink(r.phone, draftMessage(r))} target="_blank" rel="noopener noreferrer" title="Opens WhatsApp with a drafted reply you can edit"><Icon name="chat" />WhatsApp</a>
        )}
        {r.email && <a className="act" href={`mailto:${encodeURIComponent(r.email)}?subject=${subject}&body=${encodeURIComponent(draftMessage(r))}`}><Icon name="mail" />Email</a>}
        {r.phone && <a className="act" href={`tel:${r.phone}`}><Icon name="phone" />Call</a>}
        <button type="button" className="act" onClick={copy}><Icon name="copy" />{r.email ? 'Copy email' : 'Copy number'}</button>
        {onMakeStudent && r.phone && <button type="button" className="act" onClick={() => onMakeStudent(r)} title="Create a student login from this enquiry"><Icon name="users" />Add as student</button>}
      </footer>
    </article>
  )
}

/** One person in a compact list: opens their full enquiry. */
export function Person({ r, onOpen }) {
  const t = typeOf(r)
  return (
    <button type="button" className={`person ${r.status === 'closed' ? 'is-closed' : ''}`} onClick={() => onOpen(r.id)} title={`Open ${r.student_name}`}>
      <span className="dot" style={{ '--c': STATUS_META[r.status].color }} aria-label={STATUS_META[r.status].label} />
      <b>{r.student_name}</b>
      <span className="person__lvl">{r.level}</span>
      <span className={`want want--${t}`}>{KIND_SHORT[t]}</span>
    </button>
  )
}

export function EnquiryTable({ rows, onOpen }) {
  return (
    <div className="etable-wrap">
      <table className="etable">
        <thead>
          <tr><th>Student</th><th>Level</th><th>Class</th><th>Subjects</th><th>Preferred times</th><th>Lessons</th><th>Received</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.status === 'closed' ? 'is-closed' : ''} onClick={() => onOpen(r.id)}>
              <td>
                <button type="button" className="etable__name" onClick={(e) => { e.stopPropagation(); onOpen(r.id) }}>{r.student_name}</button>
                <small>{[ENQUIRER_LABEL[r.enquirer], r.school].filter(Boolean).join(' · ')}</small>
              </td>
              <td>{r.level}</td>
              <td><span className={`want want--${typeOf(r)}`}>{KIND_SHORT[typeOf(r)]}</span></td>
              <td>{r.subjects.join(', ')}</td>
              <td>{r.custom_labels.length ? <>{r.custom_labels.join(', ')}<small>Own times · in person</small></> : r.preferred_slots.length ? r.preferred_slots.map((p) => p.label).join(', ') : <i>Flexible</i>}</td>
              <td>{FORMAT_LABEL[r.format] || r.format}{r.location ? <small>{r.location}</small> : null}</td>
              <td><time dateTime={r.created_at} title={fullDate(r.created_at)}>{timeAgo(r.created_at)}</time></td>
              <td><StatusDot status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const VIEWS = [['cards', 'Cards', 'cards'], ['table', 'Table', 'list']]

export function EnquiriesTab({ rows, actions, onOpen, onMakeStudent, notify, filter, setFilter }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('newest')
  const [kind, setKind] = useState('all')
  const [system, setSystem] = useState('all')
  const [subject, setSubject] = useState('all')
  const [stored, setView] = useStored('kangyan-admin-view', 'cards')
  const view = VIEWS.some(([k]) => k === stored) ? stored : 'cards'

  const counts = useMemo(
    () => Object.fromEntries(ENQUIRY_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length])),
    [rows],
  )

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (kind !== 'all' && typeOf(r) !== kind) return false
      if (system !== 'all' && levelSystem(r.level) !== system) return false
      if (subject !== 'all' && !r.subjects.includes(subject)) return false
      if (!needle) return true
      return [r.student_name, r.email, r.phone, r.level, r.school, r.message, r.location, r.admin_notes, LESSON_TYPE_LABEL[r.lesson_type], ENQUIRER_LABEL[r.enquirer], ...r.subjects, ...r.preferred_slots.map((p) => p.label), ...r.custom_labels]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(needle))
    })
    // New enquiries always come first; within each group, sort by date.
    const t = (r) => new Date(r.created_at).getTime()
    return [...list].sort((a, b) => {
      const an = a.status === 'new' ? 0 : 1
      const bn = b.status === 'new' ? 0 : 1
      if (an !== bn) return an - bn
      return sort === 'newest' ? t(b) - t(a) : t(a) - t(b)
    })
  }, [rows, filter, q, sort, kind, system, subject])

  const filtered = kind !== 'all' || system !== 'all' || subject !== 'all'
  const clear = () => { setKind('all'); setSystem('all'); setSubject('all'); setQ(''); setFilter('all') }

  const tiles = [['all', 'All', rows.length, 'var(--purple)'], ...ENQUIRY_STATUSES.map((s) => [s, STATUS_META[s].label, counts[s], STATUS_META[s].color])]

  return (
    <>
      <div className="adm-stats">
        {tiles.map(([k, label, n, c]) => (
          <button
            key={k}
            type="button"
            className={`adm-stat ${filter === k ? 'is-on' : ''}`}
            style={{ '--c': c }}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            <span className="adm-stat__n">{n}</span>
            <span className="adm-stat__l">{label}</span>
          </button>
        ))}
      </div>

      <div className="adm-tools">
        <label className="adm-search">
          <Icon name="search" />
          <input type="search" placeholder="Search name, school, time, notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search enquiries" />
        </label>
        <button type="button" className="adm-sort" onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))} aria-label={`Sort: ${sort} first`}>
          <Icon name="sort" />
          <span>{sort === 'newest' ? 'Newest' : 'Oldest'}</span>
        </button>
      </div>

      <div className="adm-filters">
        <select className="adm-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Class type">
          <option value="all">All classes</option>
          <option value="private">1-to-1</option>
          <option value="group">Group</option>
        </select>
        <select className="adm-select" value={system} onChange={(e) => setSystem(e.target.value)} aria-label="School system">
          <option value="all">All levels</option>
          {Object.entries(SYSTEM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="adm-select" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
          <option value="all">All subjects</option>
          {SUBJECTS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        {(filtered || q || filter !== 'all') && <button type="button" className="adm-clear" onClick={clear}>Clear</button>}

        <div className="adm-filters__end">
          <div className="viewpick" role="group" aria-label="View">
            {VIEWS.map(([k, label, icon]) => (
              <button key={k} type="button" className={view === k ? 'is-on' : ''} aria-pressed={view === k} onClick={() => setView(k)} title={label}>
                <Icon name={icon} /><span>{label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="icon-btn" onClick={() => { downloadCsv(shown); notify(`Exported ${shown.length} enquir${shown.length === 1 ? 'y' : 'ies'}`) }} title="Export these enquiries as CSV" aria-label="Export CSV" disabled={!shown.length}>
            <Icon name="download" />
          </button>
        </div>
      </div>

      {shown.length > 0 && shown.length !== rows.length && <p className="adm-showing">Showing {shown.length} of {rows.length}</p>}

      {shown.length === 0 ? (
        <div className="adm-empty">
          <strong>{rows.length === 0 ? 'No enquiries yet' : 'Nothing matches'}</strong>
          {rows.length === 0
            ? 'New enquiries from the website will appear here.'
            : 'Try another filter or search term.'}
        </div>
      ) : view === 'table' ? (
        <EnquiryTable rows={shown} onOpen={onOpen} />
      ) : (
        <div className="enq-list">
          {shown.map((r) => <EnquiryCard key={r.id} r={r} onStatus={actions.status} onNotes={actions.notes} onMakeStudent={onMakeStudent} notify={notify} />)}
        </div>
      )}
    </>
  )
}

/** Full enquiry in a side panel, opened from the table, by-time view or timetable. */
export function Drawer({ onClose, children, label }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.smenu.is-open')) onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label={label}>
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel">
        <button type="button" className="icon-btn drawer__close" onClick={onClose} aria-label="Close" autoFocus><Icon name="x" /></button>
        {children}
      </div>
    </div>
  )
}

