// Shared helpers, icons and labels for the admin dashboard.
import { useState } from 'react'
import { FORMATS, LESSON_TYPE_LABEL, LEVEL_GROUPS, ENQUIRER_LABEL } from '../../shared/constants.js'
import { STRINGS, shortRange } from '../i18n.jsx'
import { fill } from './templates.js'

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export const KEY = 'kangyan-admin-token'
export const getToken = () => { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } }
export const setToken = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY) } catch { /* ignore */ } }

export async function api(path, { method = 'GET', body } = {}) {
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

export const STATUS_META = {
  new: { label: 'New', color: 'var(--yellow)' },
  contacted: { label: 'Contacted', color: 'var(--blue)' },
  confirmed: { label: 'Confirmed', color: 'var(--green)' },
  closed: { label: 'Closed', color: '#A8A3B3' },
}
export const FORMAT_LABEL = Object.fromEntries(FORMATS.map((f) => [f.value, f.label]))


export const fullDate = (iso) =>
  new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export function timeAgo(iso) {
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

export const initials = (name) =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

/** Malaysian-friendly wa.me link: strips symbols, turns a leading 0 into 60. */
export function waLink(phone, text = '') {
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
  // In-person enquiries suggest their own times.
  slots.push(...(r.custom_times || []).map((x) => `${L.weekdaysShort[x.weekday]} ${shortRange(x.start, x.end, zh ? 'zh' : 'en')}`))
  const times = slots.length ? slots.join(zh ? '、' : ', ') : zh ? '时间都可以' : 'Flexible'
  const type = zh ? (r.lesson_type === 'group' ? '小组课' : '一对一私人课') : LESSON_TYPE_LABEL[r.lesson_type] || LESSON_TYPE_LABEL.private
  const fmt = L.formats[r.format] || L.formats.either
  const where = r.location ? (zh ? `（${r.location}）` : ` (${r.location})`) : ''

  const lang = zh ? 'zh' : 'en'
  return fill(r.enquirer === 'student' ? 'enquiryStudent' : 'enquiryParent', lang, { name: first, class: type, level, subjects, times, lessons: `${fmt}${where}` })
}

export const levelSystem = (level) => LEVEL_GROUPS.find((g) => g.levels.includes(level))?.key || 'other'
export const SYSTEM_LABEL = { uec: 'UEC', kssm: 'SPM', igcse: 'IGCSE', other: 'Other' }
export const typeOf = (r) => (r.lesson_type === 'group' ? 'group' : 'private')

/** Remembered per browser (view mode etc.). Storage can be blocked, so never rely on it. */
export function useStored(key, initial) {
  const [v, setV] = useState(() => { try { return localStorage.getItem(key) || initial } catch { return initial } })
  const set = (next) => { setV(next); try { localStorage.setItem(key, next) } catch { /* ignore */ } }
  return [v, set]
}

/** Download the given enquiries as a spreadsheet-friendly CSV. */
export function downloadCsv(rows) {
  const cols = [
    ['Received', (r) => fullDate(r.created_at)],
    ['Status', (r) => STATUS_META[r.status].label],
    ['Student', (r) => r.student_name],
    ['Enquirer', (r) => ENQUIRER_LABEL[r.enquirer] || ''],
    ['Level', (r) => r.level],
    ['School', (r) => r.school],
    ['Class', (r) => LESSON_TYPE_LABEL[typeOf(r)]],
    ['Subjects', (r) => r.subjects.join(', ')],
    ['Preferred times', (r) => [...r.preferred_slots.map((p) => p.label), ...(r.custom_labels || [])].join(', ') || 'Flexible'],
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

export const sortSlots = (list) =>
  [...list].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))

export { ICONS, Icon } from '../components/Icon.jsx'


export const KIND_SHORT = { private: '1-to-1', group: 'Group', both: 'Both' }

export function StatusDot({ status }) {
  return <span className="st" style={{ '--c': STATUS_META[status].color }}><span className="dot" />{STATUS_META[status].label}</span>
}

