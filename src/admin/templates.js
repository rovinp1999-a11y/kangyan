// WhatsApp message templates for the one-click buttons. Each has English and 中文 text with
// {placeholders}; the tutor can rewrite them on the Message templates tab (saved in the
// database), and "Reset" goes back to these defaults.
export const TEMPLATES = [
  {
    key: 'enquiryParent', title: 'Reply to an enquiry (parent)', where: 'Enquiries → WhatsApp / Email',
    vars: ['name', 'class', 'level', 'subjects', 'times', 'lessons'],
    en: "Hi, this is Kangyan, the Science and Maths tutor. Thanks for your enquiry about tuition for {name}!\n\nHere's a quick summary of what you sent:\n• Class: {class}\n• Level: {level}\n• Subjects: {subjects}\n• Preferred times: {times}\n• Lessons: {lessons}\n\nI'd be happy to arrange a time for the first lesson and let you know the fees. When would be a good time to chat?",
    zh: '你好！我是 Kangyan，教理科和数学的补习老师。谢谢你帮{name}留下补习资料。\n\n我这边收到的是：\n• {class}\n• {level}\n• 科目：{subjects}\n• 偏好时间：{times}\n• 上课方式：{lessons}\n\n想跟你确认一下上课时间，顺便说明学费。请问什么时候方便聊聊？',
  },
  {
    key: 'enquiryStudent', title: 'Reply to an enquiry (student)', where: 'Enquiries → WhatsApp / Email',
    vars: ['name', 'class', 'level', 'subjects', 'times', 'lessons'],
    en: "Hi {name}, this is Kangyan, the Science and Maths tutor. Thanks for your enquiry about tuition!\n\nHere's a quick summary of what you sent:\n• Class: {class}\n• Level: {level}\n• Subjects: {subjects}\n• Preferred times: {times}\n• Lessons: {lessons}\n\nI'd be happy to arrange a time for the first lesson and let you know the fees. When would be a good time to chat?",
    zh: '{name}你好！我是 Kangyan，教理科和数学的补习老师。谢谢你留下补习资料。\n\n我这边收到的是：\n• {class}\n• {level}\n• 科目：{subjects}\n• 偏好时间：{times}\n• 上课方式：{lessons}\n\n想跟你确认一下上课时间，顺便说明学费。请问什么时候方便聊聊？',
  },
  {
    key: 'login', title: 'Login details (with PIN)', where: 'Students → Send login details / New PIN',
    vars: ['name', 'link', 'phone', 'pin'],
    en: 'Hi {name}! Here are your login details for Kangyan tuition:\n\n{link}\nWhatsApp number: {phone}\nPIN: {pin}\n\nThere you can see your upcoming lessons, report an absence, reschedule a lesson (at least 12 hours before) and check your fees. You can change your PIN after logging in.',
    zh: '{name}你好！这是 Kangyan 补习的学生登录资料：\n\n{link}\nWhatsApp 号码：{phone}\nPIN 码：{pin}\n\n登录后可以看到接下来的课、请假、改上课时间（至少提前 12 小时）和查看学费。登录后也可以自己更改 PIN 码。',
  },
  {
    key: 'pageReminder', title: 'Student page reminder', where: 'Students → WhatsApp',
    vars: ['name', 'link', 'phone'],
    en: "Hi {name}! A reminder that your Kangyan student page is here:\n\n{link}\nLog in with your WhatsApp number {phone} and your 6-digit PIN.\n\nForgot your PIN? Reply and I'll send you a new one.",
    zh: '{name}你好！提醒一下，Kangyan 补习的学生页面在这里：\n\n{link}\n登录：WhatsApp 号码 {phone} 加上你的 6 位数 PIN 码。\n\n忘记 PIN 码的话回复我，我再发新的给你。',
  },
  {
    key: 'accepted', title: 'Request accepted', where: 'Students → after Accept',
    vars: ['name', 'what', 'reply', 'link'],
    en: 'Hi {name}! Confirmed: {what}.{reply}\n\n{link}',
    zh: '{name}你好！已经确认：{what}。{reply}\n\n{link}',
  },
  {
    key: 'declined', title: 'Request declined', where: 'Students → after Decline',
    vars: ['name', 'what', 'reply', 'link'],
    en: "Hi {name}! Sorry, I can't do this one: {what}.{reply}\n\n{link}",
    zh: '{name}你好！抱歉，这次没办法安排：{what}。{reply}\n\n{link}',
  },
  {
    key: 'feeReminder', title: 'Fee reminder', where: 'Fees → Remind to pay',
    vars: ['name', 'month', 'amount', 'due', 'link'],
    en: 'Hi {name}! A gentle reminder that the tuition fee for {month} is RM{amount}, due {due}. Thank you!\n\nYou can see your fees here: {link}',
    zh: '{name}你好！温馨提醒：{month}的学费是 RM{amount}，请在{due}前缴付。谢谢！\n\n学费可以在这里查看：{link}',
  },
]

const DEFAULTS = Object.fromEntries(TEMPLATES.map((t) => [t.key, { en: t.en, zh: t.zh }]))
let saved = {}

/** Called once the admin data loads (and after saving on the templates tab). */
export function setSavedTemplates(t) { saved = t || {} }
export function templateText(key, lang) {
  const l = lang === 'zh' ? 'zh' : 'en'
  return saved[key]?.[l] || DEFAULTS[key][l]
}

/** Fill a template: {name} etc. Unknown placeholders are left as they are. */
export function fill(key, lang, vars) {
  return templateText(key, lang).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? vars[k] === 0 ? String(vars[k]) : m))
}
