import React, { useState } from 'react';
import { Sparkles, Clock, Calendar, Heart, Bookmark, Eye, Search, Plus } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';

interface MemoryAppProps {
  onBack: () => void;
}

export const MemoryApp: React.FC<MemoryAppProps> = ({ onBack }) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'milestones' | 'dialogue' | 'snapshots'>('all');

  const memoryFragments = [
    {
      id: 1,
      title: '初遇新川虚拟图书馆',
      category: 'milestones',
      categoryLabel: '重大里程碑',
      date: '2026年08月15日 · 晴',
      excerpt: '初次开机的清晨，第一道水蓝微光在屏幕正中凝聚。与林汐和子言交换了第一张电子名片。',
      mood: '🌸 温暖感动',
      color: 'from-sky-300/30 to-blue-400/20',
      tag: '#最初的起点',
    },
    {
      id: 2,
      title: '浮岛暴雨夜的围炉剧本研讨',
      category: 'dialogue',
      categoryLabel: '对话共鸣',
      date: '2026年09月04日 · 暴雨',
      excerpt: '雷声隔绝在玻璃窗外，咖啡香气弥漫了一整晚。我们敲定了世界书第三律的草案。',
      mood: '☕ 静谧专注',
      color: 'from-amber-300/30 to-orange-400/20',
      tag: '#羁绊加深',
    },
    {
      id: 3,
      title: '浮光浅滩的落日快照',
      category: 'snapshots',
      categoryLabel: '时光快照',
      date: '2026年09月28日 · 霞光',
      excerpt: '粉白与水蓝交织的天际线，微风掠过水面留下细小的涟漪。那一刻时间仿佛彻底静止。',
      mood: '🌅 宁静永恒',
      color: 'from-pink-300/30 to-rose-400/20',
      tag: '#浅滩留影',
    },
    {
      id: 4,
      title: 'PocketOS 掌心终端正式激活',
      category: 'milestones',
      categoryLabel: '重大里程碑',
      date: '2026年10月12日 · 晨曦',
      excerpt: '所有模块组装完毕，轻触小白条即可无缝穿梭于每一个精心编织的应用之间。',
      mood: '✨ 晶莹闪耀',
      color: 'from-teal-300/30 to-emerald-400/20',
      tag: '#系统新生',
    },
  ];

  const filtered = memoryFragments.filter((m) => {
    if (activeFilter === 'all') return true;
    return m.category === activeFilter;
  });

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F3F7FA] overflow-hidden">
      <AppHeader
        title="记忆 · 回忆碎片"
        subtitle="时光胶囊与心绪归档"
        onBack={onBack}
        rightAction={
          <button className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">
            <Plus className="w-3.5 h-3.5" />
            <span>封存新记忆</span>
          </button>
        }
      />

      {/* Top filter pills */}
      <div className="px-4 py-2 bg-white/40 border-b border-white/60 shrink-0">
        <div className="flex items-center p-1 bg-slate-200/50 rounded-xl">
          {[
            { key: 'all', label: '全部记忆' },
            { key: 'milestones', label: '里程碑' },
            { key: 'dialogue', label: '共鸣' },
            { key: 'snapshots', label: '快照' },
          ].map(({ key, label }) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key as any)}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Memory Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-2.5 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        {/* Memory Capsule Banner */}
        <div className="glass-card rounded-2xl p-4 flex items-center justify-between border-amber-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#2C4A5C]">记忆胶囊库</p>
              <span className="text-[10px] text-slate-500">已完整封存 4 篇重要回忆碎片</span>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-amber-600">100% 完整</span>
        </div>

        {/* Timeline Cards */}
        {filtered.map((item) => (
          <div
            key={item.id}
            className="glass-card rounded-2xl p-4 space-y-2 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold">
                {item.categoryLabel}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                <Clock className="w-3 h-3" />
                <span>{item.date}</span>
              </div>
            </div>

            <h3 className="text-xs font-bold text-[#2C4A5C]">{item.title}</h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              {item.excerpt}
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100/60">
              <span className="text-[10px] text-slate-500 font-medium">{item.mood}</span>
              <span className="text-[10px] text-sky-600 font-medium">{item.tag}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
