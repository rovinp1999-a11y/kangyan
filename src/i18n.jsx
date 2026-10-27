import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// English + Simplified Chinese copy for the public enquiry site.
// Values sent to the API (subjects, levels, formats) stay in English; only the
// labels shown to visitors are translated. The admin dashboard stays English.

const KEY = 'kangyan-lang'

const en = {
  htmlLang: 'en',
  meta: {
    title: 'Kangyan | UEC, SPM & IGCSE Science and Maths Tuition Enquiry',
    description: 'Book Physics, Chemistry, Biology, Science or Maths tuition for Chinese independent schools (UEC Junior and Senior), SPM and IGCSE. Private 1-to-1 or group classes on weekday evenings. Reply within 48 hours.',
  },
  nav: { switchLabel: 'Language / 语言' },
  intro: {
    eyebrow: 'UEC · SPM · IGCSE · Science & Maths tuition',
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
    failed: 'Something went wrong. Please try again in a moment.',
    errors: {
      name: "Please enter the student's name.",
      lessonType: 'Please choose 1-to-1 or a group class.',
      level: 'Please choose a level.',
      subjects: 'Please choose at least one subject.',
      format: 'Please choose online or in person.',
      location: 'Please enter where lessons would be.',
      phone: 'That WhatsApp number looks too short.',
      email: "That email doesn't look right.",
      contact: 'Please add a WhatsApp number or an email.',
    },
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
      unavailable: 'No open slots right now',
      fullBadge: 'Full',
      noGroup: "Group classes are full right now. Please choose Private 1-to-1, and I'll let you know when a group class opens.",
      noPrivate: 'Private slots are full right now. Please choose a group class.',
      allFull: "All slots are full at the moment. You can still enquire and I'll let you know when one opens.",
    },
    level: { q: (n) => `Which level is ${n} in?`, help: 'Chinese independent school (UEC), national school (SPM) or IGCSE.' },
    subjects: { q: 'Which subjects do you need help with?', help: 'Pick one or more.' },
    times: {
      q: 'Which times suit you?',
      help: { private: 'Weekday evenings for private lessons. Pick as many as you like.', group: 'Weekday evenings when group classes run. Pick as many as you like.' },
      empty: (type) => `No ${type.toLowerCase()} slots are open right now. Tap Continue and I'll suggest times.`,
      noGroup: 'There are no group classes available right now. Please switch to Private 1-to-1 to see open times.',
      switchPrivate: 'Switch to Private 1-to-1',
      allTaken: (type) => `All ${type.toLowerCase()} slots are full right now. Tap Continue and I'll suggest other times.`,
      loading: 'Loading the timetable…',
      error: "The timetable didn't load. Tap Continue and I'll suggest times.",
      flexible: "I'm flexible, skip this",
      picked: (n) => `${n} time${n > 1 ? 's' : ''} picked`,
      none: 'No times picked',
      taken: 'Full',
    },
    format: {
      q: 'Online or in person?',
      opts: { online: ['Online', 'Learn from home'], 'in-person': ['In person', 'At your place or nearby'], either: ['Either works', 'Whatever fits best'] },
      location: 'Where would lessons be?',
      locationPh: 'Area or address, e.g. Cheras, Kuala Lumpur',
      locationHint: "I'll let you know whether I can travel there.",
    },
    contact: {
      q: 'Where should I reply?',
      help: 'WhatsApp is fastest. Fill in at least one.',
      phone: 'WhatsApp number',
      email: 'Email',
      message: 'Anything I should know?',
      optional: 'optional',
      messagePh: 'e.g. Senior 2, finds electricity hard, sitting UEC next year',
      summary: 'Your enquiry',
      flexible: 'Flexible on time',
      needContact: 'Please add a WhatsApp number or an email.',
      badEmail: "That email doesn't look right.",
      badPhone: 'That WhatsApp number looks too short.',
    },
    done: {
      title: (n) => `Thanks, ${n}!`,
      text: "Your enquiry is in. I'll reply within 48 hours with a suggested time and the fees.",
      again: 'Start a new enquiry',
    },
  },
  footer: { rights: (y) => `© ${y} Kangyan` },
  labels: {
    lessonTypes: { private: 'Private 1-to-1', group: 'Group class' },
    subjects: { Physics: 'Physics', Chemistry: 'Chemistry', Biology: 'Biology', Science: 'Science', Mathematics: 'Maths' },
    levelGroups: { uec: 'Chinese independent · UEC', kssm: 'National school · SPM', igcse: 'International · IGCSE', other: 'Other' },
    levels: {
      'UEC Junior 1': 'Junior 1', 'UEC Junior 2': 'Junior 2', 'UEC Junior 3': 'Junior 3',
      'UEC Senior 1': 'Senior 1', 'UEC Senior 2': 'Senior 2', 'UEC Senior 3': 'Senior 3',
      'IGCSE Year 10': 'Year 10', 'IGCSE Year 11': 'Year 11',
    },
    formats: { online: 'Online', 'in-person': 'In person', either: 'Online or in person' },
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
}

