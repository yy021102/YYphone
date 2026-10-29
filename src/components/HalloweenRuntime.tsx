import { useEffect, useRef, useState } from 'react';
import { HalloweenScene } from './HalloweenScene';
import { HALLOWEEN_CHANGE, HALLOWEEN_OPEN, halloweenIsDue, markHalloweenSeen, readHalloweenSeen, readHalloweenSettings } from '../utils/halloween';

export function HalloweenRuntime({ unlocked, atHome, blocked = false, onOpenBeauty }: { unlocked: boolean; atHome: boolean; blocked?: boolean; onOpenBeauty?: () => void }) {
  const [scene, setScene] = useState<{ manual: boolean } | null>(null), [revision, setRevision] = useState(0);
  const scope = useRef({ unlocked, blocked }); scope.current = { unlocked, blocked };
  const settings = readHalloweenSettings();
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    const open = () => { if (scope.current.unlocked && !scope.current.blocked) setScene({ manual: true }); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = setInterval(refresh, 30_000);
    window.addEventListener(HALLOWEEN_CHANGE, refresh); window.addEventListener(HALLOWEEN_OPEN, open);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); window.removeEventListener(HALLOWEEN_CHANGE, refresh); window.removeEventListener(HALLOWEEN_OPEN, open); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, []);
  useEffect(() => {
    if (!unlocked || !atHome || blocked || scene || document.visibilityState === 'hidden') return;
    if (halloweenIsDue(readHalloweenSettings(), readHalloweenSeen())) { markHalloweenSeen(); setScene({ manual: false }); }
  }, [unlocked, atHome, blocked, scene, settings.enabled, revision]);
  useEffect(() => {
    if (scene && (!unlocked || !scene.manual && (!settings.enabled || !atHome))) setScene(null);
  }, [unlocked, atHome, scene, settings.enabled]);
  if (!scene || !unlocked || blocked || !scene.manual && !atHome) return null;
  return <HalloweenScene onClose={() => setScene(null)} onOpenBeauty={onOpenBeauty ? () => { setScene(null); onOpenBeauty(); } : undefined}/>;
}
