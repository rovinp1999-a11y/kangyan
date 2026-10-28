import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// English + Simplified Chinese copy for the public enquiry site.
// Values sent to the API (subjects, levels, formats) stay in English; only the
// labels shown to visitors are translated. The admin dashboard stays English.

const KEY = 'kangyan-lang'

const en = {
  htmlLang: 'en',
  meta: {
    title: 'Private Science & Maths Tutor | UEC, SPM & IGCSE | Kangyan',
    description: 'Private 1-to-1 and group tuition in Physics, Chemistry, Biology, Science and Maths for UEC (独中统考), SPM and IGCSE. Online across Malaysia. Enquire in a minute.',
  },
  seo: {
    title: 'Private Science & Maths tutor for UEC, SPM and IGCSE',
    intro: 'Private 1-to-1 and small-group tuition in Physics, Chemistry, Biology, Science and Mathematics. Online lessons across Malaysia, in-person lessons by arrangement, on weekday evenings.',
    groups: [
      { name: 'UEC (独中统考)', levels: 'Junior 1–3 · Senior 1–3', subjects: 'Physics, Chemistry, Biology, Science, Mathematics' },
      { name: 'SPM / KSSM', levels: 'Form 1–5', subjects: 'Physics, Chemistry, Biology, Science, Mathematics' },
      { name: 'IGCSE', levels: 'Year 7–11', subjects: 'Physics 0625, Chemistry 0620, Biology 0610, Mathematics 0580' },
    ],
    pricing: {
      title: 'Fees',
      items: [
        { name: 'Group class, junior (Form 1–3)', price: 'RM280 / month', note: '4 lessons a month' },
        { name: 'Group class, senior (Form 4–6)', price: 'RM320 / month', note: '4 lessons a month' },
        { name: 'Private 1-to-1', price: 'From RM70 / hour', note: 'Depends on online or in person, and for in-person lessons, the location' },
      ],
    },
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
      enquirer: 'Please choose parent or student.',
      name: "Please enter the student's name.",
      lessonType: 'Please choose 1-to-1 or a group class.',
      level: 'Please choose a level.',
      school: 'Please tell me the school.',
      subjects: 'Please choose at least one subject.',
      format: 'Please choose online or in person.',
      location: 'Please enter where lessons would be.',
      phone: 'That WhatsApp number looks too short.',
      email: "That email doesn't look right.",
      contact: 'Please add a WhatsApp number or an email.',
    },
    who: {
      q: "Who's filling this in?",
      help: "Just so I know who I'm talking to.",
      parent: { title: "I'm a parent", desc: 'Enquiring for my child' },
      student: { title: "I'm the student", desc: 'Enquiring for myself' },
    },
    name: {
      q: { parent: "What's your child's name?", student: "What's your name?" },
      help: "Let's find the right class. This takes about a minute.",
      ph: { parent: "Your child's full name", student: 'Your full name' },
    },
    type: {
      q: (n, who) => (who === 'parent' ? `Private 1-to-1 or a group class for ${n}?` : `Hi ${n}! Private 1-to-1 or a group class?`),
      help: 'You can change this later.',
      private: { title: 'Private 1-to-1', desc: "Lessons built around one student's pace and gaps.", price: 'From RM70 / hour' },
      group: { title: 'Group class', desc: 'Learn alongside a few students at the same level.', price: 'RM280–320 / month · 4 lessons' },
      unavailable: 'No open slots right now',
      fullBadge: 'Full',
      noGroup: "Group classes are full right now. Please choose Private 1-to-1, and I'll let you know when a group class opens.",
      noPrivate: 'Private slots are full right now. Please choose a group class.',
      allFull: "All slots are full at the moment. You can still enquire and I'll let you know when one opens.",
    },
    level: { q: (n, who) => (who === 'parent' ? `Which level is ${n} in?` : 'Which level are you in?'), help: 'Chinese independent school (UEC), national school (SPM) or IGCSE.' },
    school: {
      q: (n, who) => (who === 'parent' ? `Which school does ${n} go to?` : 'Which school do you go to?'),
      help: "Start typing and pick from the list. If it isn't there, just type the full name.",
      ph: 'e.g. Foon Yew, SMK Damansara Jaya, 循人',
      noMatch: "Not on the list? That's fine. I'll use the name you typed.",
    },
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
      title: (n, who) => (who === 'parent' ? 'Thank you!' : `Thanks, ${n}!`),
      text: (n, who) => (who === 'parent'
        ? `I've received your enquiry for ${n}. I'll reply within 48 hours with a suggested time and the fees.`
        : "Your enquiry is in. I'll reply within 48 hours with a suggested time and the fees."),
      again: 'Start a new enquiry',
    },
  },
  footer: { rights: (y) => `© ${y} Kangyan` },
  labels: {
    lessonTypes: { private: 'Private 1-to-1', group: 'Group class' },
    enquirers: { parent: 'Parent', student: 'Student' },
    schoolTypes: { dz: 'Independent', smjk: 'SMJK', gov: 'National', mrsm: 'MRSM', intl: 'International' },
    subjects: { Physics: 'Physics', Chemistry: 'Chemistry', Biology: 'Biology', Science: 'Science', Mathematics: 'Maths' },
    levelGroups: { uec: 'Chinese independent · UEC', kssm: 'National school · SPM', igcse: 'International · IGCSE', other: 'Other' },
    levels: {
      'UEC Junior 1': 'Junior 1', 'UEC Junior 2': 'Junior 2', 'UEC Junior 3': 'Junior 3',
      'UEC Senior 1': 'Senior 1', 'UEC Senior 2': 'Senior 2', 'UEC Senior 3': 'Senior 3',
      'IGCSE Year 7': 'Year 7', 'IGCSE Year 8': 'Year 8', 'IGCSE Year 9': 'Year 9', 'IGCSE Year 10': 'Year 10', 'IGCSE Year 11': 'Year 11',
    },
    formats: { online: 'Online', 'in-person': 'In person', either: 'Online or in person' },
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
}

