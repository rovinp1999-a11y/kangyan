import { CONTACT } from '../data.js'
import { useLang } from '../i18n.jsx'

export default function Footer() {
  const { t } = useLang()
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span>{t.footer.rights(new Date().getFullYear())}</span>
        <div className="footer__social">
          <a href={`mailto:${CONTACT.email}`} aria-label="Email">
            <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z" /><path d="M22 6l-10 7L2 6" /></svg>
          </a>
        </div>
      </div>
    </footer>
  )
}
