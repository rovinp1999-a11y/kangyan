import Reveal from './Reveal.jsx'

export default function Contact() {
  return (
    <section className="section contact" id="contact" data-spotlight>
      <div className="container contact__grid">
        <Reveal className="contact__text">
          <p className="label" style={{ '--accent': 'var(--yellow)', color: 'var(--paper)' }}>Let's Talk</p>
          <h2 className="contact__title">
            BOOK<br /><span className="outline-text">KANGYAN</span>
          </h2>
          <p>
            Tell me about your occasion and I'll get back to you within 48 hours with
            availability and a tailored quote.
          </p>

          <ul className="contact__details">
            <li>
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16v16H4z" /><path d="M22 6l-10 7L2 6" />
              </svg>
              <a href="mailto:girlychangkangyan@gmail.com">girlychangkangyan@gmail.com</a>
            </li>
            <li>
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <a href="tel:+60162241099">+60 16-224 1099</a>
            </li>
            <li>
              <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" />
              </svg>
              <a href="https://instagram.com/kangyan1204" target="_blank" rel="noopener noreferrer">@kangyan1204</a>
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
