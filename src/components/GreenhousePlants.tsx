import { useId, type ReactNode } from 'react';

import { BotanicalFlower } from './BotanicalFlower';
export function PottedPlant({ icon, image, name, stage = 4, watering = false }: { icon: ReactNode; image?: string; name: string; stage?: number; watering?: boolean }) {
  const gradientId = useId();
  return <div className={`pomo-potted-plant stage-${stage}${watering ? ' is-watering' : ''}`}>
    <div className="pomo-plant-shadow" />
    {stage > 0 && <svg className="pomo-plant-stem" viewBox="0 0 100 110" fill="none" aria-hidden="true"><path d="M50 108C48 75 58 50 50 15" stroke="#75a38b" strokeWidth="4" strokeLinecap="round" /><path d="M50 80C23 81 19 59 20 56C40 54 51 65 50 80Z" fill="#a4c7ab" /><path d="M52 65C76 66 84 44 81 41C60 42 51 52 52 65Z" fill="#84b69a" /></svg>}
    <div className="pomo-plant-flower">{image ? <img src={image} alt={name} /> : <BotanicalFlower icon={icon} name={name} stage={stage} />}</div>
    <svg className="pomo-ceramic-pot" viewBox="0 0 160 100" aria-hidden="true"><defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2=".5"><stop stopColor="#fff9f4" /><stop offset=".5" stopColor="#efdcd4" /><stop offset="1" stopColor="#cdb5b4" /></linearGradient></defs><path d="M22 19H138L121 83Q80 101 39 83Z" fill={'url(#' + gradientId + ')'} /><ellipse cx="80" cy="19" rx="59" ry="15" fill="#f5e7de" /><ellipse cx="80" cy="18" rx="49" ry="9" fill="#867465" /><path d="M38 39L47 76" stroke="white" strokeOpacity=".65" strokeWidth="5" strokeLinecap="round" /><path d="M55 89Q80 94 105 89" stroke="#bba4a6" strokeOpacity=".4" strokeWidth="2" /></svg>
    {watering && <span className="pomo-watering-drops" aria-hidden="true">✧ ˚ 💧</span>}
  </div>;
}

type Specimen = { id: string; nickname?: string; speciesName: string; bloomIcon: string; imageUrl?: string; charName: string; harvestDate: string; commemorativeQuote: string };
export function FlowerShelves({ specimens, onClose }: { specimens: Specimen[]; onClose: () => void }) {
  const rows = Array.from({ length: Math.max(2, Math.ceil(specimens.length / 3)) }, (_, i) => specimens.slice(i * 3, i * 3 + 3));
  return <section className="pomo-flower-gallery" role="dialog" aria-modal="true" aria-label="植物图鉴">
    <header><div><small>我们的温室</small><h3>花开收藏室 <span>{specimens.length}</span></h3></div><button type="button" onClick={onClose} aria-label="关闭植物图鉴">×</button></header>
    <div className="pomo-gallery-shelves">{!specimens.length && <p className="pomo-gallery-empty">第一朵花的位置，已经留好了</p>}{rows.map((row, i) => <div className="pomo-flower-shelf" key={i}><div className="pomo-shelf-plants">{row.map(sp => <details key={sp.id} className="pomo-specimen"><summary><PottedPlant icon={sp.bloomIcon} image={sp.imageUrl} name={sp.speciesName} /><strong>{sp.nickname?.trim() || sp.speciesName}</strong><small>{sp.charName}</small></summary><div className="pomo-specimen-label"><strong>{sp.speciesName}</strong><time>{sp.harvestDate}</time><p>{sp.commemorativeQuote}</p></div></details>)}</div><div className="pomo-shelf-board" /></div>)}</div>
  </section>;
}

