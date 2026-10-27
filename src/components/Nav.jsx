import { useLang } from '../i18n.jsx'

export default function Nav() {
  const { t, lang, setLang } = useLang()
  return (
    <header className="nav">
      <div className="container nav__inner">
        <a href="/" className="nav__logo" aria-label="Kangyan">
          Kangyan<span className="dot" aria-hidden="true" />
        </a>
        <div className="lang" role="group" aria-label={t.nav.switchLabel}>
          <button type="button" className={lang === 'en' ? 'is-on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">EN</button>
          <button type="button" className={lang === 'zh' ? 'is-on' : ''} aria-pressed={lang === 'zh'} onClick={() => setLang('zh')} lang="zh-Hans">中文</button>
        </div>
      </div>
    </header>
  )
}
