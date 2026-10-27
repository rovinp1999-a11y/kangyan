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

/** About: chalkboard of maths and science sketches (4:5). */
export function AboutArt() {
  const chalk = { fill: 'none', stroke: PAPER, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.92 }
  const dna = []
  for (let i = 0; i < 6; i++) {
    const y = 186 + i * 32
    dna.push(<line key={i} x1="238" y1={y} x2="266" y2={y} stroke={GREEN} strokeWidth="3" strokeLinecap="round" />)
  }
  return (
    <svg className="art" viewBox="0 0 320 400" role="img" aria-label="Chalkboard with maths and science sketches">
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24,0 H0 V24" fill="none" stroke={PAPER} strokeWidth="1" opacity=".08" />
        </pattern>
      </defs>
      <rect width="320" height="400" fill={INK} />
      <rect width="320" height="400" fill="url(#grid)" />
      <rect x="12" y="12" width="296" height="376" rx="18" fill="none" stroke={PAPER} strokeWidth="2" opacity=".2" />

      {/* light bulb */}
      <g transform="translate(160 54)">
        <g stroke={YELLOW} strokeWidth="3" strokeLinecap="round" opacity=".9">
          <line x1="-34" y1="-18" x2="-26" y2="-13" /><line x1="34" y1="-18" x2="26" y2="-13" />
          <line x1="-30" y1="8" x2="-22" y2="6" /><line x1="30" y1="8" x2="22" y2="6" />
          <line x1="0" y1="-36" x2="0" y2="-28" />
        </g>
        <path d="M-16,8 C-26,-2 -22,-20 0,-20 C22,-20 26,-2 16,8 L12,18 H-12 Z" fill={YELLOW} stroke={PAPER} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="-10" y="20" width="20" height="10" rx="3" fill="none" stroke={PAPER} strokeWidth="2.5" />
      </g>

      {/* right triangle + Pythagoras */}
      <path d="M36,150 V70 L116,150 Z" {...chalk} />
      <path d="M36,138 h12 v12" {...chalk} strokeWidth="2" />
      <text x="20" y="116" fill={PAPER} fontSize="14" style={display} opacity=".9">a</text>
      <text x="72" y="168" fill={PAPER} fontSize="14" style={display} opacity=".9">b</text>
      <text x="84" y="104" fill={PAPER} fontSize="14" style={display} opacity=".9">c</text>
      <text x="36" y="196" fill={YELLOW} fontSize="16" style={display}>a² + b² = c²</text>

      {/* benzene ring */}
      <g transform="translate(246 108)">
        <polygon points="0,-42 36,-21 36,21 0,42 -36,21 -36,-21" {...chalk} />
        <circle r="24" {...chalk} strokeWidth="2.5" />
        <text x="0" y="66" fill={PAPER} fontSize="13" textAnchor="middle" style={display} opacity=".85">C₆H₆</text>
      </g>

      {/* parabola graph */}
      <path d="M40,320 H168 M56,336 V214" {...chalk} strokeWidth="2.5" />
      <path d="M164,316 L168,320 L164,324 M52,218 L56,214 L60,218" {...chalk} strokeWidth="2.5" />
      <path d="M68,228 Q110,392 152,228" fill="none" stroke={GREEN} strokeWidth="3.5" strokeLinecap="round" />
      <text x="124" y="232" fill={GREEN} fontSize="14" style={display}>y = x²</text>

      {/* DNA helix */}
      <path d="M232,180 C272,206 232,232 272,258 C232,284 272,310 232,336 C272,362 232,388 272,400" {...chalk} stroke={BLUE} strokeWidth="3.5" opacity="1" />
      <path d="M272,180 C232,206 272,232 232,258 C272,284 232,310 272,336 C232,362 272,388 232,400" {...chalk} stroke={PAPER} strokeWidth="3.5" opacity=".9" />
      {dna}

      {/* bottom formulas */}
      <text x="36" y="372" fill={PAPER} fontSize="16" style={display} opacity=".9">PV = nRT</text>
      <text x="142" y="372" fill={YELLOW} fontSize="14" style={display}>Σ</text>

      <Sparkle x={290} y={40} s={6} fill={YELLOW} />
      <Sparkle x={30} y={244} s={5} fill={PAPER} opacity=".8" />
      <Sparkle x={196} y={300} s={6} fill={YELLOW} />
    </svg>
  )
}
