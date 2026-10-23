import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FileUp, Lightbulb, Plus, RotateCcw, Send, Share2, Sparkles } from 'lucide-react';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';

export type TurtlePerson = { id: string; name: string; kind: '角色' | 'NPC' };
export type TurtlePuzzle = { id: string; title: string; surface: string; truth: string; difficulty: string; source?: 'custom' };
type Turn = { id: string; kind: 'question' | 'guess'; question: string; verdict: 'yes' | 'no' | 'irrelevant' | 'guess'; answer: string };
type Session = {
  id: string; puzzle: TurtlePuzzle; host: TurtlePerson; phase: 'asking' | 'ended';
  mode?: 'guess' | 'host';
  turns: Turn[]; pending: { kind: Turn['kind']; question: string } | null;
  solverPrompt?: { kind: Turn['kind']; text: string } | null;
  outcome: 'solved' | 'revealed' | null; selectedShare: string[]; shared: boolean;
};
type Stored = { selectedPuzzleId: string; hostId: string; generated: TurtlePuzzle[]; custom?: TurtlePuzzle[]; customDraft?: TurtlePuzzle | null; session: Session | null };
type HostInput = { host: TurtlePerson; puzzle: TurtlePuzzle; history: Turn[]; mode: 'question' | 'guess'; question: string };
type HostOutput = { verdict: 'yes' | 'no' | 'irrelevant'; answer: string; solved?: boolean };
type SolverInput = { actor: TurtlePerson; title: string; surface: string; history: Turn[] };
type SolverOutput = { kind: 'question' | 'guess'; text: string };
type Props = {
  people: TurtlePerson[]; userName: string;
  onHost: (input: HostInput) => Promise<HostOutput>;
  onSolver: (input: SolverInput) => Promise<SolverOutput>;
  onGenerate: (style: string) => Promise<TurtlePuzzle>;
  onShare: (result: { id: string; title: string; detail: string }, recipients: string[]) => void;
};

const KEY = 'yyphone:turtle-soup:v1';
const BUILTIN: TurtlePuzzle[] = [
  { id: 'turtle-fishbowl', title: '地上的玻璃', difficulty: '入门', surface: '一个人回到家，看见地上的碎玻璃和一滩水，立刻知道有两条生命已经没了。为什么？', truth: '鱼缸摔碎了，水和玻璃散落一地；缸里的两条金鱼离水后死亡。这里的“两条生命”指金鱼。' },
  { id: 'turtle-lamps', title: '只闪了两次', difficulty: '进阶', surface: '每晚八点，阿岚都会等对面楼的灯闪三次。某晚灯只闪了两次，她立刻报警，救了一个人。为什么？', truth: '对面住着独居且失语的老人。阿岚与老人约定每天八点用台灯闪三次报平安。那晚老人按到第二次时突发疾病倒下，信号中断。阿岚察觉异常报警，老人因此获救。' },
  { id: 'turtle-blank-letter', title: '没有字的信', difficulty: '轻松', surface: '她收到父亲寄来的一封“空白”信，却马上知道父亲平安抵达了目的地。为什么？', truth: '父亲失明，习惯用盲文写信。信纸上没有普通人看得见的墨字，却有凸起的盲文；她读出父亲写的报平安消息。' },
];
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isPuzzle = (value: unknown): value is TurtlePuzzle => isRecord(value) && ['id', 'title', 'surface', 'truth', 'difficulty'].every(key => typeof value[key] === 'string') &&
  (value.source === undefined || value.source === 'custom');
const isTurn = (value: unknown): value is Turn => isRecord(value) && typeof value.id === 'string' &&
  (value.kind === 'question' || value.kind === 'guess') && typeof value.question === 'string' &&
  ['yes', 'no', 'irrelevant', 'guess'].includes(String(value.verdict)) && typeof value.answer === 'string';
