import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// English + Simplified Chinese copy for the public site.
// Values sent to the API (subjects, levels, formats) stay in English; only the
// labels shown to visitors are translated. The admin dashboard stays English.

const KEY = 'kangyan-lang'

const en = {
  htmlLang: 'en',
  meta: {
    title: 'Kangyan | SPM & IGCSE Science and Maths Tutor',
    description: 'Physics, Chemistry, Biology, Science and Maths tuition for Form 1–5 (KSSM), SPM and IGCSE, online or in person. Check free weekly slots and send an enquiry. Reply within 48 hours.',
  },
  nav: { subjects: 'Subjects', how: 'How it works', timetable: 'Timetable', faq: 'FAQ', cta: 'Enquire', switchTo: '中文', switchLabel: '切换到中文' },
  hero: {
    eyebrow: 'Now accepting new students',
    sr: 'SPM and IGCSE Science and Maths tuition, taught so it clicks.',
    line1: 'SPM & IGCSE',
    afterWord: ' tuition,',
    line3: 'taught so it clicks',
    line3End: '.',
    words: ['Physics', 'Chemistry', 'Biology', 'Maths', 'Science'],
    lede: [
      "Hi, I'm ", 'Kangyan',
      '. I tutor Physics, Chemistry, Biology, Science and Mathematics for Form 1–5 (KSSM) and IGCSE. Lessons pair clear explanations with past-year paper practice, so students understand the topic and know how to answer it in the exam.',
    ],
    cta: 'Send an enquiry',
    cta2: 'Check my free slots',
    fine: 'Free to enquire · No commitment · Reply within 48 hours',
    trust: ['Online or in-person', 'One-to-one or small groups', 'Progress updates for parents'],
  },
  subjectsSec: {
    kicker: 'Subjects',
    title: 'What I teach',
    sub: "Form 1–5 KSSM and Cambridge IGCSE. Tell me the subject and level, and I'll shape the lessons around it.",
  },
  subjects: [
    { title: 'Physics', syll: 'SPM · IGCSE 0625', desc: 'Forces, electricity and waves, with the step-by-step working examiners give marks for.' },
    { title: 'Chemistry', syll: 'SPM · IGCSE 0620', desc: 'Mole calculations, bonding and organic chemistry, broken into steps that stick.' },
    { title: 'Biology', syll: 'SPM · IGCSE 0610', desc: 'Clear diagrams, the right key terms and how to write full-mark long answers.' },
    { title: 'Mathematics', syll: 'SPM · IGCSE 0580', desc: 'Algebra, graphs and statistics, practised until the methods feel automatic.' },
    { title: 'Science', syll: 'Form 1–3 · UASA', desc: 'Builds a solid base before students split into Physics, Chemistry and Biology.' },
  ],
  how: {
    kicker: 'How it works',
    title: 'Getting started is simple',
    steps: [
      { title: 'Pick a few times', desc: 'Tick the weekly slots that suit you. Not sure yet? Skip this step.' },
      { title: 'Send a short enquiry', desc: "Share the level, subjects and what you'd like help with. It takes about a minute." },
      { title: 'Hear back within 48 hours', desc: "I'll reply by WhatsApp or email with a confirmed time and the fees." },
    ],
    whyTitle: 'Why students learn with me',
    why: [
      'Concepts first, so students understand why and stop memorising blindly',
      'Past-year papers and marking schemes built into lessons',
      'A patient pace where every question is welcome',
      'Regular progress updates for parents',
    ],
  },
  book: {
    kicker: 'Enquire',
    title: 'Check my timetable, then send an enquiry',
    sub: "Choosing times is optional. Enquiring is free and doesn't commit you to anything.",
    contact: 'Rather message directly?',
    email: 'Email',
    sticky: 'Send an enquiry',
    stickyN: (n) => `Send enquiry · ${n} time${n > 1 ? 's' : ''} picked`,
  },
  tt: {
    title: 'Pick your times',
    optional: 'optional',
    loading: 'Loading…',
    none: 'No slots',
    error: "The timetable didn't load. You can still send an enquiry and I'll suggest times.",
    hint: 'Tap any times that work. Pick as many as you like.',
    selected: (n) => `${n} time${n > 1 ? 's' : ''} selected`,
    legendSel: 'Selected',
    legendTaken: 'Taken',
    taken: 'taken',
  },
  form: {
    title: 'Tell me about the student',
    name: "Student's name",
    namePh: 'Full name',
    email: 'Parent or student email',
    phone: 'WhatsApp number',
    optional: 'optional',
    level: 'Current level',
    levelPh: 'Choose a level…',
    subjects: 'Subjects needed',
    format: 'Lesson type',
    times: 'Preferred times',
    timesNone: ['None chosen yet. ', 'Pick from the timetable', ", or leave it and I'll suggest times."],
    remove: 'Remove',
    message: 'What would you like help with?',
    messagePh: 'e.g. Form 4, finds electricity hard, sitting SPM next year',
    submit: 'Send enquiry',
    sending: 'Sending…',
    fine: "Free and no commitment. I'll reply within 48 hours.",
    needSubject: 'Please choose at least one subject.',
    failed: 'Something went wrong. Please try again, or message me on WhatsApp.',
    doneTitle: (name) => `Thank you, ${name}!`,
    doneText: "Your enquiry has been sent. I'll get back to you within 48 hours by WhatsApp or email with a suggested time and the fees.",
    again: 'Send another enquiry',
  },
  faqSec: { kicker: 'FAQ', title: 'Questions parents often ask', sub: 'Something else on your mind?', subLink: 'Message me on WhatsApp' },
  faqs: [
    { q: 'How much are the fees?', a: "Fees depend on the level, subject and lesson length. I'll include them in my reply to your enquiry, so you know the cost before anything is booked." },
    { q: 'Do you teach online or in person?', a: "Both. Online lessons work from anywhere in Malaysia. For in-person lessons, mention your area in the enquiry and I'll let you know if it works." },
    { q: 'Which syllabus do you follow?', a: "Malaysian KSSM for Form 1–5 and SPM, and Cambridge IGCSE. Lessons follow the student's school topics and the exam format they'll sit." },
    { q: 'Is it one-to-one?', a: 'Most lessons are one-to-one. Small groups are possible if your child would like to learn with a friend or sibling.' },
    { q: 'What happens after I enquire?', a: "I'll reply within 48 hours to suggest a time and share fees. Nothing is booked and nothing is paid until you agree." },
  ],
  footer: {
    tag: 'Science and Maths tuition for Form 1–5 (KSSM), SPM and IGCSE · Online and in-person',
    rights: (y) => `© ${y} Kangyan. All rights reserved.`,
  },
  labels: {
    subjects: { Physics: 'Physics', Chemistry: 'Chemistry', Biology: 'Biology', Science: 'Science', Mathematics: 'Mathematics' },
    levels: {},
    formats: { online: 'Online', 'in-person': 'In-person', either: 'Either works' },
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
}

const zh = {
  htmlLang: 'zh-Hans',
  meta: {
    title: 'Kangyan | SPM 与 IGCSE 科学和数学补习老师',
    description: '中一至中五（KSSM）、SPM 及 IGCSE 的物理、化学、生物、科学和数学补习，线上或面对面上课。查看每周空档并发送咨询，48 小时内回复。',
  },
  nav: { subjects: '科目', how: '上课流程', timetable: '时间表', faq: '常见问题', cta: '咨询', switchTo: 'EN', switchLabel: 'Switch to English' },
  hero: {
    eyebrow: '现正招收新学生',
    sr: 'SPM 与 IGCSE 科学和数学补习，讲到你真正明白。',
    line1: 'SPM & IGCSE',
    afterWord: '补习，',
    line3: '讲到你真正明白',
    line3End: '。',
    words: ['物理', '化学', '生物', '数学', '科学'],
    lede: [
      '你好，我是 ', 'Kangyan',
      '。我教中一至中五（KSSM）及 IGCSE 的物理、化学、生物、科学和数学。课堂结合清楚的概念讲解和历年考题练习，让学生不只看懂题目，也知道考试时该怎么作答。',
    ],
    cta: '发送咨询',
    cta2: '查看空档时间',
    fine: '免费咨询 · 无需承诺 · 48 小时内回复',
    trust: ['线上或面对面上课', '一对一或小组', '定期向家长汇报进度'],
  },
  subjectsSec: {
    kicker: '科目',
    title: '我教的科目',
    sub: '涵盖中一至中五 KSSM 及 Cambridge IGCSE。告诉我科目和年级，我会按需求安排课程。',
  },
  subjects: [
    { title: '物理', syll: 'SPM · IGCSE 0625', desc: '力、电学和波，一步步写出考官会给分的解题过程。' },
    { title: '化学', syll: 'SPM · IGCSE 0620', desc: '摩尔计算、化学键到有机化学，拆成容易记住的步骤。' },
    { title: '生物', syll: 'SPM · IGCSE 0610', desc: '清楚的图解、正确的关键词，以及长答题的满分写法。' },
    { title: '数学', syll: 'SPM · IGCSE 0580', desc: '代数、图表和统计，反复练习直到解题方法变成本能。' },
    { title: '科学', syll: '中一至中三 · UASA', desc: '打好基础，为日后的物理、化学和生物做好准备。' },
  ],
  how: {
    kicker: '上课流程',
    title: '开始很简单',
    steps: [
      { title: '挑选时间', desc: '勾选适合你的每周时段。还不确定？可以先跳过。' },
      { title: '发送简短咨询', desc: '告诉我年级、科目和需要帮助的地方，大约一分钟就能完成。' },
      { title: '48 小时内收到回复', desc: '我会通过 WhatsApp 或电邮回复，确认上课时间和学费。' },
    ],
    whyTitle: '为什么学生选择跟我学',
    why: [
      '先讲懂概念，让学生明白原理，不再死记硬背',
      '课堂融入历年考题和评分标准',
      '节奏耐心，任何问题都欢迎提出',
      '定期向家长汇报学习进度',
    ],
  },
  book: {
    kicker: '咨询',
    title: '先看时间表，再发送咨询',
    sub: '选择时间不是必须的。咨询免费，也不需要任何承诺。',
    contact: '想直接联系？',
    email: '电邮',
    sticky: '发送咨询',
    stickyN: (n) => `发送咨询 · 已选 ${n} 个时间`,
  },
  tt: {
    title: '挑选时间',
    optional: '可选',
    loading: '载入中…',
    none: '暂无时段',
    error: '时间表暂时无法载入。你仍可发送咨询，我会建议上课时间。',
    hint: '点选适合的时间，可以多选。',
    selected: (n) => `已选 ${n} 个时间`,
    legendSel: '已选',
    legendTaken: '已满',
    taken: '已满',
  },
  form: {
    title: '告诉我学生的情况',
    name: '学生姓名',
    namePh: '全名',
    email: '家长或学生电邮',
    phone: 'WhatsApp 号码',
    optional: '可选',
    level: '目前年级',
    levelPh: '选择年级…',
    subjects: '需要的科目',
    format: '上课方式',
    times: '偏好时间',
    timesNone: ['还没选择。', '从时间表挑选', '，或留空让我建议时间。'],
    remove: '移除',
    message: '需要哪方面的帮助？',
    messagePh: '例如：中四，电学比较弱，明年考 SPM',
    submit: '发送咨询',
    sending: '发送中…',
    fine: '免费且无需承诺，我会在 48 小时内回复。',
    needSubject: '请至少选择一个科目。',
    failed: '发送失败，请稍后再试，或直接 WhatsApp 我。',
    doneTitle: (name) => `谢谢你，${name}！`,
    doneText: '你的咨询已送出。我会在 48 小时内通过 WhatsApp 或电邮回复，提供建议的上课时间和学费。',
    again: '再发送一个咨询',
  },
  faqSec: { kicker: '常见问题', title: '家长常问的问题', sub: '还有其他问题？', subLink: '直接 WhatsApp 我' },
  faqs: [
    { q: '学费是多少？', a: '学费视年级、科目和课时长短而定。我会在回复咨询时附上学费，让你在确认之前就清楚费用。' },
    { q: '线上还是面对面上课？', a: '两种都可以。线上课程适合全马任何地区。如需面对面上课，请在咨询中注明你的地区，我会告诉你是否可行。' },
    { q: '跟随哪个课程纲要？', a: '马来西亚 KSSM（中一至中五及 SPM）和 Cambridge IGCSE。课程会配合学生学校的进度和所考的考试格式。' },
    { q: '是一对一上课吗？', a: '大部分是一对一。如果孩子想和朋友或兄弟姐妹一起学，也可以安排小组课。' },
    { q: '发送咨询后会怎样？', a: '我会在 48 小时内回复，建议上课时间并提供学费。在你同意之前，不会有任何预约或付款。' },
  ],
  footer: {
    tag: '中一至中五（KSSM）、SPM 及 IGCSE 科学与数学补习 · 线上及面对面',
    rights: (y) => `© ${y} Kangyan。版权所有。`,
  },
  labels: {
    subjects: { Physics: '物理', Chemistry: '化学', Biology: '生物', Science: '科学', Mathematics: '数学' },
    levels: {
      'Form 1': '中一', 'Form 2': '中二', 'Form 3': '中三', 'Form 4': '中四', 'Form 5': '中五',
      'IGCSE Year 10': 'IGCSE 十年级', 'IGCSE Year 11': 'IGCSE 十一年级', Other: '其他',
    },
    formats: { online: '线上', 'in-person': '面对面', either: '都可以' },
    weekdays: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'],
    weekdaysShort: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  },
}

export const STRINGS = { en, zh }

/** Short slot label: '4–6 PM' in English, '下午4–6点' in Chinese. */
export function shortRange(start, end, lang = 'en') {
  const parse = (t) => {
    const [h, m] = t.split(':').map(Number)
    return { h, m }
  }
  const a = parse(start)
  const b = parse(end)
  if (lang === 'zh') {
    const period = (h) => (h < 12 ? '上午' : h === 12 ? '中午' : h < 18 ? '下午' : '晚上')
    const num = ({ h, m }) => `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, '0')}` : ''}`
    // An end time on the hour belongs to the period before it: 4–6 PM is 下午, 10–12 is 上午.
    const pa = period(a.h)
    const hb = b.m === 0 ? b.h - 1 : b.h
    const pb = hb === 12 && b.h !== 12 ? '下午' : period(hb)
    return pa === pb ? `${pa}${num(a)}–${num(b)}点` : `${pa}${num(a)}点–${pb}${num(b)}点`
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
