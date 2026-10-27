import { CONTACT } from '../data.js'
import { useLang } from '../i18n.jsx'

export default function Footer() {
  const { t } = useLang()
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span>{t.footer.rights(new Date().getFullYear())}</span>
        <div className="footer__social">
          <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
            <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
          </a>
          <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>
          </a>
          <a href={`mailto:${CONTACT.email}`} aria-label="Email">
            <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z" /><path d="M22 6l-10 7L2 6" /></svg>
          </a>
        </div>
      </div>
    </footer>
  )
}