const zh = {
  htmlLang: 'zh-Hans',
  meta: {
    title: '理科与数学私人补习老师｜独中统考、SPM、IGCSE｜Kangyan',
    description: '物理、化学、生物、科学、数学一对一私人补习与小组课，适合独中统考（初中、高中）、国中 SPM 和 IGCSE 学生。全马网课，平日晚上开课，一分钟完成咨询。',
  },
  seo: {
    title: '独中统考、SPM、IGCSE 理科与数学私人补习',
    intro: '物理、化学、生物、科学、数学的一对一私人补习和小组课。全马网课，面对面上课可另约，平日晚上开课。',
    groups: [
      { name: '独中统考（UEC）', levels: '初一至初三 · 高一至高三', subjects: '物理、化学、生物、科学、数学' },
      { name: '国中 SPM / KSSM', levels: '中一至中五', subjects: '物理、化学、生物、科学、数学' },
      { name: 'IGCSE', levels: '七年级至十一年级', subjects: '物理 0625、化学 0620、生物 0610、数学 0580' },
    ],
    pricing: {
      title: '学费',
      items: [
        { name: '初中小组课（中一至中三）', price: 'RM280 / 月', note: '每月 4 堂课' },
        { name: '高中小组课（中四至中六）', price: 'RM320 / 月', note: '每月 4 堂课' },
        { name: '一对一私人课', price: 'RM70 / 小时起', note: '视网课或面对面而定，面对面课也看上课地点' },
      ],
    },
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
      enquirer: '请选择家长或学生。',
      name: '请填写学生姓名。',
      lessonType: '请选择一对一或小组课。',
      level: '请选择年级。',
      school: '请填写学校名称。',
      subjects: '请至少选一个科目。',
      format: '请选择网课或面对面。',
      location: '请填写上课地点。',
      phone: 'WhatsApp 号码好像少了几个数字。',
      email: '电邮好像不太对，再检查一下？',
      contact: '请留个 WhatsApp 号码或电邮，我才联系得到你。',
    },
    who: {
      q: '请问你是？',
      help: '方便我知道怎么称呼你。',
      parent: { title: '我是家长', desc: '帮孩子咨询补习' },
      student: { title: '我是学生', desc: '自己来咨询' },
    },
    name: {
      q: { parent: '孩子叫什么名字？', student: '你叫什么名字？' },
      help: '大概一分钟就能填完，我好帮你安排合适的课。',
      ph: { parent: '孩子的姓名', student: '你的姓名' },
    },
    type: {
      q: (n, who) => (who === 'parent' ? `想帮${n}报一对一，还是小组课？` : `${n}，想上一对一，还是小组课？`),
      help: '还没想好也没关系，之后可以再改。',
      private: { title: '一对一私人课', desc: '整堂课只顾一位学生，跟着他的进度和弱项来教。', price: 'RM70 / 小时起' },
      group: { title: '小组课', desc: '几位程度相近的同学一起上，互相讨论、一起进步。', price: 'RM280–320 / 月 · 每月 4 堂' },
      unavailable: '暂时没有空位',
      fullBadge: '已满',
      noGroup: '小组课目前都满了，先选一对一吧。一有小组课空位，我会马上通知你。',
      noPrivate: '一对一目前都满了，可以先报小组课。',
      allFull: '目前所有时段都满了。不过你还是可以先留个资料，一有空位我就联系你。',
    },
    level: { q: (n, who) => (who === 'parent' ? `${n}现在读几年级？` : '你现在读几年级？'), help: '独中、国中、国际学校都可以。' },
    school: {
      q: (n, who) => (who === 'parent' ? `${n}在哪间学校读书？` : '你在哪间学校读书？'),
      help: '打几个字就会出现学校名单，点选就好。找不到的话，直接打全名也可以。',
      ph: '例如：宽柔、循人、SMK Damansara Jaya',
      noMatch: '名单里没有也没关系，就用你打的校名。',
    },
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
      title: (n, who) => (who === 'parent' ? '谢谢你！' : `谢谢你，${n}！`),
      text: (n, who) => (who === 'parent'
        ? `已经收到${n}的补习资料。我会在 48 小时内通过 WhatsApp 或电邮联系你，跟你确认上课时间和学费。`
        : '资料已经收到了。我会在 48 小时内通过 WhatsApp 或电邮联系你，跟你确认上课时间和学费。'),
      again: '再填一份',
    },
  },
  footer: { rights: (y) => `© ${y} Kangyan` },
  labels: {
    lessonTypes: { private: '一对一', group: '小组课' },
    enquirers: { parent: '家长', student: '学生本人' },
    schoolTypes: { dz: '独中', smjk: '国民型', gov: '国中', mrsm: 'MRSM', intl: '国际/私立' },
    subjects: { Physics: '物理', Chemistry: '化学', Biology: '生物', Science: '科学', Mathematics: '数学' },
    levelGroups: { uec: '独中（统考）', kssm: '国中（SPM）', igcse: '国际学校（IGCSE）', other: '其他' },
    levels: {
      'UEC Junior 1': '初一', 'UEC Junior 2': '初二', 'UEC Junior 3': '初三',
      'UEC Senior 1': '高一', 'UEC Senior 2': '高二', 'UEC Senior 3': '高三',
      'Form 1': '中一', 'Form 2': '中二', 'Form 3': '中三', 'Form 4': '中四', 'Form 5': '中五',
      'IGCSE Year 7': '七年级', 'IGCSE Year 8': '八年级', 'IGCSE Year 9': '九年级', 'IGCSE Year 10': '十年级', 'IGCSE Year 11': '十一年级', Other: '其他',
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

/** True on the Chinese entry page (/zh or /zh/), which search engines index separately. */
export const onZhPath = () => /^\/zh\/?$/.test(window.location.pathname)

function initialLang() {
  try {
    if (onZhPath()) return 'zh'
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
  }

  // Keep the address bar clean: a shared ?lang=zh / ?lang=en link is read once
  // (in initialLang) and then removed from the URL.
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const zhPath = onZhPath()
      if (!url.searchParams.has('lang') && !zhPath) return
      // Remember the language the link chose, so a refresh on the cleaned URL keeps it.
      localStorage.setItem(KEY, lang)
      url.searchParams.delete('lang')
      window.history.replaceState(null, '', (zhPath ? '/' : url.pathname) + (url.search || '') + url.hash)
    } catch { /* ignore */ }
  }, [])

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
