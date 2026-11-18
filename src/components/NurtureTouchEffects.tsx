import type { CSSProperties } from 'react';
import { Heart } from 'lucide-react';

export function NurtureTap({ delayed = false }: { delayed?: boolean }) {
  return <span className={`nurture-screen-tap${delayed ? ' is-delayed' : ''}`} aria-hidden="true"><i/><i/><b/></span>;
}
const directions = [[0, -65], [-45, -48], [48, -43], [-65, 4], [64, 7], [-30, 48], [33, 45]];
export function NurtureHeartBurst({ x, y, part }: { x: number; y: number; part: string }) {
  return <span className="nurture-heart-burst" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-label={`触碰${part}，爱心散开`}><span className="nurture-heart-ring"/>{directions.map(([dx, dy], i) => <Heart key={i} fill="currentColor" size={i % 2 ? 15 : 21} style={{ '--heart-x': `${dx}px`, '--heart-y': `${dy}px`, '--heart-delay': `${i * 55}ms` } as CSSProperties}/>)}<small>触碰 · {part}</small></span>;
}
