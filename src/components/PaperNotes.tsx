import React, { useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, Mail, Send, Star, Trash2, X } from 'lucide-react';
import { localDateString } from '../utils/coupleSpaceData';
import { answerPaper, discardPaper, openDailyPaper, loadPaperNotes, setPaperFavorite, type PaperNotesState } from '../utils/paperNotes';
import { generateDailyPaper, generatePaperReply } from '../utils/paperNotesAi';

export const PaperNotes: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [state, setState] = useState<PaperNotesState>();
  const [today, setToday] = useState(localDateString());
  const [drawer, setDrawer] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const working = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);
  const cancelPress = () => { clearTimeout(pressTimer.current); };
  const refresh = async () => setState(await loadPaperNotes());
  const fail = (error: unknown) => {
    console.error('Could not update anonymous paper notes.', error);
    setError(error instanceof Error ? error.message : '小纸条操作失败，请重试。');
  };
  useEffect(() => {
    void refresh().catch(fail);
    const tick = () => setToday(localDateString());
    const timer = window.setInterval(tick, 15_000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); cancelPress(); };
  }, []);
  const act = async (task: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try { await task(); } catch (error) { fail(error); }
    finally {
      try { await refresh(); } catch (error) { fail(error); }
      setToday(localDateString());
      working.current = false;
      setBusy(false);
    }
  };
  const paper = state?.notes.find((item) => item.id === selectedId);
  const todayPaper = state?.notes.find((item) => item.id === state.days[today]?.noteId);
  const received = !!state?.days[today]?.noteId;
  const select = (id: string) => { setSelectedId(id); setAnswer(''); setError(''); setDeleting(false); };
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-label="小纸条"
        className="flex max-h-[92%] w-full max-w-sm flex-col overflow-hidden rounded-[28px] border border-white/80 bg-gradient-to-b from-[#DCEEFF] to-white text-[#2C4A5C] shadow-xl">
        <header className="flex shrink-0 items-center justify-between border-b border-sky-100 p-4">
          <div className="flex items-center gap-2">
            {(drawer || selectedId) && <button type="button" aria-label="返回纸条首页" disabled={busy}
              onClick={() => { setDrawer(false); setSelectedId(undefined); setError(''); setDeleting(false); }}><ArrowLeft className="h-4 w-4" /></button>}
            <h2 className="flex items-center gap-2 text-sm font-bold"><Mail className="h-4 w-4" />{drawer && !paper ? '纸条抽屉' : '小纸条'}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="打开纸条抽屉" disabled={busy} onClick={() => {
              setDrawer(true); setSelectedId(undefined); setError(''); setDeleting(false);
            }}><Archive className="h-4 w-4" /></button>
            <button type="button" aria-label="关闭小纸条" onClick={onClose}><X className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="space-y-4 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          {!state ? (
            <button type="button" onClick={() => void act(refresh)} className="text-xs text-slate-500">{error ? '重新加载' : '正在整理纸条…'}</button>
          ) : paper ? (
            <>
              <p className="text-center text-[11px] text-slate-400">{paper.date} · 匿名</p>
              <button type="button" disabled={busy} aria-pressed={!!paper.favorite}
                onClick={() => void act(async () => { await setPaperFavorite(paper.id, !paper.favorite); })}
                className="mx-auto flex items-center gap-1 text-xs text-sky-600">
                <Star className={`h-4 w-4 ${paper.favorite ? 'fill-sky-200' : ''}`} />{paper.favorite ? '已收藏 · 点击取消' : '收藏纸条'}
              </button>
              <article aria-label="匿名纸条正文" className="whitespace-pre-wrap break-words rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 text-sm leading-7 shadow-sm">{paper.content}</article>
              {paper.answer !== undefined && <div className="rounded-2xl bg-sky-50 p-4 text-xs">
                <p className="mb-2 text-slate-400">你传回的纸条</p><p className="whitespace-pre-wrap break-words leading-6">{paper.answer}</p>
              </div>}
              {paper.reply !== undefined && <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 text-sm">
                <p className="mb-2 text-[11px] text-slate-400">收到的回信 · 匿名</p>
                <p aria-label="匿名纸条回信" className="whitespace-pre-wrap break-words leading-7">{paper.reply}</p>
                <p className="mt-3 text-[10px] text-slate-400">这张纸条的旅程到这里结束了。</p>
              </div>}
              {paper.kind === 'question' && paper.reply === undefined && (
                paper.date === today ? <form className="space-y-2" onSubmit={(event) => {
                  event.preventDefault();
                  void act(async () => { await answerPaper(paper.id, answer, generatePaperReply); });
                }}>
                  {paper.answer === undefined && <textarea aria-label="纸条回答" maxLength={2000} rows={3} value={answer}
                    disabled={busy} onChange={(event) => setAnswer(event.target.value)}
                    placeholder="把你的回答写在背面…"
                    className="w-full rounded-xl border border-sky-100 bg-white/80 p-3 text-xs outline-none" />}
                  <button type="submit" disabled={busy || (paper.answer === undefined && !answer.trim())}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-100 bg-gradient-to-br from-[#DCEEFF] to-white py-2.5 text-xs font-semibold disabled:opacity-50">
                    <Send className="h-3 w-3" />{busy ? '纸条正在路上…' : paper.answer !== undefined ? '重试接收回信' : '传纸条'}
                  </button>
                  <p className="text-center text-[10px] text-slate-400">仅今天可传回一次，再收一封回信。</p>
                </form> : <p className="text-center text-[10px] text-slate-400">当天的传纸条机会已结束。</p>
              )}
              {deleting ? <div className="flex items-center justify-center gap-4 text-xs">
                <button type="button" disabled={busy} onClick={() => void act(async () => {
                  await discardPaper(paper.id); setSelectedId(undefined); setDrawer(true); setDeleting(false);
                })} className="text-rose-600">确认扔掉</button>
                <button type="button" disabled={busy} onClick={() => setDeleting(false)}>保留纸条</button>
              </div> : <button type="button" disabled={busy} onClick={() => setDeleting(true)}
                className="mx-auto flex items-center gap-1 text-[11px] text-slate-400"><Trash2 className="h-3 w-3" />扔进垃圾桶</button>}
            </>
          ) : drawer ? (
            <div className="space-y-2">
              <p className="text-[10px] text-slate-400">长按纸条收藏 / 取消收藏。保留最近100条未收藏纸条，收藏不占名额、不会自动删除。</p>
              {state.notes.length ? [...state.notes].sort((a, b) => b.date.localeCompare(a.date)).map((item) => (
                <button type="button" key={item.id} disabled={busy}
                  onPointerDown={() => {
                    cancelPress(); longPressed.current = false;
                    pressTimer.current = setTimeout(() => {
                      longPressed.current = true;
                      void act(async () => { await setPaperFavorite(item.id, !item.favorite); });
                    }, 550);
                  }}
                  onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress}
                  onContextMenu={(event) => event.preventDefault()}
                  onClick={() => { if (!longPressed.current) select(item.id); longPressed.current = false; }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 text-left">
                  {item.favorite ? <Star aria-label="已收藏" className="h-5 w-5 shrink-0 fill-sky-200 text-sky-500" /> : <Mail className="h-5 w-5 shrink-0 text-[#6F8CA0]" />}
                  <div className="min-w-0 flex-1"><p className="text-xs">{item.date}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-400">{item.content}</p></div>
                </button>
              )) : <p className="py-10 text-center text-xs text-slate-400">抽屉里还没有纸条。</p>}
            </div>
          ) : (
            <div className="space-y-5 py-6 text-center">
              <Mail className="mx-auto h-14 w-14 text-[#6F8CA0]" strokeWidth={1} />
              <p className="text-sm">{received ? '今天的小纸条已经收过啦' : '你收到了一张纸条'}</p>
              {received ? (
                todayPaper ?
                  <button type="button" onClick={() => select(todayPaper.id)}
                    className="rounded-full border border-sky-100 bg-gradient-to-br from-[#DCEEFF] to-white px-6 py-2.5 text-xs">查看今天的纸条</button> :
                  <p className="text-xs text-slate-400">纸条已扔掉，明天再来吧。</p>
              ) : <button type="button" disabled={busy} onClick={() => void act(async () => {
                const opened = await openDailyPaper(generateDailyPaper);
                if (opened) select(opened.id);
              })} className="rounded-full border border-sky-100 bg-gradient-to-br from-[#DCEEFF] to-white px-6 py-2.5 text-xs disabled:opacity-50">{busy ? '正在展开纸条…' : '打开纸条'}</button>}
              <p className="text-[10px] text-slate-400">一天一张，不署名的小心事。</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
