import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightAction?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full glass-nav px-3 pt-[env(safe-area-inset-top,0px)] md:pt-2.5 pb-1.5 flex items-center justify-between text-[#2C4A5C] shrink-0 border-b border-white/60">
      {/* 
        Back button directly below device notch / Dynamic Island
      */}
      <button
        onClick={onBack}
        aria-label="返回上一级"
        className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center hover:bg-black/5 active:scale-90 transition-all text-[#2C4A5C] cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5 stroke-[2.4]" />
      </button>

      {/* Title & Subtitle */}
      <div className="flex flex-col items-center justify-center text-center px-2 flex-1 min-w-0">
        <h1 className="text-[15px] font-bold tracking-tight text-[#2C4A5C] truncate max-w-[210px]">
          {title}
        </h1>
        {subtitle && (
          <span className="text-[10px] text-slate-500 font-medium tracking-normal truncate">
            {subtitle}
          </span>
        )}
      </div>

      {/* Right action button */}
      <div className="w-10 h-10 -mr-1 flex items-center justify-center">
        {rightAction}
      </div>
    </header>
  );
};
