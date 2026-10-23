import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronRight, Download, FileUp, Plus, RotateCcw, Search, Send, Share2, Sparkles } from 'lucide-react';
import { readStoredValue, readStorageString, writeStoredValue } from '../utils/localStorage';
import {
  BUILTIN_SCRIPT, importMysteryScript, isMysteryScript, isMysteryScriptList,
  mysteryScriptError, newMysteryDraft,
  type MysteryClue, type MysteryRole, type MysteryScript,
} from './scriptMysteryData';

export type MysteryPerson = { id: string; name: string; persona?: string; kind: '角色' | 'NPC' };
export type MysteryTurn = { id: string; actorId: string; question: string; answer: string };
type CastMember = MysteryPerson & { roleId: string };
export type MysteryReplyInput = {
  actor: MysteryPerson;
  role: MysteryRole;
  script: MysteryScript;
  act: 1 | 2;
  playerRoleTitle: string;
  participants: CastMember[];
  discoveredClues: MysteryClue[];
  transcript: MysteryTurn[];
  question: string;
};
type Phase = 'opening' | 'investigate' | 'accuse' | 'ended';
type Session = {
  id: string;
  script: MysteryScript;
  playerRoleId?: string;
  phase: Phase;
  act: 1 | 2;
  participants: CastMember[];
  discovered: string[];
  selectedEvidence: string[];
  transcript: MysteryTurn[];
  events: string[];
  pending: { actorId: string; question: string } | null;
  investigatorNotes: string;
  finalReason: string;
  accusedId: string;
  outcome: 'solved' | 'partial' | 'missed' | null;
  selectedShare: string[];
  shared: boolean;
};
type View = 'library' | 'editor' | 'play';
type Stored = {
  version: 2;
  view: View;
  selectedScriptId: string;
  playerRoleId?: string;
  chosen: string[];
  activeActorId: string;
  questionDraft: string;
  draft: MysteryScript | null;
  session: Session | null;
};
type Props = {
  people: MysteryPerson[];
  userName: string;
  onReply: (input: MysteryReplyInput) => Promise<string>;
  onGenerateScript: (genre: string, description: string, roleCount: number) => Promise<MysteryScript>;
  onShare: (result: { id: string; title: string; detail: string }, recipients: string[]) => void;
};

const LIBRARY_KEY = 'yyphone:script-mystery:library';
const SESSION_KEY = 'yyphone:script-mystery:v2';
const LEGACY_KEY = 'yyphone:script-mystery:v1';
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const personName = (session: Session, id: string) => session.participants.find(person => person.id === id)?.name ?? '角色';
const roleOf = (session: Session, member: CastMember) => session.script.roles.find(role => role.id === member.roleId);
const playerRoleOf = (session: Session) => session.script.roles.find(role => role.id === session.playerRoleId);
const playerTitle = (session: Session) => playerRoleOf(session)?.title || session.script.playerRoleTitle || '调查者';
const playerBrief = (session: Session) => playerRoleOf(session)?.privateBrief || session.script.playerBrief || '你需要通过线索与询问还原真相。';
const newItemId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const isSession = (value: unknown): value is Session => {
  if (!isRecord(value) || !isMysteryScript(value.script) || !Array.isArray(value.participants) || !Array.isArray(value.transcript)) return false;
  const storedScript = value.script;
  return typeof value.id === 'string' && ['opening', 'investigate', 'accuse', 'ended'].includes(value.phase as string) &&
    (value.act === 1 || value.act === 2) && (value.playerRoleId === undefined || typeof value.playerRoleId === 'string') &&
    (!value.playerRoleId || storedScript.roles.some(role => role.id === value.playerRoleId)) &&
    value.participants.length === storedScript.roles.length - (value.playerRoleId ? 1 : 0) &&
    value.participants.every((person, index) => isRecord(person) && typeof person.id === 'string' &&
      typeof person.name === 'string' && person.roleId === storedScript.roles.filter(role => role.id !== value.playerRoleId)[index].id) &&
    isStrings(value.discovered) && isStrings(value.selectedEvidence) && isStrings(value.events) &&
    value.transcript.every(turn => isRecord(turn) && typeof turn.id === 'string' && typeof turn.actorId === 'string' &&
      typeof turn.question === 'string' && typeof turn.answer === 'string') &&
    (value.pending === null || (isRecord(value.pending) && typeof value.pending.actorId === 'string' && typeof value.pending.question === 'string')) &&
    typeof value.investigatorNotes === 'string' && typeof value.finalReason === 'string' && typeof value.accusedId === 'string' &&
    (value.outcome === null || ['solved', 'partial', 'missed'].includes(value.outcome as string)) &&
    isStrings(value.selectedShare) && typeof value.shared === 'boolean';
};
const isStored = (value: unknown): value is Stored => isRecord(value) && value.version === 2 &&
  ['library', 'editor', 'play'].includes(value.view as string) && typeof value.selectedScriptId === 'string' &&
  (value.playerRoleId === undefined || typeof value.playerRoleId === 'string') &&
  isStrings(value.chosen) && typeof value.activeActorId === 'string' && typeof value.questionDraft === 'string' &&
  (value.draft === null || isMysteryScript(value.draft)) && (value.session === null || isSession(value.session));

const initialStored = (): Stored => ({
  version: 2, view: 'library', selectedScriptId: BUILTIN_SCRIPT.id,
  playerRoleId: '',
  chosen: [],
  activeActorId: '', questionDraft: '', draft: null, session: null,
});

