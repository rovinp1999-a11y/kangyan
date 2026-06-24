export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="container">
        <p className="footer__word">
          KANGYAN<b>.</b>
        </p>
        <div className="footer__bar">
          <span className="footer__tag">Professional Emcee &amp; Event Host</span>
          <div className="footer__social">
            <a href="https://instagram.com/kangyan1204" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>
            </a>
            <a href="mailto:girlychangkangyan@gmail.com" aria-label="Email">
              <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z" /><path d="M22 6l-10 7L2 6" /></svg>
            </a>
          </div>
          <span className="footer__copy">© {year} Kangyan. All rights reserved.</span>
        </div>
      </div>
    </footer>
  )
}
