// Content data for the site — edit these to make the site Kangyan's own.

export const stats = [
  { num: 250, label: 'Events Hosted' },
  { num: 8, label: 'Years on Stage' },
  { num: 3, label: 'Languages' },
  { num: 100, suffix: '%', label: 'Happy Clients' },
]

// `tile` maps to a bento class (a–e). The 6th item renders as the full-width CTA tile.
export const services = [
  {
    num: '01',
    tile: 'a',
    title: 'Weddings',
    desc: 'Heartfelt, perfectly-paced hosting that lets you stay present while I guide the celebration.',
    icon: 'M12 21s-7-4.35-9.5-8.5C.5 8.5 3 5 6.5 5 9 5 12 8 12 8s3-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.65 12 21 12 21z',
  },
  {
    num: '02',
    tile: 'b',
    title: 'Corporate Events',
    desc: 'Conferences, town halls and award nights kept sharp, on-brand and on-schedule.',
    icon: 'M3 21V7l9-4 9 4v14 M9 21v-6h6v6',
  },
  {
    num: '03',
    tile: 'c',
    title: 'Galas & Awards',
    desc: 'Black-tie elegance with the energy to keep a ballroom captivated all night.',
    icon: 'M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.8 5.7 21l2.3-7.2-6-4.4h7.6z',
  },
  {
    num: '04',
    tile: 'd',
    title: 'Product Launches',
    desc: 'Build anticipation and land the big reveal with dynamic stage presence.',
    icon: 'M3 11l19-9-9 19-2-8-8-2z',
  },
  {
    num: '05',
    tile: 'e',
    title: 'Concerts & Shows',
    desc: 'High-energy crowd work and seamless segues that keep the audience roaring.',
    icon: 'M9 18V5l12-2v13 M6 21a3 3 0 100-6 3 3 0 000 6z M18 19a3 3 0 100-6 3 3 0 000 6z',
  },
]

// Placeholder event imagery — swap each with Kangyan's own photos in public/assets/gallery/.
export const gallery = [
  { src: '/assets/1736456761587.jpg', c: 'purple', label: 'FYP Showcase' },
  { src: '/assets/gallery/2.jpg', c: 'blue', label: 'When the crowd erupts' },
  { src: '/assets/gallery/3.jpg', c: 'green', label: 'On the mic' },
  { src: '/assets/gallery/4.jpg', c: 'yellow', label: 'Festival main stage' },
  { src: '/assets/gallery/5.jpg', c: 'blue', label: 'Holding the room' },
  { src: '/assets/gallery/6.jpg', c: 'purple', label: 'Show time' },
]

// PLACEHOLDER testimonials — swap in real client quotes before going live.
export const testimonials = [
  {
    accent: 'var(--purple)',
    quote: "Kangyan ran our wedding flawlessly. Guests are still talking about how warm and funny she was. We didn't worry about a single thing.",
    name: 'Amelia & Jordan',
    event: 'Wedding',
  },
  {
    accent: 'var(--blue)',
    quote: 'Professional, prepared and incredibly easy to work with. She kept our 400-person conference perfectly on schedule and full of energy.',
    name: 'Marcus Lee',
    event: 'Tech Conference',
  },
  {
    accent: 'var(--green)',
    quote: "The best emcee we've hired. Kangyan reads the room like no one else and elevated the whole evening. We'll book her again.",
    name: 'Priya N.',
    event: 'Charity Gala',
  },
]
