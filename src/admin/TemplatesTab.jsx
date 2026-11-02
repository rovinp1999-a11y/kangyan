// Edit the WhatsApp messages behind every one-click button, in English and 中文.
import { useRef, useState } from 'react'
import { TEMPLATES, templateText, setSavedTemplates } from './templates.js'
import { api } from './lib.jsx'

const SAMPLE = {
  name: 'Mei Ling', class: 'Private 1-to-1', level: 'Form 4', subjects: 'Physics, Chemistry', times: 'Mon 5:30–7 PM', lessons: 'Online',
  link: 'https://kangyan.work/student', phone: '012-345 6789', pin: '482913', what: 'moving your lesson on Wed 11 Nov to Tue 10 Nov 2:30–4 PM',
  reply: '\n\nSee you then!', month: 'November 2026', amount: '280', due: '1 Nov', student: 'Mei Ling',
}

function Editor({ t, value, onChange }) {
  const refs = { en: useRef(null), zh: useRef(null) }
  const [last, setLast] = useState('en')
  const insert = (v) => {
    const el = refs[last].current
    const text = value[last]
    const at = el ? el.selectionStart : text.length
    const next = `${text.slice(0, at)}{${v}}${text.slice(el ? el.selectionEnd : at)}`
    onChange({ ...value, [last]: next })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + v.length + 2, at + v.length + 2) })
  }
  const preview = value[last].replace(/\{(\w+)\}/g, (m, k) => SAMPLE[k] ?? m)
  const changed = value.en !== t.en || value.zh !== t.zh
  return (
    <section className="tpl">
      <header className="tpl__head">
        <div><h3>{t.title}</h3><p>{t.where}</p></div>
        {changed && <button type="button" className="stu-link" onClick={() => onChange({ en: t.en, zh: t.zh })}>Reset to default</button>}
      </header>
      <div className="tpl__vars">
        <span>Insert:</span>
        {t.vars.map((v) => <button type="button" key={v} onClick={() => insert(v)}>{`{${v}}`}</button>)}
      </div>
      <div className="tpl__langs">
        {['en', 'zh'].map((l) => (
          <label key={l} className="sform__f">
            <span>{l === 'en' ? 'English' : '中文'}</span>
            <textarea ref={refs[l]} rows={7} value={value[l]} onFocus={() => setLast(l)} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
          </label>
        ))}
      </div>
      <details className="tpl__preview">
        <summary>Preview ({last === 'en' ? 'English' : '中文'}, sample details)</summary>
        <pre>{preview}</pre>
      </details>
    </section>
  )
}

export function TemplatesTab({ notify, onAuthError }) {
  const [values, setValues] = useState(() => Object.fromEntries(TEMPLATES.map((t) => [t.key, { en: templateText(t.key, 'en'), zh: templateText(t.key, 'zh') }])))
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      // Only store what differs from the defaults, so improved defaults still reach untouched ones.
      const diff = Object.fromEntries(TEMPLATES.filter((t) => values[t.key].en !== t.en || values[t.key].zh !== t.zh)
        .map((t) => [t.key, { en: values[t.key].en !== t.en ? values[t.key].en : '', zh: values[t.key].zh !== t.zh ? values[t.key].zh : '' }]))
      const { templates } = await api('/api/admin/students', { method: 'POST', body: { action: 'saveTemplates', templates: diff } })
      setSavedTemplates(templates)
      notify('Templates saved')
    } catch (e) {
      e.unauthorized ? onAuthError() : notify(e.message, 'error')
    } finally { setBusy(false) }
  }
  return (
    <div className="tpls">
      <p className="adm-showing">These are the WhatsApp messages the one-click buttons open. Words in {'{braces}'} are filled in for each student. Messages go out in the student's own language.</p>
      {TEMPLATES.map((t) => <Editor key={t.key} t={t} value={values[t.key]} onChange={(v) => setValues((x) => ({ ...x, [t.key]: v }))} />)}
      <div className="tpls__save"><button type="button" className="btn btn--accent" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save templates'}</button></div>
    </div>
  )
}
