import React, { useState } from 'react';
import { BookOpen, Users, Compass, Shield, Search, ArrowRight, X } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';

interface WorldBookAppProps {
  onBack: () => void;
}

export const WorldBookApp: React.FC<WorldBookAppProps> = ({ onBack }) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'rules' | 'factions' | 'characters'>('all');
  const [activeEntry, setActiveEntry] = useState<{
    id: number;
    title: string;
    category: string;
    subtitle: string;
    content: string;
    tags: string[];
  } | null>(null);

  const entries = [
    {
      id: 1,
      title: '灵识涟漪法则 (The Resonance Law)',
      category: 'rules',
      subtitle: '世界基石定律 #01',
      tags: ['绝对律', '灵识', '共鸣'],
      content:
        '在浮岛世界中，旅人的思考与情感并非虚无，而是以微弱的“水蓝微澜”形式在空间中扩散。当两个个体的思考频率产生谐振时，便可激活掌心终端的专属链接通道。',
    },
    {
      id: 2,
      title: '数字探索者公会 (The Explorers Guild)',
      category: 'factions',
      subtitle: '三大核心阵营之一',
      tags: ['中立探索', '图书馆', '制图'],
      content:
        '驻扎在新川市立虚拟图书馆的自由学者联盟，致力于将破碎的古代词条重新编织成完整的世界法则图谱。苏子言与星野遥皆隶属于该公会的第3探索小队。',
    },
    {
      id: 3,
      title: '林汐 (NPC 档案 #04)',
      category: 'characters',
      subtitle: '剧本监督 · 记忆观测者',
      tags: ['核心角色', '观测者', '友好'],
      content:
        '拥有感知时间回溯痕迹的罕见天赋。性格沉静温和，偏爱手作甜点与雨天白噪音。常常在微信中给星野遥分享未完稿的剧本支线。',
    },
    {
      id: 4,
      title: '苏子言 (NPC 档案 #09)',
      category: 'characters',
      subtitle: '终端架构师 · 灵能工程师',
      tags: ['核心角色', '工程师', '技术宅'],
      content:
        'PocketOS 掌心终端的核心协议设计者。醉心于优化算法延迟，桌上常年摆放着一盆充满香气的新鲜薄荷草。',
    },
    {
      id: 5,
      title: '浮光湖界限 (The Floating Shallows)',
      category: 'rules',
      subtitle: '地理法则与空间边界',
      tags: ['地理', '微风', '边界'],
      content:
        '浮岛西侧的无垠浅水区，水深仅没脚踝，映照着天空中永不落幕的粉白霞光。旅人在此漫步时，终端将自动进入线下禅定模式。',
    },
  ];

  const filteredEntries = entries.filter((e) => {
    if (selectedCategory === 'all') return true;
    return e.category === selectedCategory;
  });

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F3F6FA] overflow-hidden">
      <AppHeader
        title="世界书 · 设定与法则"
        subtitle="词条库 · 阵营与人物志"
        onBack={onBack}
      />

      {/* Filter Tabs */}
      <div className="px-4 py-2 bg-white/40 border-b border-white/60 shrink-0">
        <div className="flex items-center p-1 bg-slate-200/50 rounded-xl">
          {[
            { key: 'all', label: '全部词条' },
            { key: 'rules', label: '世界法则' },
            { key: 'factions', label: '阵营势力' },
            { key: 'characters', label: '核心人物' },
          ].map(({ key, label }) => {
            const isActive = selectedCategory === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as any)}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-2.5 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        {filteredEntries.map((entry) => (
          <div
            key={entry.id}
            onClick={() => setActiveEntry(entry)}
            className="glass-card rounded-2xl p-3.5 space-y-1.5 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-full font-mono">
                {entry.subtitle}
              </span>
              <span className="text-slate-400 group-hover:text-purple-600 transition-colors text-xs">
                查看详情 ›
              </span>
            </div>

            <h3 className="text-xs font-bold text-[#2C4A5C]">{entry.title}</h3>
            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
              {entry.content}
            </p>

            <div className="flex items-center gap-1.5 pt-1">
              {entry.tags.map((t) => (
                <span
                  key={t}
                  className="text-[9px] text-slate-500 bg-white/70 px-1.5 py-0.5 rounded border border-white"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Entry Detail Modal Drawer */}
      {activeEntry && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end animate-fadeIn">
          <div className="w-full max-h-[80%] bg-white/95 backdrop-blur-2xl rounded-t-3xl p-5 pb-[max(env(safe-area-inset-bottom,0px),24px)] shadow-2xl flex flex-col space-y-3 overflow-y-auto no-scrollbar border-t border-white">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-mono text-purple-600 font-bold">
                {activeEntry.subtitle}
              </span>
              <button
                onClick={() => setActiveEntry(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-base font-bold text-[#2C4A5C]">{activeEntry.title}</h2>

            <div className="flex items-center gap-1.5">
              {activeEntry.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full font-medium"
                >
                  #{t}
                </span>
              ))}
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 leading-relaxed">
              {activeEntry.content}
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setActiveEntry(null)}
                className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-sm active:scale-98"
              >
                收起词条
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