const zh = {
  htmlLang: 'zh-Hans',
  meta: {
    title: 'Kangyan｜独中统考、SPM、IGCSE 理科与数学补习',
    description: '独中初中、高中（统考）、国中 SPM 和 IGCSE 的物理、化学、生物、科学、数学补习。平日晚上有一对一和小组课，填个简单资料，48 小时内回复你。',
  },
  nav: { switchLabel: 'Language / 语言' },
  intro: {
    eyebrow: '独中统考 · SPM · IGCSE ｜ 理科、数学补习',
    title: ['', '一分钟', '约好补习时间。'],
    sub: '回答几个简单的问题就好。我会在 48 小时内亲自回复你，咨询免费，不用急着决定。',
  },
  wz: {
    stepOf: (i, n) => `第 ${i} 步，共 ${n} 步`,
    next: '下一步',
    back: '返回',
    skip: '跳过',
    sending: '送出中…',
    submit: '送出咨询',
    failed: '哎呀，没送出去。请稍等一下再试一次。',
    errors: {
      name: '请填写学生姓名。',
      lessonType: '请选择一对一或小组课。',
      level: '请选择年级。',
      subjects: '请至少选一个科目。',
      format: '请选择网课或面对面。',
      location: '请填写上课地点。',
      phone: 'WhatsApp 号码好像少了几个数字。',
      email: '电邮好像不太对，再检查一下？',
      contact: '请留个 WhatsApp 号码或电邮，我才联系得到你。',
    },
    name: {
      q: '先告诉我，学生怎么称呼？',
      help: '大概一分钟就能填完，我好帮你安排合适的课。',
      ph: '学生姓名',
    },
    type: {
      q: (n) => `${n}，想上一对一，还是小组课？`,
      help: '还没想好也没关系，之后可以再改。',
      private: { title: '一对一私人课', desc: '整堂课只顾一位学生，跟着他的进度和弱项来教。' },
      group: { title: '小组课', desc: '几位程度相近的同学一起上，互相讨论、一起进步。' },
      unavailable: '暂时没有空位',
      fullBadge: '已满',
      noGroup: '小组课目前都满了，先选一对一吧。一有小组课空位，我会马上通知你。',
      noPrivate: '一对一目前都满了，可以先报小组课。',
      allFull: '目前所有时段都满了。不过你还是可以先留个资料，一有空位我就联系你。',
    },
    level: { q: (n) => `${n}现在读几年级？`, help: '独中、国中、国际学校都可以。' },
    subjects: { q: '想补哪些科目？', help: '可以选不止一科。' },
    times: {
      q: '哪些时间比较方便？',
      help: { private: '以下是一对一的平日晚上时段，可以多选几个。', group: '以下是小组课的平日晚上时段，可以多选几个。' },
      empty: (type) => `${type}暂时没有开放的时段。直接按下一步，我再跟你约时间。`,
      noGroup: '现在没有小组课可以选。改成一对一，就能看到可以预约的时间。',
      switchPrivate: '改选一对一',
      allTaken: (type) => `${type}的时段暂时都满了。按下一步，我再跟你商量其他时间。`,
      loading: '正在载入时间表…',
      error: '时间表暂时打不开。直接按下一步，我再跟你约时间。',
      flexible: '时间都可以',
      picked: (n) => `已选 ${n} 个时段`,
      none: '还没选时段',
      taken: '已满',
    },
    format: {
      q: '想上网课，还是面对面？',
      opts: { online: ['网课', '在家就能上'], 'in-person': ['面对面', '到你家或附近上课'], either: ['都可以', '看哪个方便'] },
      location: '上课地点大概在哪里？',
      locationPh: '例如：蕉赖、梳邦、八打灵再也',
      locationHint: '我看看能不能到你那边，会再跟你确认。',
    },
    contact: {
      q: '怎么联系你比较方便？',
      help: 'WhatsApp 最快，电邮也可以，至少留一个。',
      phone: 'WhatsApp 号码',
      email: '电邮',
      message: '还有什么想让我知道的？',
      optional: '选填',
      messagePh: '例如：高二，电学比较弱，明年要考统考',
      summary: '确认一下你的资料',
      flexible: '时间都可以',
      needContact: '请留个 WhatsApp 号码或电邮，我才联系得到你。',
      badEmail: '电邮好像不太对，再检查一下？',
      badPhone: 'WhatsApp 号码好像少了几个数字。',
    },
    done: {
      title: (n) => `谢谢你，${n}！`,
      text: '资料已经收到了。我会在 48 小时内通过 WhatsApp 或电邮联系你，跟你确认上课时间和学费。',
      again: '再填一份',
    },
  },
  footer: { rights: (y) => `© ${y} Kangyan` },
  labels: {
    lessonTypes: { private: '一对一', group: '小组课' },
    subjects: { Physics: '物理', Chemistry: '化学', Biology: '生物', Science: '科学', Mathematics: '数学' },
    levelGroups: { uec: '独中（统考）', kssm: '国中（SPM）', igcse: '国际学校（IGCSE）', other: '其他' },
    levels: {
      'UEC Junior 1': '初一', 'UEC Junior 2': '初二', 'UEC Junior 3': '初三',
      'UEC Senior 1': '高一', 'UEC Senior 2': '高二', 'UEC Senior 3': '高三',
      'Form 1': '中一', 'Form 2': '中二', 'Form 3': '中三', 'Form 4': '中四', 'Form 5': '中五',
      'IGCSE Year 10': '十年级', 'IGCSE Year 11': '十一年级', Other: '其他',
    },
    formats: { online: '网课', 'in-person': '面对面', either: '网课或面对面' },
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
