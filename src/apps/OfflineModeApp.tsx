import React, { useState } from 'react';
import {
  Compass,
  Volume2,
  VolumeX,
  MapPin,
  Sparkles,
  Footprints,
  Radio,
  Wind,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';

interface OfflineModeAppProps {
  onBack: () => void;
}

export const OfflineModeApp: React.FC<OfflineModeAppProps> = ({ onBack }) => {
  const [activeSound, setActiveSound] = useState<string | null>('雨声');
  const [zenModeActive, setZenModeActive] = useState(false);

  const ambientSounds = [
    { name: '雨声', icon: '🌧️', desc: '屋檐轻叩细雨' },
    { name: '海浪', icon: '🌊', desc: '晨曦海岸潮汐' },
    { name: '白噪音', icon: '🍃', desc: '高山森林微风' },
    { name: '咖啡馆', icon: '☕', desc: '午后杯碟轻响' },
  ];

  const cityStops = [
    {
      id: 1,
      title: '新川市立虚拟图书馆 · 屋顶花园',
      dist: '距离 120m',
      status: '推荐漫步',
      desc: '绿植环绕的观景露台，视野开阔，适合携带便签本散步记录。',
    },
    {
      id: 2,
      title: '浅井古董咖啡店后巷',
      dist: '距离 450m',
      status: '安静角落',
      desc: '爬满常春藤的红砖墙与老式木质长椅，偶有猫咪停留。',
    },
    {
      id: 3,
      title: '浮光湖畔慢跑步道',
      dist: '距离 820m',
      status: '微风宜人',
      desc: '全长2公里的环湖步道，秋日落叶铺满路面。',
    },
  ];

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F1F6F8] overflow-hidden">
      <AppHeader
        title="线下模式 · 城市漫游"
        subtitle="感知当下 · 暂别网络喧嚣"
        onBack={onBack}
        rightAction={
          <div className="flex items-center gap-1 text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            <Radio className="w-3 h-3 text-teal-600 animate-pulse" />
            <span>离线模式</span>
          </div>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3 pb-[env(safe-area-inset-bottom,0px)]">
        {/* Ambient Sounds Selector Card */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-[#2C4A5C]">自然伴奏与白噪音</h3>
            </div>
            <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-medium">
              {activeSound ? `正在播放 · ${activeSound}` : '已静音'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ambientSounds.map((snd) => {
              const isSelected = activeSound === snd.name;
              return (
                <button
                  key={snd.name}
                  onClick={() => setActiveSound(isSelected ? null : snd.name)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-500/15 border-teal-500/40 text-teal-900 shadow-2xs'
                      : 'bg-white/60 border-white/80 text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="text-xl">{snd.icon}</span>
                  <div className="text-left">
                    <p className="text-xs font-bold">{snd.name}</p>
                    <span className="text-[9px] text-slate-500">{snd.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-world exploration spots */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-[#2C4A5C]">
            <span className="flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-teal-600" />
              <span>漫步探索推荐点</span>
            </span>
            <span className="text-[10px] text-slate-400">已载入本地离线地图</span>
          </div>

          {cityStops.map((stop) => (
            <div
              key={stop.id}
              className="glass-card rounded-2xl p-3.5 space-y-1.5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2C4A5C]">{stop.title}</span>
                <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-semibold">
                  {stop.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{stop.desc}</p>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1">
                <MapPin className="w-3 h-3 text-teal-500" />
                <span>{stop.dist}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Zen Battery Saver Switch */}
        <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-[#2C4A5C]">极简省电禅定模式</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">
              关闭所有非必要动画，仅保留基础记录与白噪音
            </p>
          </div>
          <button
            onClick={() => setZenModeActive(!zenModeActive)}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              zenModeActive ? 'bg-teal-500' : 'bg-slate-300'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                zenModeActive ? 'left-5.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
