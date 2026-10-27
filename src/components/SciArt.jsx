// Animated hero illustration. Pure SVG; motion is CSS keyframes plus SVG
// animateMotion for the orbiting electrons. Styles live under ".art" in styles.css.

const INK = '#15121C'
const YELLOW = '#FACC15'
const GREEN = '#10B981'
const BLUE = '#2563EB'
const PURPLE = '#7C3AED'
const WHITE = '#FFFFFF'

const display = { fontFamily: 'var(--ff-display)', fontWeight: 800 }
const outline = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' }

// Ellipse centred on the nucleus, as a path so electrons can follow it.
const ORBIT = 'M58,150 a92,34 0 1,0 184,0 a92,34 0 1,0 -184,0'

function Sparkle({ x, y, s, fill, delay = 0 }) {
  const k = s * 0.15
  return (
    <path
      className="art-twinkle"
      style={{ animationDelay: `${delay}s` }}
      d={`M${x},${y - s} Q${x + k},${y - k} ${x + s},${y} Q${x + k},${y + k} ${x},${y + s} Q${x - k},${y + k} ${x - s},${y} Q${x - k},${y - k} ${x},${y - s} Z`}
      fill={fill}
    />
  )
}

function Electron({ angle, dur, fill, begin = '0s' }) {
  return (
    <g transform={`rotate(${angle} 150 150)`}>
      <circle r="8" fill={fill} {...outline}>
        <animateMotion dur={dur} repeatCount="indefinite" begin={begin} path={ORBIT} />
      </circle>
    </g>
  )
}

function Bubble({ cx, cy, r, delay, dur = 3.2 }) {
  return (
    <circle className="art-bubble" cx={cx} cy={cy} r={r} fill={WHITE} style={{ animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />
  )
}

/** Hero: animated atom, bubbling flask and test tube on a purple→blue gradient (3:4). */
export function HeroArt() {
  return (
    <svg className="art" viewBox="0 0 300 400" role="img" aria-label="Animated atom, flask and formulas illustration">
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
      <rect width="300" height="400" fill="url(#dots)" className="art-drift" />

      {/* formulas, each bobbing gently */}
      <text x="22" y="104" fill={WHITE} fontSize="20" style={display} className="art-float">F = ma</text>
      <text x="212" y="52" fill={YELLOW} fontSize="20" style={{ ...display, animationDelay: '-1.4s' }} className="art-float">H₂O</text>
      <text x="150" y="332" fill={YELLOW} fontSize="24" textAnchor="middle" style={{ ...display, animationDelay: '-2.2s' }} className="art-float">E = mc²</text>
      <text x="150" y="384" fill={WHITE} fontSize="16" textAnchor="middle" style={{ ...display, animationDelay: '-.7s' }} className="art-float" opacity=".9">a² + b² = c²</text>

      {/* atom: orbits slowly rotate, electrons travel along them, nucleus pulses */}
      <g className="art-spin">
        <g fill="none" stroke={YELLOW} strokeWidth="5" strokeLinecap="round">
          <path d={ORBIT} />
          <path d={ORBIT} transform="rotate(60 150 150)" />
          <path d={ORBIT} transform="rotate(-60 150 150)" />
        </g>
        <Electron angle={0} dur="3.6s" fill={WHITE} />
        <Electron angle={60} dur="4.4s" fill={GREEN} begin="-1.2s" />
        <Electron angle={-60} dur="5.2s" fill={YELLOW} begin="-2.6s" />
      </g>
      <g className="art-pulse">
        <circle cx="150" cy="150" r="18" fill={GREEN} {...outline} />
        <circle cx="144" cy="145" r="5" fill={WHITE} opacity=".8" />
      </g>

      {/* Erlenmeyer flask with sloshing liquid and rising bubbles */}
      <path d="M60,250 h22 v34 l32,68 c4,10 -4,18 -14,18 h-58 c-10,0 -18,-8 -14,-18 l32,-68 Z" fill={WHITE} fillOpacity=".92" {...outline} />
      <g clipPath="url(#flaskClip)">
        <rect x="0" y="326" width="140" height="60" fill={GREEN} />
        <path className="art-wave" d="M-20,324 q11,-8 22,0 t22,0 t22,0 t22,0 t22,0 t22,0 t22,0 t22,0 V390 H-20 Z" fill="#34D399" />
        <Bubble cx={46} cy={366} r={4} delay={0} />
        <Bubble cx={66} cy={370} r={3} delay={1.1} dur={2.6} />
        <Bubble cx={84} cy={368} r={3.5} delay={2} dur={3.6} />
        <Bubble cx={58} cy={372} r={2.2} delay={.6} dur={2.2} />
      </g>
      <path d="M60,250 h22 v34 l32,68 c4,10 -4,18 -14,18 h-58 c-10,0 -18,-8 -14,-18 l32,-68 Z" fill="none" {...outline} />
      <rect x="55" y="244" width="32" height="10" rx="5" fill={WHITE} {...outline} />
      <g fill="none" stroke={GREEN} strokeWidth="2.5">
        <circle className="art-vapour" cx="96" cy="236" r="4" />
        <circle className="art-vapour" cx="106" cy="222" r="2.8" style={{ animationDelay: '.8s' }} />
        <circle className="art-vapour" cx="90" cy="214" r="2" style={{ animationDelay: '1.6s' }} />
      </g>

      {/* test tube with fizzing blue liquid */}
      <rect x="224" y="236" width="30" height="120" rx="15" fill={WHITE} fillOpacity=".92" {...outline} />
      <g clipPath="url(#tubeClip)">
        <rect x="224" y="298" width="30" height="62" fill={BLUE} />
        <path className="art-wave art-wave--fast" d="M204,298 q5,-5 10,0 t10,0 t10,0 t10,0 t10,0 t10,0 t10,0 V360 H204 Z" fill="#60A5FA" />
        <Bubble cx={234} cy={346} r={2.6} delay={.3} dur={2.4} />
        <Bubble cx={245} cy={350} r={2} delay={1.4} dur={2} />
      </g>
      <rect x="224" y="236" width="30" height="120" rx="15" fill="none" {...outline} />
      <rect x="218" y="230" width="42" height="10" rx="5" fill={WHITE} {...outline} />

      <Sparkle x={40} y={120} s={9} fill={WHITE} />
      <Sparkle x={262} y={150} s={7} fill={YELLOW} delay={.8} />
      <Sparkle x={120} y={300} s={6} fill={WHITE} delay={1.6} />
      <Sparkle x={272} y={372} s={8} fill={YELLOW} delay={2.3} />
    </svg>
  )
}
