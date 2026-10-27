// Vector illustrations used in place of photos. Pure SVG, brand palette only.

const INK = '#15121C'
const PAPER = '#F6F4EE'
const YELLOW = '#FACC15'
const GREEN = '#10B981'
const BLUE = '#2563EB'
const PURPLE = '#7C3AED'
const WHITE = '#FFFFFF'

const display = { fontFamily: 'var(--ff-display)', fontWeight: 800 }
const outline = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' }

function Sparkle({ x, y, s, fill, opacity = 1 }) {
  const k = s * 0.15
  return (
    <path
      d={`M${x},${y - s} Q${x + k},${y - k} ${x + s},${y} Q${x + k},${y + k} ${x},${y + s} Q${x - k},${y + k} ${x - s},${y} Q${x - k},${y - k} ${x},${y - s} Z`}
      fill={fill}
      opacity={opacity}
    />
  )
}

/** Hero: bold flat atom, flask and test tube on a purple→blue gradient (3:4). */
export function HeroArt() {
  return (
    <svg className="art" viewBox="0 0 300 400" role="img" aria-label="Atom, flask and formulas illustration">
      <defs>
        <linearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PURPLE} />
          <stop offset="1" stopColor={BLUE} />
        </linearGradient>
        <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill={WHITE} opacity=".16" />
        </pattern>
        <clipPath id="flaskClip">
          <path d="M60,250 h22 v34 l32,68 c4,10 -4,18 -14,18 h-58 c-10,0 -18,-8 -14,-18 l32,-68 Z" />
        </clipPath>
        <clipPath id="tubeClip">
          <rect x="224" y="236" width="30" height="120" rx="15" />
        </clipPath>
      </defs>

      <rect width="300" height="400" fill="url(#heroBg)" />
      <rect width="300" height="400" fill="url(#dots)" />

      {/* formulas */}
      <text x="22" y="104" fill={WHITE} fontSize="20" style={display}>F = ma</text>
      <text x="212" y="52" fill={YELLOW} fontSize="20" style={display}>H₂O</text>
      <text x="150" y="332" fill={YELLOW} fontSize="24" textAnchor="middle" style={display}>E = mc²</text>
      <text x="150" y="384" fill={WHITE} fontSize="16" textAnchor="middle" style={display} opacity=".9">a² + b² = c²</text>

      {/* atom */}
      <g fill="none" stroke={YELLOW} strokeWidth="5" strokeLinecap="round">
        <ellipse cx="150" cy="150" rx="92" ry="34" />
        <ellipse cx="150" cy="150" rx="92" ry="34" transform="rotate(60 150 150)" />
        <ellipse cx="150" cy="150" rx="92" ry="34" transform="rotate(-60 150 150)" />
      </g>
      <circle cx="150" cy="150" r="18" fill={GREEN} {...outline} />
      <circle cx="144" cy="145" r="5" fill={WHITE} opacity=".8" />
      <circle cx="58" cy="150" r="8" fill={WHITE} {...outline} />
      <circle cx="196" cy="230" r="8" fill={YELLOW} {...outline} />
      <circle cx="196" cy="70" r="8" fill={GREEN} {...outline} />

      {/* Erlenmeyer flask */}
      <path d="M60,250 h22 v34 l32,68 c4,10 -4,18 -14,18 h-58 c-10,0 -18,-8 -14,-18 l32,-68 Z" fill={WHITE} fillOpacity=".92" {...outline} />
      <g clipPath="url(#flaskClip)">
        <rect x="20" y="322" width="110" height="60" fill={GREEN} />
        <path d="M24,322 Q46,314 68,322 T112,322 V380 H24 Z" fill="#34D399" />
        <circle cx="52" cy="344" r="4" fill={WHITE} opacity=".85" />
        <circle cx="82" cy="356" r="3" fill={WHITE} opacity=".85" />
        <circle cx="66" cy="366" r="2.2" fill={WHITE} opacity=".85" />
      </g>
      <path d="M60,250 h22 v34 l32,68 c4,10 -4,18 -14,18 h-58 c-10,0 -18,-8 -14,-18 l32,-68 Z" fill="none" {...outline} />
      <rect x="55" y="244" width="32" height="10" rx="5" fill={WHITE} {...outline} />
      <g fill="none" stroke={GREEN} strokeWidth="2.5">
        <circle cx="96" cy="236" r="4" />
        <circle cx="106" cy="222" r="2.8" />
        <circle cx="90" cy="214" r="2" />
      </g>

      {/* test tube */}
      <rect x="224" y="236" width="30" height="120" rx="15" fill={WHITE} fillOpacity=".92" {...outline} />
      <g clipPath="url(#tubeClip)">
        <rect x="224" y="296" width="30" height="60" fill={BLUE} />
        <path d="M224,296 Q239,290 254,296 V360 H224 Z" fill="#60A5FA" />
        <circle cx="234" cy="318" r="2.6" fill={WHITE} opacity=".85" />
        <circle cx="246" cy="334" r="2" fill={WHITE} opacity=".85" />
      </g>
      <rect x="224" y="236" width="30" height="120" rx="15" fill="none" {...outline} />
      <rect x="218" y="230" width="42" height="10" rx="5" fill={WHITE} {...outline} />

      <Sparkle x={40} y={120} s={9} fill={WHITE} opacity=".9" />
      <Sparkle x={262} y={150} s={7} fill={YELLOW} />
      <Sparkle x={120} y={300} s={6} fill={WHITE} opacity=".8" />
      <Sparkle x={272} y={372} s={8} fill={YELLOW} />
    </svg>
  )
}
