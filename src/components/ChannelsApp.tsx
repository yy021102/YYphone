import { useState } from 'react';
import { Compass, Heart, MessageCircle, Play, Radio, Search, UserRound } from 'lucide-react';
import { ChannelsProfile } from './ChannelsProfile';

type Tab = 'plaza' | 'live' | 'messages' | 'me';
type Props = { userName: string; avatarUrl?: string; contacts: Array<{ id: string; name: string }> };

const tabs = [
  { id: 'plaza', label: '广场', icon: Compass },
  { id: 'live', label: '直播', icon: Radio },
  { id: 'messages', label: '私信', icon: MessageCircle },
  { id: 'me', label: '我', icon: UserRound },
] as const;

export function ChannelsApp({ userName, avatarUrl, contacts }: Props) {
  const [tab, setTab] = useState<Tab>('plaza');
  const [plazaView, setPlazaView] = useState<'recommended' | 'following'>('recommended');
  return <section className="flex h-full min-h-0 flex-col bg-[#f7f8f8] text-[#202928]">
    <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
      {tab === 'plaza' && <>
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 pt-3 backdrop-blur">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold tracking-tight">广场</h2><Search className="h-5 w-5 text-slate-400" aria-hidden="true" /></div>
          <div className="mt-3 flex gap-6 text-sm font-semibold">
            <button type="button" onClick={() => setPlazaView('recommended')} className={`border-b-2 pb-2 ${plazaView === 'recommended' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400'}`}>推荐</button>
            <button type="button" onClick={() => setPlazaView('following')} className={`border-b-2 pb-2 ${plazaView === 'following' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400'}`}>关注</button>
          </div>
        </header>
        <div className="space-y-3 p-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3"><span className="h-9 w-9 rounded-full bg-slate-100"/><div className="space-y-2"><span className="block h-2.5 w-24 rounded bg-slate-100"/><span className="block h-2 w-16 rounded bg-slate-100"/></div></div>
            <div className="mt-4 space-y-2"><span className="block h-2.5 w-[85%] rounded bg-slate-100"/><span className="block h-2.5 w-[64%] rounded bg-slate-100"/></div>
            <div className="mt-4 flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-[#edf3f0] to-[#e8eceb]"><p className="text-xs text-slate-400">{plazaView === 'recommended' ? '广场内容区' : '关注内容区'}</p></div>
            <div className="mt-4 flex gap-6 text-slate-300"><Heart className="h-4 w-4"/><MessageCircle className="h-4 w-4"/><Play className="h-4 w-4"/></div>
          </div>
          <p className="py-4 text-center text-xs text-slate-400">内容玩法将在下一步完善</p>
        </div>
      </>}
      {tab === 'live' && <><header className="border-b border-slate-100 bg-white px-4 py-4"><h2 className="text-xl font-bold">直播</h2><p className="mt-1 text-xs text-slate-500">发现正在进行的直播</p></header><div className="p-4"><div className="flex aspect-video items-center justify-center rounded-2xl bg-gradient-to-br from-[#dcefe8] to-[#e8e7f2]"><Radio className="h-10 w-10 text-white/90" /></div><p className="mt-4 text-center text-sm font-semibold">直播内容区</p><p className="mt-1 text-center text-xs text-slate-500">直播间和互动玩法将在下一步完善</p></div></>}
      {tab === 'messages' && <><header className="border-b border-slate-100 bg-white px-4 py-4"><h2 className="text-xl font-bold">私信</h2></header><div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><MessageCircle className="h-10 w-10 text-slate-300"/><p className="mt-3 text-sm font-semibold">暂无视频号私信</p><p className="mt-1 text-xs text-slate-500">这里将集中展示视频号内的对话</p></div></>}
      {tab === 'me' && <ChannelsProfile userName={userName} avatarUrl={avatarUrl} contacts={contacts} />}
    </div>
    <nav aria-label="视频号导航" className="grid shrink-0 grid-cols-4 border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)]">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={`flex flex-col items-center gap-1 py-2 text-[10px] ${tab === id ? 'font-bold text-emerald-700' : 'text-slate-400'}`}><Icon className="h-5 w-5"/>{label}</button>)}
    </nav>
  </section>;
}
