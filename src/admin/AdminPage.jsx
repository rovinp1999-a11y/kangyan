import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  WEEKDAYS, WEEKDAYS_SHORT, ENQUIRY_STATUSES, FORMATS, LESSON_TYPE_LABEL, SLOT_KINDS, SLOT_KIND_LABEL, LEVEL_GROUPS, ENQUIRER_LABEL, SUBJECTS, formatRange, slotLabel,
} from '../../shared/constants.js'
import { STRINGS, shortRange } from '../i18n.jsx'

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
  ['17:30', '19:00'], ['19:00', '20:30'], ['20:30', '22:00'],
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
function waLink(phone, text = '') {
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2) // 0060… international prefix
  else if (d.startsWith('0')) d = `60${d.slice(1)}` // 012… local number
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** Drafted first reply for an enquiry, in the language the enquiry was sent in. */
export function draftMessage(r) {
  const zh = r.lang === 'zh'
  const L = STRINGS[zh ? 'zh' : 'en'].labels
  const name = r.student_name.trim()
  const first = zh ? name : name.split(/\s+/)[0]
  const group = LEVEL_GROUPS.find((g) => g.levels.includes(r.level))?.key
  const level = zh
    ? `${L.levels[r.level] || r.level}${{ uec: '（独中）', kssm: '（国中）', igcse: '（IGCSE）' }[group] || ''}`
    : `${L.levels[r.level] || r.level}${{ uec: ' (UEC)', igcse: ' (IGCSE)' }[group] || ''}`
  const subjects = r.subjects.map((x) => (zh ? L.subjects[x] : x) || x).join(zh ? '、' : ', ')
  const slots = (r.preferred_slots || []).map((x) =>
    x.weekday != null && x.start && x.end ? `${L.weekdaysShort[x.weekday]} ${shortRange(x.start, x.end, zh ? 'zh' : 'en')}` : x.label)
  const times = slots.length ? slots.join(zh ? '、' : ', ') : zh ? '时间都可以' : 'Flexible'
  const type = zh ? (r.lesson_type === 'group' ? '小组课' : '一对一私人课') : LESSON_TYPE_LABEL[r.lesson_type] || LESSON_TYPE_LABEL.private
  const fmt = L.formats[r.format] || L.formats.either
  const where = r.location ? (zh ? `（${r.location}）` : ` (${r.location})`) : ''

  if (zh) {
    return [
      r.enquirer === 'parent'
        ? `你好！我是 Kangyan，教理科和数学的补习老师。谢谢你帮${first}留下补习资料。`
        : r.enquirer === 'student'
          ? `${first}你好！我是 Kangyan，教理科和数学的补习老师。谢谢你留下补习资料。`
          : `你好！我是 Kangyan，教理科和数学的补习老师。谢谢你留下${first}的补习资料。`,
      '',
      '我这边收到的是：',
      `• ${type}`,
      `• ${level}`,
      `• 科目：${subjects}`,
      `• 偏好时间：${times}`,
      `• 上课方式：${fmt}${where}`,
      '',
      '想跟你确认一下上课时间，顺便说明学费。请问什么时候方便聊聊？',
    ].join('\n')
  }
  return [
    r.enquirer === 'student'
      ? `Hi ${first}, this is Kangyan, the Science and Maths tutor. Thanks for your enquiry about tuition!`
      : `Hi, this is Kangyan, the Science and Maths tutor. Thanks for your enquiry about tuition for ${first}!`,
    '',
    "Here's a quick summary of what you sent:",
    `• Class: ${type}`,
    `• Level: ${level}`,
    `• Subject${r.subjects.length > 1 ? 's' : ''}: ${subjects}`,
    `• Preferred time${slots.length > 1 ? 's' : ''}: ${times}`,
    `• Lessons: ${fmt}${where}`,
    '',
    "I'd be happy to arrange a time for the first lesson and let you know the fees. When would be a good time to chat?",
  ].join('\n')
}

const levelSystem = (level) => LEVEL_GROUPS.find((g) => g.levels.includes(level))?.key || 'other'
const SYSTEM_LABEL = { uec: 'UEC', kssm: 'SPM', igcse: 'IGCSE', other: 'Other' }
const typeOf = (r) => (r.lesson_type === 'group' ? 'group' : 'private')

/** Remembered per browser (view mode etc.). Storage can be blocked, so never rely on it. */
function useStored(key, initial) {
  const [v, setV] = useState(() => { try { return localStorage.getItem(key) || initial } catch { return initial } })
  const set = (next) => { setV(next); try { localStorage.setItem(key, next) } catch { /* ignore */ } }
  return [v, set]
}

