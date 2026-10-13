import React from 'react';
import { Palette, Check, Sparkles, Image as ImageIcon } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { THEMES, WALLPAPERS } from '../data/mockData';

interface ThemeCustomizerAppProps {
  onBack: () => void;
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
  activeWallpaperId: string;
  onSelectWallpaper: (wallpaperId: string) => void;
}

export const ThemeCustomizerApp: React.FC<ThemeCustomizerAppProps> = ({
  onBack,
  activeThemeId,
  onSelectTheme,
  activeWallpaperId,
  onSelectWallpaper,
}) => {
  return (
    <div className="flex-1 w-full flex flex-col bg-[#F3F7FA] overflow-hidden">
      <AppHeader
        title="美化 · 主题与壁纸"
        subtitle="柔和渐变 · 琉璃玻璃质感"
        onBack={onBack}
      />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        {/* Section 1: Themes Selection */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-[#2C4A5C]">
            <span className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-pink-500" />
              <span>系统主题配色</span>
            </span>
            <span className="text-[10px] text-slate-400">实时生效</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((theme) => {
              const isSelected = activeThemeId === theme.id;
              return (
                <div
                  key={theme.id}
                  onClick={() => onSelectTheme(theme.id)}
                  className={`glass-card rounded-2xl p-3 cursor-pointer transition-all border ${
                    isSelected
                      ? 'border-sky-500 ring-2 ring-sky-300 shadow-md scale-[1.02]'
                      : 'border-white/60 hover:border-sky-300'
                  }`}
                >
                  <div
                    className={`h-14 rounded-xl bg-gradient-to-r ${theme.gradient} border border-white/80 p-2 flex items-start justify-between shadow-inner`}
                  >
                    <span className="text-[10px] font-bold text-slate-700 bg-white/70 px-1.5 py-0.5 rounded shadow-2xs">
                      {theme.name}
                    </span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2 px-1">
                    <span className="text-xs font-bold text-[#2C4A5C]">{theme.name}</span>
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Wallpapers Selection */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-[#2C4A5C]">
            <span className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
              <span>锁屏与主屏壁纸</span>
            </span>
            <span className="text-[10px] text-slate-400">水彩梦境</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {WALLPAPERS.map((wp) => {
              const isSelected = activeWallpaperId === wp.id;
              return (
                <div
                  key={wp.id}
                  onClick={() => onSelectWallpaper(wp.id)}
                  className={`glass-card rounded-2xl overflow-hidden cursor-pointer transition-all border ${
                    isSelected
                      ? 'border-sky-500 ring-2 ring-sky-300 shadow-md scale-[1.02]'
                      : 'border-white/60 hover:border-sky-300'
                  }`}
                >
                  <div
                    className="h-28 relative p-2.5 flex flex-col justify-between"
                    style={{ background: wp.style }}
                  >
                    <div className="flex justify-end">
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-[#2C4A5C] bg-white/70 px-2 py-0.5 rounded-md w-fit shadow-2xs backdrop-blur-xs">
                      {wp.name}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white/60">
                    <p className="text-[10px] text-slate-500 truncate">{wp.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Material Glass Preview */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C4A5C]">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>质感参数说明</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            PocketOS 采用高透水雾毛玻璃（35% 白雾透光率、20px 高斯模糊与 65% 白边高光），柔和水蓝阴影保障在强烈光照下的文字可读性。
          </p>
        </div>
      </div>
    </div>
  );
};
