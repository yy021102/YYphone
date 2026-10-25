import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Search, Share2, Trash2, X } from 'lucide-react';
import { favoriteDate, favoritePreview, type WeChatFavorite } from '../utils/wechatFavorites';

interface Props {
  items: WeChatFavorite[];
  onShare: (item: WeChatFavorite) => void;
  onDelete: (id: string) => void;
  composeOpen: boolean;
  onComposeClose: () => void;
  onCreate: (text: string) => boolean;
}

export function WeChatFavorites({ items, onShare, onDelete, composeOpen, onComposeClose, onCreate }: Props) {
  const [search, setSearch] = useState('');
  const [menuId, setMenuId] = useState('');
  const [previewId, setPreviewId] = useState('');
  const [draft, setDraft] = useState('');
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; y: number; suppress: boolean }>({ timer: null, x: 0, y: 0, suppress: false });
  const cancelPress = () => { if (press.current.timer) clearTimeout(press.current.timer); press.current.timer = null; };
  useEffect(() => () => { if (press.current.timer) clearTimeout(press.current.timer); }, []);
  const menu = items.find(item => item.id === menuId);
  const preview = items.find(item => item.id === previewId);
  const query = search.trim().toLocaleLowerCase();
  const shown = items.filter(item => `${item.message.title ?? ''} ${favoritePreview(item.message)} ${item.sourceChatTitle} ${item.sourceSenderName}`.toLocaleLowerCase().includes(query));

  return <div className="wechat-favorites min-h-full bg-[#ededed] px-3 pb-6 pt-2">
    <label className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-white px-4 text-[#aaa]">
      <Search className="h-4 w-4 shrink-0" /><input aria-label="搜索收藏" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索" className="min-w-0 flex-1 bg-transparent py-3 text-base text-slate-800 outline-none placeholder:text-[#aaa]" />
      {search && <button type="button" aria-label="清空搜索" onClick={() => setSearch('')}><X size={16} /></button>}
    </label>
    <div className="space-y-2.5">
      {shown.map(item => <button type="button" key={item.id} aria-label={`收藏：${item.message.title || favoritePreview(item.message)}`}
        className="wechat-favorite-card block w-full rounded-lg bg-white p-4 text-left active:bg-slate-50 touch-pan-y select-none"
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          cancelPress(); press.current = { timer: null, x: event.clientX, y: event.clientY, suppress: false };
          press.current.timer = setTimeout(() => { press.current.suppress = true; setMenuId(item.id); }, 550);
        }}
        onPointerMove={event => { if (Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 8) cancelPress(); }}
        onPointerUp={cancelPress} onPointerCancel={cancelPress} onPointerLeave={cancelPress}
        onContextMenu={event => { event.preventDefault(); cancelPress(); press.current.suppress = true; setMenuId(item.id); }}
        onClick={() => { if (press.current.suppress) { press.current.suppress = false; return; } setPreviewId(item.id); }}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-3 whitespace-pre-wrap break-words text-[16px] leading-6 text-slate-800">{item.message.title || favoritePreview(item.message)}</p>
            {item.message.title && <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-5 text-slate-400">{favoritePreview(item.message)}</p>}
          </div>
          {item.message.imageUrl && <img src={item.message.imageUrl} alt="收藏图片" className="h-16 w-16 shrink-0 rounded object-cover" />}
        </div>
        <div className="mt-5 flex items-end justify-between gap-3 text-[11px] text-[#aaa]">
          <span className="min-w-0 truncate">{item.sourceChatTitle || item.sourceSenderName || '我的收藏'}</span>
          <time className="shrink-0" dateTime={item.savedAt}>{favoriteDate(item.savedAt)}</time>
        </div>
      </button>)}
      {!shown.length && <div className="flex flex-col items-center px-5 py-20 text-center text-slate-400"><Bookmark className="mb-4 h-10 w-10" /><p className="text-sm">{query ? '没有找到相关收藏' : '暂无收藏'}</p>{!query && <p className="mt-2 text-xs">长按聊天消息，选择“收藏”即可保存</p>}</div>}
    </div>

    {menu && <div className="absolute inset-0 z-[75] flex items-end bg-black/40" onClick={() => setMenuId('')}>
      <section role="dialog" aria-modal="true" aria-label="收藏操作" className="w-full rounded-t-2xl bg-[#ededed] p-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)]" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={() => { setMenuId(''); onShare(menu); }} className="flex w-full items-center justify-center gap-2 rounded-t-lg bg-white py-4 text-base text-slate-800"><Share2 size={18} />分享</button>
        <button type="button" onClick={() => { onDelete(menu.id); setMenuId(''); }} className="flex w-full items-center justify-center gap-2 rounded-b-lg border-t border-slate-100 bg-white py-4 text-base text-rose-500"><Trash2 size={18} />删除</button>
        <button type="button" onClick={() => setMenuId('')} className="mt-2 w-full rounded-lg bg-white py-4 text-base text-slate-700">取消</button>
      </section>
    </div>}

    {preview && <div className="absolute inset-0 z-[65] flex items-center justify-center bg-black/40 p-5" onClick={() => setPreviewId('')}>
      <section role="dialog" aria-modal="true" aria-label="收藏详情" className="flex max-h-[85%] w-full max-w-sm flex-col rounded-2xl bg-white p-5" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-slate-800">收藏详情</h2><button type="button" aria-label="关闭收藏详情" onClick={() => setPreviewId('')}><X size={20} /></button></div>
        <div className="min-h-0 overflow-y-auto">
          {preview.message.title && <h3 className="mb-2 text-base font-semibold text-slate-800">{preview.message.title}</h3>}
          {preview.message.imageUrl && <img src={preview.message.imageUrl} alt="收藏图片" className="mb-3 max-h-80 w-full object-contain" />}
          <p className="whitespace-pre-wrap break-words text-base leading-7 text-slate-800">{favoritePreview(preview.message)}</p>
          <p className="mt-5 text-xs text-slate-400">{preview.sourceChatTitle} · {preview.sourceSenderName}</p>
          <p className="mt-1 text-xs text-slate-400">{new Date(preview.savedAt).toLocaleString('zh-CN', { hour12: false })}</p>
        </div>
        <button type="button" onClick={() => { setPreviewId(''); onShare(preview); }} className="mt-4 rounded-lg bg-[#07c160] py-2.5 text-sm font-semibold text-white">分享</button>
      </section>
    </div>}

    {composeOpen && <div className="absolute inset-0 z-[65] flex items-center justify-center bg-black/40 p-5">
      <form onSubmit={event => { event.preventDefault(); if (draft.trim() && onCreate(draft.trim())) { setDraft(''); onComposeClose(); } }} role="dialog" aria-modal="true" aria-label="新建收藏" className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-slate-800">新建收藏</h2><button type="button" aria-label="关闭新建收藏" onClick={onComposeClose}><X size={20} /></button></div>
        <textarea autoFocus aria-label="收藏内容" value={draft} onChange={event => setDraft(event.target.value)} maxLength={20000} rows={6} placeholder="记录想收藏的内容" className="w-full resize-y rounded-lg border border-slate-200 bg-transparent p-3 text-base text-slate-800 outline-none" />
        <button type="submit" disabled={!draft.trim()} className="w-full rounded-lg bg-[#07c160] py-2.5 text-sm font-semibold text-white disabled:opacity-40">保存收藏</button>
      </form>
    </div>}
  </div>;
}
