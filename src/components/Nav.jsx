import { useEffect, useState } from 'react'
import { useLang } from '../i18n.jsx'

export default function Nav() {
  const { t, lang, setLang } = useLang()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '#subjects', label: t.nav.subjects },
    { href: '#how', label: t.nav.how },
    { href: '#timetable', label: t.nav.timetable },
    { href: '#faq', label: t.nav.faq },
  ]

  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container nav__inner">
        <a href="#home" className="nav__logo" aria-label="Kangyan">
          Kangyan<span className="dot" aria-hidden="true" />
        </a>
        <nav className="nav__links" aria-label="Primary">
          {links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <div className="lang" role="group" aria-label="Language / 语言">
          <button type="button" className={lang === 'en' ? 'is-on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">EN</button>
          <button type="button" className={lang === 'zh' ? 'is-on' : ''} aria-pressed={lang === 'zh'} onClick={() => setLang('zh')} lang="zh-Hans">中文</button>
        </div>
        <a href="#enquire" className="btn btn--accent btn--sm nav__cta">{t.nav.cta}</a>
      </div>
    </header>
  )
}
