import { ChevronDown, Sparkles } from 'lucide-react';
import { BirthdaySettings } from './BirthdaySettings';
import { HalloweenSettings } from './HalloweenSettings';

export function SpecialOpeningSettings() {
  return <details className="special-opening-settings glass-card rounded-2xl p-3">
    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-[#2C4A5C]">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400"/><span className="flex-1">特殊开屏</span><ChevronDown size={13} className="special-opening-chevron shrink-0 text-slate-400 transition-transform"/>
    </summary>
    <div className="special-opening-list"><BirthdaySettings/><HalloweenSettings/></div>
  </details>;
}
