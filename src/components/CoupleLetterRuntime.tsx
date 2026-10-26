import { useEffect } from 'react';
import { COUPLE_REWARDS_EVENT } from '../utils/coupleRewards';
import { processPendingCoupleLetters } from '../utils/coupleLetters';

export function CoupleLetterRuntime() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const process = () => { clearTimeout(timer); timer = setTimeout(() => { void processPendingCoupleLetters(); }, 0); };
    process(); window.addEventListener(COUPLE_REWARDS_EVENT, process);
    return () => { clearTimeout(timer); window.removeEventListener(COUPLE_REWARDS_EVENT, process); };
  }, []);
  return null;
}