const migrateLegacy = (people: MysteryPerson[]): Stored | null => {
  try {
    const source = readStorageString(LEGACY_KEY);
    const old: unknown = source ? JSON.parse(source) : null;
    if (!isRecord(old) || old.version !== 1) return null;
    const base = initialStored();
    const previous = old.session;
    if (!isRecord(previous) || !Array.isArray(previous.participants) || previous.participants.length !== BUILTIN_SCRIPT.roles.length) return base;
    const participants = previous.participants.map((person, index) => isRecord(person) &&
      typeof person.id === 'string' && typeof person.name === 'string'
      ? { id: person.id, name: person.name, persona: typeof person.persona === 'string' ? person.persona : '',
          kind: person.kind === 'NPC' ? 'NPC' as const : '角色' as const, roleId: BUILTIN_SCRIPT.roles[index].id }
      : null);
    if (participants.some(person => person === null)) return base;
    const cast = participants as CastMember[];
    const phase = previous.phase === 'accuse' || previous.phase === 'ended' ? previous.phase : 'investigate';
    const session: Session = {
      id: typeof previous.id === 'string' ? previous.id : newItemId('script-mystery'),
      script: BUILTIN_SCRIPT, phase, act: 2, participants: cast,
      discovered: isStrings(previous.discovered) ? previous.discovered : [],
      selectedEvidence: isStrings(previous.selectedEvidence) ? previous.selectedEvidence : [],
      transcript: Array.isArray(previous.transcript) ? previous.transcript.filter(turn =>
        isRecord(turn) && typeof turn.id === 'string' && typeof turn.actorId === 'string' &&
        typeof turn.question === 'string' && typeof turn.answer === 'string') as MysteryTurn[] : [],
      events: ['从旧版剧本杀恢复了进度。'],
      pending: isRecord(previous.pending) && typeof previous.pending.actorId === 'string' && typeof previous.pending.question === 'string'
        ? { actorId: previous.pending.actorId, question: previous.pending.question } : null,
      investigatorNotes: '', finalReason: typeof previous.note === 'string' ? previous.note : '',
      accusedId: typeof previous.accusedId === 'string' ? previous.accusedId : '',
      outcome: previous.outcome === 'solved' || previous.outcome === 'partial' || previous.outcome === 'missed' ? previous.outcome : null,
      selectedShare: isStrings(previous.selectedShare) ? previous.selectedShare : cast.map(person => person.id),
      shared: previous.shared === true,
    };
    return { ...base, view: 'play', chosen: cast.map(person => person.id),
      activeActorId: typeof old.activeActorId === 'string' ? old.activeActorId : cast[0].id,
      questionDraft: typeof old.questionDraft === 'string' ? old.questionDraft : '', session };
  } catch { return null; }
};

const resultLabel = (outcome: Session['outcome']) => outcome === 'solved' ? '完整还原真相'
  : outcome === 'partial' ? '找对了人，证据链尚不完整' : '本次推理未破案';
const report = (session: Session, userName: string) => {
  const { script } = session;
  const culprit = session.participants.find(person => person.roleId === script.culpritRoleId);
  const accused = session.participants.find(person => person.id === session.accusedId);
  return [
    `剧本杀 · ${script.title}`, `参与者：${userName}（${playerTitle(session)}）、${session.participants.map(person => `${person.name}（${roleOf(session, person)?.title || '角色'}）`).join('、')}`,
    `结果：${resultLabel(session.outcome)}`, `你的指认：${session.accusedId === 'user' ? userName : accused?.name ?? '未指认'}`,
    `你提交的证据：${session.selectedEvidence.map(id => script.clues.find(clue => clue.id === id)?.title).filter(Boolean).join('、') || '无'}`,
    `你的最终推理：${session.finalReason || '未填写'}`, `调查笔记：${session.investigatorNotes || '无'}`,
    '', '【第一幕 · 开场】', script.content, '【第二幕 · 深入】', script.actTwo,
    '', '【取得的线索】', ...session.discovered.map(id => {
      const clue = script.clues.find(item => item.id === id);
      return clue ? `第 ${clue.act} 幕 · ${clue.place} · ${clue.title}：${clue.detail}` : '';
    }).filter(Boolean),
    '', '【调查进程】', ...session.events,
    '', '【询问记录】', ...(session.transcript.length ? session.transcript.flatMap(turn => [
      `${userName} → ${personName(session, turn.actorId)}：${turn.question}`,
      `${personName(session, turn.actorId)}：${turn.answer}`,
    ]) : ['本局没有询问记录。']),
    '', '【结案真相】', `关键人物：${session.playerRoleId === script.culpritRoleId ? userName : culprit?.name ?? '未知'}。`, script.truth,
    '', '【角色专属剧本】', ...(playerRoleOf(session) ? [`${userName}（${playerTitle(session)}）：${playerBrief(session)}${playerRoleOf(session)?.goal ? `；目标：${playerRoleOf(session)?.goal}` : ''}`] : []), ...session.participants.map(person => {
      const role = roleOf(session, person);
      return `${person.name}（${role?.title || '角色'}）：${role?.privateBrief || '无'}${role?.goal ? `；目标：${role.goal}` : ''}`;
    }),
  ].join('\n');
};

function EditorField({ label, value, onChange, rows = 3, placeholder = '', maxLength = 20000 }: {
  label: string; value: string; onChange: (value: string) => void; rows?: number; placeholder?: string; maxLength?: number;
}) {
  return <label className="block text-xs font-semibold text-[#53616e]">{label}
    <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} maxLength={maxLength}
      placeholder={placeholder} className="mt-1 w-full resize-y rounded-xl border border-white/80 bg-white/85 p-3 font-normal leading-5 outline-none focus:border-[#a9bec4]" />
  </label>;
}

