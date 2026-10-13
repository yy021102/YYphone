import React, { useState } from 'react';
import {
  Image as ImageIcon,
  BookMarked,
  FileText,
  Lock,
  Plus,
  Calendar,
  Sparkles,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { PHONE_DIARIES, PHONE_NOTES, PHONE_PHOTOS } from '../data/mockData';

interface PhoneExplorerAppProps {
  onBack: () => void;
}

type ExplorerTab = 'photos' | 'diary' | 'notes';

export const PhoneExplorerApp: React.FC<PhoneExplorerAppProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<ExplorerTab>('photos');

  const photos = PHONE_PHOTOS;
  const diaries = PHONE_DIARIES;
  const [notes, setNotes] = useState(PHONE_NOTES);

  const toggleNote = (id: number) => {
    setNotes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F3F8FB] overflow-hidden">
      <AppHeader
        title="查手机 · 隐私探索"
        subtitle="已加密保护 · 仅主人可见"
        onBack={onBack}
        rightAction={
          <div className="flex items-center gap-1 text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            <Lock className="w-3 h-3" />
            <span>私密</span>
          </div>
        }
      />

      {/* Segmented Top Tabs */}
      <div className="px-4 py-2 bg-white/40 border-b border-white/60 shrink-0">
        <div className="flex items-center p-1 bg-slate-200/50 rounded-xl">
          {[
            { key: 'photos', label: '相册 (6)', icon: ImageIcon },
            { key: 'diary', label: '日记 (3)', icon: BookMarked },
            { key: 'notes', label: '备忘录 (5)', icon: FileText },
          ].map(({ key, label, icon: TabIcon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as ExplorerTab)}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#2C4A5C] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        {/* PHOTOS */}
        {activeTab === 'photos' && (
          <div className="space-y-3 pb-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#2C4A5C] px-1">
              <span>近期胶卷快照</span>
              <span className="text-[11px] text-sky-600 font-normal">整理相册</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="glass-card rounded-2xl overflow-hidden group cursor-pointer active:scale-95 transition-all"
                >
                  <div
                    className={`h-28 bg-gradient-to-tr ${photo.color} relative p-2.5 flex flex-col justify-between`}
                  >
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/70 text-[#2C4A5C] w-fit shadow-2xs">
                      {photo.tag}
                    </span>
                    <Sparkles className="w-4 h-4 text-white/80 self-end" />
                  </div>
                  <div className="p-2.5 bg-white/60">
                    <p className="text-xs font-semibold text-[#2C4A5C] truncate">
                      {photo.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DIARY */}
        {activeTab === 'diary' && (
          <div className="space-y-3 pb-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#2C4A5C] px-1">
              <span>随笔与日记流</span>
              <button className="flex items-center gap-1 text-[11px] text-sky-600 font-bold bg-sky-50 px-2 py-0.5 rounded-md">
                <Plus className="w-3 h-3" />
                <span>写新篇</span>
              </button>
            </div>
            <div className="space-y-3">
              {diaries.map((diary) => (
                <div
                  key={diary.id}
                  className="glass-card rounded-2xl p-3.5 space-y-1.5 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-500 font-mono">
                      <Calendar className="w-3 h-3" />
                      <span>{diary.date}</span>
                    </div>
                    <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-medium">
                      {diary.mood}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-[#2C4A5C]">{diary.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {diary.preview}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NOTES */}
        {activeTab === 'notes' && (
          <div className="space-y-3 pb-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#2C4A5C] px-1">
              <span>待办随手记</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {notes.filter((n) => n.done).length} / {notes.length} 已完成
              </span>
            </div>

            <div className="glass-card rounded-2xl divide-y divide-slate-100/70 overflow-hidden">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => toggleNote(note.id)}
                  className="flex items-start gap-3 p-3 hover:bg-white/40 cursor-pointer transition-colors"
                >
                  {note.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <span
                    className={`text-xs flex-1 leading-relaxed ${
                      note.done ? 'line-through text-slate-400' : 'text-[#2C4A5C] font-medium'
                    }`}
                  >
                    {note.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl text-center">
              <span className="text-[11px] text-sky-800 font-medium">
                💡 查手机所有数据仅保存在本地设备中，绝不上报云端
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
