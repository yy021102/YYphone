import React from 'react';

interface HomeIndicatorProps {
  onHome: () => void;
  showHomePrompt?: boolean;
}

export const HomeIndicator: React.FC<HomeIndicatorProps> = ({ onHome, showHomePrompt = false }) => {
  return (
    <div className="w-full flex flex-col items-center justify-center pb-2 pt-1 select-none z-40">
      {showHomePrompt && (
        <span className="text-[10px] text-slate-500/80 mb-0.5 tracking-wider font-medium animate-pulse">
          轻触返回桌面
        </span>
      )}
      <button
        onClick={onHome}
        aria-label="返回桌面"
        className="w-36 h-4 group flex items-center justify-center cursor-pointer transition-transform active:scale-95"
      >
        <div className="w-32 h-1.5 bg-slate-700/35 hover:bg-slate-700/60 transition-all rounded-full group-active:w-28 group-active:bg-sky-500/70" />
      </button>
    </div>
  );
};