export function ScriptMysteryGame({ people, userName, onReply, onGenerateScript, onShare }: Props) {
  const [saved] = useState(() => {
    const restored = readStoredValue(SESSION_KEY, null as Stored | null, (value): value is Stored | null => value === null || isStored(value))
      ?? migrateLegacy(people) ?? initialStored();
    return restored.view === 'play' && !restored.session || restored.view === 'editor' && !restored.draft
      ? { ...restored, view: 'library' as const } : restored;
  });
  const [customScripts, setCustomScripts] = useState(() => readStoredValue(LIBRARY_KEY, [] as MysteryScript[], isMysteryScriptList));
  const [view, setView] = useState<View>(saved.view);
  const [selectedScriptId, setSelectedScriptId] = useState(saved.selectedScriptId);
  const [playerRoleId, setPlayerRoleId] = useState(saved.playerRoleId ?? '');
  const [chosen, setChosen] = useState(saved.playerRoleId ? saved.chosen : []);
  const [activeActorId, setActiveActorId] = useState(saved.activeActorId);
  const [questionDraft, setQuestionDraft] = useState(saved.questionDraft);
  const [draft, setDraft] = useState<MysteryScript | null>(saved.draft);
  const [session, setSession] = useState<Session | null>(saved.session);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editorMessage, setEditorMessage] = useState('');
  const [deletePendingId, setDeletePendingId] = useState('');
  const [genre, setGenre] = useState('悬疑推理');
  const [generationDescription, setGenerationDescription] = useState('');
  const [generationRoleCount, setGenerationRoleCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    writeStoredValue(SESSION_KEY, { version: 2, view, selectedScriptId, playerRoleId, chosen, activeActorId, questionDraft, draft, session } satisfies Stored);
  }, [view, selectedScriptId, playerRoleId, chosen, activeActorId, questionDraft, draft, session]);
  useEffect(() => () => { requestId.current++; }, []);
  const commit = (next: Session | null) => {
    setSession(next);
    const latest = readStoredValue(SESSION_KEY, saved, isStored);
    writeStoredValue(SESSION_KEY, { ...latest, session: next });
  };
  const scripts = [BUILTIN_SCRIPT, ...customScripts];
  const selectedScript = scripts.find(script => script.id === selectedScriptId) ?? BUILTIN_SCRIPT;
  const castChoices = selectedScript.roles.map((_, index) => chosen[index] ?? '');
  const castIds = selectedScript.roles.flatMap((role, index) => role.id === playerRoleId ? [] : [castChoices[index]]);
  const requiredCastCount = selectedScript.roles.length - 1;
  const ready = !!playerRoleId && castIds.length === requiredCastCount && castIds.every(Boolean) && new Set(castIds).size === castIds.length &&
    castIds.every(id => people.some(person => person.id === id));

  const selectScript = (script: MysteryScript) => {
    setSelectedScriptId(script.id);
    setPlayerRoleId('');
    setChosen([]);
  };
  const randomizeCast = () => {
    if (people.length < requiredCastCount) return;
    const shuffle = <T,>(items: T[]) => {
      const result = [...items];
      for (let index = result.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
      }
      return result;
    };
    const shuffledRoles = shuffle(selectedScript.roles);
    const shuffledPeople = shuffle(people);
    const userRoleId = shuffledRoles[0].id;
    let nextPerson = 0;
    setPlayerRoleId(userRoleId);
    setChosen(selectedScript.roles.map(role => role.id === userRoleId ? '' : shuffledPeople[nextPerson++]?.id ?? ''));
  };
  const openEditor = (script?: MysteryScript) => {
    const next = script ? { ...script, id: script.id === BUILTIN_SCRIPT.id ? newItemId('custom-script') : script.id,
      roles: script.roles.map(role => ({ ...role })), clues: script.clues.map(clue => ({ ...clue })) } : newMysteryDraft();
    setDraft(next); setEditorMessage(''); setView('editor');
  };
  const updateDraft = (change: Partial<MysteryScript>) => setDraft(previous => previous ? { ...previous, ...change } : previous);
  const updateRole = (id: string, change: Partial<MysteryRole>) => setDraft(previous => previous
    ? { ...previous, roles: previous.roles.map(role => role.id === id ? { ...role, ...change } : role) } : previous);
  const updateClue = (id: string, change: Partial<MysteryClue>) => setDraft(previous => previous
    ? { ...previous, clues: previous.clues.map(clue => clue.id === id ? { ...clue, ...change } : clue) } : previous);
  const saveDraft = () => {
    if (!draft) return;
    const problem = mysteryScriptError(draft);
    if (problem) { setEditorMessage(problem); return; }
    if (!customScripts.some(script => script.id === draft.id) && customScripts.length >= 20) {
      setEditorMessage('最多保存 20 个自定义剧本。'); return;
    }
    const next = [...customScripts.filter(script => script.id !== draft.id), draft];
    try { writeStoredValue(LIBRARY_KEY, next); }
    catch { setEditorMessage('保存失败：本地存储空间可能不足，请精简剧本内容后再试。'); return; }
    setCustomScripts(next); setSelectedScriptId(draft.id);
    setPlayerRoleId(''); setChosen([]);
    setEditorMessage(''); setDraft(null); setView('library');
  };
  const uploadFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(txt|md|markdown|json)$/i.test(file.name)) { setEditorMessage('请选择 .txt、.md 或 .json 剧本文件。'); return; }
    if (file.size > 150 * 1024) { setEditorMessage('文件超过 150 KB，请精简后再导入。'); return; }
    try {
      const text = await file.text();
      setDraft(importMysteryScript(text, file.name));
      setEditorMessage('已导入内容。请补全各角色专属剧本、两幕剧情、线索和真相后保存。');
      setView('editor');
    } catch { setEditorMessage('读取文件失败，请选择 UTF-8 文本或 JSON 文件。'); }
  };
  const uploadRoleFile = async (roleId: string, file?: File) => {
    if (!file) return;
    if (!/\.(txt|md|markdown)$/i.test(file.name)) { setEditorMessage('角色文稿请使用 .txt 或 .md 文件。'); return; }
    if (file.size > 60 * 1024) { setEditorMessage('单个角色文稿最多 60 KB。'); return; }
    try { updateRole(roleId, { privateBrief: await file.text() }); setEditorMessage('角色文稿已导入到专属剧本。'); }
    catch { setEditorMessage('角色文稿读取失败，请选择 UTF-8 文本文件。'); }
  };
  const exportScript = (script: MysteryScript) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(script, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${(script.title || '剧本杀模板').replace(/[\\/:*?"<>|]/g, '_')}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const generateScript = async () => {
    if (generating) return;
    setGenerating(true); setEditorMessage('');
    try {
      const generated = await onGenerateScript(genre, generationDescription.trim().slice(0, 1000), generationRoleCount);
      const problem = mysteryScriptError(generated);
      if (problem) throw new Error(`生成内容不完整：${problem}请重试。`);
      setDraft({ ...generated, id: newItemId('custom-script') });
      setView('editor');
      setEditorMessage('剧本已生成，请检查故事、角色秘密与线索，再保存到剧本库。');
    } catch (cause) { setEditorMessage(cause instanceof Error ? cause.message : '生成失败，请重试。'); }
    finally { setGenerating(false); }
  };
  const deleteScript = (id: string) => {
    const next = customScripts.filter(script => script.id !== id);
    writeStoredValue(LIBRARY_KEY, next);
    setCustomScripts(next);
    if (selectedScriptId === id) selectScript(BUILTIN_SCRIPT);
    setDeletePendingId('');
  };

  const begin = (script: MysteryScript, existingCast?: CastMember[]) => {
    const cast = existingCast ?? (ready && script.id === selectedScript.id
      ? script.roles.flatMap((role, index) => role.id === playerRoleId ? [] : [{ ...people.find(person => person.id === castChoices[index])!, roleId: role.id }]) : []);
    const sessionPlayerRoleId = existingCast ? session?.playerRoleId ?? '' : playerRoleId;
    if (!existingCast && !script.roles.some(role => role.id === sessionPlayerRoleId)) return;
    if (cast.length !== script.roles.length - (sessionPlayerRoleId ? 1 : 0)) return;
    requestId.current++; setBusy(false); setError(''); setQuestionDraft(''); setActiveActorId(cast[0]?.id ?? '');
    commit({
      id: newItemId('script-mystery'), script: structuredClone(script), playerRoleId: sessionPlayerRoleId, phase: 'opening', act: 1,
      participants: cast, discovered: [], selectedEvidence: [], transcript: [],
      events: [`进入剧本《${script.title}》。`], pending: null,
      investigatorNotes: '', finalReason: '', accusedId: '', outcome: null,
      selectedShare: cast.map(person => person.id), shared: false,
    });
    setView('play');
  };
  const restart = () => { if (session) begin(session.script, session.participants); };
  const reveal = (id: string) => {
    if (!session || session.phase !== 'investigate' || session.discovered.includes(id)) return;
    const clue = session.script.clues.find(item => item.id === id && item.act <= session.act);
    if (!clue) return;
    commit({ ...session, discovered: [...session.discovered, id],
      events: [...session.events, `第 ${session.act} 幕，在${clue.place || '现场'}发现「${clue.title}」。`] });
  };
  const ask = async () => {
    if (!session || session.phase !== 'investigate' || busy) return;
    const pending = session.pending ?? { actorId: activeActorId || session.participants[0].id, question: questionDraft.trim().slice(0, 500) };
    if (!pending.question) return;
    const actor = session.participants.find(person => person.id === pending.actorId);
    const role = actor && roleOf(session, actor);
    if (!actor || !role) return;
    const prepared = { ...session, pending };
    commit(prepared); setQuestionDraft(''); setBusy(true); setError('');
    const token = ++requestId.current;
    try {
      const answer = (await onReply({ actor, role, script: prepared.script, act: prepared.act, playerRoleTitle: playerTitle(prepared),
        participants: prepared.participants,
        discoveredClues: prepared.script.clues.filter(clue => prepared.discovered.includes(clue.id)),
        transcript: prepared.transcript, question: pending.question })).trim().slice(0, 1000);
      if (requestId.current !== token) return;
      if (!answer) throw new Error('角色没有返回有效回答。');
      commit({ ...prepared, pending: null,
        transcript: [...prepared.transcript, { id: crypto.randomUUID(), actorId: actor.id, question: pending.question, answer }],
        events: [...prepared.events, `询问 ${actor.name}：${pending.question} / ${answer}`] });
    } catch (cause) {
      if (requestId.current === token) setError(cause instanceof Error ? cause.message : '请求失败，请重试。');
    } finally {
      if (requestId.current === token) setBusy(false);
    }
  };
  const submit = () => {
    if (!session || session.phase !== 'accuse' || !session.accusedId || !session.finalReason.trim()) return;
    const correct = (session.accusedId === 'user' ? session.playerRoleId : session.participants.find(person => person.id === session.accusedId)?.roleId) === session.script.culpritRoleId;
    const keyTotal = session.script.clues.filter(clue => clue.key).length;
    const keySelected = session.selectedEvidence.filter(id => session.script.clues.find(clue => clue.id === id)?.key).length;
    const outcome = correct ? keySelected >= Math.min(2, keyTotal) ? 'solved' : 'partial' : 'missed';
    commit({ ...session, phase: 'ended', outcome, events: [...session.events, `指认 ${personName(session, session.accusedId)}；结案结果：${resultLabel(outcome)}。`] });
  };

  const activeActor = session?.participants.find(person => person.id === (session.pending?.actorId || activeActorId)) ?? session?.participants[0];
  const visibleTurns = session?.transcript.filter(turn => turn.actorId === activeActor?.id) ?? [];
  const discoveredClues = session?.script.clues.filter(clue => session.discovered.includes(clue.id)) ?? [];
  const currentClues = session?.script.clues.filter(clue => clue.act === session.act) ?? [];
  const currentActFound = currentClues.filter(clue => session?.discovered.includes(clue.id)).length;
  const culprit = session?.participants.find(person => person.roleId === session.script.culpritRoleId);
  const availableRecipients = session?.selectedShare.filter(id => people.some(person => person.id === id)) ?? [];

  return <section className="min-h-full bg-gradient-to-b from-[#e7edf1] via-[#f4eff3] to-[#f8f5ee] px-4 py-5 text-[#435160]">
    <div className="mx-auto max-w-[480px] space-y-4 pb-7">
      <header className="rounded-3xl border border-white/70 bg-gradient-to-br from-[#cadde1]/85 via-[#e4d8e5]/90 to-[#f2e9df]/90 p-5 shadow-sm backdrop-blur-xl">
        <p className="text-[10px] font-bold tracking-[.16em] text-[#677b86]">微信游戏 · 剧本杀</p>
        <h2 className="mt-2 flex items-center gap-2 text-2xl font-black"><BookOpen size={22} />{view === 'play' && session ? session.script.title : '剧本杀'}</h2>
        <p className="mt-2 text-xs leading-5">{view === 'play' && session ? session.script.subtitle : '挑选剧本，写下角色秘密，沿着线索走到真相。'}</p>
      </header>

      {view === 'library' && <>
        {session && <button type="button" onClick={() => setView('play')} className="flex w-full items-center justify-between rounded-2xl border border-[#d3e0e0] bg-white/85 p-4 text-left shadow-sm">
          <span><strong className="block text-sm">继续《{session.script.title}》</strong><span className="mt-1 block text-[11px] text-slate-500">{session.phase === 'ended' ? '查看结案记录' : session.phase === 'opening' ? '开场' : session.phase === 'accuse' ? '最终指认' : `第 ${session.act} 幕调查`} · 进度已保存</span></span><ChevronRight size={16} />
        </button>}
        <div className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-sm">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold">我的剧本库</h3><span className="text-[11px] text-slate-500">内置 1 部 · 自定义 {customScripts.length} 部</span></div>
          <div className="mt-3 space-y-2">{scripts.map(script => <div key={script.id} className={`rounded-2xl border p-3 ${script.id === selectedScript.id ? 'border-[#a9c5ca] bg-[#edf4f3]' : 'border-white bg-[#f8f8f7]'}`}>
            <button type="button" onClick={() => selectScript(script)} className="w-full text-left"><strong className="text-sm">{script.title}</strong><p className="mt-1 text-xs text-slate-500">{script.subtitle || script.content.slice(0, 54)}</p><span className="mt-2 block text-[10px] text-slate-500">{script.roles.length} 人 · {script.clues.length} 条线索 · {script.id === BUILTIN_SCRIPT.id ? '内置' : '自定义'}</span></button>
            <div className="mt-2 flex gap-3 text-[11px] text-[#66808a]"><button type="button" onClick={() => openEditor(script)}>{script.id === BUILTIN_SCRIPT.id ? '复制并编辑' : '编辑'}</button><button type="button" onClick={() => exportScript(script)}>导出 JSON</button>{script.id !== BUILTIN_SCRIPT.id && <button type="button" onClick={() => deletePendingId === script.id ? deleteScript(script.id) : setDeletePendingId(script.id)} className="text-rose-600">{deletePendingId === script.id ? '再次点击删除' : '删除'}</button>}</div>
          </div>)}</div>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-sm">
          <h3 className="text-sm font-bold">上传或创作剧本</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">支持 UTF-8 的 .txt、.md 和 .json（最大 150 KB）。文本会填入公开剧情；JSON 可同时导入角色专属剧本和线索。导入后可继续编辑。</p>
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#a7bec4] bg-white/65 py-3 text-xs font-bold"><FileUp size={16} />从本地上传
            <input type="file" accept=".txt,.md,.markdown,.json,text/plain,application/json" className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void uploadFile(file); }} />
          </label>
          <button type="button" onClick={() => openEditor()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7892a1] py-3 text-xs font-bold text-white"><Plus size={15} />手动创建剧本</button>
          {draft && <button type="button" onClick={() => setView('editor')} className="mt-2 w-full text-center text-[11px] font-semibold text-[#68818c]">继续编辑草稿《{draft.title || '未命名'}》</button>}
          <button type="button" onClick={() => exportScript(BUILTIN_SCRIPT)} className="mt-2 w-full text-center text-[11px] font-semibold text-[#68818c]">下载示例 JSON</button>
          {editorMessage && <p role="status" className="mt-2 text-xs text-rose-700">{editorMessage}</p>}
        </div>
        <div className="rounded-3xl border border-white/80 bg-gradient-to-br from-[#edf3f2]/90 via-[#f5eef3]/90 to-[#f8f4e9]/90 p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Sparkles size={16} />AI 生成剧本</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">生成两幕剧情、角色专属剧本、线索和真相。生成后可继续编辑，确认后再保存。</p>
          <label className="mt-3 block text-xs font-semibold">故事类型<select value={genre} onChange={event => setGenre(event.target.value)} className="mt-1 w-full rounded-xl bg-white/90 p-2.5 font-normal">
            {['悬疑推理', '古风权谋', '现代都市', '校园青春', '科幻未来', '奇幻冒险', '恐怖惊悚', '温情治愈', '轻喜剧'].map(option => <option key={option} value={option}>{option}</option>)}
          </select></label>
          <label className="mt-3 block text-xs font-semibold">剧本角色人数（包含玩家）<select value={generationRoleCount} onChange={event => setGenerationRoleCount(Number(event.target.value))} className="mt-1 w-full rounded-xl bg-white/90 p-2.5 font-normal">{[2, 3, 4, 5, 6].map(count => <option key={count} value={count}>{count} 人</option>)}</select></label>
          <EditorField label="大概描述（选填）" value={generationDescription} onChange={value => setGenerationDescription(value.slice(0, 1000))} rows={3} maxLength={1000} placeholder="例如：暴风雪封山的温泉旅馆，所有人都隐瞒了同一晚的行踪……" />
          <button type="button" disabled={generating} onClick={() => void generateScript()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#8499a5] py-3 text-xs font-bold text-white disabled:opacity-50"><Sparkles size={15} />{generating ? '正在构思剧本…' : '生成剧本草稿'}</button>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-sm">
          <h3 className="text-sm font-bold">开局分配角色 · {selectedScript.title}</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">剧本只规定身份和秘密。现在决定谁扮演哪个身份；也可以随机分配后再调整。</p>
          <button type="button" disabled={people.length < requiredCastCount} onClick={randomizeCast} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e2eced] py-2.5 text-xs font-bold text-[#607c86] disabled:opacity-40"><RotateCcw size={14} />随机分配身份</button>
          <label className="mt-3 block text-xs font-semibold">我扮演<select value={playerRoleId} onChange={event => {
            const nextRoleId = event.target.value;
            setPlayerRoleId(nextRoleId);
            setChosen(previous => {
              const next = [...previous];
              const previousUserIndex = selectedScript.roles.findIndex(role => role.id === playerRoleId);
              const nextUserIndex = selectedScript.roles.findIndex(role => role.id === nextRoleId);
              if (previousUserIndex >= 0 && nextUserIndex >= 0) next[previousUserIndex] = next[nextUserIndex] ?? '';
              if (nextUserIndex >= 0) next[nextUserIndex] = '';
              return next;
            });
          }} className="mt-1 w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal"><option value="">请选择剧本身份</option>{selectedScript.roles.map(role => <option key={role.id} value={role.id}>{role.title}</option>)}</select></label>
          <p className="mt-2 rounded-xl bg-[#edf2f1] p-3 text-xs leading-5 text-slate-600">{playerRoleId ? selectedScript.roles.find(role => role.id === playerRoleId)?.publicStatement || '开局后解锁这名角色的专属剧本。' : '选择身份后，在开局时查看对应的专属剧本。'}</p>
          <div className="mt-3 space-y-2">{selectedScript.roles.map((role, index) => role.id === playerRoleId ? <div key={role.id} className="rounded-xl bg-[#e8f0ee] px-3 py-2.5 text-xs font-semibold">{role.title} · 由你扮演</div> : <label key={role.id} className="block text-xs font-semibold">{role.title}
            <select value={castChoices[index]} onChange={event => setChosen(previous => selectedScript.roles.map((_, position) => position === index ? event.target.value : previous[position] ?? ''))}
              className="mt-1 w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal"><option value="">选择角色或 NPC</option>{people.map(person => <option key={person.id} value={person.id}>{person.name} · {person.kind}</option>)}</select>
          </label>)}</div>
          {people.length < requiredCastCount && <p className="mt-2 text-xs text-rose-600">该剧本需要 {requiredCastCount} 位不同的角色或 NPC，请先添加。</p>}
          {!ready && people.length >= requiredCastCount && <p className="mt-2 text-[11px] text-slate-500">请选择自己的剧本身份，并给其他身份分配不同的角色或 NPC。</p>}
          <button type="button" disabled={!ready} onClick={() => begin(selectedScript)} className="mt-4 w-full rounded-xl bg-[#7892a1] py-3 text-sm font-bold text-white disabled:opacity-40">开始《{selectedScript.title}》</button>
        </div>
      </>}

      {view === 'editor' && draft && <div className="space-y-4 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold">编辑自定义剧本</h3><button type="button" onClick={() => setView('library')} className="text-xs text-slate-500">返回剧本库</button></div>
        <p className="text-[11px] leading-5 text-slate-500">公开剧情会给所有角色；专属剧本只会给对应角色，结案后才显示在完整记录中。草稿会自动保存在本机，已开始的局会保留开局时的剧本版本。内容越长，角色回答的用量和等待时间也会增加。</p>
        <label className="block text-xs font-semibold">剧本名<input value={draft.title} onChange={event => updateDraft({ title: event.target.value.slice(0, 80) })} maxLength={80} placeholder="例：雨夜车站的第七封信" className="mt-1 w-full rounded-xl bg-white p-3 font-normal outline-none" /></label>
        <label className="block text-xs font-semibold">一句话简介<input value={draft.subtitle} onChange={event => updateDraft({ subtitle: event.target.value.slice(0, 180) })} maxLength={180} className="mt-1 w-full rounded-xl bg-white p-3 font-normal outline-none" /></label>
        <EditorField label="第一幕 · 开场与公开剧情" value={draft.content} onChange={content => updateDraft({ content })} rows={6} maxLength={150000} placeholder="交代地点、事件、时间线和公开规则。" />
        <EditorField label="第二幕 · 深入剧情" value={draft.actTwo} onChange={actTwo => updateDraft({ actTwo })} rows={4} placeholder="推进事件，补充新的公开信息；第二幕线索将在此时开放。" />
        <p className="rounded-2xl bg-[#f0f4f3] p-3 text-[11px] leading-5 text-slate-600">创建时只写剧本身份。玩家与角色或 NPC 的扮演关系在每次开局前选择，也可随机分配。</p>
        <div><div className="flex items-center justify-between"><h4 className="text-sm font-bold">角色专属剧本</h4><span className="text-[11px] text-slate-500">{draft.roles.length}/6</span></div>
          <div className="mt-2 space-y-2">{draft.roles.map((role, index) => <details key={role.id} className="rounded-2xl bg-[#f1f4f4] p-3">
            <summary className="cursor-pointer text-xs font-bold">角色 {index + 1} · {role.title || '未命名'}</summary>
            <div className="mt-3 space-y-3"><label className="block text-xs font-semibold">角色称谓<input value={role.title} onChange={event => updateRole(role.id, { title: event.target.value.slice(0, 60) })} maxLength={60} placeholder="例：车站管理员" className="mt-1 w-full rounded-xl bg-white p-2.5 font-normal" /></label>
              <EditorField label="公开自我介绍" value={role.publicStatement} onChange={publicStatement => updateRole(role.id, { publicStatement })} rows={2} placeholder="其他玩家开场就能看到。" />
              <EditorField label="专属剧本与秘密" value={role.privateBrief} onChange={privateBrief => updateRole(role.id, { privateBrief })} rows={5} maxLength={60000} placeholder="角色知道的时间线、关系、隐瞒的事，以及不能与线索冲突的事实。" />
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[#68818c]"><FileUp size={13} />为这个角色导入 .txt / .md 文稿<input type="file" accept=".txt,.md,.markdown,text/plain" className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void uploadRoleFile(role.id, file); }} /></label>
              <EditorField label="角色目标（可选）" value={role.goal} onChange={goal => updateRole(role.id, { goal })} rows={2} />
              {draft.roles.length > 2 && <button type="button" onClick={() => updateDraft({ roles: draft.roles.filter(item => item.id !== role.id), culpritRoleId: draft.culpritRoleId === role.id ? '' : draft.culpritRoleId })} className="text-xs text-rose-600">移除这个角色</button>}
            </div>
          </details>)}</div>
          {draft.roles.length < 6 && <button type="button" onClick={() => updateDraft({ roles: [...draft.roles, { id: newItemId('role'), title: '', publicStatement: '', privateBrief: '', goal: '' }] })} className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#68818c]"><Plus size={14} />增加角色</button>}
        </div>
        <label className="block text-xs font-semibold">真相对应的角色<select value={draft.culpritRoleId} onChange={event => updateDraft({ culpritRoleId: event.target.value })} className="mt-1 w-full rounded-xl bg-white p-3 font-normal"><option value="">请选择</option>{draft.roles.map(role => <option key={role.id} value={role.id}>{role.title || '未命名角色'}</option>)}</select></label>
        <div><div className="flex items-center justify-between"><h4 className="text-sm font-bold">分幕线索</h4><span className="text-[11px] text-slate-500">{draft.clues.length} 条</span></div>
          <p className="mt-1 text-[11px] text-slate-500">两幕都要有线索；至少标记一条用于判断结案的关键证据。</p>
          <div className="mt-2 space-y-2">{draft.clues.map((clue, index) => <details key={clue.id} className="rounded-2xl bg-[#f5f1f3] p-3">
            <summary className="cursor-pointer text-xs font-bold">第 {clue.act} 幕 · {clue.title || `线索 ${index + 1}`}</summary>
            <div className="mt-3 space-y-3"><div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold">出现幕次<select value={clue.act} onChange={event => updateClue(clue.id, { act: Number(event.target.value) as 1 | 2 })} className="mt-1 w-full rounded-xl bg-white p-2.5 font-normal"><option value={1}>第一幕</option><option value={2}>第二幕</option></select></label><label className="text-xs font-semibold">地点<input value={clue.place} onChange={event => updateClue(clue.id, { place: event.target.value.slice(0, 60) })} maxLength={60} className="mt-1 w-full rounded-xl bg-white p-2.5 font-normal" /></label></div>
              <label className="block text-xs font-semibold">线索名<input value={clue.title} onChange={event => updateClue(clue.id, { title: event.target.value.slice(0, 80) })} maxLength={80} className="mt-1 w-full rounded-xl bg-white p-2.5 font-normal" /></label>
              <EditorField label="未发现时的提示" value={clue.teaser} onChange={teaser => updateClue(clue.id, { teaser })} rows={2} />
              <EditorField label="发现后的完整内容" value={clue.detail} onChange={detail => updateClue(clue.id, { detail })} rows={3} />
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={clue.key} onChange={event => updateClue(clue.id, { key: event.target.checked })} />关键证据</label>
              {draft.clues.length > 2 && <button type="button" onClick={() => updateDraft({ clues: draft.clues.filter(item => item.id !== clue.id) })} className="text-xs text-rose-600">移除这条线索</button>}
            </div>
          </details>)}</div>
          {draft.clues.length < 30 && <button type="button" onClick={() => updateDraft({ clues: [...draft.clues, { id: newItemId('clue'), act: 2, place: '', title: '', teaser: '', detail: '', key: false }] })} className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#68818c]"><Plus size={14} />增加线索</button>}
        </div>
        <EditorField label="结案真相" value={draft.truth} onChange={truth => updateDraft({ truth })} rows={5} placeholder="写明真实经过、关键人物与线索如何串起来；结案前不会给角色的 API。" />
        {editorMessage && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{editorMessage}</p>}
        <button type="button" onClick={() => exportScript(draft)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e8efef] py-2.5 text-xs font-bold text-[#607b86]"><Download size={15} />导出当前草稿 JSON</button>
        <button type="button" onClick={saveDraft} className="w-full rounded-xl bg-[#7892a1] py-3 text-sm font-bold text-white">保存到我的剧本库</button>
      </div>}

      {view === 'play' && session && <>
        <div className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm">
          <div className="flex items-center justify-between"><strong className="text-xs">{session.phase === 'opening' ? '序幕 · 入场' : session.phase === 'investigate' ? `第 ${session.act} 幕 · 调查` : session.phase === 'accuse' ? '终幕 · 指认' : '结案 · 真相'}</strong><span className="text-[11px] text-slate-500">线索 {session.discovered.length}/{session.script.clues.length}</span></div>
          <p className="mt-2 text-[11px] text-slate-500">进度自动保存。返回剧本库后，可以继续本局。</p>
          <details className="mt-2 rounded-xl bg-white/75 p-2.5 text-xs"><summary className="cursor-pointer font-semibold">我的角色剧本 · {playerTitle(session)}</summary><p className="mt-2 whitespace-pre-wrap leading-5">{playerBrief(session)}</p></details>
          <div className="mt-2 flex gap-4 text-xs font-semibold text-[#718699]"><button type="button" onClick={() => setView('library')}>返回剧本库</button><button type="button" onClick={restart} className="flex items-center gap-1"><RotateCcw size={13} />重开本局</button></div>
        </div>
        {session.phase === 'opening' && <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
          <h3 className="text-base font-black">第一幕 · 开场</h3><p className="mt-3 whitespace-pre-wrap text-xs leading-6">{session.script.content}</p>
          <div className="mt-4 rounded-2xl bg-[#eaf0ee] p-3"><strong className="text-xs">你的身份 · {playerTitle(session)}</strong><p className="mt-1 whitespace-pre-wrap text-xs leading-5">{playerBrief(session)}</p></div>
          <h4 className="mt-4 text-xs font-bold">在场角色</h4><div className="mt-2 space-y-2">{session.participants.map(person => <div key={person.id} className="rounded-xl bg-[#f2f4f4] p-3 text-xs"><strong>{person.name} · {roleOf(session, person)?.title}</strong><p className="mt-1 leading-5">{roleOf(session, person)?.publicStatement || '暂时没有公开发言。'}</p></div>)}</div>
          <button type="button" onClick={() => commit({ ...session, phase: 'investigate', events: [...session.events, '进入第一幕调查。'] })} className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-[#7892a1] py-3 text-sm font-bold text-white">开始调查<ChevronRight size={16} /></button>
        </div>}

        {session.phase === 'investigate' && <>
          <div className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-sm"><h3 className="text-sm font-bold">第 {session.act} 幕 · {session.act === 1 ? '初查现场' : '重构时间线'}</h3><p className="mt-2 whitespace-pre-wrap text-xs leading-6">{session.act === 1 ? session.script.content : session.script.actTwo}</p></div>
          <div className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold"><Search size={16} />勘查线索</h3><p className="mt-1 text-[11px] text-slate-500">本幕 {currentActFound}/{currentClues.length} 条已发现。点击地点查看详细内容。</p>
            <div className="mt-3 grid grid-cols-2 gap-2">{currentClues.map(clue => {
              const found = session.discovered.includes(clue.id);
              return <button type="button" key={clue.id} onClick={() => reveal(clue.id)} className={`rounded-2xl border p-3 text-left text-xs ${found ? 'border-[#c8d9dc] bg-[#edf4f3]' : 'border-white bg-[#f6f3f3]'}`}><span className="text-[10px] text-slate-500">{clue.place || '现场'}</span><strong className="mt-1 block">{clue.title}</strong><span className="mt-1 block text-[10px] text-slate-500">{found ? '已取得' : clue.teaser || '点击调查'}</span></button>;
            })}</div>
            {discoveredClues.length > 0 && <details className="mt-3 rounded-xl bg-white/85 p-3"><summary className="cursor-pointer text-xs font-bold">线索册 · 已取得 {discoveredClues.length} 条</summary><div className="mt-2 space-y-2">{discoveredClues.map(clue => <p key={clue.id} className="rounded-lg bg-[#f2f5f4] p-2.5 text-xs leading-5"><strong>{clue.title}：</strong>{clue.detail}</p>)}</div></details>}
          </div>
          <div className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-sm">
            <h3 className="text-sm font-bold">询问在场角色</h3><p className="mt-1 text-[11px] text-slate-500">每次向选中的角色单独发起一次 API 请求；对方会读取自己的专属剧本、人设和记忆。</p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{session.participants.map(person => <button type="button" key={person.id} disabled={!!session.pending || busy} onClick={() => setActiveActorId(person.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs disabled:opacity-50 ${activeActor?.id === person.id ? 'bg-[#a9bec4] text-white' : 'bg-[#eef2f2]'}`}>{person.name}</button>)}</div>
            <p className="mt-2 text-[11px] text-slate-500">{activeActor?.name} · {activeActor && roleOf(session, activeActor)?.title}</p>
            {activeActor && <p className="mt-2 rounded-xl bg-[#f3f5f3] p-2.5 text-xs leading-5">{roleOf(session, activeActor)?.publicStatement || '这位角色还没有公开陈述。'}</p>}
            <div className="mt-2 max-h-60 space-y-2 overflow-y-auto">{visibleTurns.length ? visibleTurns.map(turn => <div key={turn.id} className="space-y-1 text-xs"><p className="rounded-xl bg-[#e8edf4] p-2.5">你：{turn.question}</p><p className="rounded-xl bg-[#f2edf0] p-2.5">{activeActor?.name}：{turn.answer}</p></div>) : <p className="rounded-xl bg-[#f6f4f4] p-3 text-xs text-slate-500">还没有询问记录。可以追问时间线、线索与人物关系。</p>}</div>
            {session.pending && <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs">待回答：{personName(session, session.pending.actorId)} · {session.pending.question}</p>}
            {error && <p role="alert" className="mt-2 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>}
            {!session.pending && <textarea value={questionDraft} onChange={event => setQuestionDraft(event.target.value)} rows={2} maxLength={500} placeholder="输入你要问这位角色的问题…" className="mt-3 w-full rounded-xl bg-slate-100 p-3 text-xs outline-none" />}
            <button type="button" disabled={busy || (!session.pending && !questionDraft.trim())} onClick={() => void ask()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7892a1] py-2.5 text-xs font-bold text-white disabled:opacity-40"><Send size={14} />{busy ? '角色正在回答…' : session.pending ? '重试这次询问' : '发送询问'}</button>
            {session.pending && !busy && <button type="button" onClick={() => { setQuestionDraft(session.pending?.question ?? ''); commit({ ...session, pending: null }); setError(''); }} className="mt-2 w-full text-center text-xs text-slate-500">修改问题</button>}
          </div>
          <div className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-sm"><h3 className="text-sm font-bold">调查笔记</h3><textarea value={session.investigatorNotes} onChange={event => commit({ ...session, investigatorNotes: event.target.value.slice(0, 5000) })} rows={3} placeholder="把人物关系、时间线和怀疑记在这里；结案卡片会保留。" className="mt-2 w-full rounded-xl bg-slate-100 p-3 text-xs outline-none" /></div>
          {session.act === 1 ? <button type="button" disabled={currentActFound < 1 || busy || !!session.pending} onClick={() => commit({ ...session, act: 2, events: [...session.events, '进入第二幕，重新梳理时间线。'] })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8494a8] py-3 text-sm font-bold text-white disabled:opacity-40">进入第二幕<ChevronRight size={16} /></button>
            : <button type="button" disabled={session.discovered.length < Math.min(2, session.script.clues.length) || busy || !!session.pending} onClick={() => commit({ ...session, phase: 'accuse', events: [...session.events, '进入最终指认。'] })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8494a8] py-3 text-sm font-bold text-white disabled:opacity-40">进入最终推理<ChevronRight size={16} /></button>}
          {session.act === 1 && currentActFound < 1 && <p className="text-center text-[11px] text-slate-500">先取得至少一条本幕线索。</p>}
        </>}

        {session.phase === 'accuse' && <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
          <h3 className="text-sm font-bold">最终指认</h3><p className="mt-1 text-[11px] text-slate-500">根据证据选择关键人物，并挑选最多两条证据构成证据链。结案后才揭晓私密剧本。</p>
          <div className="mt-3 space-y-2">{session.participants.map(person => <label key={person.id} className={`flex items-center gap-2 rounded-xl p-3 text-xs ${session.accusedId === person.id ? 'bg-[#e2eceb]' : 'bg-slate-50'}`}><input type="radio" name="mystery-accused" checked={session.accusedId === person.id} onChange={() => commit({ ...session, accusedId: person.id })} />{person.name} · {roleOf(session, person)?.title}</label>)}</div>
          {session.playerRoleId && <label className={`mt-2 flex items-center gap-2 rounded-xl p-3 text-xs ${session.accusedId === 'user' ? 'bg-[#e2eceb]' : 'bg-slate-50'}`}><input type="radio" name="mystery-accused" checked={session.accusedId === 'user'} onChange={() => commit({ ...session, accusedId: 'user' })} />{userName} · {playerTitle(session)}（我）</label>}
          <p className="mt-4 text-xs font-semibold">提交证据（最多 2 条）</p><div className="mt-2 space-y-2">{discoveredClues.map(clue => <label key={clue.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 text-xs"><input type="checkbox" checked={session.selectedEvidence.includes(clue.id)} disabled={!session.selectedEvidence.includes(clue.id) && session.selectedEvidence.length >= 2} onChange={event => commit({ ...session, selectedEvidence: event.target.checked ? [...session.selectedEvidence, clue.id] : session.selectedEvidence.filter(id => id !== clue.id) })} /><span>{clue.title}<span className="mt-1 block text-[11px] text-slate-500">{clue.detail}</span></span></label>)}</div>
          <textarea value={session.finalReason} onChange={event => commit({ ...session, finalReason: event.target.value.slice(0, 2000) })} rows={4} placeholder="写下你的最终推理…" className="mt-4 w-full rounded-xl bg-slate-100 p-3 text-xs outline-none" />
          <div className="mt-3 flex gap-2"><button type="button" onClick={() => commit({ ...session, phase: 'investigate' })} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold">返回调查</button><button type="button" disabled={!session.accusedId || !session.finalReason.trim()} onClick={submit} className="flex-1 rounded-xl bg-[#7892a1] py-2.5 text-xs font-bold text-white disabled:opacity-40">提交结案</button></div>
        </div>}

        {session.phase === 'ended' && <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm">
          <h3 className="text-lg font-black">{resultLabel(session.outcome)}</h3><p className="mt-2 text-xs leading-5">关键人物是 {session.playerRoleId === session.script.culpritRoleId ? userName : culprit?.name || '未知'}。{session.script.truth}</p>
          <details className="mt-3 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-bold">查看完整记录与角色专属剧本</summary><pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-5">{report(session, userName)}</pre></details>
          <p className="mt-4 text-xs font-bold">分享结案卡片给角色</p><div className="mt-2 max-h-32 overflow-y-auto">{people.map(person => <label key={person.id} className="flex items-center gap-2 py-1.5 text-xs"><input type="checkbox" checked={session.selectedShare.includes(person.id)} onChange={event => commit({ ...session, selectedShare: event.target.checked ? [...session.selectedShare, person.id] : session.selectedShare.filter(id => id !== person.id) })} />{person.name}</label>)}</div>
          <button type="button" disabled={!availableRecipients.length || session.shared} onClick={() => { onShare({ id: session.id, title: `剧本杀 · ${session.script.title}`, detail: report(session, userName) }, availableRecipients); commit({ ...session, shared: true }); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7892a1] py-3 text-sm font-bold text-white disabled:opacity-40"><Share2 size={15} />{session.shared ? '已分享到聊天' : '分享结案卡片'}</button>
        </div>}
      </>}
    </div>
  </section>;
}
