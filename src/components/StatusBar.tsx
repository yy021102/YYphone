import React from 'react';
import { Wifi, BatteryMedium, Signal, Lock } from 'lucide-react';

interface StatusBarProps {
  time: string;
  isLocked?: boolean;
  onLockClick?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ time, isLocked = false, onLockClick }) => {
  return (
    <div className="w-full pt-2 px-5 pb-1 flex items-center justify-between text-[#2C4A5C] text-xs font-semibold select-none z-30 transition-colors">
      {/* Left: Time and date indicator */}
      <div className="flex items-center gap-1.5 min-w-[50px]">
        <span className="tracking-tight text-[13px] font-bold">{time}</span>
      </div>

      {/* Center: Dynamic island / Notch mimic pill */}
      <div className="h-5 px-3 bg-black/15 backdrop-blur-md rounded-full flex items-center justify-center gap-1.5 shadow-inner">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-800/80 border border-white/20 flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-sky-400 animate-pulse"></div>
        </div>
        {isLocked ? (
          <Lock className="w-3 h-3 text-slate-700" />
        ) : (
          <span className="text-[10px] text-slate-700 font-medium tracking-wide">PocketOS</span>
        )}
      </div>

      {/* Right: Connectivity & Battery */}
      <div className="flex items-center gap-2 min-w-[50px] justify-end">
        <Signal className="w-3.5 h-3.5 stroke-[2.2]" />
        <Wifi className="w-3.5 h-3.5 stroke-[2.2]" />
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] font-mono tabular-nums font-bold">88%</span>
          <BatteryMedium className="w-4 h-4 stroke-[2.2] text-[#2C4A5C]" />
        </div>
        {onLockClick && !isLocked && (
          <button
            onClick={onLockClick}
            title="锁定屏幕"
            className="p-1 -mr-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Lock className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
