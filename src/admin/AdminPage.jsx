import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WEEKDAYS_SHORT, formatRange, slotLabel } from '../../shared/constants.js'
import { Icon, STATUS_META, api, getToken, setToken, sortSlots } from './lib.jsx'
import { EnquiriesTab, EnquiryCard, EnquiryForm, Drawer } from './Enquiries.jsx'
import { SlotsTab } from './Timetable.jsx'
import { AdminCalendar } from './Calendar.jsx'
import { Overview } from './Overview.jsx'
import { Schedule } from './Schedule.jsx'
import { FeesTab } from './Fees.jsx'
import { AnnouncementsTab } from './Announcements.jsx'
import { TemplatesTab } from './TemplatesTab.jsx'
import { setSavedTemplates } from './templates.js'
import { feeState } from '../../shared/schedule.js'
import { todayMY } from '../../shared/lessons.js'
import { StudentsTab, formFromStudent } from './Students.jsx'

// Sidebar sections. On phones the bottom bar shows the `bar` tabs and a More menu for the rest.
const GROUPS = [
  { label: null, tabs: [{ key: 'overview', label: 'Overview', icon: 'chart', bar: true }] },
  { label: 'New enquiries', tabs: [
    { key: 'enquiries', label: 'Enquiries', icon: 'inbox', bar: true },
    { key: 'schedule', label: 'Group ideas', icon: 'grid' },
    { key: 'slots', label: 'Enquiry slots', icon: 'clock' },
  ] },
  { label: 'My students', tabs: [
    { key: 'students', label: 'Students', icon: 'users', bar: true },
    { key: 'calendar', label: 'My calendar', short: 'Calendar', icon: 'calendar', bar: true },
    { key: 'fees', label: 'Fees', icon: 'cash' },
    { key: 'news', label: 'Announcements', icon: 'megaphone' },
  ] },
  { label: 'Settings', tabs: [{ key: 'templates', label: 'Message templates', icon: 'chat' }] },
]
const TABS = GROUPS.flatMap((g) => g.tabs)
const TAB_KEY = 'kangyan-admin-tab'
const savedTab = () => { try { const t = sessionStorage.getItem(TAB_KEY); return TABS.some((x) => x.key === t) ? t : 'overview' } catch { return 'overview' } }

/* ------------------------------------------------------------------ */
/* login                                                               */
/* ------------------------------------------------------------------ */

