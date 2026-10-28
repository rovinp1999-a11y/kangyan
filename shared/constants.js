// Shared between the Vite frontend and the Vercel API functions.

export const SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Science', 'Mathematics']

// Levels grouped by school system. 独中 (Chinese independent, UEC) comes first.
export const LEVEL_GROUPS = [
  { key: 'uec', levels: ['UEC Junior 1', 'UEC Junior 2', 'UEC Junior 3', 'UEC Senior 1', 'UEC Senior 2', 'UEC Senior 3'] },
  { key: 'kssm', levels: ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5'] },
  { key: 'igcse', levels: ['IGCSE Year 7', 'IGCSE Year 8', 'IGCSE Year 9', 'IGCSE Year 10', 'IGCSE Year 11'] },
  { key: 'other', levels: ['Other'] },
]
export const LEVELS = LEVEL_GROUPS.flatMap((g) => g.levels)

// Monthly group class fee (4 lessons) by stage: junior = Form 1–3 / Junior 1–3 / Year 7–9,
// senior = Form 4–6 / Senior 1–3 / Year 10–11. 'Other' has no fixed stage.
export const GROUP_FEE = { junior: 280, senior: 320 }
export const PRIVATE_FEE_FROM = 70
const SENIOR_LEVELS = ['UEC Senior 1', 'UEC Senior 2', 'UEC Senior 3', 'Form 4', 'Form 5', 'IGCSE Year 10', 'IGCSE Year 11']
export const feeStage = (level) => (!level || level === 'Other' ? null : SENIOR_LEVELS.includes(level) ? 'senior' : 'junior')

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
// A timetable slot can also be offered as both, so it shows for either choice.
export const SLOT_KINDS = ['private', 'group', 'both']
export const SLOT_KIND_LABEL = { private: 'Private 1-to-1', group: 'Group class', both: '1-to-1 or group' }
export const slotFits = (kind, lessonType) => kind === lessonType || kind === 'both'
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
