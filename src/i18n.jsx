import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// English + Simplified Chinese copy for the public enquiry site.
// Values sent to the API (subjects, levels, formats) stay in English; only the
// labels shown to visitors are translated. The admin dashboard stays English.

const KEY = 'kangyan-lang'

const en = {
  htmlLang: 'en',
  meta: {
    title: 'Science & Maths Tuition for UEC, SPM & IGCSE | Small Groups & 1-to-1 | Kangyan',
    description: 'Live online group classes (2–5 students) and private 1-to-1 tuition in Physics, Chemistry, Biology, Science and Maths for UEC (独中统考), SPM and IGCSE. Group classes from RM280 a month. Enquire in a minute.',
  },
  seo: {
    title: 'Science & Maths tuition for UEC, SPM and IGCSE',
    intro: 'Live, interactive group classes of 2–5 students and private 1-to-1 lessons in Physics, Chemistry, Biology, Science and Mathematics. Every lesson comes with notes and exercises. Online across Malaysia on weekday evenings, with in-person lessons by arrangement.',
    groups: [
      { name: 'UEC (独中统考)', levels: 'Junior 1–3 · Senior 1–3', subjects: 'Physics, Chemistry, Biology, Science, Mathematics' },
      { name: 'SPM / KSSM', levels: 'Form 1–5', subjects: 'Physics, Chemistry, Biology, Science, Mathematics' },
      { name: 'IGCSE', levels: 'Year 7–11', subjects: 'Physics 0625, Chemistry 0620, Biology 0610, Mathematics 0580' },
    ],
    pricing: {
      title: 'Fees',
      items: [
        { name: 'Junior group class', price: 'RM280 / month', note: 'Form 1–3 · Junior 1–3 · Year 7–9. 4 lessons a month.' },
        { name: 'Senior group class', price: 'RM320 / month', note: 'Form 4–6 · Senior 1–3 · Year 10–11. 4 lessons a month.' },
        { name: 'Private 1-to-1', price: 'From RM70 / hour', note: 'The rate depends on online or in person and, for in-person lessons, the location.' },
      ],
    },
  },
  nav: { switchLabel: 'Language / 语言' },
  intro: {
    eyebrow: 'UEC · SPM · IGCSE · Science & Maths tuition',
    title: ['Science & Maths, taught so it ', 'finally clicks', '.'],
    sub: "Small group classes and private 1-to-1 lessons for UEC, SPM and IGCSE. Answer a few quick questions and I'll reply within 48 hours. Free, no commitment.",
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
      help: 'A few quick questions and I can recommend the right class. About a minute.',
      ph: { parent: "Your child's full name", student: 'Your full name' },
    },
    type: {
      q: (n, who) => (who === 'parent' ? `Private 1-to-1 or a group class for ${n}?` : 'Private 1-to-1 or a group class?'),
      help: 'Fees shown are for this level. You can change your mind later.',
      private: { title: 'Private 1-to-1', desc: "Fully tailored to one student's pace, gaps and goals.", price: 'From RM70 / hour' },
      group: { title: 'Group class', desc: '2–5 students at the same level. Live, interactive, notes included.', price: (fee) => (fee ? `RM${fee} / month · 4 lessons` : 'RM280–320 / month · 4 lessons') },
      unavailable: 'No open slots right now',
      fullBadge: 'Full',
      noGroup: "Group classes are full right now. Please choose Private 1-to-1, and I'll let you know when a group class opens.",
      noPrivate: 'Private slots are full right now. Please choose a group class.',
      allFull: "All slots are full at the moment. You can still enquire and I'll let you know when one opens.",
    },
    level: { q: (n, who) => (who === 'parent' ? `Which level is ${n} in?` : `Hi ${n}! Which level are you in?`), help: 'Chinese independent school (UEC), national school (SPM) or IGCSE. This sets the fee.' },
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
      custom: {
        q: 'When would in-person lessons suit you?',
        limited: "My in-person availability is very limited, but please still let me know what suits you. If I can't fit you in, I can refer you to another tutor.",
        help: "Tap the days that work, then the times of day. I'll confirm the exact time with you.",
        daysQ: 'Which days?',
        partsQ: 'What time of day?',
        many: 'pick as many as you like',
        parts: { morning: ['Morning', '9am–12pm'], afternoon: ['Afternoon', '12–5pm'], evening: ['Evening', '5–9pm'] },
        summary: (days, parts) => `${days.join(', ')} · ${parts.join(', ').toLowerCase()}`,
        needPart: 'Now pick a time of day.',
        needDay: 'Now pick at least one day.',
      },
      none: 'No times picked',
      taken: 'Full',
    },
    format: {
      q: 'Online or in person?',
      opts: { online: ['Online', 'Learn from home'], 'in-person': ['In person', 'At your place or nearby'], either: ['Either works', 'Whatever fits best'] },
      location: 'Where would lessons be?',
      locationPh: 'Area or address, e.g. Cheras, Kuala Lumpur',
      locationHint: "Lessons are near where the student lives. I'll confirm whether I can travel there.",
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
  faq: {
    title: 'Frequently asked questions',
    intro: "Everything parents and students usually ask before starting. Still unsure? Send an enquiry and ask me directly.",
    items: [
      { q: 'How do group classes work?', a: [
        'Each group has 2 to 5 students at the same level, so everyone gets attention. Classes are live and interactive: students keep their webcam on, ask questions at any point and work through problems together.',
        'Notes and exercises are provided for every lesson. All you need is a laptop, tablet or phone that can join an online meeting.',
      ] },
      { q: 'How much are the fees?', a: [
        'Group classes are RM280 a month for junior levels (Form 1–3, Junior 1–3, Year 7–9) and RM320 a month for senior levels (Form 4–6, Senior 1–3, Year 10–11). Each month has 4 lessons.',
        'Private 1-to-1 lessons start from RM70 an hour. The final rate depends on whether lessons are online or in person and, for in-person lessons, the location.',
      ] },
      { q: 'Do fees change over time?', a: [
        'Group class fees stay the same throughout each stage. All of junior (Form 1–3, Junior 1–3, Year 7–9) is RM280 a month, and all of senior (Form 4–6, Senior 1–3, Year 10–11) is RM320 a month. The fee changes only once, when the student moves up from junior to senior, for example from Form 3 to Form 4.',
        'Private 1-to-1 rates go up by RM5 an hour each year.',
      ] },
      { q: 'When are fees paid?', a: [
        "Fees are paid at the start of each month. If payment is more than 2 weeks late, the student can't join lessons until it is settled.",
      ] },
      { q: 'Do you teach in person?', a: [
        "Yes, where it works. In-person lessons take place near where the student lives, depending on whether I can travel to the area. Share your location in the enquiry and we'll agree the details together.",
      ] },
      { q: 'Are in-person 1-to-1 lessons available on weekdays?', a: [
        "Weekday in-person 1-to-1 slots are very limited. Please still send an enquiry: if I don't have a slot that suits you, I can refer you to another tutor.",
      ] },
      { q: "What if the student can't make a lesson?", a: [
        'Please let me know at least 12 hours before the lesson, ideally the day before, especially for 1-to-1.',
        "For 1-to-1, a lesson cancelled at least 12 hours ahead can be replaced at a time we agree on. With less than 12 hours' notice, the lesson is forfeited and not replaced.",
      ] },
      { q: 'Are missed group classes replaced?', a: [
        'Group classes run on a fixed schedule, so missed classes are not replaced. A recording of the class is available on request, so the student can catch up.',
      ] },
      { q: 'How do I get started?', a: [
        "Fill in the enquiry form above. It takes about a minute. I'll reply within 48 hours by WhatsApp or email with a suggested time and the fees.",
      ] },
    ],
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
    title: '理科与数学补习｜独中统考、SPM、IGCSE｜小组课与一对一｜Kangyan',
    description: '物理、化学、生物、科学、数学线上小组课（每班 2–5 人）与一对一私人补习，适合独中统考、国中 SPM 和 IGCSE 学生。小组课每月 RM280 起，一分钟完成咨询。',
  },
  seo: {
    title: '独中统考、SPM、IGCSE 理科与数学补习',
    intro: '物理、化学、生物、科学、数学的线上互动小组课（每班 2–5 人）和一对一私人补习，每堂课都附笔记和练习。全马网课，周一至周五晚上上课，面对面课可另外安排。',
    groups: [
      { name: '独中统考（UEC）', levels: '初一至初三 · 高一至高三', subjects: '物理、化学、生物、科学、数学' },
      { name: '国中 SPM / KSSM', levels: '中一至中五', subjects: '物理、化学、生物、科学、数学' },
      { name: 'IGCSE', levels: '七年级至十一年级', subjects: '物理 0625、化学 0620、生物 0610、数学 0580' },
    ],
    pricing: {
      title: '学费',
      items: [
        { name: '初中小组课', price: 'RM280 / 月', note: '初一至初三 · 中一至中三 · 七至九年级，每月 4 堂课。' },
        { name: '高中小组课', price: 'RM320 / 月', note: '高一至高三 · 中四至中六 · 十至十一年级，每月 4 堂课。' },
        { name: '一对一私人课', price: 'RM70 / 小时起', note: '实际收费视网课或面对面而定，面对面课也看上课地点。' },
      ],
    },
  },
  nav: { switchLabel: 'Language / 语言' },
  intro: {
    eyebrow: '独中统考 · SPM · IGCSE ｜ 理科、数学补习',
    title: ['理科和数学，', '真正学懂', '才有好成绩。'],
    sub: '独中统考、SPM、IGCSE 小组课与一对一私人补习。花一分钟回答几个问题，我会在 48 小时内亲自回复。咨询免费，没有任何承诺。',
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
      help: '回答几个简单问题，我就能推荐合适的课，大约一分钟。',
      ph: { parent: '孩子的姓名', student: '你的姓名' },
    },
    type: {
      q: (n, who) => (who === 'parent' ? `想帮${n}报一对一，还是小组课？` : '想上一对一，还是小组课？'),
      help: '以下是这个年级的学费，之后想改也可以。',
      private: { title: '一对一私人课', desc: '完全按照学生的进度、弱项和目标来教。', price: 'RM70 / 小时起' },
      group: { title: '小组课', desc: '每班 2–5 位同年级同学，线上互动教学，附笔记和练习。', price: (fee) => (fee ? `RM${fee} / 月 · 每月 4 堂` : 'RM280–320 / 月 · 每月 4 堂') },
      unavailable: '暂时没有空位',
      fullBadge: '已满',
      noGroup: '小组课目前都满了，先选一对一吧。一有小组课空位，我会马上通知你。',
      noPrivate: '一对一目前都满了，可以先报小组课。',
      allFull: '目前所有时段都满了。不过你还是可以先留个资料，一有空位我就联系你。',
    },
    level: { q: (n, who) => (who === 'parent' ? `${n}现在读几年级？` : `${n}你好！你现在读几年级？`), help: '独中、国中、国际学校都可以，学费按年级计算。' },
    school: {
      q: (n, who) => (who === 'parent' ? `${n}在哪间学校读书？` : '你在哪间学校读书？'),
      help: '打几个字就会出现学校名单，点选就好。找不到的话，直接打全名也可以。',
      ph: '例如：宽柔、循人、SMK Damansara Jaya',
      noMatch: '名单里没有也没关系，就用你打的校名。',
    },
    subjects: { q: '想补哪些科目？', help: '可以选不止一科。' },
    times: {
      q: '哪些时间比较方便？',
      help: { private: '以下是一对一的周一至周五晚上时段，可以多选几个。', group: '以下是小组课的周一至周五晚上时段，可以多选几个。' },
      empty: (type) => `${type}暂时没有开放的时段。直接按下一步，我再跟你约时间。`,
      noGroup: '现在没有小组课可以选。改成一对一，就能看到可以预约的时间。',
      switchPrivate: '改选一对一',
      allTaken: (type) => `${type}的时段暂时都满了。按下一步，我再跟你商量其他时间。`,
      loading: '正在载入时间表…',
      error: '时间表暂时打不开。直接按下一步，我再跟你约时间。',
      flexible: '时间都可以',
      picked: (n) => `已选 ${n} 个时段`,
      custom: {
        q: '面对面上课，什么时间比较方便？',
        limited: '我的面对面课时段非常有限，不过还是欢迎你先告诉我方便的时间。如果我排不出时间，可以介绍其他老师给你。',
        help: '选好方便的星期，再选时段就可以，确切时间我会再跟你确认。',
        daysQ: '哪几天方便？',
        partsQ: '什么时段方便？',
        many: '可以多选',
        parts: { morning: ['上午', '9点–12点'], afternoon: ['下午', '12点–5点'], evening: ['晚上', '5点–9点'] },
        summary: (days, parts) => `${days.join('、')} · ${parts.join('、')}`,
        needPart: '再选一个时段。',
        needDay: '再选至少一天。',
      },
      none: '还没选时段',
      taken: '已满',
    },
    format: {
      q: '想上网课，还是面对面？',
      opts: { online: ['网课', '在家就能上'], 'in-person': ['面对面', '到你家或附近上课'], either: ['都可以', '看哪个方便'] },
      location: '上课地点大概在哪里？',
      locationPh: '例如：蕉赖、梳邦、八打灵再也',
      locationHint: '上课地点以学生住处附近为主，我能不能过去会再跟你确认。',
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
  faq: {
    title: '常见问题',
    intro: '家长和学生报名前最常问的问题都在这里。还有疑问的话，直接送出咨询问我就好。',
    items: [
      { q: '小组课是怎么上的？', a: [
        '每班 2 至 5 位同年级的学生，每个人都能被照顾到。全程线上直播互动，上课时需要开镜头，有问题随时可以问，大家一起讨论、一起做题。',
        '每堂课都会提供笔记和练习。只要有一部能进线上会议的电脑、平板或手机就可以上课。',
      ] },
      { q: '学费怎么算？', a: [
        '小组课：初中（初一至初三、中一至中三、七至九年级）每月 RM280；高中（高一至高三、中四至中六、十至十一年级）每月 RM320。每月 4 堂课。',
        '一对一私人课 RM70 / 小时起，实际收费视网课或面对面而定，面对面课也看上课地点。',
      ] },
      { q: '学费会调整吗？', a: [
        '小组课学费按初中、高中两个阶段计算，同一个阶段里不会涨价：整个初中（初一至初三、中一至中三、七至九年级）都是每月 RM280，整个高中（高一至高三、中四至中六、十至十一年级）都是每月 RM320。只有从初中升上高中时（例如中三升中四）才会调整一次。',
        '一对一私人课每年每小时调涨 RM5。',
      ] },
      { q: '学费什么时候缴？', a: [
        '学费在每个月初缴付。如果迟交超过两个星期，缴清之前将无法继续上课。',
      ] },
      { q: '可以面对面上课吗？', a: [
        '可以，视情况安排。面对面课的地点以学生住处附近为主，也要看我能不能到那一带。咨询时填上地区，我们再一起商量细节。',
      ] },
      { q: '周一至周五有一对一面对面课吗？', a: [
        '周一至周五的一对一面对面时段非常有限。还是欢迎先送出咨询，如果我没有适合的时段，可以介绍其他老师给你。',
      ] },
      { q: '学生没办法来上课怎么办？', a: [
        '请至少在上课前 12 小时通知我，最好提前一天，一对一课尤其重要。',
        '一对一课如果提前 12 小时或以上通知，可以跟我商量另外补课的时间；不到 12 小时才通知，该堂课将不会补回。',
      ] },
      { q: '小组课缺席可以补课吗？', a: [
        '小组课按固定时间进行，缺席不另外补课。如有需要，可以向我索取该堂课的录影，自己补上进度。',
      ] },
      { q: '要怎么开始？', a: [
        '填写上面的咨询表格就好，大约一分钟。我会在 48 小时内通过 WhatsApp 或电邮联系你，跟你确认上课时间和学费。',
      ] },
    ],
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

export function LangProvider({ children, title }) {
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
    document.title = title ? title(t) : t.meta.title
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