/** Change the admin password (signs out every other device). */
function PasswordForm({ onDone, onCancel, notify }) {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    if (next.length < 8) return setErr('Use at least 8 characters.')
    if (next !== again) return setErr('The new passwords don’t match.')
    setBusy(true)
    setErr('')
    try {
      const { token } = await api('/api/admin/login', { method: 'POST', body: { action: 'change', current: cur, next } })
      setToken(token)
      notify('Password changed. Other devices are logged out.')
      onDone()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="sform" onSubmit={submit}>
      <h2>Change admin password</h2>
      <p className="sform__note">You'll stay logged in here. Any other phone or computer logged in to the admin will need the new password.</p>
      <label className="sform__f"><span>Current password</span><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
      <label className="sform__f"><span>New password (at least 8 characters)</span><input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} /></label>
      <label className="sform__f"><span>New password again</span><input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
      {err && <p className="form__note is-error">{err}</p>}
      <div className="sform__acts">
        <button type="button" className="act" onClick={onCancel}>Cancel</button>
        <button className="btn btn--accent" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </div>
    </form>
  )
}

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
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => !!getToken())
  const [tab, setTabState] = useState(savedTab)
  const [enqFilter, setEnqFilter] = useState('all')
  const [enquiries, setEnquiries] = useState(null)
  const [slots, setSlots] = useState(null)
  const [students, setStudents] = useState(null)
  const [requests, setRequests] = useState(null)
  const [prefill, setPrefill] = useState(null)
  const [fees, setFees] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [more, setMore] = useState(false) // phones: the More menu
  const [editing, setEditing] = useState(null) // enquiry being corrected
  const [pwOpen, setPwOpen] = useState(false)
  const [savingEnq, setSavingEnq] = useState(false)
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
  const setTab = useCallback((t) => {
    setTabState(t)
    try { sessionStorage.setItem(TAB_KEY, t) } catch { /* ignore */ }
  }, [])
  // From the overview: jump to a tab, optionally with an enquiry status filter.
  const go = useCallback((t, status) => {
    if (t === 'enquiries') setEnqFilter(status || 'all')
    setTab(t)
  }, [setTab])

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
    setStudents(null)
    setRequests(null)
  }, [])

  const load = useCallback(async () => {
    setLoadErr('')
    try {
      const [e, s, st] = await Promise.all([
        api('/api/admin/enquiries'),
        fetch('/api/slots').then((r) => r.json()),
        api('/api/admin/students'),
      ])
      setEnquiries(e.enquiries)
      setStudents(st.students)
      setRequests(st.requests)
      setFees(st.fees || [])
      setAnnouncements(st.announcements || [])
      setSavedTemplates(st.templates)
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
      // In-person enquiries suggest their own times instead of picking slots.
      custom_times: r.custom_times || [],
      custom_labels: (r.custom_times || []).map((x) => `${WEEKDAYS_SHORT[x.weekday]} ${formatRange(x.start, x.end)}`),
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
  const editEnquiry = useCallback((r) => { setOpenId(null); setEditing(r) }, [])
  const saveEnquiry = async (f) => {
    setSavingEnq(true)
    try {
      const { enquiry } = await api('/api/admin/enquiries', { method: 'PATCH', body: { id: editing.id, details: f } })
      setEnquiries((rs) => rs.map((x) => (x.id === enquiry.id ? enquiry : x)))
      setEditing(null)
      notify('Enquiry updated')
    } catch (e) {
      e.unauthorized ? logout() : notify(e.message, 'error')
    } finally {
      setSavingEnq(false)
    }
  }
  // Slots change status when a 1-to-1 student is added, moved or removed.
  const refreshSlots = useCallback(async () => {
    try { const s = await fetch('/api/slots').then((r) => r.json()); if (s.ok) setSlots(sortSlots(s.slots)) } catch { /* keep the old list */ }
  }, [])
  const clearPrefill = useCallback(() => setPrefill(null), [])
  const editStudent = useCallback((s) => { setPrefill(formFromStudent(s)); setTab('students') }, [setTab])
  // From an enquiry: open the add-student form already filled in.
  const makeStudent = useCallback((r) => {
    setOpenId(null)
    setPrefill({
      name: r.student_name, phone: r.phone || '', level: r.level, lessonType: r.lesson_type === 'group' ? 'group' : 'private',
      subjects: r.subjects,
      // Start from the times they picked; the form lets you change or add more.
      lessons: r.preferred_slots.filter((p) => p.live).map((p) => ({ weekday: p.weekday, start: p.start, end: p.end })).slice(0, 3),
      lang: r.lang === 'zh' ? 'zh' : 'en', enquiryId: r.id,
      notes: [
        r.school,
        r.format === 'in-person' ? `In person${r.location ? `: ${r.location}` : ''}` : r.location,
        r.custom_labels?.length ? `Asked for: ${r.custom_labels.join(', ')}` : '',
        r.email ? `Email: ${r.email}` : '',
        r.message ? `Message: ${r.message}` : '',
      ].filter(Boolean).join('\n'),
    })
    setTab('students')
  }, [setTab])
  const opened = rows && openId != null ? rows.find((r) => r.id === openId) : null
  // Enquiries that have already become students.
  const studentOf = useMemo(() => {
    const m = new Map((students || []).filter((s) => s.enquiry_id).map((s) => [s.enquiry_id, s]))
    return (r) => m.get(r.id) || null
  }, [students])

  const newCount = enquiries ? enquiries.filter((r) => r.status === 'new').length : 0
  const weekAgo = Date.now() - 7 * 864e5
  const weekCount = enquiries ? enquiries.filter((r) => new Date(r.created_at).getTime() > weekAgo).length : 0
  const openSlots = slots ? slots.filter((s) => s.status === 'open').length : 0
  const ready = enquiries && slots && students && requests
  const pendingCount = requests ? requests.filter((r) => r.status === 'pending').length : 0
  const today = new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })
  const HEAD = {
    overview: ['Overview', `${today} · ${newCount} waiting for a reply`],
    enquiries: ['Enquiries', `${newCount} new · ${weekCount} in the last 7 days · ${enquiries?.length ?? 0} total`],
    students: ['Students', `${students?.filter((s) => s.active).length ?? 0} active · ${pendingCount} request${pendingCount === 1 ? '' : 's'} waiting · login page: kangyan.work/student`],
    schedule: ['Schedule', 'Who picked which time, like a spreadsheet. Tap a name to open the enquiry.'],
    calendar: ['My calendar', `Your classes with confirmed students · ${students?.filter((s) => s.active).length ?? 0} active students`],
    slots: ['Enquiry slots', `${openSlots} open slot${openSlots === 1 ? '' : 's'} · new enquiries can only pick slots you set to Open`],
    fees: ['Fees', 'Monthly tuition fees: what each student owes, who has paid, and one-click reminders.'],
    news: ['Announcements', 'Shown at the top of the student page.'],
    templates: ['Message templates', 'The WhatsApp messages behind the one-click buttons.'],
  }
  HEAD.schedule = ['Group ideas', 'Enquiries who picked the same time, grouped by subject and level.']
  const unpaidCount = students ? students.filter((s) => s.active && feeState(todayMY().slice(0, 7), fees.find((f) => f.student_id === s.id && f.month === todayMY().slice(0, 7))?.paid) === 'overdue').length : 0
  const badge = (k) => (k === 'enquiries' ? newCount : k === 'students' ? pendingCount : k === 'fees' ? unpaidCount : 0)

  return (
    <div className={`admin ${authed ? 'is-authed' : ''}`}>
      <aside className="aside">
        <a href="/" className="admin__logo" aria-label="Back to website">
          Kangyan<span className="dot" aria-hidden="true" /><small>Admin</small>
        </a>

        {authed && (
          <nav className="aside__nav" aria-label="Admin sections">
            {GROUPS.map((g) => (
              <div className="aside__group" key={g.label || 'top'}>
                {g.label && <span className="aside__label">{g.label}</span>}
                {g.tabs.map((t) => (
                  <button key={t.key} type="button" className={`${tab === t.key ? 'is-on' : ''} ${t.bar ? 'is-bar' : 'is-more'}`} aria-current={tab === t.key ? 'page' : undefined} onClick={() => { setMore(false); go(t.key) }}>
                    <Icon name={t.icon} /><span className="tab-full">{t.label}</span><span className="tab-short">{t.short || t.label}</span>
                    {badge(t.key) > 0 && <span className="badge" aria-label={`${badge(t.key)} need attention`}>{badge(t.key)}</span>}
                  </button>
                ))}
              </div>
            ))}
            <button type="button" className={`aside__more ${TABS.find((t) => t.key === tab)?.bar ? '' : 'is-on'}`} onClick={() => setMore((m) => !m)} aria-expanded={more}>
              <Icon name="menu" /><span className="tab-short">More</span>
              {badge('fees') > 0 && <span className="badge" aria-label={`${badge('fees')} overdue fees`}>{badge('fees')}</span>}
            </button>
          </nav>
        )}

        {authed && (
          <div className="aside__foot">
            <button type="button" className={`icon-btn ${spinning ? 'is-spinning' : ''}`} onClick={refresh} aria-label="Refresh" title="Refresh">
              <Icon name="refresh" />
            </button>
            <button type="button" className="icon-btn" onClick={() => setPwOpen(true)} aria-label="Change password" title="Change password">
              <Icon name="key" />
            </button>
            <button type="button" className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
              <Icon name="logout" />
            </button>
          </div>
        )}
      </aside>

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
              <h1>{HEAD[tab][0]}</h1>
              <p>{HEAD[tab][1]}</p>
            </div>
            {tab === 'overview' && <Overview rows={rows} slots={slots} onOpen={setOpenId} go={go} />}
            {tab === 'enquiries' && <EnquiriesTab rows={rows} actions={actions} onOpen={setOpenId} onMakeStudent={makeStudent} onEdit={editEnquiry} studentOf={studentOf} onViewStudent={editStudent} notify={notify} filter={enqFilter} setFilter={setEnqFilter} />}
            {tab === 'students' && <StudentsTab students={students} setStudents={setStudents} requests={requests} setRequests={setRequests} slots={slots} refreshSlots={refreshSlots} prefill={prefill} clearPrefill={clearPrefill} onCreated={(s) => s.enquiry_id && setEnquiries((rs) => rs.map((r) => (r.id === s.enquiry_id ? { ...r, status: 'confirmed' } : r)))} notify={notify} onAuthError={logout} />}
            {tab === 'fees' && <FeesTab students={students} requests={requests} fees={fees} setFees={setFees} notify={notify} onAuthError={logout} />}
            {tab === 'news' && <AnnouncementsTab announcements={announcements} setAnnouncements={setAnnouncements} students={students} notify={notify} onAuthError={logout} />}
            {tab === 'templates' && <TemplatesTab notify={notify} onAuthError={logout} />}
            {tab === 'schedule' && <Schedule rows={rows} slots={slots} onOpen={setOpenId} notify={notify} />}
            {tab === 'calendar' && <AdminCalendar slots={slots} setSlots={setSlots} students={students} setStudents={setStudents} requests={requests} setRequests={setRequests} refreshSlots={refreshSlots} notify={notify} onAuthError={logout} onEditStudent={editStudent} />}
            {tab === 'slots' && <SlotsTab slots={slots} setSlots={setSlots} enquiries={rows} students={students} onAuthError={logout} notify={notify} onOpen={setOpenId} />}
          </>
        )}
      </main>

      {opened && (
        <Drawer onClose={closeDrawer} label={`Enquiry from ${opened.student_name}`}>
          <EnquiryCard r={opened} onStatus={actions.status} onNotes={actions.notes} onMakeStudent={makeStudent} onEdit={editEnquiry} student={studentOf(opened)} onViewStudent={(s) => { setOpenId(null); editStudent(s) }} notify={notify} />
        </Drawer>
      )}

      {more && (
        <div className="more-sheet" role="dialog" aria-label="More">
          <div className="more-sheet__bg" onClick={() => setMore(false)} />
          <div className="more-sheet__panel">
            {GROUPS.map((g) => g.tabs.filter((t) => !t.bar).length > 0 && (
              <div key={g.label} className="more-sheet__group">
                <span className="aside__label">{g.label}</span>
                {g.tabs.filter((t) => !t.bar).map((t) => (
                  <button key={t.key} type="button" className={tab === t.key ? 'is-on' : ''} onClick={() => { setMore(false); go(t.key) }}>
                    <Icon name={t.icon} />{t.label}{badge(t.key) > 0 && <span className="badge">{badge(t.key)}</span>}
                  </button>
                ))}
              </div>
            ))}
            <div className="more-sheet__group">
              <button type="button" onClick={() => { setMore(false); setPwOpen(true) }}><Icon name="key" />Change password</button>
            </div>
          </div>
        </div>
      )}

      {pwOpen && (
        <Drawer onClose={() => setPwOpen(false)} label="Change admin password">
          <PasswordForm notify={notify} onDone={() => setPwOpen(false)} onCancel={() => setPwOpen(false)} />
        </Drawer>
      )}

      {editing && (
        <Drawer onClose={() => setEditing(null)} label={`Edit enquiry from ${editing.student_name}`}>
          <EnquiryForm r={rows.find((x) => x.id === editing.id) || editing} slots={slots} busy={savingEnq} onSave={saveEnquiry} onCancel={() => setEditing(null)} />
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
