// Existing students: their regular weekly slot, login PIN, and the requests they send
// from the student page (move one lesson, absence, new regular time).
import { useEffect, useMemo, useState } from 'react'
import { LEVEL_GROUPS, SUBJECTS, WEEKDAYS, WEEKDAYS_SHORT, formatTime, slotLabel } from '../../shared/constants.js'
import { dateLabel } from '../../shared/lessons.js'
import { STRINGS, shortRange } from '../i18n.jsx'
import { Icon, KIND_SHORT, api, fullDate, timeAgo, waLink } from './lib.jsx'
import { Drawer } from './Enquiries.jsx'

const SITE = 'https://kangyan.work/student'
const KIND_LABEL = { reschedule: 'Move one lesson', absence: 'Absence', change: 'New regular time' }
const STATUS = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected', cancelled: 'Withdrawn' }
const localPhone = (p) => (p?.startsWith('60') ? `0${p.slice(2)}` : p || '')
const first = (n) => n.trim().split(/\s+/)[0]
const weeklyText = (l) => `${WEEKDAYS[l.weekday]} · ${shortRange(l.start, l.end, 'en')}`
const toT = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const toM = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
// Half-hour choices from 7 AM to 10 PM for the weekly lesson rows.
const TIMES = Array.from({ length: 31 }, (_, i) => toT(7 * 60 + i * 30))
const NEW_LESSON = { weekday: 0, start: '17:30', end: '19:00' }

/** Short day + time of a slot in the student's language, for WhatsApp messages. */
function timeText(slot, date, lang) {
  if (!slot) return ''
  const L = STRINGS[lang].labels
  return `${date ? dateLabel(date, lang) : (lang === 'zh' ? `每${L.weekdays[slot.weekday]}` : `every ${L.weekdays[slot.weekday]}`)} ${shortRange(slot.start, slot.end, lang)}`
}

export function loginMessage(s, pin) {
  const phone = localPhone(s.phone)
  if (s.lang === 'zh') {
    return `${s.name}你好！这是 Kangyan 补习的学生登录资料：\n\n${SITE}\nWhatsApp 号码：${phone}\nPIN 码：${pin}\n\n登录后可以看到接下来的课，也可以请假、申请改一对一的上课时间（至少提前 12 小时），或者更改固定上课时间。`
  }
  return `Hi ${first(s.name)}! Here are your login details for Kangyan tuition:\n\n${SITE}\nWhatsApp number: ${phone}\nPIN: ${pin}\n\nThere you can see your upcoming lessons, report an absence, ask to move a 1-to-1 lesson (at least 12 hours before), or change your regular time.`
}

function decisionMessage(r, s, slots, approved) {
  const zh = s.lang === 'zh'
  const lang = zh ? 'zh' : 'en'
  const to = slots.find((x) => x.id === r.to_slot_id)
  const lesson = r.lesson_date ? dateLabel(r.lesson_date, lang) : ''
  const what = {
    reschedule: zh ? `${lesson} 的课改到 ${timeText(to, r.to_date, lang)}` : `moving your lesson on ${lesson} to ${timeText(to, r.to_date, lang)}`,
    absence: zh ? `${lesson} 请假${r.recording ? '（会发录影给你）' : ''}` : `your absence on ${lesson}${r.recording ? ' (I will send you the recording)' : ''}`,
    change: zh ? `固定上课时间改到${timeText(to, null, lang)}` : `changing your regular lesson to ${timeText(to, null, lang)}`,
  }[r.kind]
  const reply = r.reply ? `\n\n${r.reply}` : ''
  if (zh) return `${s.name}你好！${approved ? '已经确认' : '抱歉，这次没办法安排'}：${what}。${reply}\n\n${SITE}`
  return `Hi ${first(s.name)}! ${approved ? 'Confirmed' : "Sorry, I can't do this one"}: ${what}.${reply}\n\n${SITE}`
}

