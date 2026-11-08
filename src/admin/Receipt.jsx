// An official receipt for one paid month, in the site's style: shown in a drawer, saved as a
// PDF (drawn from the receipt itself, so Chinese names and the site fonts come out right) and
// shared to the parent on WhatsApp. On phones the PDF itself is shared; on a computer it is
// downloaded and WhatsApp opens with the message ready, to attach it.
import { useEffect, useRef, useState } from 'react'
import { occurrences, monthRange } from '../../shared/schedule.js'
import { Icon, waLink } from './lib.jsx'
import { Drawer } from './Enquiries.jsx'
import { fill } from './templates.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const localPhone = (p) => (p?.startsWith('60') ? `0${p.slice(2)}` : p || '')
const money = (n) => `RM${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const SUBJECT = {
  en: {},
  zh: { Physics: '物理', Chemistry: '化学', Biology: '生物', Science: '科学', Mathematics: '数学' },
}
const RECEIPT_W = 600 // px; the PDF is drawn from the receipt at this width

const L = {
  en: {
    title: 'Receipt', no: 'Receipt no.', date: 'Date', period: 'Period', from: 'Received from', student: 'Student',
    desc: 'Description', qty: 'Qty', rate: 'Unit price', amount: 'Amount',
    fee: (m) => `Tuition fee, ${m}`, groupFee: 'Group class, monthly fee', tuition: 'Tuition',
    kind: { private: '1-to-1 lessons', group: 'Group class' }, count: (n) => `${n} lesson${n === 1 ? '' : 's'}`, absent: (n) => `incl. ${n} absence${n === 1 ? '' : 's'}`, hrs: (h) => `${h} hr${h === 1 ? '' : 's'}`,
    total: 'Total', paid: 'Amount paid', balance: 'Balance due', parentOf: (n) => `Parent of ${n}`,
    on: (d) => `Received on ${d}`, method: 'Payment', note: 'Note',
    thanks: 'Thank you for your payment.', valid: 'This is a computer-generated receipt and does not require a signature.',
    month: (m) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`,
    day: (d) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)} ${d.slice(0, 4)}`,
  },
  zh: {
    title: '收据', no: '收据编号', date: '日期', period: '期间', from: '付款人', student: '学生',
    desc: '项目', qty: '数量', rate: '单价', amount: '金额',
    fee: (m) => `学费（${m}）`, groupFee: '小组课月费', tuition: '补习',
    kind: { private: '一对一课', group: '小组课' }, count: (n) => `${n} 堂`, absent: (n) => `含 ${n} 次请假`, hrs: (h) => `${h} 小时`,
    total: '总额', paid: '已付金额', balance: '尚欠金额', parentOf: (n) => `${n}的家长`,
    on: (d) => `于${d}收讫`, method: '付款方式', note: '备注',
    thanks: '谢谢您的付款。', valid: '本收据由电脑生成，无需签名。',
    month: (m) => `${m.slice(0, 4)}年${Number(m.slice(5))}月`,
    day: (d) => `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`,
  },
}

/** Receipt number from the month and the student, so the same receipt always has the same number. */
export const receiptNo = (month, studentId) => `KY-${month.replace('-', '')}-${String(studentId).padStart(4, '0')}`

export function ReceiptDrawer({ s, fee, month, requests, notify, onClose }) {
  const [lang, setLang] = useState(s.lang === 'zh' ? 'zh' : 'en')
  const [busy, setBusy] = useState('')
  const sheet = useRef(null)
  const wrap = useRef(null)
  // The receipt is drawn at its full A4-like width; the preview is scaled down to fit the panel.
  const [fit, setFit] = useState(1)
  useEffect(() => {
    const el = wrap.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => setFit(Math.min(1, el.clientWidth / (RECEIPT_W + 8))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const t = L[lang]
  const no = receiptNo(month, s.id)
  const paidOn = fee.paid_at ? new Date(Date.parse(fee.paid_at) + 8 * 3600e3).toISOString().slice(0, 10) : null
  const [a, b] = monthRange(month)
  const held = occurrences(s, requests.filter((r) => r.student_id === s.id), a, b).filter((o) => o.status === 'lesson' || o.status === 'absent')

  // Line items worked out from what the student actually had that month: one line per class
  // type (1-to-1 / group) with its lessons and hours × the hourly rate, or the monthly fee for
  // group-only students. If the fee was changed by hand, one line with that amount.
  const breakdown = (lang) => {
    const t = L[lang]
    const title = (s.subjects || []).length ? s.subjects.map((x) => SUBJECT[lang][x] || x).join(lang === 'zh' ? '、' : ', ') : t.tuition
    const one = (detail) => [{ title, detail, qty: 1, unit: '', price: fee.amount || 0 }]
    if (s.lesson_type === 'group') return one(`${t.groupFee} · ${t.month(month)}`)
    const rate = s.hourly_rate || 70
    const lines = ['private', 'group'].map((k) => {
      const list = held.filter((o) => o.kind === k)
      const hrs = Math.round((list.reduce((n, o) => n + toMin(o.end) - toMin(o.start), 0) / 60) * 100) / 100
      const away = list.filter((o) => o.status === 'absent').length
      return list.length && { title, detail: [t.kind[k], t.count(list.length), away ? t.absent(away) : null].filter(Boolean).join(' · '), qty: hrs, unit: 'hrs', price: rate }
    }).filter(Boolean)
    const sum = lines.reduce((n, l) => n + l.qty * l.price, 0)
    return lines.length && Math.round(sum) === fee.amount ? lines : one(t.fee(t.month(month)))
  }
  const [edited, setEdited] = useState(null) // line items changed by hand (kept when switching language)
  const [editing, setEditing] = useState(false)
  const lines = edited || breakdown(lang)
  const num = (v) => Number(v) || 0 // qty and price can be half-typed text while editing
  const lineTotal = (l) => Math.round(num(l.qty) * num(l.price) * 100) / 100
  const total = Math.round(lines.reduce((n, l) => n + lineTotal(l), 0) * 100) / 100
  const paidAmt = fee.amount || 0
  const setLine = (i, k, v) => setEdited(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const parent = s.parent_name?.trim()
  const file = `Kangyan receipt ${no} ${s.name}.pdf`

  // Draw the receipt as it looks on screen onto an A4 page.
  const makePdf = async () => {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
    const canvas = await html2canvas(sheet.current, {
      scale: 2, backgroundColor: '#FFFFFF', useCORS: true,
      // Draw it full size, with the small text shifts html2canvas needs (it sets text a little low).
      onclone: (doc) => { doc.querySelector('.rcpt-fit').style.transform = 'none'; doc.querySelector('.rcpt').classList.add('rcpt--pdf') },
    })
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const w = 190
    const h = (canvas.height / canvas.width) * w
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 10, 10, w, Math.min(h, 277))
    pdf.setProperties({ title: `${t.title} ${no}`, author: 'Kangyan Tuition' })
    return pdf
  }
  const download = async () => {
    setBusy('pdf')
    try { (await makePdf()).save(file) } catch { notify('Could not make the PDF', 'error') } finally { setBusy('') }
  }
  const message = fill('receipt', lang, {
    name: parent || (lang === 'zh' ? '家长' : 'there'), student: lang === 'zh' ? s.name : s.name.split(/\s+/)[0],
    month: t.month(month), amount: fee.amount ?? '', receipt: no,
  })
  const to = s.parent_phone || s.phone
  const sendWhatsApp = async () => {
    setBusy('wa')
    try {
      const pdf = await makePdf()
      const shared = new File([pdf.output('blob')], file, { type: 'application/pdf' })
      // Phones: share the PDF straight into WhatsApp (pick the parent's chat).
      if (navigator.canShare?.({ files: [shared] })) {
        try { await navigator.share({ files: [shared], text: message }) } catch { /* closed the share sheet */ }
        return
      }
      // Computers: save the PDF, then open the parent's chat with the message to attach it to.
      pdf.save(file)
      window.open(waLink(to, message), '_blank', 'noopener')
      notify('PDF saved. Attach it in the WhatsApp chat that just opened.')
    } catch { notify('Could not make the PDF', 'error') } finally { setBusy('') }
  }

  return (
    <Drawer onClose={onClose} label={`Receipt for ${s.name}`}>
      <div className="rcpt-tools">
        <h2>Receipt</h2>
        <div className="kindpick kindpick--sm" role="group" aria-label="Receipt language">
          {[['en', 'English'], ['zh', '中文']].map(([k, v]) => (
            <button key={k} type="button" className={`kindpick__b ${lang === k ? 'is-on is-once' : ''}`} aria-pressed={lang === k} onClick={() => setLang(k)}>{v}</button>
          ))}
        </div>
        <div className="rcpt-tools__acts">
          <button type="button" className="btn btn--accent btn--sm" disabled={!!busy} onClick={download}><Icon name="download" />{busy === 'pdf' ? 'Making PDF…' : 'Download PDF'}</button>
          <button type="button" className="act act--wa" disabled={!!busy || !to} onClick={sendWhatsApp}><Icon name="chat" />{busy === 'wa' ? 'Preparing…' : s.parent_phone ? 'Send to parent on WhatsApp' : 'Send on WhatsApp'}</button>
        </div>
        <button type="button" className="act rcpt-tools__edit" onClick={() => setEditing((x) => !x)} aria-expanded={editing}><Icon name="edit" />{editing ? 'Done editing lines' : 'Edit lines'}</button>
        {editing && (
          <div className="rcpt-lines">
            {lines.map((l, i) => (
              <div className="rcpt-lines__row" key={i}>
                <input value={l.title} onChange={(e) => setLine(i, 'title', e.target.value)} aria-label={`Line ${i + 1} description`} placeholder="Description" />
                <input value={l.detail} onChange={(e) => setLine(i, 'detail', e.target.value)} aria-label={`Line ${i + 1} details`} placeholder="Details (optional)" />
                <label><span>Qty</span><input inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value.replace(/[^\d.]/g, ''))} /></label>
                <label><span>Unit</span>
                  <select value={l.unit} onChange={(e) => setLine(i, 'unit', e.target.value)}><option value="hrs">hours</option><option value="">items</option></select>
                </label>
                <label><span>Price (RM)</span><input inputMode="decimal" value={l.price} onChange={(e) => setLine(i, 'price', e.target.value.replace(/[^\d.]/g, ''))} /></label>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => setEdited(lines.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1}><Icon name="x" /></button>
              </div>
            ))}
            <div className="rcpt-tools__acts">
              <button type="button" className="act" onClick={() => setEdited([...lines, { title: '', detail: '', qty: 1, unit: '', price: 0 }])}><Icon name="plus" />Add a line</button>
              {edited && <button type="button" className="act" onClick={() => setEdited(null)}>Back to automatic</button>}
            </div>
            {total !== paidAmt && <p className="rcpt-lines__warn">These lines add up to {money(total)}, but {money(paidAmt)} was paid, so the receipt shows a balance of {money(Math.max(0, total - paidAmt))}. Change the lines or the month's fee on the Fees tab.</p>}
          </div>
        )}
        <small>{s.parent_phone ? `Goes to ${parent || 'the parent'} · ${localPhone(s.parent_phone)}` : `No parent number yet: goes to ${s.name}'s number ${localPhone(s.phone)}.`}</small>
      </div>

      <div className="rcpt-wrap" ref={wrap} style={{ height: sheet.current ? sheet.current.offsetHeight * fit + 10 : undefined }}>
        <div className="rcpt-fit" style={{ transform: `scale(${fit})` }}>
        <article className="rcpt" ref={sheet} lang={lang === 'zh' ? 'zh' : 'en'} style={{ width: RECEIPT_W }}>
          <header className="rcpt__head">
            <div className="rcpt__brand">
              <p className="rcpt__logo">Kangyan<i aria-hidden="true" /></p>
              <p>kangyan.work</p>
              <p>kangyan1204@gmail.com</p>
            </div>
            <div className="rcpt__doc">
              <h3>{t.title}</h3>
              <dl>
                <dt>{t.no}</dt><dd>{no}</dd>
                <dt>{t.date}</dt><dd>{paidOn ? t.day(paidOn) : '—'}</dd>
                <dt>{t.period}</dt><dd>{t.month(month)}</dd>
              </dl>
            </div>
          </header>

          <section className="rcpt__parties">
            <div><span>{t.from}</span><b>{parent || t.parentOf(s.name)}</b>{parent && <small>{t.parentOf(s.name)}</small>}</div>
            <div><span>{t.student}</span><b>{s.name}</b>{s.level && <small>{s.level}</small>}</div>
          </section>

          <table className="rcpt__table">
            <thead><tr><th>{t.desc}</th><th>{t.qty}</th><th>{t.rate}</th><th>{t.amount}</th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td><b>{l.title}</b>{l.detail && <small>{l.detail}</small>}</td>
                  <td>{l.unit === 'hrs' ? t.hrs(num(l.qty)) : num(l.qty)}</td>
                  <td>{money(num(l.price))}</td>
                  <td>{money(lineTotal(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="rcpt__bottom">
            <div className="rcpt__pay">
              {paidOn && <p>{t.on(t.day(paidOn))}</p>}
              {fee.note && <p>{t.method}: {fee.note}</p>}
            </div>
            <dl className="rcpt__totals">
              <dt>{t.total}</dt><dd>{money(total)}</dd>
              <dt>{t.paid}</dt><dd>{money(paidAmt)}</dd>
              <dt className="is-due">{t.balance}</dt><dd className="is-due">{money(Math.max(0, total - paidAmt))}</dd>
            </dl>
          </div>

          <footer className="rcpt__foot">
            <p>{t.thanks}</p>
            <p>{t.valid}</p>
          </footer>
        </article>
        </div>
      </div>
    </Drawer>
  )
}
