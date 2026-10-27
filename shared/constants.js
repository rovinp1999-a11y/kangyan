// Shared between the Vite frontend and the Vercel API functions.

export const SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Science', 'Mathematics']

export const LEVELS = [
  'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5',
  'IGCSE Year 10', 'IGCSE Year 11', 'Other',
]

export const FORMATS = [
  { value: 'online', label: 'Online' },
  { value: 'in-person', label: 'In-person' },
  { value: 'either', label: 'Either works' },
]

// weekday index 0 = Monday … 6 = Sunday
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const SLOT_STATUSES = ['open', 'taken']

// What kind of class a timetable slot is, and what the enquirer asks for.
export const LESSON_TYPES = ['private', 'group']
export const LESSON_TYPE_LABEL = { private: 'Private 1-to-1', group: 'Group class' }
export const ENQUIRY_STATUSES = ['new', 'contacted', 'confirmed', 'closed']

/** '16:00' → '4:00 PM' */
export function formatTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/** '16:00','18:00' → '4:00–6:00 PM'; '10:00','13:00' → '10:00 AM–1:00 PM' */
export function formatRange(start, end) {
  const a = formatTime(start)
  const b = formatTime(end)
  const [at, ap] = a.split(' ')
  const [bt, bp] = b.split(' ')
  return ap === bp ? `${at}–${bt} ${ap}` : `${a}–${b}`
}

/** { weekday, start, end } → 'Mon 4:00–6:00 PM' */
export function slotLabel(slot) {
  return `${WEEKDAYS_SHORT[slot.weekday]} ${formatRange(slot.start, slot.end)}`
}