function requestText(r, s, slots) {
  const to = slots.find((x) => x.id === r.to_slot_id)
  const at = r.from_lesson ? ` ${shortRange(r.from_lesson.start, r.from_lesson.end, 'en')}` : ''
  if (r.kind === 'reschedule') return `${dateLabel(r.lesson_date)}${at} → ${to ? `${dateLabel(r.to_date)} ${shortRange(to.start, to.end, 'en')}` : r.to_label}`
  if (r.kind === 'absence') return `${dateLabel(r.lesson_date)}${at}${r.recording ? ' · wants the recording' : ''}`
  return `${r.from_lesson ? `${WEEKDAYS_SHORT[r.from_lesson.weekday]}${at}` : 'New weekly lesson'} → ${to ? slotLabel(to) : r.to_label}`
}

/** Login details shown once after creating a student or giving a new PIN. */
function PinCard({ s, pin, onClose, notify }) {
  const msg = loginMessage(s, pin)
  const copy = async () => {
    try { await navigator.clipboard.writeText(msg); notify('Login details copied') } catch { notify('Could not copy', 'error') }
  }
  return (
    <div className="pin-card">
      <h2>Login details for {s.name}</h2>
      <p className="pin-card__note">This PIN is shown only now. Send it to the student or parent.</p>
      <dl>
        <dt>Page</dt><dd>{SITE.replace('https://', '')}</dd>
        <dt>WhatsApp</dt><dd>{localPhone(s.phone)}</dd>
        <dt>PIN</dt><dd className="pin-card__pin">{pin}</dd>
      </dl>
      <div className="pin-card__acts">
        <a className="act act--wa" href={waLink(s.phone, msg)} target="_blank" rel="noopener noreferrer"><Icon name="chat" />Send on WhatsApp</a>
        <button type="button" className="act" onClick={copy}><Icon name="copy" />Copy message</button>
        <button type="button" className="act" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

const BLANK = { name: '', phone: '', level: '', lessonType: 'private', subjects: [], lessons: [NEW_LESSON], startDate: '', lang: 'en', notes: '' }

/** One row per weekly lesson: day, start and end. Shows when it matches a timetable slot. */
function WeeklyLessons({ value, onChange, slots, lessonType, own = [] }) {
  const setRow = (i, k, v) => onChange(value.map((l, j) => {
    if (j !== i) return l
    const next = { ...l, [k]: k === 'weekday' ? Number(v) : v }
    // Moving the start keeps the length; an end before the start is pushed back.
    if (k === 'start') next.end = toT(Math.min(toM('22:00'), toM(v) + (toM(l.end) - toM(l.start))))
    if (toM(next.end) <= toM(next.start)) next.end = toT(Math.min(toM('22:00'), toM(next.start) + 30))
    return next
  }))
  return (
    <div className="wl">
      {value.map((l, i) => {
        const slot = slots.find((x) => x.weekday === l.weekday && x.start === l.start && x.end === l.end)
        const mins = toM(l.end) - toM(l.start)
        return (
          <div className="wl__row" key={i}>
            <select className="wl__day" value={l.weekday} onChange={(e) => setRow(i, 'weekday', e.target.value)} aria-label={`Lesson ${i + 1} day`}>
              {WEEKDAYS.map((d, k) => <option key={d} value={k}>{d}</option>)}
            </select>
            <select className="wl__start" value={l.start} onChange={(e) => setRow(i, 'start', e.target.value)} aria-label={`Lesson ${i + 1} start`}>
              {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
            </select>
            <span className="wl__to">to</span>
            <select className="wl__end" value={l.end} onChange={(e) => setRow(i, 'end', e.target.value)} aria-label={`Lesson ${i + 1} end`}>
              {TIMES.filter((t) => toM(t) > toM(l.start)).map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
            </select>
            <button type="button" className="icon-btn icon-btn--danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove lesson ${i + 1}`}><Icon name="x" /></button>
            <small className="wl__info">
              {mins / 60} hour{mins === 60 ? '' : 's'}
              {!slot ? ' · not one of your timetable slots'
                : slot.status === 'taken' && !own.some((o) => o.weekday === l.weekday && o.start === l.start && o.end === l.end)
                  ? ' · ⚠ this timetable slot is already taken'
                  : ` · matches your timetable slot${lessonType === 'private' ? ' (will be marked taken)' : ''}`}
            </small>
          </div>
        )
      })}
      {value.length < 7 && (
        <button type="button" className="act wl__add" onClick={() => onChange([...value, value.length ? { ...value[value.length - 1], weekday: (value[value.length - 1].weekday + 2) % 7 } : NEW_LESSON])}>
          <Icon name="plus" />{value.length ? 'Add another weekly lesson' : 'Add a weekly lesson'}
        </button>
      )}
    </div>
  )
}

function StudentForm({ initial, slots, onSave, onCancel, busy }) {
  const [f, setF] = useState(initial)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const editing = !!initial.id
  return (
    <form className="sform" onSubmit={(e) => { e.preventDefault(); onSave(f) }}>
      <h2>{editing ? `Edit ${initial.name}` : initial.enquiryId ? 'Add student from enquiry' : 'Add a student'}</h2>
      <label className="sform__f"><span>Student name</span><input value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={80} /></label>
      <label className="sform__f"><span>WhatsApp number (student or parent)</span><input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} required placeholder="012-345 6789" /></label>
      <div className="sform__row">
        <label className="sform__f"><span>Level</span>
          <select value={f.level} onChange={(e) => set('level', e.target.value)}>
            <option value="">—</option>
            {LEVEL_GROUPS.map((g) => <optgroup key={g.key} label={g.key.toUpperCase()}>{g.levels.map((l) => <option key={l} value={l}>{l}</option>)}</optgroup>)}
          </select>
        </label>
        <div className="sform__f"><span>Class</span>
          <div className="kindpick" role="group" aria-label="Class type">
            {['private', 'group'].map((k) => (
              <button key={k} type="button" className={`kindpick__b kindpick__b--${k} ${f.lessonType === k ? 'is-on' : ''}`} aria-pressed={f.lessonType === k} onClick={() => set('lessonType', k)}>{KIND_SHORT[k]}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="sform__f"><span>Subjects</span>
        <div className="sform__subs">
          {SUBJECTS.map((x) => (
            <label key={x} className={`sform__sub ${f.subjects.includes(x) ? 'is-on' : ''}`}>
              <input type="checkbox" checked={f.subjects.includes(x)} onChange={() => set('subjects', f.subjects.includes(x) ? f.subjects.filter((y) => y !== x) : [...f.subjects, x])} />{x}
            </label>
          ))}
        </div>
      </div>
      <div className="sform__f"><span>Weekly lessons</span>
        <WeeklyLessons value={f.lessons} onChange={(v) => set('lessons', v)} slots={slots} lessonType={f.lessonType} own={initial.id ? initial.lessons : []} />
      </div>
      <div className="sform__row">
        <label className="sform__f"><span>First lesson (optional)</span><input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></label>
        <label className="sform__f"><span>Messages in</span>
          <select value={f.lang} onChange={(e) => set('lang', e.target.value)}><option value="en">English</option><option value="zh">中文</option></select>
        </label>
      </div>
      <label className="sform__f"><span>Private notes</span><textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} /></label>
      <div className="sform__acts">
        <button type="button" className="act" onClick={onCancel}>Cancel</button>
        <button className="btn btn--accent" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add student & create PIN'}</button>
      </div>
    </form>
  )
}

function RequestCard({ r, s, slots, onDecide }) {
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const decide = async (status) => { setBusy(true); await onDecide(r, status, reply); setBusy(false) }
  return (
    <article className={`sreq sreq--${r.kind}`}>
      <header>
        <b>{s?.name || 'Removed student'}</b>
        <span className="sreq__kind">{KIND_LABEL[r.kind]}</span>
        <time dateTime={r.created_at} title={fullDate(r.created_at)}>{timeAgo(r.created_at)}</time>
      </header>
      <p className="sreq__what">{requestText(r, s, slots)}</p>
      {r.note && <p className="sreq__note">“{r.note}”</p>}
      <input className="sreq__reply" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the student (optional)" maxLength={500} aria-label={`Reply to ${s?.name}`} />
      <div className="sreq__acts">
        <button type="button" className="act" disabled={busy} onClick={() => decide('rejected')}>Reject</button>
        <button type="button" className="btn btn--accent btn--sm" disabled={busy} onClick={() => decide('approved')}>{r.kind === 'absence' ? 'Noted' : 'Approve'}</button>
      </div>
    </article>
  )
}

export function StudentsTab({ students, setStudents, requests, setRequests, slots, refreshSlots, prefill, clearPrefill, notify, onAuthError }) {
  const [form, setForm] = useState(null) // form initial values
  const [busy, setBusy] = useState(false)
  const [pin, setPin] = useState(null) // { s, pin }
  const [told, setTold] = useState(null) // { r, s, approved } → WhatsApp link after a decision
  const [q, setQ] = useState('')
  const fail = (e) => (e.unauthorized ? onAuthError() : notify(e.message, 'error'))

  useEffect(() => { if (prefill) { setForm({ ...BLANK, ...prefill }); clearPrefill() } }, [prefill, clearPrefill])

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const pending = requests.filter((r) => r.status === 'pending')
  const history = requests.filter((r) => r.status !== 'pending').slice(0, 40)
  const shown = students.filter((s) => !q.trim() || [s.name, s.phone, localPhone(s.phone), s.level, ...(s.subjects || [])].filter(Boolean).some((v) => v.toLowerCase().includes(q.trim().toLowerCase())))

  const save = async (f) => {
    setBusy(true)
    try {
      const body = { ...f, lessons: f.lessons.map(({ weekday, start, end }) => ({ weekday, start, end })), startDate: f.startDate || null }
      if (f.id) {
        const { student } = await api('/api/admin/students', { method: 'POST', body: { action: 'update', ...body } })
        setStudents((list) => list.map((x) => (x.id === student.id ? student : x)))
        notify('Student saved')
      } else {
        const { student, pin: p } = await api('/api/admin/students', { method: 'POST', body: { action: 'create', ...body } })
        setStudents((list) => [...list, student].sort((a, b) => a.name.localeCompare(b.name)))
        setPin({ s: student, pin: p })
      }
      setForm(null)
      refreshSlots()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const resetPin = async (s) => {
    if (!window.confirm(`Give ${s.name} a new PIN? The old PIN stops working.`)) return
    try {
      const { pin: p } = await api('/api/admin/students', { method: 'POST', body: { action: 'resetPin', id: s.id } })
      setPin({ s, pin: p })
    } catch (e) { fail(e) }
  }
  const setActive = async (s, active) => {
    try {
      const { student } = await api('/api/admin/students', { method: 'POST', body: { action: 'update', id: s.id, active } })
      setStudents((list) => list.map((x) => (x.id === student.id ? student : x)))
      notify(active ? `${s.name} is active again` : `${s.name} can no longer log in`)
      refreshSlots()
    } catch (e) { fail(e) }
  }
  const remove = async (s) => {
    if (!window.confirm(`Delete ${s.name} and all their requests? This can't be undone.`)) return
    try {
      await api('/api/admin/students', { method: 'POST', body: { action: 'delete', id: s.id } })
      setStudents((list) => list.filter((x) => x.id !== s.id))
      setRequests((list) => list.filter((x) => x.student_id !== s.id))
      notify(`Deleted ${s.name}`)
      refreshSlots()
    } catch (e) { fail(e) }
  }
  const decide = async (r, status, reply) => {
    try {
      const { request, student } = await api('/api/admin/students', { method: 'POST', body: { action: 'decide', id: r.id, status, reply } })
      setRequests((list) => list.map((x) => (x.id === request.id ? request : x)))
      if (student) { setStudents((list) => list.map((x) => (x.id === student.id ? student : x))); refreshSlots() }
      const s = byId.get(r.student_id)
      if (s) setTold({ r: request, s: student || s, approved: status === 'approved' })
      notify(status === 'approved' ? 'Approved' : 'Rejected')
    } catch (e) { fail(e) }
  }

  return (
    <>
      <section className="sblock">
        <header className="sblock__head">
          <h2>Requests waiting <span className="badge">{pending.length}</span></h2>
        </header>
        {told && (
          <div className="sreq-told">
            <span>Let {first(told.s.name)} know:</span>
            <a className="act act--wa" href={waLink(told.s.phone, decisionMessage(told.r, told.s, slots, told.approved))} target="_blank" rel="noopener noreferrer"><Icon name="chat" />WhatsApp {told.approved ? 'confirmation' : 'reply'}</a>
            <button type="button" className="icon-btn" onClick={() => setTold(null)} aria-label="Dismiss"><Icon name="x" /></button>
          </div>
        )}
        {pending.length ? (
          <div className="sreqs">{pending.map((r) => <RequestCard key={r.id} r={r} s={byId.get(r.student_id)} slots={slots} onDecide={decide} />)}</div>
        ) : <p className="cempty">No requests waiting. When a student asks to move a lesson, reports an absence or wants a new regular time, it appears here.</p>}
      </section>

      <section className="sblock">
        <header className="sblock__head">
          <h2>Students <span className="sblock__n">{students.filter((s) => s.active).length} active</span></h2>
          <button type="button" className="btn btn--accent btn--sm" onClick={() => setForm(BLANK)}><Icon name="plus" />Add student</button>
        </header>
        {students.length > 4 && (
          <label className="adm-search"><Icon name="search" /><input type="search" placeholder="Search students" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" /></label>
        )}
        {students.length === 0 ? (
          <p className="cempty">No students yet. Add one here, or use “Add as student” on a confirmed enquiry.</p>
        ) : (
          <div className="slist">
            {shown.map((s) => {
              const waiting = pending.filter((r) => r.student_id === s.id).length
              return (
                <article key={s.id} className={`scard ${s.active ? '' : 'is-off'}`}>
                  <header>
                    <div>
                      <h3>{s.name}</h3>
                      <p>{[s.level, KIND_SHORT[s.lesson_type], (s.subjects || []).join(', ')].filter(Boolean).join(' · ')}</p>
                    </div>
                    {waiting > 0 && <span className="badge" title="Requests waiting">{waiting}</span>}
                  </header>
                  <div className="scard__slots">
                    {(s.lessons || []).length
                      ? s.lessons.map((l) => <p className="scard__slot" key={`${l.weekday}-${l.start}`}><Icon name="calendar" />Every {weeklyText(l)}</p>)
                      : <p className="scard__slot is-none"><Icon name="calendar" />No weekly lessons yet</p>}
                  </div>
                  <p className="scard__meta">{localPhone(s.phone)} · {s.last_login ? `last seen ${timeAgo(s.last_login)}` : 'not logged in yet'}{s.active ? '' : ' · deactivated'}</p>
                  {s.notes && <p className="scard__notes">{s.notes}</p>}
                  <footer>
                    <button type="button" className="act" onClick={() => setForm({ ...BLANK, id: s.id, name: s.name, phone: localPhone(s.phone), level: s.level || '', lessonType: s.lesson_type, subjects: s.subjects || [], lessons: (s.lessons || []).map(({ weekday, start, end }) => ({ weekday, start, end })), startDate: s.start_date || '', lang: s.lang, notes: s.notes || '' })}><Icon name="edit" />Edit</button>
                    <button type="button" className="act" onClick={() => resetPin(s)}>New PIN</button>
                    <a className="act act--wa" href={waLink(s.phone)} target="_blank" rel="noopener noreferrer"><Icon name="chat" />WhatsApp</a>
                    <button type="button" className="act" onClick={() => setActive(s, !s.active)}>{s.active ? 'Deactivate' : 'Reactivate'}</button>
                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(s)} aria-label={`Delete ${s.name}`}><Icon name="trash" /></button>
                  </footer>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <details className="sblock shist">
          <summary>Past requests ({history.length})</summary>
          <ul>
            {history.map((r) => {
              const s = byId.get(r.student_id)
              return (
                <li key={r.id}>
                  <span className={`shist__st shist__st--${r.status}`}>{STATUS[r.status]}</span>
                  <b>{s?.name || '—'}</b>
                  <span>{KIND_LABEL[r.kind]}: {requestText(r, s, slots)}</span>
                  {r.reply && <small>Reply: {r.reply}</small>}
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {form && (
        <Drawer onClose={() => setForm(null)} label="Student details">
          <StudentForm initial={form} slots={slots} busy={busy} onSave={save} onCancel={() => setForm(null)} />
        </Drawer>
      )}
      {pin && (
        <Drawer onClose={() => setPin(null)} label="Login details">
          <PinCard s={pin.s} pin={pin.pin} notify={notify} onClose={() => setPin(null)} />
        </Drawer>
      )}
    </>
  )
}
