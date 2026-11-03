import { useId } from 'react';

const LATIN_LETTERS = [
  'M17 22L28 41L39 22M28 41V63',
  'M54 22L65 41L76 22M65 41V63',
  'M93 38V77M94 46C94 31 117 31 117 49C117 67 94 67 94 52',
  'M133 22V63M133 47C133 32 155 32 155 47V63',
  'M183 36C165 36 165 64 183 64C201 64 201 36 183 36Z',
  'M211 38V63M211 47C211 32 233 32 233 47V63',
  'M252 49H277C277 31 250 30 250 49C250 65 266 68 276 59',
];
const WAI_LETTER = 'M9 8H47M29 8Q25 23 10 29M28 17V32M36 21L45 29M10 41H47M29 42V67M17 51V67M30 53H43M9 68H48';

export function CreamWordmark() {
  const id = useId();
  return <svg className="yy-cream-wordmark" viewBox="0 0 300 164" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-candy`} x1="20" y1="0" x2="280" y2="145" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f3d0df" /><stop offset=".55" stopColor="#c7e4f5" /><stop offset="1" stopColor="#f4e3b2" />
      </linearGradient>
      <filter id={`${id}-glaze`} x="-10%" y="-15%" width="120%" height="130%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="roundness" />
        <feSpecularLighting in="roundness" surfaceScale="2" specularConstant=".4" specularExponent="18" lightingColor="#fffefa" result="shine">
          <fePointLight x="-70" y="-90" z="160" />
        </feSpecularLighting>
        <feComposite in="shine" in2="SourceAlpha" operator="in" result="glaze" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="glaze" /></feMerge>
      </filter>
      <g id={`${id}-latin`}>{LATIN_LETTERS.map((d, index) => <path key={index} d={d} />)}</g>
      <g id={`${id}-han`}>
        <path d={WAI_LETTER} /><path d={WAI_LETTER} transform="translate(66 0)" />
        <path d="M140 25H165M153 9V68M153 27L138 49M154 31L166 45M171 67Q178 57 178 42V15H195V59Q195 69 205 64" />
      </g>
    </defs>
    <g strokeLinecap="round" strokeLinejoin="round">
      <g transform="translate(8 0)">
        <use href={`#${id}-latin`} stroke="#fffdf5" strokeWidth="18" />
        <use href={`#${id}-latin`} stroke={`url(#${id}-candy)`} strokeWidth="14" filter={`url(#${id}-glaze)`} />
        <path d="M16 20L20 26M53 20L57 26M91 39V46M131 23V31M175 38Q179 35 184 36M209 39V45M256 37Q261 34 266 37" stroke="#fffefa" strokeWidth="2.4" opacity=".72" />
      </g>
      <g transform="translate(43 83)">
        <use href={`#${id}-han`} stroke="#fffdf5" strokeWidth="10.5" />
        <use href={`#${id}-han`} stroke={`url(#${id}-candy)`} strokeWidth="7.2" filter={`url(#${id}-glaze)`} />
        <path d="M13 6H23M13 39H23M79 6H89M79 39H89M143 23H150M193 18V25" stroke="#fffefa" strokeWidth="1.4" opacity=".6" />
      </g>
    </g>
  </svg>;
}

function CreamStar({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <path d="M18 5Q20 0 22 5L26 13L35 15Q40 16 36 20L30 26L31 35Q32 40 27 37L20 33L12 37Q7 40 9 34L10 26L4 20Q0 16 5 15L14 13Z" fill="var(--cream-candy, #f3d992)" stroke="#fffaf0" strokeWidth="2" strokeLinejoin="round" />
    <path d="M18 9L15 16L9 18" fill="none" stroke="#fffdf5" strokeWidth="2" strokeLinecap="round" opacity=".8" />
  </svg>;
}

function CreamBow({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 100 70" aria-hidden="true" focusable="false">
    <g stroke="#dca8b7" strokeWidth="1.3" strokeLinejoin="round">
      <path d="M43 32L29 62L41 58L48 67L53 35M54 33L71 63L60 59L54 68L47 35" fill="#f3c9d6" />
      <path d="M47 29C15 0 1 11 11 37C18 51 35 40 48 34M53 29C85 0 99 11 89 37C82 51 65 40 52 34" fill="#f8d8e2" />
      <path d="M15 20Q24 14 42 29M85 20Q76 14 58 29" fill="none" stroke="#fff8f4" strokeWidth="3" strokeLinecap="round" />
      <path d="M44 25Q50 21 56 26L57 36Q50 42 43 36Z" fill="#efb6ca" />
    </g>
  </svg>;
}

export function CreamOpeningScene({ titleId }: { titleId: string }) {
  return <>
    <div className="yy-cream-frame" aria-hidden="true">
      {['top', 'right', 'bottom', 'left'].map(side => <span key={side} className={`yy-cream-lace is-${side}`} />)}
      <CreamBow className="yy-cream-crown" />
      <span className="yy-cream-flower is-pink" /><span className="yy-cream-flower is-blue" />
    </div>
    <div className="yy-cream-charm is-star" aria-hidden="true"><span /><CreamStar className="yy-cream-charm-star" /></div>
    <div className="yy-cream-charm is-heart" aria-hidden="true"><span /><svg viewBox="0 0 44 44" focusable="false"><path d="M22 37C-7 20 7 0 22 13C37 0 51 20 22 37Z" fill="#f3c7d7" stroke="#fffaf2" strokeWidth="2" /><path d="M11 13Q7 16 10 21" fill="none" stroke="#fff8f5" strokeWidth="2" strokeLinecap="round" /></svg></div>
    <div className="yy-cream-scene">
      <div className="yy-cream-halo" aria-hidden="true" />
      <div className="yy-cream-sugars" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => <CreamStar key={index} className={`yy-cream-sugar is-${index}`} />)}
      </div>
      <div className="yy-cream-letterbox">
        <svg className="yy-cream-envelope-back" viewBox="0 0 300 180" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="2" y="2" width="296" height="176" rx="22" fill="#f3dfc5" stroke="#e5cdb2" strokeWidth="2" /></svg>
        <svg className="yy-cream-flap" viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M3 2H297L168 100Q150 114 132 100Z" fill="#fbe8cf" stroke="#e6cdb2" strokeWidth="2" /></svg>
        <div className="yy-cream-card">
          <span className="yy-cream-card-heart" aria-hidden="true">♥</span>
          <h1 id={titleId} aria-label="YYphone 歪歪机"><CreamWordmark /></h1>
        </div>
        <svg className="yy-cream-pocket" viewBox="0 0 300 180" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <rect x="2" y="2" width="296" height="176" rx="22" fill="#fff0db" stroke="#e5cdb2" strokeWidth="2" />
          <path d="M5 10L160 105L18 173Q3 170 3 154Z" fill="#f8dfe5" />
          <path d="M295 10L140 105L282 173Q297 170 297 154Z" fill="#e1edf6" />
          <path d="M9 168L133 83Q150 71 167 83L291 168Q290 178 275 178H25Q10 178 9 168Z" fill="#fff0d6" stroke="#e7d3b9" strokeWidth="1.5" />
          <path d="M15 160L134 77Q150 66 166 77L285 160" fill="none" stroke="#d8bca7" strokeWidth="1.2" strokeDasharray="3 5" />
        </svg>
        <CreamBow className="yy-cream-seal" />
      </div>
      <div className="yy-cream-cloud is-left" aria-hidden="true"><i /><i /><i /></div>
      <div className="yy-cream-cloud is-right" aria-hidden="true"><i /><i /><i /></div>
      <div className="yy-cream-pearls" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    </div>
  </>;
}
