import { useEffect, useState } from 'react'

const LINKS = [
  { href: '#subjects', label: 'Subjects' },
  { href: '#how', label: 'How it works' },
  { href: '#timetable', label: 'Timetable' },
  { href: '#faq', label: 'FAQ' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container nav__inner">
        <a href="#home" className="nav__logo" aria-label="Kangyan home">
          Kangyan<span className="dot" aria-hidden="true" />
        </a>
        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <a href="#enquire" className="btn btn--accent btn--sm">Enquire</a>
      </div>
    </header>
  )
}
