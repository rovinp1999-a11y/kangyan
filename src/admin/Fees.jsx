// Tuition fees by month: the suggested amount for each student (group fee by stage, or the
// 1-to-1 hourly rate × that month's hours), an override, Paid / Unpaid, and a one-click
// WhatsApp reminder with the amount, sent to the parent.
import { useMemo, useState } from 'react'
import { addDays, todayMY } from '../../shared/lessons.js'
import { suggestedFee, feeState, monthOf } from '../../shared/schedule.js'
import { Icon, KIND_SHORT, api, waLink } from './lib.jsx'
import { fill } from './templates.js'

const SITE = 'https://kangyan.work/student'
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthName = (m, lang = 'en') => (lang === 'zh' ? `${Number(m.slice(5))}月` : `${MONTHS_EN[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`)
const dueText = (m, lang) => (lang === 'zh' ? `${Number(m.slice(5))}月1日` : `1 ${MONTHS_EN[Number(m.slice(5)) - 1].slice(0, 3)}`)
const shift = (m, n) => monthOf(addDays(`${m}-15`, n * 30))
const localPhone = (p) => (p?.startsWith('60') ? `0${p.slice(2)}` : p || '')
const STATE = { paid: 'Paid', due: 'Due', overdue: 'Overdue', upcoming: 'Not due yet' }

