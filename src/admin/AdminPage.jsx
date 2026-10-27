import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  WEEKDAYS, WEEKDAYS_SHORT, ENQUIRY_STATUSES, FORMATS, formatRange,
} from '../../shared/constants.js'

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const KEY = 'kangyan-admin-token'
const getToken = () => { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } }
const setToken = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY) } catch { /* ignore */ } }

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    setToken('')
    throw Object.assign(new Error('Session expired — please log in again.'), { unauthorized: true })
  }
  if (!res.ok || !data.ok) throw new Error(data.error || 'Request failed')
  return data
}

const STATUS_META = {
  new: { label: 'New', color: 'var(--yellow)' },
  contacted: { label: 'Contacted', color: 'var(--blue)' },
  confirmed: { label: 'Confirmed', color: 'var(--green)' },
  closed: { label: 'Closed', color: '#A8A3B3' },
}
const FORMAT_LABEL = Object.fromEntries(FORMATS.map((f) => [f.value, f.label]))

const PRESETS = [
  ['16:00', '18:00'], ['18:00', '20:00'], ['20:00', '22:00'],
  ['10:00', '12:00'], ['14:00', '16:00'],
]

const fullDate = (iso) =>
  new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)}m ago`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)}h ago`
  const d = h / 24
  if (d < 7) return `${Math.floor(d)}d ago`
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
}

const initials = (name) =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

/** Malaysian-friendly wa.me link: strips symbols, turns a leading 0 into 60. */
function waLink(phone) {
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('0')) d = `60${d.slice(1)}`
  return `https://wa.me/${d}`
}

const sortSlots = (list) =>
  [...list].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))

/* ------------------------------------------------------------------ */
/* icons                                                               */
/* ------------------------------------------------------------------ */

const ICONS = {
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z',
  calendar: 'M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z M16 2v4 M8 2v4 M3 10h18',
  refresh: 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9',
  mail: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z M22 6l-10 7L2 6',
  chat: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
  phone: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z',
  copy: 'M9 9h11a2 2 0 012 2v9a2 2 0 01-2 2H11a2 2 0 01-2-2z M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35',
  chevron: 'M6 9l6 6 6-6',
  check: 'M20 6L9 17l-5-5',
  trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6',
  sort: 'M3 6h18 M6 12h12 M10 18h4',
  plus: 'M12 5v14 M5 12h14',
}

