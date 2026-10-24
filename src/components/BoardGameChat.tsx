import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';

export type BoardGameChatLine = { from: 'user' | 'character'; text: string };
type Props = {
  gameName: string;
  opponentId: string;
  opponentName: string;
  context: string;
  moveCount?: number;
  onTalk: (opponentId: string, gameName: string, message: string, context: string, history: BoardGameChatLine[]) => Promise<string>;
};

export function BoardGameChat({ gameName, opponentId, opponentName, context, moveCount = 0, onTalk }: Props) {
  const [history, setHistory] = useState<BoardGameChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [autoEnabled, setAutoEnabled] = useState(true);
  const historyRef = useRef<BoardGameChatLine[]>([]);
  const busyRef = useRef(false);
  const lastManualMove = useRef(-10);
  const lastAutoMove = useRef(0);
  const requestSequence = useRef(0);
  useEffect(() => () => { requestSequence.current += 1; }, []);
  const updateHistory = (next: BoardGameChatLine[]) => { historyRef.current = next; setHistory(next); };
  const send = async () => {
    const message = draft.trim();
    if (!message || busyRef.current || !opponentId) return;
    const next: BoardGameChatLine[] = [...historyRef.current, { from: 'user', text: message }];
    updateHistory(next); setDraft(''); busyRef.current = true; setBusy(true); setError(''); lastManualMove.current = moveCount;
    const request = ++requestSequence.current;
    try {
      const reply = (await onTalk(opponentId, gameName, message, context, next)).trim();
      if (request !== requestSequence.current) return;
      if (!reply) throw new Error('角色没有返回有效回复，请重试。');
      updateHistory([...historyRef.current, { from: 'character', text: reply.slice(0, 400) }]);
    } catch (cause) {
      if (request === requestSequence.current) setError(cause instanceof Error ? cause.message : '角色暂时没有回应，请重试。');
    } finally { if (request === requestSequence.current) { busyRef.current = false; setBusy(false); } }
  };
  useEffect(() => {
    if (!autoEnabled || !opponentId || busyRef.current || moveCount < 8 ||
      moveCount - lastAutoMove.current < 8 || moveCount - lastManualMove.current < 4) return;
    const timer = window.setTimeout(() => {
      if (busyRef.current) return;
      lastAutoMove.current = moveCount;
      busyRef.current = true; setBusy(true); setError('');
      const request = ++requestSequence.current;
      void onTalk(opponentId, gameName, '', context, historyRef.current)
        .then(reply => {
          if (request === requestSequence.current && reply.trim()) updateHistory([...historyRef.current, { from: 'character', text: reply.trim().slice(0, 400) }]);
        })
        .catch(() => { /* 主动发言失败不打断棋局。 */ })
        .finally(() => { if (request === requestSequence.current) { busyRef.current = false; setBusy(false); } });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [moveCount, autoEnabled, opponentId]);
  return <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white/85 shadow-sm">
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><div className="flex items-center gap-2"><MessageCircle size={16} className="text-emerald-700"/><div><p className="text-xs font-bold">棋局小聊</p><p className="text-[10px] text-slate-400">和{opponentName}边下边聊</p></div></div><label className="flex items-center gap-1 text-[10px] text-slate-500"><input type="checkbox" checked={autoEnabled} onChange={event => setAutoEnabled(event.target.checked)} className="accent-emerald-700"/>主动发言</label></div>
    <div className="max-h-44 min-h-16 space-y-2 overflow-y-auto px-4 py-3">{history.length ? history.map((line, index) => <div key={index} className={`flex ${line.from === 'user' ? 'justify-end' : 'justify-start'}`}><p className={`max-w-[86%] rounded-2xl px-3 py-2 text-xs leading-5 ${line.from === 'user' ? 'rounded-br-sm bg-emerald-700 text-white' : 'rounded-bl-sm bg-[#f2f5f1] text-slate-700'}`}>{line.text}</p></div>) : <p className="py-2 text-center text-xs text-slate-400">落子之间，和 TA 聊两句吧</p>}{busy && <p className="text-[11px] text-slate-400">{opponentName}正在想怎么说…</p>}</div>
    {error && <p role="alert" className="px-4 pb-2 text-[11px] text-rose-600">{error}</p>}
    <div className="flex gap-2 border-t border-slate-100 p-3"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void send(); }} maxLength={300} placeholder="说点什么，聊聊这盘棋…" className="min-w-0 flex-1 rounded-xl bg-[#f3f7f3] px-3 py-2.5 text-xs outline-none"/><button type="button" aria-label="发送游戏聊天" disabled={busy || !draft.trim()} onClick={() => void send()} className="flex w-10 items-center justify-center rounded-xl bg-emerald-700 text-white disabled:opacity-40"><Send size={16}/></button></div>
  </div>;
}
