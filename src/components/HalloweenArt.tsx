import { useId } from 'react';

export function HalloweenCandy({ kind = 0 }: { kind?: number }) {
  return <svg viewBox="0 0 72 58" fill="none" aria-hidden="true">
    {kind === 1 ? <><path d="m36 4 7.5 15.2 16.8 2.4-12.2 11.9L51 50.2 36 42.3l-15 7.9 2.9-16.7L11.7 21.6l16.8-2.4Z" fill="#ffe2a1" stroke="#ffefc9" strokeWidth="2"/><path d="m32 18-5 8m13 10 5-9" stroke="#f0b46e" strokeWidth="3" strokeLinecap="round"/></> : <g transform="rotate(-16 36 29)"><path d="m20 22-16-8 2 14-2 15 16-8m32-13 16-8-2 14 2 15-16-8" fill={kind === 2 ? '#a9d9d4' : '#eab7d0'} stroke="#fff0e2" strokeWidth="1.5"/><rect x="17" y="12" width="38" height="35" rx="13" fill={kind === 2 ? '#c6eee0' : '#f4c9db'} stroke="#fff4e9" strokeWidth="2"/><path d="m29 14-8 25m23-25-9 31" stroke={kind === 2 ? '#7abfb7' : '#d18fae'} strokeWidth="8"/><path d="m28 18-3 7" stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".75"/></g>}
  </svg>;
}

export function HalloweenPumpkin({ open = false }: { open?: boolean }) {
  const id = useId();
  return <svg viewBox="0 0 110 112" fill="none" aria-hidden="true">
    <defs><linearGradient id={id} x1="30" y1="26" x2="82" y2="104" gradientUnits="userSpaceOnUse"><stop stopColor="#ffcf91"/><stop offset=".5" stopColor="#eaa56e"/><stop offset="1" stopColor="#b97055"/></linearGradient></defs>
    <ellipse cx="56" cy="101" rx="38" ry="6" fill="#0c0e1d" opacity=".24"/>
    <path d="M51 33c-5-16 1-24 12-25l-1 9c-8 0-7 9-7 16" fill="#829c83" stroke="#394c4a" strokeWidth="2"/>
    <path d="M54 30C25 16 8 44 12 69c3 24 23 34 44 30 25 6 44-11 45-34 2-27-19-47-47-35Z" fill={`url(#${id})`} stroke="#e8b183" strokeWidth="1.4"/>
    <path d="M40 31c-16 19-14 46-2 63m31-62c14 19 13 45 3 61M55 33c-10 21-9 44 0 64" stroke="#a96650" strokeOpacity=".28" strokeWidth="2"/>
    {open ? <><path d="M30 57q9-12 16 0m18 0q8-12 15 0" stroke="#634a4e" strokeWidth="4" strokeLinecap="round"/><path d="M39 75q16 13 31 0" stroke="#634a4e" strokeWidth="4" strokeLinecap="round"/></> : <><path d="m28 60 16-12 2 16Zm36 3 4-16 13 13Z" fill="#61464b"/><path d="m31 75 12 4 4-5 8 7 7-6 5 5 14-5c-9 20-39 20-50 0Z" fill="#61464b"/><path d="m54 63-4 8h9Z" fill="#99614e"/></>}
    <path d="M23 44q4-8 13-9" stroke="#ffe1b9" strokeWidth="3" strokeLinecap="round" opacity=".65"/>
  </svg>;
}

