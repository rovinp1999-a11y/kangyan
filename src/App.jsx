import Effects from './Effects.jsx'
import Nav from './components/Nav.jsx'
import Hero from './components/Hero.jsx'
import Marquee from './components/Marquee.jsx'
import About from './components/About.jsx'
import Services from './components/Services.jsx'
import Stats from './components/Stats.jsx'
import Gallery from './components/Gallery.jsx'
import Testimonials from './components/Testimonials.jsx'
import Contact from './components/Contact.jsx'
import Footer from './components/Footer.jsx'

export default function App() {
  return (
    <>
      <Effects />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <About />
        <Services />
        <Stats />
        <Gallery />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