const isSession = (value: unknown): value is Session => isRecord(value) && typeof value.id === 'string' &&
  isPuzzle(value.puzzle) && isRecord(value.host) && typeof value.host.id === 'string' && typeof value.host.name === 'string' &&
  (value.host.kind === '角色' || value.host.kind === 'NPC') && (value.phase === 'asking' || value.phase === 'ended') &&
  (value.mode === undefined || value.mode === 'guess' || value.mode === 'host') &&
  Array.isArray(value.turns) && value.turns.every(isTurn) &&
  (value.pending === null || isRecord(value.pending) && (value.pending.kind === 'question' || value.pending.kind === 'guess') && typeof value.pending.question === 'string') &&
  (value.solverPrompt === undefined || value.solverPrompt === null || isRecord(value.solverPrompt) &&
    (value.solverPrompt.kind === 'question' || value.solverPrompt.kind === 'guess') && typeof value.solverPrompt.text === 'string') &&
  (value.outcome === null || value.outcome === 'solved' || value.outcome === 'revealed') &&
  Array.isArray(value.selectedShare) && value.selectedShare.every((id: unknown) => typeof id === 'string') && typeof value.shared === 'boolean';
const isStored = (value: unknown): value is Stored => isRecord(value) && typeof value.selectedPuzzleId === 'string' &&
  typeof value.hostId === 'string' && Array.isArray(value.generated) && value.generated.every(isPuzzle) &&
  (value.custom === undefined || Array.isArray(value.custom) && value.custom.every(isPuzzle)) &&
  (value.customDraft === undefined || value.customDraft === null || isPuzzle(value.customDraft)) &&
  (value.session === null || isSession(value.session));
const DEFAULT: Stored = { selectedPuzzleId: BUILTIN[0].id, hostId: '', generated: [], custom: [], customDraft: null, session: null };
const verdictLabel = (verdict: Turn['verdict']) => verdict === 'yes' ? '是' : verdict === 'no' ? '不是' : verdict === 'irrelevant' ? '无关' : '推理';
const newCustomDraft = (): TurtlePuzzle => ({ id: `turtle-custom-${crypto.randomUUID()}`, title: '', surface: '', truth: '', difficulty: '自创', source: 'custom' });
const parseSoupFile = (text: string, filename: string): TurtlePuzzle => {
  const draft = newCustomDraft();
  draft.title = filename.replace(/\.(txt|md|markdown|json)$/i, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown; } catch { parsed = null; }
  if (isRecord(parsed)) {
    draft.title = typeof parsed.title === 'string' ? parsed.title.trim() : typeof parsed.name === 'string' ? parsed.name.trim() : draft.title;
    draft.surface = typeof parsed.surface === 'string' ? parsed.surface : typeof parsed['汤面'] === 'string' ? parsed['汤面']
      : typeof parsed.story === 'string' ? parsed.story : '';
    draft.truth = typeof parsed.truth === 'string' ? parsed.truth : typeof parsed['汤底'] === 'string' ? parsed['汤底']
      : typeof parsed.answer === 'string' ? parsed.answer : '';
    return draft;
  }
  const titleMarker = /(?:^|\n)\s*(?:题名|标题|名称)\s*[：:]\s*([^\n]+)/m.exec(text);
  if (titleMarker) draft.title = titleMarker[1].trim();
  const surfaceMarker = /(?:^|\n)\s*(?:汤面|题面)\s*[：:]/m.exec(text);
  const truthMarker = /(?:^|\n)\s*(?:汤底|答案)\s*[：:]/m.exec(text);
  const before = truthMarker ? text.slice(surfaceMarker ? surfaceMarker.index + surfaceMarker[0].length : 0, truthMarker.index)
    : surfaceMarker ? text.slice(surfaceMarker.index + surfaceMarker[0].length) : text;
  draft.surface = (!surfaceMarker && titleMarker ? before.replace(titleMarker[0], '') : before).trim();
  draft.truth = truthMarker ? text.slice(truthMarker.index + truthMarker[0].length).trim() : '';
  return draft;
};

