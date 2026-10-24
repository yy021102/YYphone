import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Hourglass, LockKeyhole, Mail, PenLine, Plus, Send, Sparkles, X } from 'lucide-react';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { daysUntil, isTimeCapsuleList, shanghaiToday, TIME_CAPSULE_STORAGE_KEY, tomorrowInShanghai, type TimeCapsule } from '../utils/timeCapsule';

type Props = {
  userName: string;
  contacts: Array<{ id: string; name: string }>;
  onCharacterWrite: (characterId: string, unlockDate: string, topic: string) => Promise<string>;
};
type Shelf = 'sealed' | 'ready' | 'opened';
type Author = 'user' | 'character';

const moods = [
  { icon: '✦', label: '星夜', colors: 'from-[#254568] via-[#30426c] to-[#70627c]' },
  { icon: '☼', label: '日光', colors: 'from-[#926659] via-[#c19571] to-[#e0ba8a]' },
  { icon: '❀', label: '花信', colors: 'from-[#724e73] via-[#a67e9c] to-[#d8aabb]' },
  { icon: '☾', label: '月白', colors: 'from-[#425f74] via-[#76939c] to-[#a9bdba]' },
];

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}.${month}.${day}`;
}

function dateAfterDays(days: number): string {
  const [year, month, day] = shanghaiToday().split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function TimeCapsuleApp({ userName, contacts, onCharacterWrite }: Props) {
  const [capsules, setCapsules] = useState<TimeCapsule[]>(() => readStoredValue(TIME_CAPSULE_STORAGE_KEY, [] as TimeCapsule[], isTimeCapsuleList));
  const [today, setToday] = useState(shanghaiToday);
  const [shelf, setShelf] = useState<Shelf>('sealed');
  const [composing, setComposing] = useState(false);
  const [author, setAuthor] = useState<Author>('user');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState('');
  const [unlockDate, setUnlockDate] = useState(tomorrowInShanghai);
  const [mood, setMood] = useState('星夜');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(shanghaiToday()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const save = (next: TimeCapsule[]) => {
    setCapsules(next);
    writeStoredValue(TIME_CAPSULE_STORAGE_KEY, next);
  };
  const grouped = useMemo(() => ({
    sealed: capsules.filter(item => !item.openedAt && item.unlockDate > today),
    ready: capsules.filter(item => !item.openedAt && item.unlockDate <= today),
    opened: capsules.filter(item => Boolean(item.openedAt)),
  }), [capsules, today]);
  const nextCapsule = [...grouped.sealed].sort((a, b) => a.unlockDate.localeCompare(b.unlockDate))[0];
  const activeCapsule = capsules.find(item => item.id === viewing);
  const minDate = tomorrowInShanghai();

  const bury = async () => {
    if (busy) return;
    setError('');
    if (unlockDate < minDate) { setError('开启日期需要是明天或更晚。'); return; }
    if (author === 'user' && !body.trim()) { setError('先写下想留给未来的话。'); return; }
    if (author === 'character' && !selectedCharacter) { setError('先选一位角色。'); return; }
    setBusy(true);
    try {
      const character = contacts.find(item => item.id === selectedCharacter);
      const letter = author === 'user' ? body.trim() : await onCharacterWrite(selectedCharacter, unlockDate, topic.trim());
      if (!letter.trim()) throw new Error('角色暂时没写出这封信，请再试一次。');
      const capsule: TimeCapsule = {
        id: crypto.randomUUID(), authorId: author === 'user' ? 'user' : selectedCharacter,
        authorName: author === 'user' ? userName : character?.name ?? '一位角色',
        title: title.trim() || (author === 'user' ? '写给未来的我' : `来自${character?.name ?? 'TA'}的信`),
        body: letter.slice(0, 5000), unlockDate, createdAt: new Date().toISOString(), mood,
      };
      save([capsule, ...capsules]);
      setComposing(false);
      setShelf('sealed');
      setTitle(''); setBody(''); setTopic(''); setUnlockDate(tomorrowInShanghai());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '封存失败，请稍后重试。');
    } finally { setBusy(false); }
  };

  const openCapsule = (capsule: TimeCapsule) => {
    if (capsule.unlockDate > shanghaiToday()) return;
    if (!capsule.openedAt) save(capsules.map(item => item.id === capsule.id ? { ...item, openedAt: new Date().toISOString() } : item));
    setViewing(capsule.id);
  };

  const selectedMood = (value: string) => moods.find(item => item.label === value) ?? moods[0];

  return <div className="relative min-h-full overflow-hidden bg-[#101b30] text-[#f6f0e8]">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[510px] overflow-hidden bg-[radial-gradient(ellipse_at_48%_28%,#405574_0%,#1b2c48_37%,#101b30_77%)]">
      <div className="absolute left-[12%] top-14 h-1 w-1 rounded-full bg-white shadow-[80px_38px_0_0_#ffffff99,210px_18px_0_0_#ffffff66,276px_120px_0_0_#ffffffaa,44px_190px_0_0_#ffffff88,170px_220px_0_0_#ffffff77]" />
      <div className="absolute -right-24 top-20 h-72 w-72 rounded-full border border-[#edcf9a]/10" />
      <div className="absolute -right-12 top-32 h-48 w-48 rounded-full border border-[#edcf9a]/10" />
      <div className="absolute left-[-80px] top-64 h-64 w-64 rounded-full bg-[#598ca3]/10 blur-3xl" />
    </div>

    <div className="relative mx-auto max-w-[540px] px-5 pb-28 pt-8">
      <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.34em] text-[#e1c99e]">
        <span>THE TIME CAPSULE</span><span className="flex items-center gap-1 tracking-[0.08em]"><Sparkles size={12} /> 写给未来</span>
      </div>
      <div className="mt-10 text-center">
        <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full border border-[#e6c891]/25 bg-[#e8d09c]/[0.04] shadow-[0_0_70px_#c9a97622,inset_0_0_40px_#ddc28a11]">
          <div className="absolute inset-3 rounded-full border border-dashed border-[#e6c891]/20" />
          <div className="absolute inset-[-11px] rounded-full border border-[#e6c891]/10" />
          <Hourglass size={48} strokeWidth={1.2} className="text-[#ead2a7]" />
          <span className="absolute -right-1 top-5 text-xl text-[#eed8ab]">✧</span>
          <span className="absolute -bottom-1 left-6 text-xs text-[#eed8ab]">✦</span>
        </div>
        <p className="mt-7 font-serif text-[30px] tracking-[0.19em] text-[#fff7e9]">时间胶囊</p>
        <p className="mt-2 text-xs tracking-[0.18em] text-[#b9bdc8]">把此刻留给未来的某一天</p>
      </div>

      <div className="mt-9 rounded-[22px] border border-[#e6c891]/20 bg-[#f9f3e9]/[0.07] px-5 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between"><span className="text-[11px] tracking-[0.14em] text-[#d4c9b9]">下一封来信</span><span className="text-[#e6c891]">✦</span></div>
        {nextCapsule ? <div className="mt-3 flex items-end justify-between gap-3">
          <div><p className="max-w-[190px] truncate font-serif text-lg text-[#fff8eb]">{nextCapsule.title}</p><p className="mt-1 text-xs text-[#aeb9c8]">{nextCapsule.authorName} · {formatDate(nextCapsule.unlockDate)}</p></div>
          <div className="shrink-0 text-right"><span className="font-serif text-[31px] leading-none text-[#efd4a4]">{daysUntil(nextCapsule.unlockDate, today)}</span><span className="ml-1 text-[11px] text-[#efd4a4]">天后</span></div>
        </div> : <p className="mt-3 text-sm text-[#d7d1cb]">还没有封存的信。让未来收到一份惊喜吧。</p>}
      </div>

      <button type="button" onClick={() => { setComposing(true); setError(''); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e8c998] py-4 text-sm font-semibold tracking-[0.1em] text-[#29334a] shadow-[0_14px_34px_#0005] active:scale-[0.99]"><Plus size={18} /> 埋下一枚时间胶囊</button>

      <div className="mt-9 flex border-b border-[#e6c891]/20 text-xs">
        {([['sealed', '封存中'], ['ready', '待开启'], ['opened', '回忆录']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setShelf(key)} className={`flex-1 border-b-2 pb-3 transition-colors ${shelf === key ? 'border-[#e8c998] text-[#f8e1b8]' : 'border-transparent text-[#8490a2]'}`}>{label} <span className="ml-1 text-[10px]">{grouped[key].length}</span></button>)}
      </div>

      <div className="space-y-3 pt-5">
        {grouped[shelf].length === 0 && <div className="rounded-2xl border border-dashed border-[#e6c891]/20 px-5 py-11 text-center"><Mail className="mx-auto text-[#bda77f]" size={27} strokeWidth={1.3} /><p className="mt-3 text-sm text-[#d5d0cb]">{shelf === 'sealed' ? '这里还没有等待未来的信' : shelf === 'ready' ? '暂时没有到期的胶囊' : '打开过的信会珍藏在这里'}</p></div>}
        {[...grouped[shelf]].sort((a, b) => shelf === 'sealed' ? a.unlockDate.localeCompare(b.unlockDate) : b.unlockDate.localeCompare(a.unlockDate)).map(capsule => {
          const ready = capsule.unlockDate <= today;
          const palette = selectedMood(capsule.mood);
          return <button key={capsule.id} type="button" onClick={() => ready && openCapsule(capsule)} disabled={!ready} className={`group relative w-full overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br ${palette.colors} p-[1px] text-left shadow-[0_10px_25px_#0003] ${ready ? 'active:scale-[0.99]' : 'cursor-default'}`}>
            <div className="relative flex min-h-[120px] items-center gap-4 overflow-hidden rounded-[19px] bg-[#17253d]/80 p-4">
              <div className="absolute -right-8 -top-14 h-36 w-36 rounded-full border border-white/15" /><div className="absolute -right-2 -top-7 h-24 w-24 rounded-full border border-white/10" />
              <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-[5px] border border-[#f1dbb3]/40 bg-[#eee0c7] text-2xl text-[#766c70] shadow-[4px_5px_0_#192239]">{ready ? palette.icon : <LockKeyhole size={23} strokeWidth={1.4} />}</div>
              <div className="min-w-0 flex-1"><p className="text-[10px] tracking-[0.15em] text-[#efd6ab]">{capsule.authorId === 'user' ? '来自过去的你' : `来自 ${capsule.authorName}`} · {palette.label}</p><p className="mt-2 truncate font-serif text-base text-[#fff7e8]">{capsule.title}</p><p className="mt-2 text-[11px] text-[#b6c0cc]">{formatDate(capsule.unlockDate)} {ready ? capsule.openedAt ? '· 已珍藏' : '· 现在可以打开' : `· 还有 ${daysUntil(capsule.unlockDate, today)} 天`}</p></div>
              {ready && <ChevronRight size={17} className="shrink-0 text-[#e9d09f]" />}
            </div>
          </button>;
        })}
      </div>
      <p className="mt-8 text-center text-[10px] leading-5 text-[#738197]">以北京时间为准 · 到期后由你亲手开启<br />信件保存在当前设备中</p>
    </div>

    {composing && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#08101d]/80 backdrop-blur-sm sm:items-center" onClick={() => !busy && setComposing(false)}>
      <div role="dialog" aria-modal="true" aria-label="埋下时间胶囊" onClick={event => event.stopPropagation()} className="max-h-[91vh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] bg-[#f5eee2] px-6 pb-8 pt-5 text-[#303546] shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between"><span className="text-[10px] font-semibold tracking-[0.24em] text-[#aa8a60]">A LETTER TO THE FUTURE</span><button type="button" onClick={() => setComposing(false)} disabled={busy} className="rounded-full p-2 text-[#777d87]"><X size={20} /></button></div>
        <div className="mt-2 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d9c39d]/35 text-[#8f7046]"><PenLine size={22} /></div><div><h2 className="font-serif text-xl">写一封未来的来信</h2><p className="text-xs text-[#8f8e8c]">封存后，直到约定的日期才会揭晓</p></div></div>
        <div className="mt-6 flex rounded-xl bg-[#e9e0d1] p-1 text-sm">{([['user', '我来埋'], ['character', '请角色埋']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { setAuthor(value); setError(''); }} className={`flex-1 rounded-[9px] py-2.5 ${author === value ? 'bg-white font-semibold text-[#6e5a43] shadow-sm' : 'text-[#87847e]'}`}>{label}</button>)}</div>
        {author === 'character' && <div className="mt-5"><label className="text-xs font-semibold text-[#746b60]">选择写信的人</label><select value={selectedCharacter} onChange={event => setSelectedCharacter(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d7cab9] bg-white px-3 py-3 text-sm outline-none"><option value="">选择角色</option>{contacts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
        <div className="mt-5"><label className="text-xs font-semibold text-[#746b60]">信封上的标题 <span className="font-normal text-[#a59b8e]">· 选填</span></label><input value={title} onChange={event => setTitle(event.target.value)} maxLength={40} placeholder={author === 'user' ? '例如：给一年后的自己' : '例如：等春天到了再看'} className="mt-2 w-full rounded-xl border border-[#d7cab9] bg-white px-3 py-3 text-sm outline-none placeholder:text-[#aaa69f]" /></div>
        {author === 'user' ? <div className="mt-5"><label className="text-xs font-semibold text-[#746b60]">想留给未来的话</label><textarea value={body} onChange={event => setBody(event.target.value)} maxLength={5000} rows={5} placeholder="现在的你，想对未来说些什么？" className="mt-2 w-full resize-none rounded-xl border border-[#d7cab9] bg-white px-3 py-3 text-sm leading-6 outline-none placeholder:text-[#aaa69f]" /><p className="text-right text-[10px] text-[#aaa69f]">{body.length}/5000</p></div> : <div className="mt-5"><label className="text-xs font-semibold text-[#746b60]">给 TA 一点灵感 <span className="font-normal text-[#a59b8e]">· 选填</span></label><textarea value={topic} onChange={event => setTopic(event.target.value)} maxLength={300} rows={3} placeholder="例如：聊聊我们最近发生的事；也可以留空，让 TA 自由发挥" className="mt-2 w-full resize-none rounded-xl border border-[#d7cab9] bg-white px-3 py-3 text-sm leading-6 outline-none placeholder:text-[#aaa69f]" /><p className="mt-1 text-[11px] leading-5 text-[#9a9288]">角色会结合人设、记忆与聊天经历写信。正文封存前也不会展示。</p></div>}
        <div className="mt-5"><label className="flex items-center gap-1 text-xs font-semibold text-[#746b60]"><CalendarDays size={14} /> 约定开启日期</label><input type="date" min={minDate} value={unlockDate} onChange={event => setUnlockDate(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d7cab9] bg-white px-3 py-3 text-sm outline-none" /><div className="mt-2 flex gap-2">{([[7, '一周后'], [30, '一个月后'], [100, '百日后'], [365, '一年后']] as const).map(([days, label]) => <button key={days} type="button" onClick={() => setUnlockDate(dateAfterDays(days))} className={`flex-1 rounded-full border px-1 py-1.5 text-[10px] ${unlockDate === dateAfterDays(days) ? 'border-[#b79462] bg-[#f0e3ca] text-[#775c39]' : 'border-[#d7cab9] text-[#91877b]'}`}>{label}</button>)}</div><p className="mt-2 text-[11px] text-[#9a9288]">最早可选明天 · 以北京时间为准</p></div>
        <div className="mt-5"><label className="text-xs font-semibold text-[#746b60]">挑一枚封印</label><div className="mt-2 grid grid-cols-4 gap-2">{moods.map(item => <button key={item.label} type="button" onClick={() => setMood(item.label)} className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] ${mood === item.label ? 'border-[#b79462] bg-[#f0e3ca] text-[#775c39]' : 'border-[#ddd3c6] text-[#8e8981]'}`}><span className="text-lg">{item.icon}</span>{item.label}</button>)}</div></div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <button type="button" onClick={bury} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#273951] py-3.5 text-sm font-semibold text-[#f6e3c0] disabled:opacity-60"><Send size={16} /> {busy ? '正在写信并封存…' : '封存至未来'}</button>
      </div>
    </div>}

    {activeCapsule && activeCapsule.unlockDate <= today && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#07101c]/85 backdrop-blur-md sm:items-center" onClick={() => setViewing(null)}>
      <div role="dialog" aria-modal="true" aria-label={activeCapsule.title} onClick={event => event.stopPropagation()} className="relative max-h-[88vh] w-full max-w-[520px] overflow-y-auto rounded-t-[30px] bg-[#f7f0e2] px-7 pb-10 pt-7 text-[#3e3a3c] shadow-[0_0_70px_#e8cc9b33] sm:rounded-[30px]">
        <button type="button" onClick={() => setViewing(null)} className="absolute right-5 top-5 rounded-full p-2 text-[#928576]"><X size={20} /></button>
        <div className="text-center"><span className="text-3xl text-[#b89461]">{selectedMood(activeCapsule.mood).icon}</span><p className="mt-3 text-[10px] tracking-[0.24em] text-[#a78d69]">A LETTER THROUGH TIME</p><h2 className="mt-4 font-serif text-2xl leading-8">{activeCapsule.title}</h2><p className="mt-3 text-xs text-[#9a8f83]">{activeCapsule.authorName} · 封存于 {new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(activeCapsule.createdAt))}</p></div>
        <div className="my-7 flex items-center gap-3 text-[#c7ae87]"><div className="h-px flex-1 bg-[#d9c9ae]" /><Sparkles size={15} /><div className="h-px flex-1 bg-[#d9c9ae]" /></div>
        <p className="whitespace-pre-wrap break-words font-serif text-[15px] leading-8 text-[#544c48]">{activeCapsule.body}</p>
        <div className="mt-9 border-t border-[#dacbb6] pt-5 text-center text-[11px] tracking-[0.12em] text-[#ab987e]">{formatDate(activeCapsule.unlockDate)} · 如约而至</div>
      </div>
    </div>}
  </div>;
}
