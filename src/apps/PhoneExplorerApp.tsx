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

interface PhoneExplorerAppProps {
  onBack: () => void;
}

type ExplorerTab = 'photos' | 'diary' | 'notes';

export const PhoneExplorerApp: React.FC<PhoneExplorerAppProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<ExplorerTab>('photos');

  // Mock photo albums
  const photos = [
    { id: 1, title: '初秋午后的蔚蓝天际', tag: '风景', color: 'from-sky-200 to-blue-300' },
    { id: 2, title: '剧本围读会议草稿纸', tag: '工作', color: 'from-amber-100 to-orange-200' },
    { id: 3, title: '雨天路过的街角咖啡屋', tag: '随拍', color: 'from-teal-100 to-emerald-200' },
    { id: 4, title: '世界书第一纪元草图', tag: '设定', color: 'from-purple-200 to-indigo-300' },
    { id: 5, title: '落日微光里的水波', tag: '风景', color: 'from-rose-200 to-pink-300' },
    { id: 6, title: '新川图书馆三楼窗景', tag: '日常', color: 'from-cyan-100 to-sky-200' },
  ];

  // Mock diary entries
  const diaries = [
    {
      id: 1,
      date: '10月12日 星期一 · 晴',
      title: '关于“灵识网络”的灵感记录',
      mood: '✨ 灵感迸发',
      preview:
        '今天在整理世界书的法则时，突然想到如果每一个AI旅人都拥有一部可以折叠进胸口的掌心小手机，那么他们之间的连接就不再是冰冷的代码，而是一串串带着晨光色泽的便签……',
    },
    {
      id: 2,
      date: '10月09日 星期五 · 微雨',
      title: '在街角咖啡馆度过的两小时',
      mood: '☕ 安静舒适',
      preview:
        '外面的小雨敲打在遮雨棚上，番茄钟响了三次。林汐发来新设定的审核反馈，提议把第二章的对话节奏放慢一点，我也觉得这样更能展现角色之间的微妙心绪。',
    },
    {
      id: 3,
      date: '10月05日 星期一 · 晴',
      title: '新川图书馆开馆日',
      mood: '📖 宁静平和',
      preview:
        '三楼靠窗的位置终于开放了，阳光透过双层玻璃洒在橡木桌上，很适合一整个下午都沉浸在故事世界里。',
    },
  ];

  // Mock notes
  const [notes, setNotes] = useState([
    { id: 1, text: '核对世界书第三章节 NPC 技能设定与平衡性', done: true },
    { id: 2, text: '准备下周线上剧情研讨会的讲稿框架', done: false },
    { id: 3, text: '给番茄钟增加白噪音环境声预设', done: false },
    { id: 4, text: '去淘宝买一本新的点阵网格手账本', done: true },
    { id: 5, text: '晚上记得备份虚拟手机里的日记与相册', done: false },
  ]);

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
