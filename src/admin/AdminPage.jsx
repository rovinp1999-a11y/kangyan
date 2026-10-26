import { useCallback, useEffect, useState } from 'react'
import {
  WEEKDAYS, WEEKDAYS_SHORT, ENQUIRY_STATUSES, formatRange,
} from '../../shared/constants.js'

const KEY = 'kangyan-admin-token'
const getToken = () => { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } }
const setToken = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY) } catch {} }

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

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/* ------------------------------------------------------------------ */

function Login({ onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
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
    <form className="card admin__login" onSubmit={submit}>
      <h1>Admin</h1>
      <p className="admin__muted">Manage your weekly availability and read enquiries.</p>
      <div className="field">
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
      </div>
      <button className="btn btn--accent btn--full" disabled={busy}>{busy ? 'Checking…' : 'Log in'}</button>
      {err && <p className="form__note is-error">{err}</p>}
    </form>
  )
}

/* ------------------------------------------------------------------ */

function EnquiriesTab({ onAuthError }) {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('all')
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api('/api/admin/enquiries')
      .then((d) => setRows(d.enquiries))
      .catch((e) => (e.unauthorized ? onAuthError() : setErr(e.message)))
  }, [onAuthError])
  useEffect(load, [load])

  const setStatus = async (id, status) => {
    const prev = rows
    setRows(rows.map((r) => (r.id === id ? { ...r, status } : r)))
    try {
      await api('/api/admin/enquiries', { method: 'PATCH', body: { id, status } })
    } catch (e) {
      setRows(prev)
      e.unauthorized ? onAuthError() : setErr(e.message)
    }
  }

  if (err) return <p className="form__note is-error">{err}</p>
  if (!rows) return <p className="admin__muted">Loading…</p>

  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter)
  const counts = Object.fromEntries(ENQUIRY_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]))

  return (
    <>
      <div className="pills admin__filters">
        <label className={`pill ${filter === 'all' ? 'is-on' : ''}`}>
          <input type="radio" name="f" checked={filter === 'all'} onChange={() => setFilter('all')} />All ({rows.length})
        </label>
        {ENQUIRY_STATUSES.map((s) => (
          <label key={s} className={`pill ${filter === s ? 'is-on' : ''}`}>
            <input type="radio" name="f" checked={filter === s} onChange={() => setFilter(s)} />
            {s} ({counts[s]})
          </label>
        ))}
      </div>

      {shown.length === 0 && <p className="admin__muted">No enquiries here yet.</p>}

      <div className="enq-list">
        {shown.map((r) => (
          <article className={`card enq enq--${r.status}`} key={r.id}>
            <header className="enq__head">
              <div>
                <h3>{r.student_name}</h3>
                <span className="admin__muted">{fmtDate(r.created_at)} · #{r.id}</span>
              </div>
              <select className="status-select" value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} aria-label="Status">
                {ENQUIRY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </header>

            <dl className="enq__meta">
              <div><dt>Contact</dt><dd><a href={`mailto:${r.email}`}>{r.email}</a>{r.phone && <> · <a href={`tel:${r.phone}`}>{r.phone}</a></>}</dd></div>
              <div><dt>Level</dt><dd>{r.level}</dd></div>
              <div><dt>Subjects</dt><dd>{r.subjects.join(', ')}</dd></div>
              <div><dt>Format</dt><dd>{r.format}</dd></div>
              <div>
                <dt>Preferred times</dt>
                <dd>{r.preferred_slots.length ? <div className="chips">{r.preferred_slots.map((s) => <span className="chip" key={s.id}>{s.label}</span>)}</div> : <em>Flexible</em>}</dd>
              </div>
            </dl>
            {r.message && <p className="enq__msg">{r.message}</p>}
          </article>
        ))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

function SlotsTab({ onAuthError }) {
  const [slots, setSlots] = useState(null)
  const [err, setErr] = useState('')
  const [draft, setDraft] = useState({ weekday: '0', start: '16:00', end: '18:00' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetch('/api/slots').then((r) => r.json()).then((d) => setSlots(d.slots || [])).catch(() => setErr('Could not load slots'))
  }, [])
  useEffect(load, [load])

  const run = async (fn) => {
    setErr('')
    try { await fn() } catch (e) { e.unauthorized ? onAuthError() : setErr(e.message) }
  }

  const add = (e) => {
    e.preventDefault()
    setBusy(true)
    run(async () => {
      const d = await api('/api/admin/slots', { method: 'POST', body: { weekday: Number(draft.weekday), start: draft.start, end: draft.end } })
      setSlots((s) => [...s.filter((x) => x.id !== d.slot.id), d.slot].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)))
    }).finally(() => setBusy(false))
  }

  const toggle = (slot) =>
    run(async () => {
      const status = slot.status === 'open' ? 'taken' : 'open'
      const d = await api('/api/admin/slots', { method: 'PATCH', body: { id: slot.id, status } })
      setSlots((s) => s.map((x) => (x.id === slot.id ? d.slot : x)))
    })

  const remove = (slot) => {
    if (!window.confirm(`Delete ${WEEKDAYS_SHORT[slot.weekday]} ${formatRange(slot.start, slot.end)}?`)) return
    run(async () => {
      await api('/api/admin/slots', { method: 'DELETE', body: { id: slot.id } })
      setSlots((s) => s.filter((x) => x.id !== slot.id))
    })
  }

  if (!slots) return <p className="admin__muted">Loading…</p>

  return (
    <>
      <form className="card adm-add" onSubmit={add}>
        <div className="field">
          <label htmlFor="wd">Day</label>
          <select id="wd" value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: e.target.value })}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="st">Start</label>
          <input id="st" type="time" step="900" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} required />
        </div>
        <div className="field">
          <label htmlFor="en">End</label>
          <input id="en" type="time" step="900" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} required />
        </div>
        <button className="btn btn--accent" disabled={busy}>{busy ? 'Adding…' : 'Add slot'}</button>
      </form>
      {err && <p className="form__note is-error">{err}</p>}

      <div className="adm-week">
        {WEEKDAYS.map((name, d) => {
          const day = slots.filter((s) => s.weekday === d)
          return (
            <section className="card adm-day" key={d}>
              <h3>{name}</h3>
              {day.length === 0 && <p className="admin__muted">No slots</p>}
              {day.map((s) => (
                <div className={`adm-slot ${s.status === 'taken' ? 'is-taken' : ''}`} key={s.id}>
                  <span className="adm-slot__time">{formatRange(s.start, s.end)}</span>
                  <button type="button" className={`tag tag--${s.status}`} onClick={() => toggle(s)} title="Click to toggle">
                    {s.status}
                  </button>
                  <button type="button" className="adm-slot__del" aria-label="Delete slot" onClick={() => remove(s)}>×</button>
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => !!getToken())
  const [tab, setTab] = useState('enquiries')
  const logout = useCallback(() => { setToken(''); setAuthed(false) }, [])

  useEffect(() => { document.title = 'Admin — Kangyan' }, [])

  return (
    <div className="admin">
      <header className="admin__top">
        <div className="container admin__bar">
          <a href="/" className="nav__logo">Kangyan<span className="dot" aria-hidden="true"></span> <small>admin</small></a>
          {authed && (
            <nav className="tabs" aria-label="Admin sections">
              <button className={tab === 'enquiries' ? 'is-on' : ''} onClick={() => setTab('enquiries')}>Enquiries</button>
              <button className={tab === 'slots' ? 'is-on' : ''} onClick={() => setTab('slots')}>Availability</button>
              <button className="tabs__out" onClick={logout}>Log out</button>
            </nav>
          )}
        </div>
      </header>

      <main className="container admin__main">
        {!authed ? (
          <Login onDone={() => setAuthed(true)} />
        ) : tab === 'enquiries' ? (
          <EnquiriesTab onAuthError={logout} />
        ) : (
          <SlotsTab onAuthError={logout} />
        )}
      </main>
    </div>
  )
}