/** Download the given enquiries as a spreadsheet-friendly CSV. */
function downloadCsv(rows) {
  const cols = [
    ['Received', (r) => fullDate(r.created_at)],
    ['Status', (r) => STATUS_META[r.status].label],
    ['Student', (r) => r.student_name],
    ['Enquirer', (r) => ENQUIRER_LABEL[r.enquirer] || ''],
    ['Level', (r) => r.level],
    ['School', (r) => r.school],
    ['Class', (r) => LESSON_TYPE_LABEL[typeOf(r)]],
    ['Subjects', (r) => r.subjects.join(', ')],
    ['Preferred times', (r) => r.preferred_slots.map((p) => p.label).join(', ') || 'Flexible'],
    ['Lessons', (r) => FORMAT_LABEL[r.format] || r.format],
    ['Location', (r) => r.location],
    ['WhatsApp', (r) => r.phone],
    ['Email', (r) => r.email],
    ['Message', (r) => r.message],
    ['My notes', (r) => r.admin_notes],
  ]
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.map(([h]) => cell(h)), ...rows.map((r) => cols.map(([, f]) => cell(f(r))))].map((l) => l.join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `kangyan-enquiries-${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
  school: 'M3 9l9-5 9 5-9 5-9-5z M7 11.2V16c0 1.4 2.2 3 5 3s5-1.6 5-3v-4.8',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  x: 'M18 6L6 18 M6 6l12 12',
  note: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z M14 3v6h6 M8 13h8 M8 17h5',
  edit: 'M12 20h9 M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  cards: 'M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2',
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

function EnquiryCard({ r, onStatus, onNotes, notify }) {
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
        <span className="enq__k">Prefers</span>
        {r.preferred_slots.length
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
      </footer>
    </article>
  )
}

function StatusDot({ status }) {
  return <span className="st" style={{ '--c': STATUS_META[status].color }}><span className="dot" />{STATUS_META[status].label}</span>
}

/** One person in a compact list: opens their full enquiry. */
function Person({ r, onOpen }) {
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

function EnquiryTable({ rows, onOpen }) {
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
              <td>{r.preferred_slots.length ? r.preferred_slots.map((p) => p.label).join(', ') : <i>Flexible</i>}</td>
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

/** Enquiries grouped by the timetable slot they picked: who wants which time. */
function ByTime({ rows, slots, onOpen }) {
  const bySlot = new Map()
  const gone = new Map()
  const flexible = []
  for (const r of rows) {
    if (!r.preferred_slots.length) flexible.push(r)
    for (const p of r.preferred_slots) {
      const m = p.live ? bySlot : gone
      const k = p.live ? p.id : p.label
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(r)
    }
  }
  const days = WEEKDAYS.map((name, d) => ({ name, list: slots.filter((s) => s.weekday === d && bySlot.has(s.id)) })).filter((x) => x.list.length)

  if (!days.length && !gone.size && !flexible.length) return null
  return (
    <div className="bytime">
      {days.map(({ name, list }) => (
        <section className="bt-day" key={name}>
          <h3>{name}</h3>
          {list.map((s) => {
            const people = bySlot.get(s.id)
            const n = (t) => people.filter((r) => typeOf(r) === t).length
            return (
              <div className={`bt-slot ${s.status === 'open' ? '' : 'is-taken'}`} key={s.id}>
                <header>
                  <span className="bt-slot__time">{formatRange(s.start, s.end)}</span>
                  <span className={`bt-kind bt-kind--${s.kind}`}>{SLOT_KIND_LABEL[s.kind]}</span>
                  {s.status !== 'open' && <span className="bt-taken">Taken</span>}
                  <span className="bt-slot__n">
                    {n('private') > 0 && `${n('private')} 1-to-1`}{n('private') > 0 && n('group') > 0 && ' · '}{n('group') > 0 && `${n('group')} group`}
                  </span>
                </header>
                <div className="bt-people">{people.map((r) => <Person key={r.id} r={r} onOpen={onOpen} />)}</div>
              </div>
            )
          })}
        </section>
      ))}
      {gone.size > 0 && (
        <section className="bt-day">
          <h3>Deleted slots</h3>
          {[...gone].map(([label, people]) => (
            <div className="bt-slot is-taken" key={label}>
              <header><span className="bt-slot__time">{label}</span></header>
              <div className="bt-people">{people.map((r) => <Person key={r.id} r={r} onOpen={onOpen} />)}</div>
            </div>
          ))}
        </section>
      )}
      {flexible.length > 0 && (
        <section className="bt-day">
          <h3>Flexible on time</h3>
          <div className="bt-slot">
            <div className="bt-people">{flexible.map((r) => <Person key={r.id} r={r} onOpen={onOpen} />)}</div>
          </div>
        </section>
      )}
    </div>
  )
}

const VIEWS = [['cards', 'Cards', 'cards'], ['table', 'Table', 'list'], ['time', 'By time', 'clock']]

function EnquiriesTab({ rows, slots, actions, onOpen, notify }) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('newest')
  const [kind, setKind] = useState('all')
  const [system, setSystem] = useState('all')
  const [subject, setSubject] = useState('all')
  const [view, setView] = useStored('kangyan-admin-view', 'cards')

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
      return [r.student_name, r.email, r.phone, r.level, r.school, r.message, r.location, r.admin_notes, LESSON_TYPE_LABEL[r.lesson_type], ENQUIRER_LABEL[r.enquirer], ...r.subjects, ...r.preferred_slots.map((p) => p.label)]
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
      ) : view === 'time' ? (
        <ByTime rows={shown} slots={slots} onOpen={onOpen} />
      ) : (
        <div className="enq-list">
          {shown.map((r) => <EnquiryCard key={r.id} r={r} onStatus={actions.status} onNotes={actions.notes} notify={notify} />)}
        </div>
      )}
    </>
  )
}

/** Full enquiry in a side panel, opened from the table, by-time view or timetable. */
function Drawer({ onClose, children, label }) {
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

/* ------------------------------------------------------------------ */
/* timetable                                                           */
/* ------------------------------------------------------------------ */

const KIND_SHORT = { private: '1-to-1', group: 'Group', both: 'Both' }

function SlotsTab({ slots, setSlots, enquiries, onAuthError, notify, onOpen }) {
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
  const [openId, setOpenId] = useState(null)
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
      if (!s.ok) throw new Error(s.error || 'Could not load the timetable')
      setSlots(sortSlots(s.slots))
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

  // Show each picked slot with its current day and time (slots can be edited after
  // the enquiry came in). A slot that no longer exists keeps the label saved with the enquiry.
  const rows = useMemo(() => {
    if (!enquiries || !slots) return null
    const byId = new Map(slots.map((x) => [x.id, x]))
    return enquiries.map((r) => ({
      ...r,
      preferred_slots: (r.preferred_slots || []).map((p) => {
        const cur = byId.get(p.id)
        return cur ? { ...p, weekday: cur.weekday, start: cur.start, end: cur.end, label: slotLabel(cur), live: true } : { ...p, live: false }
      }).sort((a, b) => (a.weekday ?? 9) - (b.weekday ?? 9) || (a.start || '').localeCompare(b.start || '')),
    }))
  }, [enquiries, slots])

  // Optimistic update of one enquiry; on failure only the changed fields roll back.
  const patchEnquiry = useCallback(async (id, change, body, okText) => {
    let old
    setEnquiries((rs) => rs.map((r) => {
      if (r.id !== id) return r
      old = Object.fromEntries(Object.keys(change).map((k) => [k, r[k]]))
      return { ...r, ...change }
    }))
    try {
      await api('/api/admin/enquiries', { method: 'PATCH', body: { id, ...body } })
      notify(okText)
    } catch (e) {
      setEnquiries((rs) => rs.map((r) => (r.id === id ? { ...r, ...old } : r)))
      e.unauthorized ? logout() : notify(e.message, 'error')
    }
  }, [notify, logout])
  const actions = useMemo(() => ({
    status: (id, status) => patchEnquiry(id, { status }, { status }, `Marked as ${STATUS_META[status].label.toLowerCase()}`),
    notes: (id, notes) => patchEnquiry(id, { admin_notes: notes }, { notes }, notes ? 'Note saved' : 'Note removed'),
  }), [patchEnquiry])
  const closeDrawer = useCallback(() => setOpenId(null), [])
  const opened = rows && openId != null ? rows.find((r) => r.id === openId) : null

  const newCount = enquiries ? enquiries.filter((r) => r.status === 'new').length : 0
  const weekAgo = Date.now() - 7 * 864e5
  const weekCount = enquiries ? enquiries.filter((r) => new Date(r.created_at).getTime() > weekAgo).length : 0
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
                  ? `${newCount} new · ${weekCount} in the last 7 days · ${enquiries.length} total`
                  : `${openSlots} open slot${openSlots === 1 ? '' : 's'} across the week`}
              </p>
            </div>
            {tab === 'enquiries' ? (
              <EnquiriesTab rows={rows} slots={slots} actions={actions} onOpen={setOpenId} notify={notify} />
            ) : (
              <SlotsTab slots={slots} setSlots={setSlots} enquiries={rows} onAuthError={logout} notify={notify} onOpen={setOpenId} />
            )}
          </>
        )}
      </main>

      {opened && (
        <Drawer onClose={closeDrawer} label={`Enquiry from ${opened.student_name}`}>
          <EnquiryCard r={opened} onStatus={actions.status} onNotes={actions.notes} notify={notify} />
        </Drawer>
      )}

      {toast && (
        <div key={toast.id} className={`toast ${toast.kind === 'error' ? 'is-error' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  )
}
