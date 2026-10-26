// Content data for the site — edit these to keep the copy Kangyan's own.
// Subjects, levels and formats used by the enquiry form live in shared/constants.js.

// `tile` maps to a bento class (a–e). The CTA tile renders after these.
export const subjects = [
  {
    num: '01',
    tile: 'a',
    title: 'Physics',
    desc: 'Forces, electricity, waves and more — concepts made intuitive, then drilled with past-year questions.',
    icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  },
  {
    num: '02',
    tile: 'b',
    title: 'Chemistry',
    desc: 'From mole calculations to organic chemistry, with the reasoning behind every reaction.',
    icon: 'M9 3h6 M10 3v6L4 20h16l-6-11V3',
  },
  {
    num: '03',
    tile: 'c',
    title: 'Biology',
    desc: 'Clear diagrams, structured notes and answer-writing technique for long-form questions.',
    icon: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z M2 21c0-3 1.85-5.36 5.08-6',
  },
  {
    num: '04',
    tile: 'd',
    title: 'Mathematics',
    desc: 'Build fluency step by step — algebra, geometry, statistics and calculus foundations.',
    icon: 'M4 4h16v16H4z M8 12h8 M12 8v8',
  },
  {
    num: '05',
    tile: 'e',
    title: 'Science',
    desc: 'Lower-secondary Science that builds the base for Physics, Chemistry and Biology later on.',
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2',
  },
]

// PLACEHOLDER testimonials — swap in real student/parent quotes before relying on them.
export const testimonials = [
  {
    accent: 'var(--purple)',
    quote: 'My son went from a C to an A in Chemistry within two terms. Kangyan explains things in a way that finally clicks.',
    name: 'Mrs. Tan',
    event: 'Parent · SPM Chemistry',
  },
  {
    accent: 'var(--blue)',
    quote: 'Physics used to scare me. Now I actually look forward to lessons. The past-year practice made the real paper feel easy.',
    name: 'Aiman R.',
    event: 'Form 5 · Physics',
  },
  {
    accent: 'var(--green)',
    quote: 'Patient, structured and always prepared. The weekly progress updates helped us know exactly where she stood.',
    name: 'Sarah L.',
    event: 'Parent · IGCSE Maths',
  },
]
