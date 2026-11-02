// Announcements shown at the top of the student page: to everyone, only 1-to-1, only group
// classes, or one student, optionally until a date.
import { useState } from 'react'
import { dateLabel, todayMY } from '../../shared/lessons.js'
import { Icon, api, timeAgo } from './lib.jsx'

const AUD = { all: 'All students', private: '1-to-1 students', group: 'Group class students', student: 'One student' }

export function AnnouncementsTab({ announcements, setAnnouncements, students, notify, onAuthError }) {
  const [f, setF] = useState({ title: '', body: '', audience: 'all', studentId: '', until: '' })
  const [busy, setBusy] = useState(false)
  const fail = (e) => (e.unauthorized ? onAuthError() : notify(e.message, 'error'))
  const today = todayMY()

  const post = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { announcement } = await api('/api/admin/students', { method: 'POST', body: { action: 'announce', ...f, studentId: f.studentId ? Number(f.studentId) : null } })
      setAnnouncements((list) => [announcement, ...list])
      setF({ title: '', body: '', audience: 'all', studentId: '', until: '' })
      notify('Posted on the student page')
    } catch (e2) { fail(e2) } finally { setBusy(false) }
  }
  const remove = async (a) => {
    if (!window.confirm(`Remove "${a.title}"?`)) return
    try {
      await api('/api/admin/students', { method: 'POST', body: { action: 'unannounce', id: a.id } })
      setAnnouncements((list) => list.filter((x) => x.id !== a.id))
      notify('Removed')
    } catch (e) { fail(e) }
  }
  const who = (a) => (a.audience === 'student' ? students.find((s) => s.id === a.student_id)?.name || 'A removed student' : AUD[a.audience])

  return (
    <div className="ann">
      <form className="adm-card sform ann__form" onSubmit={post}>
        <h2>New announcement</h2>
        <label className="sform__f"><span>Title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. No classes 1–7 Dec (school holidays)" required minLength={2} maxLength={120} /></label>
        <label className="sform__f"><span>Message (optional)</span><textarea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={2000} placeholder="Any details. Write in the language your students read." /></label>
        <div className="sform__row">
          <label className="sform__f"><span>Who sees it</span>
            <select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              {Object.entries(AUD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {f.audience === 'student' ? (
            <label className="sform__f"><span>Student</span>
              <select value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })} required>
                <option value="">Choose…</option>
                {students.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          ) : (
            <label className="sform__f"><span>Show until (optional)</span><input type="date" min={today} value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} /></label>
          )}
        </div>
        {f.audience === 'student' && <label className="sform__f"><span>Show until (optional)</span><input type="date" min={today} value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} /></label>}
        <div className="sform__acts"><button className="btn btn--accent" disabled={busy}>{busy ? 'Posting…' : 'Post announcement'}</button></div>
      </form>

      <section className="sblock">
        <header className="sblock__head"><h2>Posted</h2></header>
        {announcements.length === 0 ? <p className="cempty">Nothing posted yet.</p> : (
          <ul className="ann__list">
            {announcements.map((a) => {
              const over = a.until && a.until < today
              return (
                <li key={a.id} className={over ? 'is-over' : ''}>
                  <div>
                    <b>{a.title}</b>
                    {a.body && <p>{a.body}</p>}
                    <small>{who(a)} · posted {timeAgo(a.created_at)}{a.until ? ` · ${over ? 'ended' : 'until'} ${dateLabel(a.until)}` : ''}</small>
                  </div>
                  <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(a)} aria-label={`Remove ${a.title}`}><Icon name="trash" /></button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
