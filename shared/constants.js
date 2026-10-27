// Shared between the Vite frontend and the Vercel API functions.

export const SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Science', 'Mathematics']

// Levels grouped by school system. 独中 (Chinese independent, UEC) comes first.
export const LEVEL_GROUPS = [
  { key: 'uec', levels: ['UEC Junior 1', 'UEC Junior 2', 'UEC Junior 3', 'UEC Senior 1', 'UEC Senior 2', 'UEC Senior 3'] },
  { key: 'kssm', levels: ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5'] },
  { key: 'igcse', levels: ['IGCSE Year 10', 'IGCSE Year 11'] },
  { key: 'other', levels: ['Other'] },
]
export const LEVELS = LEVEL_GROUPS.flatMap((g) => g.levels)

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
// Who filled in the enquiry.
export const ENQUIRERS = ['parent', 'student']
export const ENQUIRER_LABEL = { parent: 'Parent', student: 'Student' }

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
