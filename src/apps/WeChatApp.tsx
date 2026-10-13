import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  Compass,
  User,
  Search,
  Plus,
  Heart,
  MessageCircle,
  QrCode,
  Shield,
  Wallet,
  Settings,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';

interface WeChatAppProps {
  onBack: () => void;
}

type WeChatTab = 'chats' | 'contacts' | 'moments' | 'me';

export const WeChatApp: React.FC<WeChatAppProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<WeChatTab>('chats');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock chats
  const chatList = [
    {
      id: 1,
      name: '林汐 (剧本监督)',
      avatar: '汐',
      avatarBg: 'from-pink-400 to-rose-300',
      lastMsg: '今晚要不要一起来世界书整理NPC的背景设定？',
      time: '12:38',
      unread: 2,
    },
    {
      id: 2,
      name: '数字探索者公会',
      avatar: '公',
      avatarBg: 'from-sky-400 to-blue-500',
      lastMsg: '[图片] 刚刚在新川图书馆地下层发现了隐藏词条！',
      time: '11:15',
      unread: 1,
    },
    {
      id: 3,
      name: '苏子言 (AI工程师)',
      avatar: '言',
      avatarBg: 'from-teal-400 to-emerald-500',
      lastMsg: 'API 的调用延迟已经优化到 200ms 以内了。',
      time: '昨天',
      unread: 0,
    },
    {
      id: 4,
      name: '文件传输助手',
      avatar: '📁',
      avatarBg: 'from-emerald-400 to-teal-500',
      lastMsg: '[文件] world_book_draft_v2.json',
      time: '星期日',
      unread: 0,
    },
  ];

  // Mock moments
  const moments = [
    {
      id: 1,
      author: '林汐',
      avatar: '汐',
      time: '1小时前',
      content: '雨后的云层像棉花糖一样，把今天的第一份剧本大纲写完了。大家记得按时喝水🫧',
      likes: 18,
      comments: 4,
      images: ['#DFF1FA', '#FAD4E0'],
    },
    {
      id: 2,
      author: '苏子言',
      avatar: '言',
      time: '3小时前',
      content: '在工位边放了一盆小薄荷，连敲代码都带着草木香气。今天番茄钟已经达成 4 个循环！',
      likes: 24,
      comments: 7,
      images: ['#E1F7EF'],
    },
  ];

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F3F7FA] overflow-hidden">
      <AppHeader
        title={
          activeTab === 'chats'
            ? '微信 (3)'
            : activeTab === 'contacts'
            ? '通讯录'
            : activeTab === 'moments'
            ? '朋友圈'
            : '我'
        }
        onBack={onBack}
        rightAction={
          <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-[#2C4A5C]">
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* TAB 1: CHATS */}
        {activeTab === 'chats' && (
          <div className="flex flex-col pb-4">
            {/* Search Box */}
            <div className="p-3 pb-1">
              <div className="flex items-center gap-2 bg-white/70 border border-white/80 rounded-xl px-3 py-1.5 shadow-2xs">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索聊天记录、联系人"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-[#2C4A5C] placeholder-slate-400 w-full"
                />
              </div>
            </div>

            {/* Chat List */}
            <div className="divide-y divide-slate-100/70 mt-1">
              {chatList.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/40 active:bg-white/60 transition-colors cursor-pointer"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${chat.avatarBg} flex items-center justify-center text-white font-bold text-sm shadow-xs`}
                    >
                      {chat.avatar}
                    </div>
                    {chat.unread > 0 && (
                      <span className="absolute -top-1 -right-1 px-1.5 min-w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border border-white shadow-xs">
                        {chat.unread}
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-xs font-bold text-[#2C4A5C] truncate">
                        {chat.name}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {chat.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {chat.lastMsg}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: CONTACTS */}
        {activeTab === 'contacts' && (
          <div className="flex flex-col p-3 space-y-3 pb-2">
            <div className="glass-card rounded-2xl p-2 space-y-1">
              {['新的朋友', '群聊', '标签', '公众号'].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/40 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-[#2C4A5C]">{item}</span>
                  <span className="text-slate-400 text-xs">›</span>
                </div>
              ))}
            </div>

            <div className="px-1 text-[11px] font-bold text-slate-400">星标朋友</div>
            <div className="glass-card rounded-2xl divide-y divide-slate-100/60 overflow-hidden">
              {['林汐 (剧本监督)', '苏子言 (AI工程师)', '浅井 (绘师)'].map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/40 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-sky-200 text-sky-800 font-bold flex items-center justify-center text-xs">
                    {name.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-[#2C4A5C]">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MOMENTS */}
        {activeTab === 'moments' && (
          <div className="flex flex-col pb-2">
            {/* Moments Cover Banner */}
            <div className="relative h-36 bg-gradient-to-r from-sky-200 via-pink-100 to-blue-200 flex items-end justify-end p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#2C4A5C] drop-shadow-xs">星野 遥</span>
                <div className="w-12 h-12 rounded-2xl bg-white p-0.5 shadow-md">
                  <div className="w-full h-full rounded-[14px] bg-gradient-to-tr from-sky-400 to-teal-300 flex items-center justify-center text-white font-bold text-sm">
                    遥
                  </div>
                </div>
              </div>
            </div>

            {/* Moments Feed */}
            <div className="p-4 space-y-4">
              {moments.map((item) => (
                <div key={item.id} className="glass-card rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-pink-200 text-pink-700 font-bold flex items-center justify-center text-xs">
                        {item.avatar}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2C4A5C]">{item.author}</h4>
                        <span className="text-[10px] text-slate-400">{item.time}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#2C4A5C] leading-relaxed">
                    {item.content}
                  </p>

                  <div className="flex gap-2">
                    {item.images.map((color, idx) => (
                      <div
                        key={idx}
                        className="w-20 h-20 rounded-xl border border-white/60 shadow-2xs"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1 text-slate-500 text-xs">
                    <button className="flex items-center gap-1 hover:text-rose-500">
                      <Heart className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-mono">{item.likes}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-sky-500">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-mono">{item.comments}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ME */}
        {activeTab === 'me' && (
          <div className="p-4 space-y-3 pb-2">
            <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-400 to-pink-300 p-0.5 shadow-sm">
                <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center text-lg font-bold text-[#2C4A5C]">
                  遥
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#2C4A5C]">星野 遥</h3>
                <p className="text-[11px] text-slate-500 font-mono">微信号: hoshino_pocket</p>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded-full w-fit">
                  <QrCode className="w-3 h-3" />
                  <span>我的名片码</span>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl divide-y divide-slate-100/60 overflow-hidden">
              {[
                { label: '服务与钱包', icon: Wallet },
                { label: '收藏与笔记', icon: Heart },
                { label: '安全与私隐', icon: Shield },
                { label: '通用设置', icon: Settings },
              ].map(({ label, icon: IconItem }) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-3.5 py-3 hover:bg-white/40 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <IconItem className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-semibold text-[#2C4A5C]">{label}</span>
                  </div>
                  <span className="text-slate-400 text-xs">›</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* WeChat Bottom Sub-Tab Bar */}
      <div className="glass-nav border-t border-white/60 px-2 pt-1 pb-[max(env(safe-area-inset-bottom,0px),8px)] flex items-center justify-around z-20 shrink-0 mt-auto">
        {[
          { key: 'chats', label: '微信', icon: MessageSquare, badge: 3 },
          { key: 'contacts', label: '通讯录', icon: Users },
          { key: 'moments', label: '朋友圈', icon: Compass },
          { key: 'me', label: '我', icon: User },
        ].map(({ key, label, icon: TabIcon, badge }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key as WeChatTab)}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-teal-700 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <TabIcon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {badge && (
                  <span className="absolute -top-1 -right-2 px-1 min-w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
