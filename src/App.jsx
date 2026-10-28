import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import Wizard from './components/Wizard.jsx'
import MoleculeField from './components/MoleculeField.jsx'
import Doodles from './components/Doodles.jsx'
import LanguageGate from './components/LanguageGate.jsx'
import { lazy, Suspense, useState } from 'react'
import { LangProvider, useLang, onZhPath } from './i18n.jsx'
import SeoStrip from './components/SeoStrip.jsx'
import Faq from './components/Faq.jsx'

// The dashboard is only for the tutor, so visitors never download it.
const AdminPage = lazy(() => import('./admin/AdminPage.jsx'))
const StudentPage = lazy(() => import('./student/StudentPage.jsx'))

// Ask for a language once per visit (tab session). A refresh mid-enquiry doesn't ask
// again, and links that already say ?lang=en / ?lang=zh skip the question.
const PICKED_KEY = 'kangyan-lang-picked'
function needsLanguageChoice() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (q === 'en' || q === 'zh' || onZhPath()) {
      sessionStorage.setItem(PICKED_KEY, '1') // the link chose; don't ask after a refresh either
      return false
    }
    return sessionStorage.getItem(PICKED_KEY) !== '1'
  } catch {
    return true
  }
}

// Two routes only: "/" (enquiry page) and "/admin" (tutor dashboard).
// vercel.json rewrites /admin to index.html so this works on Vercel.
function EnquiryPage() {
  const { t, lang, setLang } = useLang()
  const [a, hl, b] = t.intro.title
  const [choosing, setChoosing] = useState(needsLanguageChoice)

  const pick = (code) => {
    setLang(code)
    try { sessionStorage.setItem(PICKED_KEY, '1') } catch { /* ignore */ }
    setChoosing(false)
  }

  if (choosing) {
    return (
      <>
        <main className="stage stage--gate">
          <MoleculeField />
          <Doodles />
          <div className="container stage__inner stage__inner--gate">
            <LanguageGate onPick={pick} current={lang} />
          </div>
        </main>
        <SeoStrip headingLevel={1} />
        <Faq />
        <Footer />
      </>
    )
  }

  return (
    <>
      <Nav />
      <main className="stage">
        <MoleculeField />
        <Doodles />
        <div className="container stage__inner">
          <div className="intro">
            <p className="eyebrow"><span className="pulse" aria-hidden="true" />{t.intro.eyebrow}</p>
            <h1>{a}<span className="hl">{hl}</span>{b}</h1>
            <p className="intro__sub">{t.intro.sub}</p>
          </div>
          <Wizard />
        </div>
      </main>
      <SeoStrip headingLevel={2} />
      <Faq />
      <Footer />
    </>
  )
}

export default function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/admin') return <Suspense fallback={null}><AdminPage /></Suspense>
  if (window.location.pathname.replace(/\/+$/, '') === '/student') {
    return (
      <LangProvider title={(t) => (t.htmlLang === 'en' ? 'Student — Kangyan' : '学生 — Kangyan')}>
        <Suspense fallback={null}><StudentPage /></Suspense>
      </LangProvider>
    )
  }
  return (
    <LangProvider>
      <EnquiryPage />
    </LangProvider>
  )
}
