import React, { useState } from 'react';
import {
  Flame,
  MessageSquare,
  ThumbsUp,
  Share2,
  TrendingUp,
  Sparkles,
  PenLine,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { FORUM_CATEGORIES, FORUM_POSTS } from '../data/mockData';

interface ForumAppProps {
  onBack: () => void;
}

export const ForumApp: React.FC<ForumAppProps> = ({ onBack }) => {
  const [activeCategory, setActiveCategory] = useState('全部');

  const categories = FORUM_CATEGORIES;
  const posts = FORUM_POSTS;

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F5F8FA] overflow-hidden">
      <AppHeader
        title="论坛 · 树洞与广场"
        subtitle="2.4k 旅人在线讨论"
        onBack={onBack}
        rightAction={
          <button className="flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
            <PenLine className="w-3.5 h-3.5" />
            <span>发帖</span>
          </button>
        }
      />

      {/* Categories Horizontal Scroll */}
      <div className="px-4 py-2 bg-white/50 border-b border-white/70 overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-rose-500 text-white shadow-xs'
                : 'bg-white/70 text-slate-600 hover:bg-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Forum Content */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        {/* Hot Topics Carousel */}
        <div className="glass-card rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#2C4A5C]">本周热话榜首</p>
              <span className="text-[10px] text-slate-500">世界书新阵营势力投票开启</span>
            </div>
          </div>
          <span className="text-xs text-rose-600 font-bold">查看 ›</span>
        </div>

        {/* Posts List */}
        {posts
          .filter((p) => activeCategory === '全部' || p.tag === activeCategory)
          .map((post) => (
            <div
              key={post.id}
              className="glass-card rounded-2xl p-4 space-y-2.5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                    {post.author.charAt(0)}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#2C4A5C]">{post.author}</span>
                    <span className="text-[10px] text-slate-400 ml-2">{post.time}</span>
                  </div>
                </div>
                <span className="text-[10px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full font-medium">
                  #{post.tag}
                </span>
              </div>

              <h3 className="text-xs font-bold text-[#2C4A5C] leading-snug">
                {post.title}
              </h3>

              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                {post.content}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1 hover:text-rose-500">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="font-mono text-[11px]">{post.upvotes}</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-sky-500">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="font-mono text-[11px]">{post.replies}</span>
                  </button>
                </div>
                <button className="hover:text-slate-800">
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
