import React, { useState } from 'react';
import { Heart, Calendar, Sparkles, Image as ImageIcon, Send, Clock, Smile } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { COUPLE_NOTES } from '../data/mockData';

interface CoupleSpaceAppProps {
  onBack: () => void;
}

export const CoupleSpaceApp: React.FC<CoupleSpaceAppProps> = ({ onBack }) => {
  const [loveNote, setLoveNote] = useState('');
  const [notes, setNotes] = useState(COUPLE_NOTES);

  const handleSendNote = () => {
    if (!loveNote.trim()) return;
    setNotes([
      { id: Date.now(), author: '星野 遥', time: '刚刚', text: loveNote.trim() },
      ...notes,
    ]);
    setLoveNote('');
  };

  return (
    <div className="flex-1 w-full flex flex-col bg-[#FDF6F8] overflow-hidden">
      <AppHeader
        title="情侣空间 · 甜蜜纪事"
        subtitle="专属双人秘密基地"
        onBack={onBack}
        rightAction={
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
            <Heart className="w-4 h-4 fill-pink-500" />
          </div>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        {/* Couple Hero Card */}
        <div className="glass-card rounded-3xl p-5 border-pink-100 bg-gradient-to-b from-white/70 via-pink-50/40 to-white/60 relative overflow-hidden text-center space-y-3">
          <div className="flex items-center justify-center gap-6 pt-2">
            {/* Left avatar */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-300 p-0.5 shadow-sm">
                <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center font-bold text-sky-800 text-base">
                  遥
                </div>
              </div>
              <span className="text-xs font-bold text-[#2C4A5C] mt-1.5">星野 遥</span>
            </div>

            {/* Center Heart Emblem */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-200 flex items-center justify-center text-rose-500 animate-pulse">
                <Heart className="w-5 h-5 fill-rose-500" />
              </div>
              <span className="text-[10px] text-rose-500 font-bold mt-1 font-mono">Lv.6 灵犀</span>
            </div>

            {/* Right avatar */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-400 to-rose-300 p-0.5 shadow-sm">
                <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center font-bold text-pink-700 text-base">
                  晴
                </div>
              </div>
              <span className="text-xs font-bold text-[#2C4A5C] mt-1.5">沐晴</span>
            </div>
          </div>

          <div className="pt-1">
            <span className="text-xs text-slate-500 font-medium">我们相伴漫游</span>
            <div className="text-2xl font-extrabold text-rose-600 font-mono tracking-tight mt-0.5">
              第 128 天
            </div>
          </div>

          <div className="pt-2 border-t border-pink-100 flex items-center justify-around text-xs text-slate-600">
            <div>
              <span className="text-[10px] text-slate-400 block">心动便签</span>
              <span className="font-bold text-[#2C4A5C] font-mono">34 条</span>
            </div>
            <div className="h-6 w-px bg-pink-200/60" />
            <div>
              <span className="text-[10px] text-slate-400 block">双人相册</span>
              <span className="font-bold text-[#2C4A5C] font-mono">92 张</span>
            </div>
            <div className="h-6 w-px bg-pink-200/60" />
            <div>
              <span className="text-[10px] text-slate-400 block">纪念日倒数</span>
              <span className="font-bold text-rose-600 font-mono">14 天</span>
            </div>
          </div>
        </div>

        {/* Anniversary Countdown */}
        <div className="glass-card rounded-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-rose-500" />
            <div>
              <p className="text-xs font-bold text-[#2C4A5C]">半周年纪念日倒计时</p>
              <span className="text-[10px] text-slate-500">2026年10月27日</span>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
            还剩 14 天
          </span>
        </div>

        {/* Leave a sweet note */}
        <div className="glass-card rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#2C4A5C]">
            <span>互通心意便签</span>
            <span className="text-[10px] text-pink-600">即时同步中</span>
          </div>

          <div className="flex items-center gap-2 bg-white/70 border border-pink-100 rounded-xl px-3 py-1.5 shadow-2xs">
            <input
              type="text"
              placeholder="给对方留下一句暖心的话……"
              value={loveNote}
              onChange={(e) => setLoveNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendNote()}
              className="bg-transparent border-none outline-none text-xs text-[#2C4A5C] placeholder-slate-400 w-full"
            />
            <button
              onClick={handleSendNote}
              className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Notes list */}
          <div className="space-y-2 pt-1">
            {notes.map((n) => (
              <div key={n.id} className="p-2.5 bg-white/60 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-rose-600">{n.author}</span>
                  <span className="text-slate-400 font-mono">{n.time}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{n.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
