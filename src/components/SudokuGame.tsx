import { useEffect, useRef, useState } from 'react';
import { candidatesAt, createSudoku, findLogicalMove, type SudokuDifficulty } from '../utils/sudoku';

type Contact = { id: string; name: string };
type CharacterMode = 'off' | 'help' | 'participate' | 'watch';
type Props = {
  contacts: Contact[];
  onTalk: (id: string, mode: 'hint' | 'watch' | 'move', context: string) => Promise<string>;
  onShare: (result: { id: string; summary: string }, recipients: string[]) => void;
};

export function SudokuGame({ contacts, onTalk, onShare }: Props) {
  const [difficulty, setDifficulty] = useState<SudokuDifficulty>('normal');
  const [game, setGame] = useState(createSudoku);
  const [gameId, setGameId] = useState(() => crypto.randomUUID());
  const [grid, setGrid] = useState(() => [...game.puzzle]);
  const [selected, setSelected] = useState(-1);
  const [notes, setNotes] = useState<Record<number, number[]>>({});
  const [pencil, setPencil] = useState(false);
  const [mode, setMode] = useState<CharacterMode>('off');
  const [characterId, setCharacterId] = useState(contacts[0]?.id ?? '');
  const [speech, setSpeech] = useState('');
  const [speechHistory, setSpeechHistory] = useState<string[]>([]);
  const [characterCells, setCharacterCells] = useState<number[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hintIndex, setHintIndex] = useState(-1);
  const [correctMoves, setCorrectMoves] = useState(0);
  const nextCommentAt = useRef(5);
  const seenCorrect = useRef(new Set<number>());
  const session = useRef(0);
  const turnLock = useRef(false);
  const solved = grid.every((value, index) => value === game.solution[index]);
  const character = contacts.find(item => item.id === characterId);
  const filled = grid.filter(Boolean).length;

  const newGame = (level: SudokuDifficulty = difficulty) => {
    session.current++;
    const next = createSudoku(level);
    setGameId(crypto.randomUUID()); setRecipients([]); setShared(false); setShareNote('');
    setGame(next); setGrid([...next.puzzle]); setSelected(-1); setNotes({}); setSpeech(''); setSpeechHistory([]); setCharacterCells([]);
    turnLock.current = false;
    setError(''); setHintIndex(-1); setCorrectMoves(0); setBusy(false); nextCommentAt.current = 5; seenCorrect.current.clear();
  };
  const boardContext = (current: number[]) =>
    Array.from({ length: 9 }, (_, row) => current.slice(row * 9, row * 9 + 9).map(value => value || '.').join('')).join('/');
  const ask = async (requestMode: 'hint' | 'watch' | 'move', context: string, onSuccess?: () => void) => {
    if (!characterId || turnLock.current) return;
    const active = session.current;
    turnLock.current = true;
    setBusy(true); setError('');
    try {
      const line = await onTalk(characterId, requestMode, context);
      if (active === session.current) { onSuccess?.(); setSpeech(line); setSpeechHistory(previous => [...previous, `${contacts.find(item => item.id === characterId)?.name ?? '角色'}：${line}`]); }
    } catch (cause) {
      if (active === session.current) setError(cause instanceof Error ? cause.message : '角色暂时没有回应。');
    } finally { if (active === session.current) { turnLock.current = false; setBusy(false); } }
  };
  const put = (value: number) => {
    if (selected < 0 || game.puzzle[selected] || solved || turnLock.current) return;
    if (pencil && value) {
      setNotes(previous => {
        const values = previous[selected] ?? [];
        return { ...previous, [selected]: values.includes(value) ? values.filter(item => item !== value) : [...values, value].sort() };
      });
      return;
    }
    const next = [...grid]; next[selected] = value;
    const newCorrectPlacement = !!value && value === game.solution[selected] && !seenCorrect.current.has(selected);
    setGrid(next); setHintIndex(-1);
    setCharacterCells(previous => previous.filter(index => index !== selected));
    setNotes(previous => ({ ...previous, [selected]: [] }));
    if (newCorrectPlacement) {
      seenCorrect.current.add(selected); setCorrectMoves(count => count + 1);
    }
    if (mode === 'participate' && character && newCorrectPlacement &&
      next.some((number, index) => number !== game.solution[index])) {
      const move = next.every((number, index) => !number || number === game.solution[index]) ? findLogicalMove(next) : null;
      if (!move || move.value !== game.solution[move.index]) {
        const line = '我先看着，这一轮还没有能确定的格子。';
        setSpeech(line); setSpeechHistory(previous => [...previous, `${character.name}：${line}`]);
      } else {
        void ask('move', `玩家刚在第${Math.floor(selected / 9) + 1}行第${selected % 9 + 1}列填入${value}。轮到你。公开棋盘：${boardContext(next)}。程序已用排除法确认第${Math.floor(move.index / 9) + 1}行第${move.index % 9 + 1}列填${move.value}；理由：${move.reason}。请只说这一步的思路，不要提出其他未经验证的落点。`, () => {
          setGrid(current => { if (current[move.index]) return current; const updated = [...current]; updated[move.index] = move.value; return updated; });
          setCharacterCells(previous => [...previous, move.index]);
          setSelected(move.index);
        });
      }
    }
  };
  useEffect(() => {
    if (mode !== 'watch' || !character || busy || solved || correctMoves < nextCommentAt.current) return;
    nextCommentAt.current = correctMoves + 4 + Math.floor(Math.random() * 3);
    void ask('watch', `玩家已正确填入${correctMoves}格，当前填入${filled}/81格。棋盘：${boardContext(grid)}。只根据公开棋盘和局势旁观点评，不要透露答案。`);
  }, [correctMoves, mode, characterId, busy, solved]);
  const requestHint = () => {
    if (!character || busy || solved) return;
    const verifiedGrid = grid.map((value, index) => value === game.solution[index] ? value : 0);
    const open = grid.map((value, index) => game.puzzle[index] || value === game.solution[index] ? -1 : index).filter(index => index >= 0);
    if (!open.length) return;
    const target = open.find(index => candidatesAt(verifiedGrid, index).length === 1) ?? open[0];
    setHintIndex(target); setSelected(target);
    void ask('hint', `玩家求助。棋盘：${boardContext(grid)}。只提示第${Math.floor(target / 9) + 1}行第${target % 9 + 1}列应填${game.solution[target]}。${grid[target] ? '玩家此格目前填错，请温和指出并建议修改。' : candidatesAt(verifiedGrid, target).length === 1 ? '这格可由已有正确数字排除得出，可简短解释行、列或宫。' : '这格当前不是显而易见的唯一候选，只给一个方向和正确数字，不要假装有简单的唯一候选推理。'}不要透露其他格的答案。`);
  };
  return <section className="min-h-full bg-[#f4f5f2] px-3 pb-8 pt-4 text-[#273f37]">
    <div className="mx-auto max-w-[440px]">
      <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">数独 · 挑战</h2><p className="text-xs text-slate-500">唯一解 · {difficulty === 'hard' ? '高难题盘 · 23 个提示数' : '约 29 个提示数'}</p></div><button type="button" onClick={() => newGame()} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold shadow-sm">新一局</button></div>
      <label className="mt-3 flex items-center gap-2 text-xs">难度<select aria-label="数独难度" value={difficulty} onChange={event => { const level = event.target.value as SudokuDifficulty; setDifficulty(level); newGame(level); }} className="rounded-lg bg-white px-3 py-2 shadow-sm"><option value="normal">普通</option><option value="hard">困难</option></select><span className="text-slate-500">切换难度会开始新题</span></label>
      <p className="mt-3 text-xs text-slate-500">已填 {filled}/81 格 · 点格子后选数字，长按思考可以用笔记</p>
      <div className="mt-3 grid aspect-square grid-cols-9 overflow-hidden rounded-lg border-2 border-[#344e42] bg-white shadow-md">
        {grid.map((value, index) => {
          const row = Math.floor(index / 9), col = index % 9;
          const fixed = game.puzzle[index] !== 0;
          const related = selected >= 0 && (row === Math.floor(selected / 9) || col === selected % 9 || Math.floor(row / 3) === Math.floor(Math.floor(selected / 9) / 3) && Math.floor(col / 3) === Math.floor((selected % 9) / 3));
          return <button key={index} type="button" aria-label={`第${row + 1}行第${col + 1}列${value || '空'}`} onClick={() => setSelected(index)}
            className={`relative flex items-center justify-center border-b border-r border-slate-200 text-base font-semibold ${col === 2 || col === 5 ? 'border-r-2 border-r-[#344e42]' : ''} ${row === 2 || row === 5 ? 'border-b-2 border-b-[#344e42]' : ''} ${selected === index ? 'bg-emerald-200' : hintIndex === index ? 'bg-amber-100' : related ? 'bg-emerald-50' : ''} ${fixed ? 'text-slate-800' : characterCells.includes(index) ? 'text-sky-700' : 'text-emerald-700'}`}>
            {value || <span className="grid w-full grid-cols-3 text-[8px] font-normal leading-3 text-slate-400">{(notes[index] ?? []).map(note => <span key={note}>{note}</span>)}</span>}
          </button>;
        })}
      </div>
      <div className="mt-3 grid grid-cols-9 gap-1">{Array.from({ length: 9 }, (_, index) => <button key={index} type="button" onClick={() => put(index + 1)} className="rounded-lg bg-white py-2 text-lg font-bold shadow-sm">{index + 1}</button>)}</div>
      <div className="mt-2 flex gap-2"><button type="button" onClick={() => put(0)} className="rounded-lg bg-white px-4 py-2 text-xs shadow-sm">擦除</button><button type="button" onClick={() => setPencil(!pencil)} className={`rounded-lg px-4 py-2 text-xs shadow-sm ${pencil ? 'bg-emerald-600 text-white' : 'bg-white'}`}>笔记 {pencil ? '开' : '关'}</button></div>
      {solved && <div role="status" className="mt-4 rounded-2xl bg-emerald-100 p-4 text-emerald-900 shadow-sm">
        <p className="text-center text-base font-bold">数独挑战完成！</p>
        <p className="mt-1 text-center text-xs">{difficulty === 'hard' ? '困难' : '普通'} · {game.puzzle.filter(Boolean).length} 个提示数 · {characterCells.length ? `角色参与填入 ${characterCells.length} 格` : '玩家独立完成'}</p>
        <div className="mt-3 border-t border-emerald-200 pt-3"><p className="text-xs font-semibold">分享完成卡片给角色</p>
          <textarea aria-label="分享附言" value={shareNote} onChange={event => setShareNote(event.target.value.slice(0, 300))} placeholder="附带消息（选填）" className="mt-2 h-16 w-full resize-none rounded-lg bg-white p-2 text-xs outline-none" />
          {!!speechHistory.length && <p className="mt-1 text-[11px] text-emerald-800">卡片会附上本局角色消息（最近 {Math.min(8, speechHistory.length)} 条）。</p>}
          <div className="mt-2 max-h-32 overflow-y-auto">{contacts.map(item => <label key={item.id} className="flex items-center gap-2 py-1 text-xs"><input type="checkbox" checked={recipients.includes(item.id)} disabled={shared} onChange={event => setRecipients(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))}/>{item.name}</label>)}</div>
          <button type="button" disabled={!recipients.length || shared} onClick={() => {
            onShare({ id: gameId, summary: `数独挑战完成：${difficulty === 'hard' ? '困难' : '普通'}难度，${game.puzzle.filter(Boolean).length} 个提示数，${characterCells.length ? `角色参与填入 ${characterCells.length} 格` : '玩家独立完成'}。${shareNote.trim() ? `\n附言：${shareNote.trim()}` : ''}${speechHistory.length ? `\n本局角色消息：${speechHistory.slice(-8).join('；')}` : ''}` }, recipients);
            setShared(true);
          }} className="mt-2 w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white disabled:opacity-50">{shared ? '已分享到聊天' : '分享完成卡片'}</button>
        </div>
      </div>}
      <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm"><h3 className="text-sm font-bold">角色参与</h3>
        <div className="mt-3 flex gap-2"><select aria-label="参与角色" value={characterId} onChange={event => { session.current++; turnLock.current = false; setBusy(false); setCharacterId(event.target.value); setSpeech(''); }} className="min-w-0 flex-1 rounded-lg bg-slate-50 p-2 text-xs"><option value="">选择角色</option>{contacts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="参与方式" value={mode} onChange={event => { session.current++; turnLock.current = false; setBusy(false); setMode(event.target.value as CharacterMode); setSpeech(''); }} className="rounded-lg bg-slate-50 p-2 text-xs"><option value="off">不参与</option><option value="help">求助</option><option value="participate">参与</option><option value="watch">旁观</option></select></div>
        {mode === 'help' && <button type="button" disabled={!character || busy || solved} onClick={requestHint} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">向角色求助</button>}
        {mode === 'watch' && <p className="mt-2 text-[11px] text-slate-500">每正确填入约 4–6 格，角色偶尔会点评。</p>}
        {mode === 'participate' && <p className="mt-2 text-[11px] text-slate-500">你填对一格后轮到角色。角色只填能从盘面确定的数字；蓝色数字是角色填的。</p>}
        {busy && <p className="mt-3 text-xs text-slate-400">{character?.name}正在想…</p>}{speech && <div aria-label="角色消息" className="mt-3 max-h-48 space-y-2 overflow-y-auto">{speechHistory.slice(-8).map((line, index) => <p key={index} className="rounded-xl bg-emerald-50 p-3 text-xs leading-5">{line}</p>)}</div>}{error && <p role="alert" className="mt-3 text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  </section>;
}
