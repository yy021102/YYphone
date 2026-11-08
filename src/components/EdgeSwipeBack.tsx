import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { installEdgeSwipeBack } from '../utils/edgeSwipeBack';

export function EdgeSwipeBack({ enabled }: { enabled: boolean }) {
  const marker = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(0);
    const root = marker.current?.closest<HTMLElement>('[data-phone-canvas]');
    if (enabled && root) return installEdgeSwipeBack(root, setProgress);
  }, [enabled]);
  return <div ref={marker} className="edge-back-hint" aria-hidden="true" style={{ opacity: progress ? 1 : 0,
    transform: `translateX(${progress ? Math.min(progress, 1) * 20 - 12 : -36}px) scale(${progress >= 1 ? 1.05 : 1})` }}>
    <ChevronLeft size={25} strokeWidth={2}/>
  </div>;
}
