import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// English + Simplified Chinese copy for the public enquiry site.
// Values sent to the API (subjects, levels, formats) stay in English; only the
// labels shown to visitors are translated. The admin dashboard stays English.

const KEY = 'kangyan-lang'

const en = {
  htmlLang: 'en',
  meta: {
    title: 'Kangyan | SPM & IGCSE Science and Maths Tuition Enquiry',
    description: 'Book Physics, Chemistry, Biology, Science or Maths tuition for Form 1–5 (KSSM), SPM and IGCSE. Private 1-to-1 or group classes on weekday evenings. Reply within 48 hours.',
  },
  nav: { switchLabel: 'Language / 语言' },
  intro: {
    eyebrow: 'SPM & IGCSE · Science & Maths tuition',
    title: ['Book a tuition slot in ', 'under a minute', '.'],
    sub: "Answer a few quick questions. I'll reply within 48 hours. Free, no commitment.",
  },
  wz: {
    stepOf: (i, n) => `Step ${i} of ${n}`,
    next: 'Continue',
    back: 'Back',
    skip: 'Skip',
    sending: 'Sending…',
    submit: 'Send enquiry',
    failed: 'Something went wrong. Please try again, or message me on WhatsApp.',
    name: {
      q: "What's the student's name?",
      help: "Let's find the right class. This takes about a minute.",
      ph: "Student's full name",
    },
    type: {
      q: (n) => `Hi ${n}! Private 1-to-1 or a group class?`,
      help: 'You can change this later.',
      private: { title: 'Private 1-to-1', desc: "Lessons built around one student's pace and gaps." },
      group: { title: 'Group class', desc: 'Learn alongside a few students at the same level.' },
    },
    level: { q: (n) => `Which level is ${n} in?`, help: 'Malaysian KSSM or Cambridge IGCSE.' },
    subjects: { q: 'Which subjects do you need help with?', help: 'Pick one or more.' },
    times: {
      q: 'Which times suit you?',
      help: { private: 'Weekday evenings for private lessons. Pick as many as you like.', group: 'Weekday evenings when group classes run. Pick as many as you like.' },
      empty: (type) => `No ${type.toLowerCase()} slots are open right now. Tap Continue and I'll suggest times.`,
      loading: 'Loading the timetable…',
      error: "The timetable didn't load. Tap Continue and I'll suggest times.",
      flexible: "I'm flexible, skip this",
      picked: (n) => `${n} time${n > 1 ? 's' : ''} picked`,
      none: 'No times picked',
      taken: 'Full',
    },
    format: {
      q: 'Online or in person?',
      opts: { online: ['Online', 'Learn from home'], 'in-person': ['In person', 'Mention your area below'], either: ['Either works', 'Whatever fits best'] },
    },
    contact: {
      q: 'Where should I reply?',
      help: 'WhatsApp is fastest. Fill in at least one.',
      phone: 'WhatsApp number',
      email: 'Email',
      message: 'Anything I should know?',
      optional: 'optional',
      messagePh: 'e.g. Form 4, finds electricity hard, sitting SPM next year',
      summary: 'Your enquiry',
      flexible: 'Flexible on time',
      needContact: 'Please add a WhatsApp number or an email.',
      badEmail: "That email doesn't look right.",
      badPhone: 'That WhatsApp number looks too short.',
    },
    done: {
      title: (n) => `Thanks, ${n}!`,
      text: "Your enquiry is in. I'll reply within 48 hours with a suggested time and the fees.",
      whatsapp: "Can't wait? Message me on WhatsApp",
      again: 'Start a new enquiry',
    },
  },
  footer: { rights: (y) => `© ${y} Kangyan` },
  labels: {
    lessonTypes: { private: 'Private 1-to-1', group: 'Group class' },
    subjects: { Physics: 'Physics', Chemistry: 'Chemistry', Biology: 'Biology', Science: 'Science', Mathematics: 'Maths' },
    levels: {},
    formats: { online: 'Online', 'in-person': 'In person', either: 'Online or in person' },
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
}

const zh = {
  htmlLang: 'zh-Hans',
  meta: {
    title: 'Kangyan | SPM 与 IGCSE 科学和数学补习咨询',
    description: '预约中一至中五（KSSM）、SPM 及 IGCSE 的物理、化学、生物、科学或数学补习。平日晚上一对一私人课或小组课，48 小时内回复。',
  },
  nav: { switchLabel: 'Language / 语言' },
  intro: {
    eyebrow: 'SPM 与 IGCSE · 科学与数学补习',
    title: ['', '一分钟内', '预约补习时段。'],
    sub: '回答几个简单问题，我会在 48 小时内回复。免费咨询，无需承诺。',
  },
  wz: {
    stepOf: (i, n) => `第 ${i} 步，共 ${n} 步`,
    next: '继续',
    back: '上一步',
    skip: '跳过',
    sending: '发送中…',
    submit: '发送咨询',
    failed: '发送失败，请稍后再试，或直接 WhatsApp 我。',
    name: {
      q: '学生叫什么名字？',
      help: '帮你找到合适的课，大约一分钟完成。',
      ph: '学生全名',
    },
    type: {
      q: (n) => `${n}你好！想上一对一私人课，还是小组课？`,
      help: '之后也可以更改。',
      private: { title: '一对一私人课', desc: '按学生的进度和弱点度身安排。' },
      group: { title: '小组课', desc: '和几位同年级的学生一起学习。' },
    },
    level: { q: (n) => `${n}现在读几年级？`, help: '马来西亚 KSSM 或 Cambridge IGCSE。' },
    subjects: { q: '需要补习哪些科目？', help: '可以多选。' },
    times: {
      q: '哪些时间适合你？',
      help: { private: '私人课的平日晚上时段，可以多选。', group: '小组课的平日晚上时段，可以多选。' },
      empty: (type) => `目前没有开放的${type}时段。按继续，我会建议时间。`,
      loading: '时间表载入中…',
      error: '时间表暂时无法载入。按继续，我会建议时间。',
      flexible: '时间都可以',
      picked: (n) => `已选 ${n} 个时间`,
      none: '未选时间',
      taken: '已满',
    },
    format: {
      q: '线上还是面对面上课？',
      opts: { online: ['线上', '在家上课'], 'in-person': ['面对面', '请在下一步注明地区'], either: ['都可以', '看哪个方便'] },
    },
    contact: {
      q: '我应该怎么回复你？',
      help: 'WhatsApp 最快，至少填一项。',
      phone: 'WhatsApp 号码',
      email: '电邮',
      message: '还有什么需要我知道的吗？',
      optional: '可选',
      messagePh: '例如：中四，电学比较弱，明年考 SPM',
      summary: '你的咨询',
      flexible: '时间都可以',
      needContact: '请填写 WhatsApp 号码或电邮。',
      badEmail: '电邮格式不正确。',
      badPhone: 'WhatsApp 号码太短了。',
    },
    done: {
      title: (n) => `谢谢你，${n}！`,
      text: '你的咨询已送出。我会在 48 小时内回复，提供建议的上课时间和学费。',
      whatsapp: '等不及？直接 WhatsApp 我',
      again: '重新开始咨询',
    },
  },
  footer: { rights: (y) => `© ${y} Kangyan` },
  labels: {
    lessonTypes: { private: '一对一私人课', group: '小组课' },
    subjects: { Physics: '物理', Chemistry: '化学', Biology: '生物', Science: '科学', Mathematics: '数学' },
    levels: {
      'Form 1': '中一', 'Form 2': '中二', 'Form 3': '中三', 'Form 4': '中四', 'Form 5': '中五',
      'IGCSE Year 10': 'IGCSE 十年级', 'IGCSE Year 11': 'IGCSE 十一年级', Other: '其他',
    },
    formats: { online: '线上', 'in-person': '面对面', either: '线上或面对面' },
    weekdays: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'],
    weekdaysShort: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  },
}

export const STRINGS = { en, zh }

/** Short slot label: '5:30–7 PM' in English, '下午5点半–晚上7点' in Chinese. */
export function shortRange(start, end, lang = 'en') {
  const parse = (t) => {
    const [h, m] = t.split(':').map(Number)
    return { h, m }
  }
  const a = parse(start)
  const b = parse(end)
  if (lang === 'zh') {
    const period = (h) => (h < 12 ? '上午' : h === 12 ? '中午' : h < 18 ? '下午' : '晚上')
    const num = ({ h, m }) => {
      const h12 = h % 12 === 0 ? 12 : h % 12
      if (!m) return `${h12}点`
      return m === 30 ? `${h12}点半` : `${h12}:${String(m).padStart(2, '0')}`
    }
    // An end time on the hour belongs to the period before it: 4–6 PM is 下午, 10–12 is 上午.
    const pa = period(a.h)
    const hb = b.m === 0 ? b.h - 1 : b.h
    const pb = hb === 12 && b.h !== 12 ? '下午' : period(hb)
    return pa === pb ? `${pa}${num(a)}–${num(b)}` : `${pa}${num(a)}–${pb}${num(b)}`
  }
  const part = ({ h, m }) => ({
    t: `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, '0')}` : ''}`,
    p: h >= 12 ? 'PM' : 'AM',
  })
  const x = part(a)
  const y = part(b)
  return x.p === y.p ? `${x.t}–${y.t} ${y.p}` : `${x.t} ${x.p}–${y.t} ${y.p}`
}

function initialLang() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (q === 'zh' || q === 'en') return q
    const saved = localStorage.getItem(KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch { /* storage may be blocked */ }
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(initialLang)
  const t = STRINGS[lang]

  const setLang = (next) => {
    setLangState(next)
    try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
    // Keep a shareable URL: ?lang=zh for Chinese, clean URL for English.
    try {
      const url = new URL(window.location.href)
      next === 'zh' ? url.searchParams.set('lang', 'zh') : url.searchParams.delete('lang')
      window.history.replaceState(null, '', url)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    document.documentElement.lang = t.htmlLang
    document.title = t.meta.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.meta.description)
  }, [t])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]) // eslint-disable-line react-hooks/exhaustive-deps
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>')
  return ctx
}