export function HalloweenTown({ lit }: { lit: boolean }) {
  const id = useId();
  const window = lit ? '#ffe0a7' : '#6d6383';
  return <svg viewBox="0 0 380 330" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id={`${id}-mist`}><stop stopColor="#b5a4c6" stopOpacity=".5"/><stop offset="1" stopColor="#8f84af" stopOpacity="0"/></radialGradient>
      <radialGradient id={`${id}-light`}><stop stopColor="#ffdb9d" stopOpacity=".42"/><stop offset="1" stopColor="#ffdb9d" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-wall`} x1="112" y1="135" x2="270" y2="284" gradientUnits="userSpaceOnUse"><stop stopColor="#74617e"/><stop offset="1" stopColor="#423b5e"/></linearGradient>
    </defs>
    <ellipse cx="190" cy="279" rx="188" ry="49" fill={`url(#${id}-mist)`}/>
    <g className="hw-town-moon"><circle cx="290" cy="66" r="53" fill="#fff0c4" opacity=".05"/><circle cx="290" cy="66" r="42" fill="#ffe6af"/>
    <path d="M306 27a42 42 0 0 1-48 64 42 42 0 0 0 48-64Z" fill="#f2ce99"/><circle cx="278" cy="59" r="5" fill="#f0cf9a" opacity=".7"/></g>
    <path d="m63 53 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm137-23 1.5 4.5L206 36l-4.5 1.5L200 42l-1.5-4.5L194 36l4.5-1.5Zm139 112 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#e6c3a1"/>
    <circle cx="135" cy="44" r="1.5" fill="#eee3ca"/><circle cx="332" cy="219" r="1.5" fill="#eee3ca"/>
    <g className="hw-art-bat"><path d="M83 98c8-16 17-13 24-3l5-6 5 6c7-10 16-13 24 3-11-4-17-2-22 5l-7-2-7 2c-5-7-11-9-22-5Z" fill="#b0a1bf" opacity=".7"/></g>
    <path d="m121 149 15-39 48-38 76 65 19 32-77-17-81-3Z" fill="#292a43" stroke="#9b8294" strokeWidth="2"/>
    <path d="m129 145 57-56 74 69m-102-34 40 5m-19-24 38 5m-80 29 110 10" stroke="#746174" strokeWidth="2"/>
    <path d="m231 115-2-43 22-4 2 64" fill="#51475f" stroke="#94808e" strokeWidth="2"/><path d="m225 71 29-5 2 11-30 4Z" fill="#93838f"/>
    <path d="M125 151 105 262l166 7-9-112-67-43-70 37Z" fill={`url(#${id}-wall)`} stroke="#a48a9c" strokeWidth="1.5"/>
    <path d="m114 246 17-78m132 92-11-94" stroke="#b69ba7" strokeOpacity=".25" strokeWidth="2"/>
    <path d="M160 265v-51a30 30 0 0 1 60 0v54" fill={window} stroke="#b19b9f" strokeWidth="5"/>
    {lit && <ellipse cx="191" cy="237" rx="80" ry="73" fill={`url(#${id}-light)`}/>}
    <path d="M171 266v-49a19 19 0 0 1 38 0v50" stroke="#a17e7e" strokeWidth="2"/><path d="M190 198v67" stroke="#9e7c78" strokeWidth="1.5"/><circle cx="201" cy="236" r="2" fill="#816173"/>
    <path d="M123 185a13 13 0 0 1 26 0v29h-26Zm111 3a12 12 0 0 1 24 0v27h-24Z" fill={window} stroke="#b8a1a7" strokeWidth="3"/><path d="M136 174v39m-12-20h25m97-17v39m-11-20h22" stroke="#78627b" strokeWidth="2"/>
    <rect x="160" y="143" width="67" height="22" rx="5" fill="#d9b298" transform="rotate(4 160 143)"/><text x="194" y="159" fill="#5f4b62" fontFamily="Georgia,serif" fontSize="10" letterSpacing="1" textAnchor="middle" transform="rotate(4 194 159)">SWEETS</text>
    <path d="m147 267 85 3 5 9-96-3Zm-8 10 100 3 9 10-119-4Z" fill="#a492a7" stroke="#504662" strokeWidth="1.5"/>
    <g className="hw-art-ghost"><path d="M49 171v-27c0-24 34-25 34-1v30l-9-5-8 6-8-6Z" fill="#e9e5ee"/><ellipse cx="61" cy="146" rx="2" ry="4" fill="#615a7c"/><ellipse cx="73" cy="146" rx="2" ry="4" fill="#615a7c"/><path d="m60 157 12 0" stroke="#caa2b3" strokeWidth="3" strokeLinecap="round"/><path d="M52 175q-11 8-22 4" stroke="#b0a4c8" strokeOpacity=".4" strokeWidth="3" strokeLinecap="round"/></g>
    <g transform="translate(80 241)"><path d="M26 0C9-9-3 8 0 24c3 14 15 19 28 16 17 4 29-7 30-22C59 2 44-9 26 0Z" fill="#e8ac7d"/><path d="m14 15 8-6 2 9m12 0 2-9 8 6m-30 12q14 11 27-1" fill="#594456"/><path d="M27 1q-3-8 5-12" stroke="#8f9a80" strokeWidth="5" strokeLinecap="round"/></g>
    <g transform="translate(244 262) scale(.6)"><path d="M26 0C9-9-3 8 0 24c3 14 15 19 28 16 17 4 29-7 30-22C59 2 44-9 26 0Z" fill="#e8ac7d"/><path d="m14 15 8-6 2 9m12 0 2-9 8 6m-30 12q14 11 27-1" fill="#594456"/><path d="M27 1q-3-8 5-12" stroke="#8f9a80" strokeWidth="5" strokeLinecap="round"/></g>
    <path d="M288 275c-16 5-28-7-18-14 12-9 5-22 5-22l11-15 4 12 14-2 4-11 8 18c9 18-1 36-17 36" fill="#2c2a42" stroke="#76647e" strokeWidth="1.5"/><path d="m284 247 7 2m9 0 7-3" stroke="#e8c391" strokeWidth="2" strokeLinecap="round"/><path d="M317 268c24 3 23-16 14-15" stroke="#2c2a42" strokeWidth="8" strokeLinecap="round"/>
    <path d="M57 282c-1-18-4-29-14-36m13 18-16-4m16 15 9-14m268 26c-3-14-1-26 9-38m-9 22 13-5m-12 13-12-7" stroke="#98839e" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round"/>
    <path d="m165 307 24-10 28 11m-58 8 29-13 34 14" stroke="#b8a0b7" strokeOpacity=".26" strokeWidth="2"/>
  </svg>;
}
