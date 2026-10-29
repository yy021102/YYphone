import React, { useEffect, useRef, useState } from 'react';
import { requestConfiguredAiText } from '../utils/aiApi';
import { readAvailableChatStickers, type ChatSticker } from '../utils/chatStickers';
import { LITTLE_P_GUIDE, littlePHistory, littlePSystemPrompt, parseLittlePReply, readLittlePMessages, writeLittlePMessages, type LittlePMessage } from '../utils/littleP';

interface LittlePPanelProps {
  open: boolean;
  onClose: () => void;
  onHide: () => void;
}

export const LittlePPanel: React.FC<LittlePPanelProps> = ({ open, onClose, onHide }) => {
  const [messages, setMessages] = useState(readLittlePMessages);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stickersOpen, setStickersOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const running = useRef(false);
  const generation = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const stickers = readAvailableChatStickers();

  const stopGeneration = () => {
    generation.current?.abort();
    generation.current = null;
    running.current = false;
    setBusy(false);
  };
  useEffect(() => { if (!open) stopGeneration(); }, [open]);
  useEffect(() => () => generation.current?.abort(), []);

  useEffect(() => {
    if (open && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, open]);

  const persist = (next: LittlePMessage[]) => {
    writeLittlePMessages(next);
    setMessages(next);
  };

  const addUserMessage = (sticker?: ChatSticker) => {
    if (running.current || (!draft.trim() && !sticker)) return;
    try {
      persist([...messages, { id: crypto.randomUUID(), role: 'user', text: sticker ? '' : draft.trim(), ...(sticker ? { sticker } : {}) }]);
      if (!sticker) setDraft('');
      setStickersOpen(false);
      setError('');
    } catch (failure) {
      console.error('Could not save Little P message.', failure);
      setError('消息保存失败，请检查本地存储后重试。');
    }
  };

  const generate = async () => {
    if (running.current) return;
    running.current = true;
    const controller = new AbortController();
    generation.current = controller;
    setBusy(true);
    setError('');
    try {
      const history = littlePHistory(messages);
      const latest = history.at(-1);
      const currentInput = latest?.role === 'user' ? latest.content : '请自然接着聊，或亲切地问候我。';
      const response = await requestConfiguredAiText(littlePSystemPrompt(stickers), currentInput, {
        json: true,
        history: latest?.role === 'user' ? history.slice(0, -1) : history.slice(-99),
        includeGlobalWorldBooks: false,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      const reply = parseLittlePReply(response, stickers).map((part): LittlePMessage => ({
        ...part, id: crypto.randomUUID(), role: 'assistant',
      }));
      persist([...messages, ...reply]);
    } catch (failure) {
      if (controller.signal.aborted) return;
      console.error('Could not generate Little P reply.', failure);
      setError(failure instanceof Error ? failure.message : '小P 暂时没有连接成功，请重试。');
    } finally {
      if (generation.current === controller) {
        generation.current = null;
        running.current = false;
        setBusy(false);
      }
    }
  };

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[90] flex items-end justify-center bg-slate-950/25 p-3 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-label="小P · YYphone 小精灵" className="flex h-[88%] max-h-[44rem] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white bg-[#f7faff] shadow-2xl">
        <header className="flex items-center gap-2 bg-gradient-to-r from-sky-100 to-pink-100 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-xl" aria-hidden="true">✦</span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-slate-700">小P</h2><p className="text-[10px] text-slate-500">YYphone 的小精灵 · 帮助与闲聊</p></div>
          <button type="button" onClick={onClose} aria-label="关闭小P" className="h-9 w-9 rounded-full bg-white/70 text-slate-500">×</button>
        </header>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 px-4 py-2 text-[10px] text-sky-700">
          <button type="button" onClick={() => setGuideOpen(!guideOpen)}>{guideOpen ? '返回聊天' : '功能指南（离线可看）'}</button>
          <button type="button" onClick={() => {
            if (window.confirm('隐藏主页小P入口？可到设置 → 小P 恢复，聊天记录不会删除。')) onHide();
          }}>隐藏主页入口</button>
          <button type="button" disabled={busy} onClick={() => {
            if (!window.confirm('清空与小P的聊天记录？其他角色聊天和记忆不受影响。')) return;
            try { persist([]); setError(''); }
            catch (failure) { console.error('Could not clear Little P history.', failure); setError('清空失败，请重试。'); }
          }} className="text-slate-400 disabled:opacity-50">清空聊天</button>
        </div>
        {guideOpen ? (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {LITTLE_P_GUIDE.map((entry) => <details key={entry.title} className="rounded-2xl bg-white p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-700">{entry.title}</summary><p className="mt-2 text-xs leading-relaxed text-slate-500">{entry.content}</p></details>)}
          </div>
        ) : (
          <div ref={scroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <p className="rounded-2xl bg-white p-3 text-xs leading-relaxed text-slate-500">嗨，我是小P！想找功能、遇到疑问，或者只是想聊聊天，都可以来找我。发出消息后，点「让小P回复」就好；还没配置 API 的话，也可以先翻翻功能指南。</p>
            {messages.map((message) => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-xs leading-relaxed ${message.role === 'user' ? 'bg-sky-100 text-slate-700' : 'bg-white text-slate-600'}`}>
                {message.sticker ? <img src={message.sticker.imageUrl} alt={message.sticker.description} className="h-24 w-24 object-contain" /> : message.text}
              </div>
            </div>)}
            {busy && <p role="status" className="text-xs text-sky-600">小P 正在想怎么回复…</p>}
          </div>
        )}
        {error && <p role="alert" className="px-4 py-2 text-xs text-rose-600">{error}</p>}
        {!guideOpen && <>
          {stickersOpen && <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto border-t border-slate-100 p-3">
            {stickers.map((sticker) => <button key={sticker.id} type="button" disabled={busy} aria-label={`发送表情包：${sticker.description}`} onClick={() => addUserMessage(sticker)} className="rounded-xl bg-white p-1">
              <img src={sticker.imageUrl} alt={sticker.description} loading="lazy" className="h-12 w-full object-contain" />
            </button>)}
          </div>}
          <form onSubmit={(event) => { event.preventDefault(); addUserMessage(); }} className="flex items-center gap-2 border-t border-slate-100 bg-white p-3">
            <button type="button" aria-label="小P表情包" disabled={busy} onClick={() => setStickersOpen(!stickersOpen)} className="text-lg text-sky-600">☺</button>
            <input aria-label="给小P的消息" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={10000} disabled={busy} placeholder="和小P说点什么…" className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2 text-xs outline-none" />
            <button type="submit" disabled={busy || !draft.trim()} className="text-xs font-semibold text-sky-700 disabled:opacity-40">发送</button>
            <button type="button" onClick={() => busy ? stopGeneration() : void generate()} className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white">{busy ? '停止生成' : '让小P回复'}</button>
          </form>
        </>}
      </section>
    </div>
  );
};
