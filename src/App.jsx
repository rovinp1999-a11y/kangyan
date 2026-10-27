import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import Wizard from './components/Wizard.jsx'
import MoleculeField from './components/MoleculeField.jsx'
import Doodles from './components/Doodles.jsx'
import AdminPage from './admin/AdminPage.jsx'
import { LangProvider, useLang } from './i18n.jsx'

// Two routes only: "/" (enquiry page) and "/admin" (tutor dashboard).
// vercel.json rewrites /admin to index.html so this works on Vercel.
function EnquiryPage() {
  const { t } = useLang()
  const [a, hl, b] = t.intro.title
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
      <Footer />
    </>
  )
}

export default function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/admin') return <AdminPage />
  return (
    <LangProvider>
      <EnquiryPage />
    </LangProvider>
  )
}
