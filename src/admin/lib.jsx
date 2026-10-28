// Shared helpers, icons and labels for the admin dashboard.
import { useState } from 'react'
import { FORMATS, LESSON_TYPE_LABEL, LEVEL_GROUPS, ENQUIRER_LABEL } from '../../shared/constants.js'
import { STRINGS, shortRange } from '../i18n.jsx'

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

export const sortSlots = (list) =>
  [...list].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))

/* ------------------------------------------------------------------ */
/* icons                                                               */
/* ------------------------------------------------------------------ */

export const ICONS = {
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
  chart: 'M3 3v18h18 M7 15v2 M11 11v6 M15 7v10 M19 12v5',
  grid: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18',
}

export function Icon({ name, className = '' }) {
  return (
    <svg className={`ic ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}


export const KIND_SHORT = { private: '1-to-1', group: 'Group', both: 'Both' }

export function StatusDot({ status }) {
  return <span className="st" style={{ '--c': STATUS_META[status].color }}><span className="dot" />{STATUS_META[status].label}</span>
}