export function FeesTab({ students, requests, fees, setFees, notify, onAuthError }) {
  const [month, setMonth] = useState(monthOf(todayMY()))
  const [busy, setBusy] = useState(null)
  const [drafts, setDrafts] = useState({}) // student id → amount being typed
  const fail = (e) => (e.unauthorized ? onAuthError() : notify(e.message, 'error'))

  const rows = useMemo(() => students
    .filter((s) => s.active || fees.some((f) => f.student_id === s.id && f.month === month))
    .map((s) => {
      const saved = fees.find((f) => f.student_id === s.id && f.month === month)
      const suggested = suggestedFee(s, requests.filter((r) => r.student_id === s.id), month)
      const amount = saved?.amount ?? suggested
      return { s, saved, suggested, amount, state: feeState(month, saved?.paid) }
    })
    .sort((a, b) => (a.state === 'paid') - (b.state === 'paid') || a.s.name.localeCompare(b.s.name)), [students, requests, fees, month])

  const total = rows.reduce((n, r) => n + (r.amount || 0), 0)
  const paid = rows.filter((r) => r.state === 'paid').reduce((n, r) => n + (r.amount || 0), 0)
  const unpaid = rows.filter((r) => r.state !== 'paid')

  const save = async (r, change) => {
    setBusy(r.s.id)
    try {
      const body = { action: 'setFee', studentId: r.s.id, month, amount: r.saved?.amount ?? null, paid: !!r.saved?.paid, note: r.saved?.note || '', ...change }
      const { fee } = await api('/api/admin/students', { method: 'POST', body })
      setFees((list) => [...list.filter((f) => !(f.student_id === fee.student_id && f.month === fee.month)), fee])
      setDrafts(({ [r.s.id]: _, ...rest }) => rest)
      if ('paid' in change) notify(change.paid ? `${r.s.name}: marked paid` : `${r.s.name}: marked unpaid`)
      else notify(`${r.s.name}: ${monthName(month)} fee ${change.amount == null ? 'back to the suggested amount' : `set to RM${change.amount}`}`)
    } catch (e) { fail(e) } finally { setBusy(null) }
  }
  const commitAmount = (r) => {
    const v = drafts[r.s.id]
    if (v === undefined) return
    const n = v.trim() === '' ? null : Number(v)
    if (n !== null && !(Number.isInteger(n) && n >= 0)) return notify('Use a whole number of ringgit', 'error')
    if (n === (r.saved?.amount ?? null)) return setDrafts(({ [r.s.id]: _, ...rest }) => rest)
    save(r, { amount: n })
  }
  // Fee reminders go to the parent; without a parent's number, to the login number.
  const reminder = (r) => {
    const lang = r.s.lang === 'zh' ? 'zh' : 'en'
    const parent = r.s.parent_name?.trim()
    return fill('feeReminder', lang, {
      name: parent || (lang === 'zh' ? '家长' : 'there'), student: lang === 'zh' ? r.s.name : r.s.name.split(/\s+/)[0],
      month: monthName(month, lang), amount: r.amount ?? '', due: dueText(month, lang), link: SITE,
    })
  }

  return (
    <div className="fees">
      <div className="fees__bar">
        <div className="wc__nav">
          <button type="button" className="icon-btn" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month">‹</button>
          <span className="wc__range">{monthName(month)}</span>
          <button type="button" className="icon-btn" onClick={() => setMonth(shift(month, 1))} aria-label="Next month">›</button>
          {month !== monthOf(todayMY()) && <button type="button" className="wc__today" onClick={() => setMonth(monthOf(todayMY()))}>This month</button>}
        </div>
        <div className="fees__sum">
          <span><b>RM{total.toLocaleString()}</b> expected</span>
          <span className="is-paid"><b>RM{paid.toLocaleString()}</b> paid</span>
          <span className="is-due"><b>RM{(total - paid).toLocaleString()}</b> outstanding · {unpaid.length} student{unpaid.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <p className="adm-showing">Fees are due on the 1st and show as overdue after the 14th. Amounts are suggested (group: by level; 1-to-1: hourly rate × that month's hours, absences included, lessons you cancelled not) — type a number to override, or clear it to go back to the suggestion.</p>

      {rows.length === 0 ? <div className="adm-empty"><strong>No students</strong>Add students first.</div> : (
        <div className="fees__list">
          {rows.map((r) => (
            <article key={r.s.id} className={`fee fee--${r.state}`}>
              <div className="fee__who">
                <b>{r.s.name}</b>
                <span>{[r.s.level, KIND_SHORT[r.s.lesson_type], r.s.lesson_type === 'private' ? `RM${r.s.hourly_rate || 70}/h` : null].filter(Boolean).join(' · ')}</span>
                {r.state !== 'paid' && <small className="fee__to">{r.s.parent_phone ? `Parent: ${[r.s.parent_name, localPhone(r.s.parent_phone)].filter(Boolean).join(' · ')}` : 'No parent number yet'}</small>}
              </div>
              <label className="fee__amt">
                <span>RM</span>
                <input
                  inputMode="numeric" aria-label={`${r.s.name} fee for ${monthName(month)}`}
                  value={drafts[r.s.id] ?? (r.saved?.amount ?? '')}
                  placeholder={r.suggested == null ? 'set' : String(r.suggested)}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.s.id]: e.target.value.replace(/[^\d]/g, '') }))}
                  onBlur={() => commitAmount(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                />
                <small>{r.saved?.amount != null ? `suggested ${r.suggested ?? '—'}` : 'suggested'}</small>
              </label>
              <span className={`fee__state fee__state--${r.state}`}>{STATE[r.state]}</span>
              <div className="fee__acts">
                {r.state === 'paid'
                  ? <button type="button" className="act" disabled={busy === r.s.id} onClick={() => save(r, { paid: false })}>Mark unpaid</button>
                  : <button type="button" className="btn btn--accent btn--sm" disabled={busy === r.s.id || r.amount == null} onClick={() => save(r, { paid: true, amount: r.amount })}><Icon name="check" />Mark paid</button>}
                {r.state !== 'paid' && r.amount != null && (r.s.parent_phone || r.s.phone) && (
                  <a className="act act--wa" href={waLink(r.s.parent_phone || r.s.phone, reminder(r))} target="_blank" rel="noopener noreferrer"
                    title={r.s.parent_phone ? `WhatsApp ${r.s.parent_name || 'parent'} · ${localPhone(r.s.parent_phone)}` : `No parent's number yet: goes to ${localPhone(r.s.phone)}. Add one in the student's profile.`}>
                    <Icon name="chat" />{r.s.parent_phone ? 'Remind parent' : 'Remind to pay'}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