export function TurtleSoupGame({ people, userName, onHost, onSolver, onGenerate, onShare }: Props) {
  const [saved] = useState(() => readStoredValue(KEY, DEFAULT, isStored));
  const [selectedPuzzleId, setSelectedPuzzleId] = useState(saved.selectedPuzzleId);
  const [hostId, setHostId] = useState(saved.hostId);
  const [generated, setGenerated] = useState(saved.generated);
  const [custom, setCustom] = useState(saved.custom ?? []);
  const [customDraft, setCustomDraft] = useState<TurtlePuzzle | null>(saved.customDraft ?? null);
  const [session, setSession] = useState<Session | null>(saved.session);
  const [mode, setMode] = useState<'question' | 'guess'>('question');
  const [draft, setDraft] = useState('');
  const [style, setStyle] = useState('悬疑');
  const [hostVerdict, setHostVerdict] = useState<'yes' | 'no' | 'irrelevant'>('yes');
  const [hostNote, setHostNote] = useState('');
  const [editorMessage, setEditorMessage] = useState('');
  const [deletePendingId, setDeletePendingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const generationInFlight = useRef(false);
  const puzzles = [...BUILTIN, ...generated, ...custom];
  const selectedPuzzle = puzzles.find(puzzle => puzzle.id === selectedPuzzleId) ?? BUILTIN[0];
  const availableRecipients = session?.selectedShare.filter(id => people.some(person => person.id === id)) ?? [];

  useEffect(() => { writeStoredValue(KEY, { selectedPuzzleId, hostId, generated, custom, customDraft, session } satisfies Stored); }, [selectedPuzzleId, hostId, generated, custom, customDraft, session]);
  useEffect(() => () => { requestId.current++; }, []);

  const start = () => {
    const host = people.find(person => person.id === hostId);
    if (!host) return;
    requestId.current++; inFlight.current = false; setBusy(false); setError(''); setDraft(''); setMode('question');
    setSession({ id: `turtle-${crypto.randomUUID()}`, puzzle: selectedPuzzle, host, phase: 'asking',
      mode: selectedPuzzle.source === 'custom' ? 'host' : 'guess',
      turns: [], pending: null, solverPrompt: null, outcome: null, selectedShare: [host.id], shared: false });
  };
  const uploadCustom = async (file?: File) => {
    if (!file) return;
    if (!/\.(txt|md|markdown|json)$/i.test(file.name)) { setEditorMessage('请选择 .txt、.md 或 .json 文件。'); return; }
    if (file.size > 80 * 1024) { setEditorMessage('文件最多 80 KB。'); return; }
    try {
      const parsed = parseSoupFile(await file.text(), file.name);
      setCustomDraft(parsed);
      setEditorMessage(parsed.truth ? '已导入汤面和汤底，请检查后保存。' : '已导入汤面，请补填汤底后保存。');
    } catch { setEditorMessage('文件读取失败，请使用 UTF-8 文本或 JSON。'); }
  };
  const uploadDraftField = async (field: 'surface' | 'truth', file?: File) => {
    if (!file || !customDraft) return;
    if (!/\.(txt|md|markdown)$/i.test(file.name) || file.size > 80 * 1024) { setEditorMessage('请选择小于 80 KB 的 .txt 或 .md 文稿。'); return; }
    try { const content = (await file.text()).trim(); setCustomDraft(previous => previous ? { ...previous, [field]: content } : previous); setEditorMessage(field === 'surface' ? '汤面已导入。' : '汤底已导入。'); }
    catch { setEditorMessage('文件读取失败。'); }
  };
  const saveCustom = () => {
    if (!customDraft) return;
    const title = customDraft.title.trim();
    const surface = customDraft.surface.trim();
    const truth = customDraft.truth.trim();
    if (!title || !surface || !truth) { setEditorMessage('请填写题名、汤面和汤底。'); return; }
    if (!custom.some(puzzle => puzzle.id === customDraft.id) && custom.length >= 20) { setEditorMessage('最多保存 20 碗自创汤。'); return; }
    const savedPuzzle = { ...customDraft, title, surface, truth, source: 'custom' as const };
    setCustom(previous => [...previous.filter(puzzle => puzzle.id !== savedPuzzle.id), savedPuzzle]);
    setSelectedPuzzleId(savedPuzzle.id); setCustomDraft(null); setEditorMessage('');
  };
  const deleteCustom = (id: string) => {
    setCustom(previous => previous.filter(puzzle => puzzle.id !== id));
    if (selectedPuzzleId === id) setSelectedPuzzleId(BUILTIN[0].id);
    setDeletePendingId('');
  };
  const generate = async () => {
    if (generationInFlight.current) return;
    generationInFlight.current = true;
    setGenerating(true); setError('');
    try {
      const puzzle = await onGenerate(style);
      if (!puzzle.title.trim() || !puzzle.surface.trim() || !puzzle.truth.trim()) throw new Error('生成的汤面或汤底不完整，请重试。');
      const next = { ...puzzle, id: `turtle-ai-${crypto.randomUUID()}`, difficulty: puzzle.difficulty || style };
      setGenerated(previous => [...previous.slice(-7), next]); setSelectedPuzzleId(next.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '生成失败，请重试。'); }
    finally { generationInFlight.current = false; setGenerating(false); }
  };
  const send = async () => {
    if (!session || session.mode === 'host' || session.phase !== 'asking' || inFlight.current) return;
    const pending = session.pending ?? { kind: mode, question: draft.trim().slice(0, 500) };
    if (!pending.question) return;
    inFlight.current = true;
    const prepared = { ...session, pending };
    setSession(prepared); setDraft(''); setBusy(true); setError('');
    const token = ++requestId.current;
    try {
      const reply = await onHost({ host: prepared.host, puzzle: prepared.puzzle, history: prepared.turns,
        mode: pending.kind, question: pending.question });
      if (requestId.current !== token) return;
      const answer = reply.answer.trim().slice(0, 600);
      if (!answer) throw new Error('主持人没有返回有效回答，请重试。');
      const turn: Turn = { id: crypto.randomUUID(), kind: pending.kind, question: pending.question,
        verdict: pending.kind === 'guess' ? 'guess' : reply.verdict, answer };
      setSession({ ...prepared, pending: null, turns: [...prepared.turns, turn],
        phase: pending.kind === 'guess' && reply.solved ? 'ended' : 'asking',
        outcome: pending.kind === 'guess' && reply.solved ? 'solved' : null });
    } catch (cause) { if (requestId.current === token) setError(cause instanceof Error ? cause.message : '请求失败，请重试。'); }
    finally { if (requestId.current === token) { inFlight.current = false; setBusy(false); } }
  };
  const askSolver = async () => {
    if (!session || session.mode !== 'host' || session.phase !== 'asking' || session.solverPrompt || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    const token = ++requestId.current;
    try {
      const action = await onSolver({ actor: session.host, title: session.puzzle.title,
        surface: session.puzzle.surface, history: session.turns });
      if (requestId.current !== token) return;
      if ((action.kind !== 'question' && action.kind !== 'guess') || !action.text.trim()) throw new Error('角色没有提出有效问题，请重试。');
      setSession({ ...session, solverPrompt: { kind: action.kind, text: action.text.trim().slice(0, 500) } });
    } catch (cause) { if (requestId.current === token) setError(cause instanceof Error ? cause.message : '角色暂时无法提问，请重试。'); }
    finally { if (requestId.current === token) { inFlight.current = false; setBusy(false); } }
  };
  const answerSolver = (correct = false) => {
    if (!session || session.mode !== 'host' || !session.solverPrompt || busy) return;
    const prompt = session.solverPrompt;
    const note = hostNote.trim().slice(0, 500);
    const answer = prompt.kind === 'guess'
      ? `${correct ? '猜对了' : '还没猜对'}${note ? `。${note}` : '。'}`
      : `${verdictLabel(hostVerdict)}${note ? `。${note}` : '。'}`;
    const turn: Turn = { id: crypto.randomUUID(), kind: prompt.kind, question: prompt.text,
      verdict: prompt.kind === 'guess' ? 'guess' : hostVerdict, answer };
    setSession({ ...session, solverPrompt: null, turns: [...session.turns, turn],
      phase: correct ? 'ended' : 'asking', outcome: correct ? 'solved' : null });
    setHostNote(''); setHostVerdict('yes'); setError('');
  };
  const reveal = () => {
    if (!session || busy || session.phase === 'ended') return;
    requestId.current++; inFlight.current = false; setSession({ ...session, phase: 'ended', pending: null, solverPrompt: null, outcome: 'revealed' }); setError('');
  };
  const restart = () => { requestId.current++; inFlight.current = false; setBusy(false); setError(''); setSession(null); setDraft(''); };
  const report = session ? [
    `海龟汤 · ${session.puzzle.title}`, `参与：${userName}（${session.mode === 'host' ? '主持' : '猜汤'}）与 ${session.host.name}（${session.mode === 'host' ? '猜汤' : '主持'}）`,
    `汤面：${session.puzzle.surface}`,
    '', '【问答与推理】', ...(session.turns.length ? session.turns.map((turn, index) =>
      `${index + 1}. ${session.mode === 'host' ? session.host.name : userName}${turn.kind === 'guess' ? '推理' : '提问'}：${turn.question}\n${session.mode === 'host' ? userName : session.host.name}【${verdictLabel(turn.verdict)}】：${turn.answer}`) : ['本局没有问答记录。']),
    '', `结果：${session.outcome === 'solved' ? session.mode === 'host' ? `${session.host.name}猜出真相` : '猜出真相' : session.outcome === 'revealed' ? '揭晓汤底' : '进行中'}`,
    ...(session.phase === 'ended' ? [`汤底：${session.puzzle.truth}`] : []),
  ].join('\n') : '';

  return <section className="min-h-full bg-gradient-to-b from-[#e7f0ef] via-[#f0f0f2] to-[#f9f2ef] px-4 py-5 text-[#465762]">
    <div className="mx-auto max-w-[480px] space-y-4 pb-8">
      <header className="rounded-3xl border border-white/75 bg-gradient-to-br from-[#d4e6e5]/90 via-[#e6e7ed]/90 to-[#f2e3df]/90 p-5 shadow-sm backdrop-blur-xl">
        <p className="text-[10px] font-bold tracking-[.16em] text-[#6b8187]">微信游戏</p>
        <h2 className="mt-2 flex items-center gap-2 text-2xl font-black"><Lightbulb size={23} />海龟汤</h2>
        <p className="mt-2 text-xs leading-5">一个离奇的故事，一连串只能用“是、不是、无关”回答的问题。</p>
      </header>
      {!session && <>
        <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
          <h3 className="text-sm font-bold">挑一碗汤</h3><p className="mt-1 text-[11px] text-slate-500">内置与 AI 汤由角色主持；你上传的汤由你主持。</p>
          <div className="mt-3 space-y-2">{puzzles.map(puzzle => <div key={puzzle.id} className={`rounded-2xl border p-3 ${selectedPuzzleId === puzzle.id ? 'border-[#b6cece] bg-[#eaf3f1]' : 'border-white bg-[#f6f7f7]'}`}><button type="button" onClick={() => setSelectedPuzzleId(puzzle.id)} className="w-full text-left"><span className="flex items-center justify-between text-xs font-bold"><span>{puzzle.title}</span><span className="text-[10px] font-normal text-slate-500">{puzzle.source === 'custom' ? '我主持' : puzzle.difficulty}</span></span><span className="mt-1 block text-[11px] leading-5 text-slate-500">{puzzle.surface}</span></button>{puzzle.source === 'custom' && <div className="mt-2 flex gap-3 text-[11px] font-semibold text-[#6a8a90]"><button type="button" onClick={() => { setCustomDraft({ ...puzzle }); setEditorMessage(''); }}>编辑</button><button type="button" onClick={() => deletePendingId === puzzle.id ? deleteCustom(puzzle.id) : setDeletePendingId(puzzle.id)} className="text-rose-600">{deletePendingId === puzzle.id ? '再次点击删除' : '删除'}</button></div>}</div>)}</div>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
          <h3 className="text-sm font-bold">我来主持 · 上传海龟汤</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">支持 .txt、.md、.json。一个文件可用“汤面：”“汤底：”分段，也可以分别上传两份文稿。</p>
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setCustomDraft(newCustomDraft()); setEditorMessage(''); }} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#e5efec] py-2.5 text-xs font-bold"><Plus size={14} />自己填写</button><label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#e8edf3] py-2.5 text-xs font-bold"><FileUp size={14} />上传整份<input type="file" accept=".txt,.md,.markdown,.json,text/plain,application/json" className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void uploadCustom(file); }} /></label></div>
          {customDraft && <div className="mt-4 space-y-3 rounded-2xl bg-[#f4f7f6] p-3">
            <label className="block text-xs font-semibold">题名<input value={customDraft.title} onChange={event => setCustomDraft({ ...customDraft, title: event.target.value.slice(0, 80) })} maxLength={80} placeholder="这碗汤的名字" className="mt-1 w-full rounded-xl bg-white p-2.5 font-normal outline-none" /></label>
            <label className="block text-xs font-semibold">汤面<textarea value={customDraft.surface} onChange={event => setCustomDraft({ ...customDraft, surface: event.target.value.slice(0, 10000) })} rows={4} maxLength={10000} placeholder="给猜汤角色看的故事" className="mt-1 w-full resize-y rounded-xl bg-white p-2.5 font-normal leading-5 outline-none" /></label>
            <label className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#65858b]"><FileUp size={13} />单独导入汤面<input type="file" accept=".txt,.md,.markdown,text/plain" className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void uploadDraftField('surface', file); }} /></label>
            <label className="block text-xs font-semibold">汤底<textarea value={customDraft.truth} onChange={event => setCustomDraft({ ...customDraft, truth: event.target.value.slice(0, 20000) })} rows={5} maxLength={20000} placeholder="完整真相，只由你查看；不会发送给猜汤角色" className="mt-1 w-full resize-y rounded-xl bg-white p-2.5 font-normal leading-5 outline-none" /></label>
            <label className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#65858b]"><FileUp size={13} />单独导入汤底<input type="file" accept=".txt,.md,.markdown,text/plain" className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void uploadDraftField('truth', file); }} /></label>
            {editorMessage && <p role="status" className="text-xs text-amber-700">{editorMessage}</p>}
            <button type="button" onClick={saveCustom} className="w-full rounded-xl bg-[#78999e] py-2.5 text-xs font-bold text-white">保存到我的汤单</button>
            <button type="button" onClick={() => { setCustomDraft(null); setEditorMessage(''); }} className="w-full text-center text-xs text-slate-500">收起编辑</button>
          </div>}
          {!customDraft && editorMessage && <p role="status" className="mt-2 text-xs text-amber-700">{editorMessage}</p>}
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Sparkles size={16} />AI 出一碗新汤</h3>
          <div className="mt-3 flex gap-2"><select value={style} onChange={event => setStyle(event.target.value)} aria-label="故事风格" className="min-w-0 flex-1 rounded-xl bg-[#f1f5f4] px-3 py-2.5 text-xs">{['悬疑', '日常反转', '温情', '惊悚', '奇幻', '校园'].map(item => <option key={item}>{item}</option>)}</select><button type="button" disabled={generating} onClick={() => void generate()} className="rounded-xl bg-[#83a7a9] px-4 text-xs font-bold text-white disabled:opacity-50">{generating ? '生成中…' : '生成'}</button></div>
          <p className="mt-2 text-[11px] text-slate-500">生成后会加入本机汤单，仍由你选择何时开局。</p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
          <h3 className="text-sm font-bold">{selectedPuzzle.source === 'custom' ? '选择猜汤角色' : '选择主持人'}</h3>
          <select value={hostId} onChange={event => setHostId(event.target.value)} className="mt-3 w-full rounded-xl bg-[#f1f5f4] px-3 py-3 text-xs"><option value="">请选择角色或 NPC</option>{people.map(person => <option key={person.id} value={person.id}>{person.name} · {person.kind}</option>)}</select>
          {selectedPuzzle.source === 'custom' && <p className="mt-2 text-[11px] leading-5 text-slate-500">你负责回答“是／不是／无关”，角色会自己提问并尝试猜出汤底。</p>}
          {!people.length && <p className="mt-2 text-xs text-rose-600">请先在通讯录添加角色或 NPC。</p>}
          {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>}
          <button type="button" disabled={!people.some(person => person.id === hostId) || generating} onClick={start} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#78999e] py-3 text-sm font-bold text-white disabled:opacity-40">{selectedPuzzle.source === 'custom' ? '开始主持' : '开始猜汤'}<ChevronRight size={15} /></button>
        </div>
      </>}
      {session && <>
        <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-xs font-bold">{session.puzzle.title}</span><span className="rounded-full bg-[#ecf2f0] px-2.5 py-1 text-[10px]">{session.mode === 'host' ? `${userName}主持 · ${session.host.name}猜汤` : `${session.host.name}主持`}</span></div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{session.puzzle.surface}</p>
          <p className="mt-3 text-[11px] text-slate-500">{session.phase === 'asking' ? session.mode === 'host' ? '你掌握汤底，决定每轮回答。进度自动保存在本机。' : '尽管提问，没有回合限制。进度自动保存在本机。' : '汤底已揭晓。'}</p>
          {session.mode === 'host' && <details className="mt-3 rounded-xl bg-[#f4f0eb] p-3 text-xs"><summary className="cursor-pointer font-bold">主持人手卡 · 汤底</summary><p className="mt-2 whitespace-pre-wrap leading-5">{session.puzzle.truth}</p><p className="mt-2 text-[11px] text-slate-500">这份手卡仅显示在你的页面，不会发送给猜汤角色。</p></details>}
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
          <h3 className="text-sm font-bold">问答记录 · {session.turns.length}</h3>
          <div className="mt-3 max-h-[340px] space-y-3 overflow-y-auto">{session.turns.length ? session.turns.map(turn => <div key={turn.id} className="space-y-1.5 text-xs"><p className="rounded-2xl bg-[#e8eef3] p-3">{session.mode === 'host' ? session.host.name : userName}{turn.kind === 'guess' ? '的推理' : '问'}：{turn.question}</p><p className="rounded-2xl bg-[#f4ecef] p-3"><strong>{session.mode === 'host' ? userName : session.host.name} · {verdictLabel(turn.verdict)}</strong><span className="mt-1 block leading-5">{turn.answer}</span></p></div>) : <p className="rounded-xl bg-[#f6f7f7] p-3 text-xs text-slate-500">还没有问题。{session.mode === 'host' ? `请让${session.host.name}先来提问。` : '可以先从人物、地点和时间问起。'}</p>}</div>
          {session.phase === 'asking' && session.mode === 'host' && <>
            {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>}
            {session.solverPrompt ? <div className="mt-4 rounded-2xl bg-[#eff5f2] p-3">
              <p className="text-xs font-bold">{session.host.name}{session.solverPrompt.kind === 'guess' ? '猜测' : '提问'}：{session.solverPrompt.text}</p>
              {session.solverPrompt.kind === 'question' && <div className="mt-3 grid grid-cols-3 gap-2">{(['yes', 'no', 'irrelevant'] as const).map(verdict => <button type="button" key={verdict} onClick={() => setHostVerdict(verdict)} className={`rounded-xl py-2 text-xs font-bold ${hostVerdict === verdict ? 'bg-[#bedbd4]' : 'bg-white'}`}>{verdictLabel(verdict)}</button>)}</div>}
              <textarea value={hostNote} onChange={event => setHostNote(event.target.value)} rows={2} maxLength={500} placeholder={session.solverPrompt.kind === 'guess' ? '可选：告诉角色哪里还没猜对' : '可选：补充一句提示，但不要直接说出汤底'} className="mt-3 w-full resize-none rounded-xl bg-white p-2.5 text-xs leading-5 outline-none" />
              {session.solverPrompt.kind === 'question' ? <button type="button" onClick={() => answerSolver()} className="mt-2 w-full rounded-xl bg-[#78999e] py-2.5 text-xs font-bold text-white">发送回答</button>
                : <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => answerSolver(false)} className="rounded-xl bg-[#e9e6e9] py-2.5 text-xs font-bold">还没猜对</button><button type="button" onClick={() => answerSolver(true)} className="rounded-xl bg-[#78999e] py-2.5 text-xs font-bold text-white">猜对了</button></div>}
            </div> : <button type="button" disabled={busy} onClick={() => void askSolver()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#78999e] py-2.5 text-xs font-bold text-white disabled:opacity-40"><Send size={14} />{busy ? `${session.host.name}正在想…` : session.turns.length ? `让${session.host.name}继续提问` : `让${session.host.name}开始提问`}</button>}
            <p className="mt-2 text-[11px] text-slate-500">角色每提出一个问题或推理才调用一次 API；汤底只用于你的主持人手卡。</p>
          </>}
          {session.phase === 'asking' && session.mode !== 'host' && <>
            {session.pending && <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800">待回答：{session.pending.question}</p>}
            {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>}
            {!session.pending && <><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode('question')} className={`rounded-xl py-2 text-xs font-bold ${mode === 'question' ? 'bg-[#cce0de]' : 'bg-[#f3f5f5]'}`}>问一个问题</button><button type="button" onClick={() => setMode('guess')} className={`rounded-xl py-2 text-xs font-bold ${mode === 'guess' ? 'bg-[#e9dce3]' : 'bg-[#f3f5f5]'}`}>提交完整推理</button></div><textarea value={draft} onChange={event => setDraft(event.target.value)} rows={3} maxLength={500} placeholder={mode === 'question' ? '例：这件事和天气有关吗？' : '说出你认为的完整经过…'} className="mt-3 w-full resize-none rounded-xl bg-[#f5f6f6] p-3 text-xs leading-5 outline-none" /></>}
            <button type="button" disabled={busy || (!session.pending && !draft.trim())} onClick={() => void send()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#78999e] py-2.5 text-xs font-bold text-white disabled:opacity-40"><Send size={14} />{busy ? '主持人正在想…' : session.pending ? '重试这次回答' : mode === 'guess' ? '提交推理' : '发送问题'}</button>
            {session.pending && !busy && <button type="button" onClick={() => { setMode(session.pending!.kind); setDraft(session.pending!.question); setSession({ ...session, pending: null }); setError(''); }} className="mt-2 w-full text-center text-xs text-slate-500">修改问题</button>}
          </>}
        </div>
        {session.phase === 'asking' && <button type="button" disabled={busy} onClick={reveal} className="w-full rounded-xl border border-white/80 bg-white/70 py-2.5 text-xs font-semibold text-[#71848a] disabled:opacity-40">{session.mode === 'host' ? '结束主持并公布汤底' : '结束猜汤并揭晓汤底'}</button>}
        {session.phase === 'ended' && <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm"><h3 className="text-base font-black">{session.outcome === 'solved' ? session.mode === 'host' ? `${session.host.name}猜出真相` : '猜出真相' : '汤底揭晓'}</h3><p className="mt-3 whitespace-pre-wrap text-xs leading-6">{session.puzzle.truth}</p><details className="mt-4 rounded-xl bg-[#f2f5f4] p-3"><summary className="cursor-pointer text-xs font-bold">查看完整记录</summary><pre className="mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-5">{report}</pre></details><p className="mt-4 text-xs font-bold">分享给角色或 NPC</p><div className="mt-2 max-h-32 overflow-y-auto">{people.map(person => <label key={person.id} className="flex items-center gap-2 py-1.5 text-xs"><input type="checkbox" checked={session.selectedShare.includes(person.id)} onChange={event => setSession({ ...session, selectedShare: event.target.checked ? [...session.selectedShare, person.id] : session.selectedShare.filter(id => id !== person.id) })} />{person.name}</label>)}</div><button type="button" disabled={!availableRecipients.length || session.shared} onClick={() => { onShare({ id: session.id, title: `海龟汤 · ${session.puzzle.title}`, detail: report }, availableRecipients); setSession({ ...session, shared: true }); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#78999e] py-3 text-xs font-bold text-white disabled:opacity-40"><Share2 size={15} />{session.shared ? '已分享' : '分享完整记录'}</button></div>}
        <button type="button" onClick={restart} className="flex items-center gap-1.5 text-xs text-slate-500"><RotateCcw size={13} />再选一碗汤</button>
      </>}
    </div>
  </section>;
}
