import Nav from './components/Nav.jsx'
import Hero from './components/Hero.jsx'
import Subjects from './components/Subjects.jsx'
import How from './components/How.jsx'
import BookingFlow from './components/BookingFlow.jsx'
import Faq from './components/Faq.jsx'
import Helix from './components/Helix.jsx'
import Footer from './components/Footer.jsx'
import AdminPage from './admin/AdminPage.jsx'

// Two routes only: "/" (public site) and "/admin" (tutor dashboard).
// vercel.json rewrites /admin to index.html so this works on Vercel.
export default function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/admin') return <AdminPage />

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Subjects />
        <How />
        <Helix />
        <BookingFlow />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
