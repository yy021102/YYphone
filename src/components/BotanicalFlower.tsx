import { useId, type ReactNode } from 'react';

export function BotanicalFlower({ icon, name, stage }: { icon: ReactNode; name: string; stage: number }) {
  const id = useId(), species = `${typeof icon === 'string' ? icon : ''}${name}`;
  const gold = /🌻|向日葵/.test(species), tulip = /🌷|郁金香/.test(species), rose = /🌹|玫瑰/.test(species), clover = /🍀|四叶草/.test(species), hibiscus = /🌺|扶桑/.test(species);
  const color = gold ? '#e1cd99' : rose ? '#cfaeba' : hibiscus ? '#cbb3cd' : '#e8d2df';
  return <svg className="pomo-botanical-flower" viewBox="0 0 120 120" role="img" aria-label={name}>
    <defs><radialGradient id={id}><stop stopColor={gold ? '#c7aa80' : '#c9b2c6'} /><stop offset=".65" stopColor={color} /><stop offset="1" stopColor={gold ? '#f0e5c3' : '#f9eef3'} /></radialGradient></defs>
    {stage === 0 ? <g transform="rotate(-25 60 60)"><ellipse cx="60" cy="65" rx="9" ry="15" fill="#b3a08b" /><path d="M61 52Q55 65 61 77" fill="none" stroke="#d1c2ac" /></g>
      : stage < 3 ? <g stroke="#94ac9b" strokeWidth="1"><path d="M60 108Q51 65 62 35" fill="none" strokeWidth="2" /><path d="M58 80Q27 79 25 49Q54 48 58 80Z" fill="#a7beaa" /><path d="M59 62Q84 63 94 33Q64 31 59 62Z" fill="#bed0b8" /><path d="M29 53L55 76M90 37L62 59" stroke="#e5e9da" />{stage === 2 && <path d="M60 47Q45 34 51 16Q72 23 60 47Z" fill="#c6d5be" />}</g>
      : stage === 3 ? <g><path d="M60 102Q31 74 44 38Q60 49 75 34Q89 73 60 102Z" fill={color} stroke="#bcabb8" strokeWidth=".6" /><path d="M60 99Q65 69 72 42M59 98Q49 77 47 47" fill="none" stroke="#fff9" /><path d="M60 105L40 83L58 92L79 81Z" fill="#a4b6a2" /></g>
      : clover ? <g fill="#a8bfa8" stroke="#92aa97" strokeWidth=".5">{[0,90,180,270].map(a => <g key={a} transform={`rotate(${a} 60 60)`}><path d="M60 65C39 50 26 38 35 27C45 15 58 27 60 35C65 18 83 17 87 31C94 47 73 58 60 65Z" /><path d="M60 60L60 36" stroke="#e4ebd9" /></g>)}</g>
      : tulip ? <g stroke="#c9aeba" strokeWidth=".5"><path d="M59 100Q23 86 27 32Q43 37 59 51Q77 36 93 31Q98 85 59 100Z" fill="#dfc1ce" /><path d="M60 99Q43 72 43 29Q59 15 75 29Q77 74 60 99Z" fill={`url(#${id})`} /><path d="M60 96Q53 59 59 31" fill="none" stroke="#fff9" /></g>
      : rose ? <g>{[0,1,2,3,4].map(layer => <g key={layer} transform={`translate(60 60) rotate(${layer * 29}) scale(${1-layer*.17}) translate(-60 -60)`}>{[0,72,144,216,288].map(a => <path key={a} transform={`rotate(${a} 60 60)`} d="M60 72Q24 68 27 40Q30 21 55 26Q87 19 91 43Q86 64 60 72Z" fill={layer % 2 ? '#ddc1ca' : `url(#${id})`} stroke="#bfa1b0" strokeWidth=".65" />)}</g>)}</g>
      : <g>{Array.from({ length: gold ? 20 : 5 },(_,i) => <g key={i} transform={`rotate(${i * (gold ? 18 : 72)} 60 60)`}>{gold ? <path d="M57 55Q34 27 58 7Q80 26 63 55Z" fill={`url(#${id})`} stroke="#cbb88e" strokeWidth=".45" /> : <><path d="M60 66C30 60 23 42 35 25Q48 9 60 19Q75 8 85 26C97 46 79 62 60 66Z" fill={`url(#${id})`} stroke="#ccb6c9" strokeWidth=".55" /><path d="M60 61Q48 40 44 29M61 60L69 26" stroke="#c9adbf" strokeOpacity=".5" strokeWidth=".55" fill="none" /></>}</g>)}<circle cx="60" cy="60" r={gold ? 19 : 7} fill={gold ? '#aa947a' : '#c9b48e'} />{Array.from({length:12},(_,i)=><circle key={i} cx={60+Math.cos(i*2.4)*(gold?12:6)} cy={60+Math.sin(i*2.4)*(gold?12:6)} r={gold?1.2:1} fill={gold?'#d7c49e':'#efe3bf'} />)}{hibiscus && <path d="M60 61Q73 57 89 72" fill="none" stroke="#d2bd95" strokeWidth="2" />}</g>}
  </svg>;
}