function Icon({ name, className = '' }) {
  return (
    <svg className={`ic ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* status dropdown (popover on desktop, bottom sheet on mobile)        */
/* ------------------------------------------------------------------ */

function StatusMenu({ value, onChange, name }) {
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
/* login                                                               */
/* ------------------------------------------------------------------ */

function Login({ onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'Login failed')
      setToken(data.token)
      onDone()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="adm-card admin__login" onSubmit={submit}>
      <h1>Welcome back</h1>
      <p>Log in to see enquiries and manage your timetable.</p>
      <div className="field">
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
      </div>
      <button className="btn btn--accent btn--full" disabled={busy}>{busy ? 'Checking…' : 'Log in'}</button>
      {err && <p className="form__note is-error">{err}</p>}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* enquiries                                                           */
/* ------------------------------------------------------------------ */

function EnquiryCard({ r, onStatus, notify }) {
  const [more, setMore] = useState(false)
  const long = (r.message || '').length > 140 || (r.message || '').split('\n').length > 3
  const subject = encodeURIComponent(`Tuition enquiry — ${r.subjects.join(', ')}`)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.email)
      notify('Email copied')
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
        {r.subjects.map((s) => <span className="tag-s" key={s}>{s}</span>)}
        <span className="tag-f">{FORMAT_LABEL[r.format] || r.format}</span>
      </div>

      <div className="enq__slots">
        <span className="enq__k">Prefers</span>
        {r.preferred_slots.length
          ? r.preferred_slots.map((s) => <span className="slot-chip" key={s.id}>{s.label}</span>)
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

      <p className="enq__contact">
        {r.email}{r.phone && <> · {r.phone}</>}
      </p>

      <footer className="enq__actions">
        <a className="act" href={`mailto:${r.email}?subject=${subject}`}><Icon name="mail" />Email</a>
        {r.phone && (
          <a className="act act--wa" href={waLink(r.phone)} target="_blank" rel="noopener noreferrer"><Icon name="chat" />WhatsApp</a>
        )}
        {r.phone && <a className="act" href={`tel:${r.phone}`}><Icon name="phone" />Call</a>}
        <button type="button" className="act" onClick={copy}><Icon name="copy" />Copy email</button>
      </footer>
    </article>
  )
}

function EnquiriesTab({ rows, setRows, onAuthError, notify }) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('newest')

  const counts = useMemo(
    () => Object.fromEntries(ENQUIRY_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length])),
    [rows],
  )

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (!needle) return true
      return [r.student_name, r.email, r.phone, r.level, r.message, ...r.subjects]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(needle))
    })
    return sort === 'newest' ? list : [...list].reverse()
  }, [rows, filter, q, sort])

  const setStatus = async (id, status) => {
    const prev = rows
    setRows(rows.map((r) => (r.id === id ? { ...r, status } : r)))
    try {
      await api('/api/admin/enquiries', { method: 'PATCH', body: { id, status } })
      notify(`Marked as ${STATUS_META[status].label.toLowerCase()}`)
    } catch (e) {
      setRows(prev)
      e.unauthorized ? onAuthError() : notify(e.message, 'error')
    }
  }

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
          <input type="search" placeholder="Search name, email, subject…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search enquiries" />
        </label>
        <button type="button" className="adm-sort" onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))} aria-label={`Sort: ${sort} first`}>
          <Icon name="sort" />
          <span>{sort === 'newest' ? 'Newest' : 'Oldest'}</span>
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="adm-empty">
          <strong>{rows.length === 0 ? 'No enquiries yet' : 'Nothing matches'}</strong>
          {rows.length === 0
            ? 'New enquiries from the website will appear here.'
            : 'Try another filter or search term.'}
        </div>
      ) : (
        <div className="enq-list">
          {shown.map((r) => <EnquiryCard key={r.id} r={r} onStatus={setStatus} notify={notify} />)}
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* timetable                                                           */
/* ------------------------------------------------------------------ */

function SlotsTab({ slots, setSlots, onAuthError, notify }) {
  const [days, setDays] = useState(() => new Set([0]))
  const [start, setStart] = useState('16:00')
  const [end, setEnd] = useState('18:00')
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
      const results = await Promise.all(
        [...days].sort().map((weekday) => api('/api/admin/slots', { method: 'POST', body: { weekday, start, end } })),
      )
      const added = results.map((r) => r.slot)
      setSlots((s) => sortSlots([...s.filter((x) => !added.some((a) => a.id === x.id)), ...added]))
      notify(`Added ${formatRange(start, end)} to ${added.length} day${added.length > 1 ? 's' : ''}`)
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

  return (
    <>
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
        <span className="adm-summary__hint">Tap the switch to mark a slot taken. Changes show on the website instantly.</span>
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
                        <span className="adm-slot__time">{range}</span>
                        <button type="button" role="switch" aria-checked={isOpen} aria-label={`${name} ${range}: ${isOpen ? 'open' : 'taken'}`} className="switch" onClick={() => toggle(s)}>
                          <span className="switch__track"><span className="switch__thumb" /></span>
                          <span className="switch__txt">{isOpen ? 'Open' : 'Taken'}</span>
                        </button>
                        <button type="button" className="icon-btn icon-btn--danger" aria-label={`Delete ${name} ${range}`} onClick={() => remove(s)}>
                          <Icon name="trash" />
                        </button>
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

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => !!getToken())
  const [tab, setTab] = useState('enquiries')
  const [enquiries, setEnquiries] = useState(null)
  const [slots, setSlots] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  // Keep the dashboard out of search results.
  useEffect(() => {
    document.title = 'Admin — Kangyan'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab])

  const notify = useCallback((text, kind = 'ok') => {
    setToast({ text, kind, id: Date.now() })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const logout = useCallback(() => {
    setToken('')
    setAuthed(false)
    setEnquiries(null)
    setSlots(null)
  }, [])

  const load = useCallback(async () => {
    setLoadErr('')
    try {
      const [e, s] = await Promise.all([
        api('/api/admin/enquiries'),
        fetch('/api/slots').then((r) => r.json()),
      ])
      setEnquiries(e.enquiries)
      setSlots(sortSlots(s.slots || []))
      return true
    } catch (err) {
      err.unauthorized ? logout() : setLoadErr(err.message)
      return false
    }
  }, [logout])

  useEffect(() => { if (authed) load() }, [authed, load])

  const refresh = async () => {
    setSpinning(true)
    const ok = await load()
    setSpinning(false)
    if (ok) notify('Up to date')
  }

  const newCount = enquiries ? enquiries.filter((r) => r.status === 'new').length : 0
  const openSlots = slots ? slots.filter((s) => s.status === 'open').length : 0
  const ready = enquiries && slots

  return (
    <div className="admin">
      <header className="admin__top">
        <div className="admin__bar">
          <a href="/" className="admin__logo" aria-label="Back to website">
            Kangyan<span className="dot" aria-hidden="true" /><small>Admin</small>
          </a>

          {authed && (
            <nav className="admin__tabs" aria-label="Admin sections">
              <button type="button" className={tab === 'enquiries' ? 'is-on' : ''} aria-current={tab === 'enquiries' ? 'page' : undefined} onClick={() => setTab('enquiries')}>
                <Icon name="inbox" /><span>Enquiries</span>
                {newCount > 0 && <span className="badge" aria-label={`${newCount} new`}>{newCount}</span>}
              </button>
              <button type="button" className={tab === 'slots' ? 'is-on' : ''} aria-current={tab === 'slots' ? 'page' : undefined} onClick={() => setTab('slots')}>
                <Icon name="calendar" /><span>Timetable</span>
              </button>
            </nav>
          )}

          {authed && (
            <div className="admin__actions">
              <button type="button" className={`icon-btn ${spinning ? 'is-spinning' : ''}`} onClick={refresh} aria-label="Refresh" title="Refresh">
                <Icon name="refresh" />
              </button>
              <button type="button" className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
                <Icon name="logout" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="admin__main">
        {!authed ? (
          <Login onDone={() => setAuthed(true)} />
        ) : loadErr ? (
          <div className="adm-empty">
            <strong>Couldn't load data</strong>
            {loadErr}
            <div><button type="button" className="btn btn--accent adm-retry" onClick={refresh}>Try again</button></div>
          </div>
        ) : !ready ? (
          <div className="adm-skel" aria-busy="true" aria-label="Loading">
            <span /><span /><span />
          </div>
        ) : (
          <>
            <div className="admin__head">
              <h1>{tab === 'enquiries' ? 'Enquiries' : 'Timetable'}</h1>
              <p>
                {tab === 'enquiries'
                  ? `${newCount} new · ${enquiries.length} total`
                  : `${openSlots} open slot${openSlots === 1 ? '' : 's'} across the week`}
              </p>
            </div>
            {tab === 'enquiries' ? (
              <EnquiriesTab rows={enquiries} setRows={setEnquiries} onAuthError={logout} notify={notify} />
            ) : (
              <SlotsTab slots={slots} setSlots={setSlots} onAuthError={logout} notify={notify} />
            )}
          </>
        )}
      </main>

      {toast && (
        <div key={toast.id} className={`toast ${toast.kind === 'error' ? 'is-error' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  )
}
