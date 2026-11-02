import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, Bird, Check, ChevronRight, CircleDot, Coins, Crown, Eye, Flower2, Heart,
  History, Infinity, KeyRound, Lamp, Loader2, Moon, Orbit, RefreshCw, Scale, Send,
  Shield, Skull, Sparkles, Star, Sun, Sword, TowerControl, Trash2, WandSparkles, Wine,
} from 'lucide-react';
import {
  TAROT_SPREADS, createTarotRecord, loadTarotRecords, makeTarotDraw, patchTarotRecord,
  recoverTarotInterpretations, saveTarotRecords, shuffleTarotDeck, subscribeTarot, tarotCard,
  tarotSpread, type TarotDrawnCard, type TarotInterpretInput, type TarotReader, type TarotRecord,
  type TarotSpreadId, type TarotSuit,
} from '../utils/tarot';
import './divination.css';
import type { AstrologyRecord, CharacterBirthInput, NatalInterpretInput } from '../utils/astrology';
import type { QimenInterpretInput, QimenRecord } from '../utils/qimen';

const AstrologyApp = lazy(() => import('./AstrologyApp'));
const QimenApp = lazy(() => import('./QimenApp'));

type Person = { id: string; name: string; avatarUrl?: string };
type Props = {
  userName: string;
  people: Person[];
  onInterpret: (input: TarotInterpretInput | NatalInterpretInput | CharacterBirthInput | QimenInterpretInput) => Promise<string>;
  onShare: (record: TarotRecord | AstrologyRecord | QimenRecord, recipients: string[]) => void | Promise<void>;
};
type Draft = { spreadId: TarotSpreadId; question: string; includeReversed: boolean; deck: string[]; picked: number[]; draws: TarotDrawnCard[]; recordId?: string };
type View = 'lobby' | 'setup' | 'draw' | 'result' | 'history' | 'astrology' | 'qimen';
const motifs = [Bird, WandSparkles, Eye, Flower2, Crown, KeyRound, Heart, Shield, Infinity, Lamp, Orbit, Scale, CircleDot, Skull, Wine, KeyRound, TowerControl, Star, Moon, Sun, Sparkles, Orbit];
const suitIcons = { wands: WandSparkles, cups: Wine, swords: Sword, pentacles: Coins };
const tones: Record<TarotSuit, string> = { major: '#d8be83', wands: '#d7a479', cups: '#94bcb9', swords: '#b5add0', pentacles: '#a9bf99' };
const stamp = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

function CelestialSeal() {
  return (
    <svg className="tarot-seal" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <circle cx="100" cy="100" r="84" stroke="currentColor" strokeOpacity=".22" />
      <circle cx="100" cy="100" r="72" stroke="currentColor" strokeOpacity=".4" strokeDasharray="1 9" />
      <circle cx="100" cy="100" r="59" stroke="currentColor" strokeOpacity=".25" />
      <path d="M100 19L158 142H42L100 19ZM100 181L42 58H158L100 181Z" stroke="currentColor" strokeOpacity=".22" />
      <path d="M119 66C108 70 101 81 104 93C107 106 121 111 133 105C128 123 105 133 88 122C69 110 68 82 85 68C95 60 108 59 119 66Z" fill="currentColor" fillOpacity=".7" />
      <path d="M132 75L134 80L140 82L134 84L132 89L130 84L125 82L130 80Z" fill="currentColor" />
      <circle cx="100" cy="16" r="3" fill="currentColor" /><circle cx="100" cy="184" r="3" fill="currentColor" />
    </svg>
  );
}

function StellarEntryArt() {
  return <svg className="divination-entry-art" viewBox="0 0 170 200" fill="none" aria-hidden="true">
    <circle cx="92" cy="96" r="67" stroke="currentColor" strokeOpacity=".22" />
    <circle cx="92" cy="96" r="55" stroke="currentColor" strokeOpacity=".42" />
    <circle cx="92" cy="96" r="39" stroke="currentColor" strokeOpacity=".18" strokeDasharray="1 6" />
    <ellipse cx="92" cy="96" rx="31" ry="81" transform="rotate(42 92 96)" stroke="currentColor" strokeOpacity=".3" />
    <ellipse cx="92" cy="96" rx="76" ry="23" transform="rotate(-25 92 96)" stroke="currentColor" strokeOpacity=".24" />
    {Array.from({ length: 12 }, (_, i) => <path key={i} d="M92 32V39" transform={`rotate(${i * 30} 92 96)`} stroke="currentColor" strokeOpacity=".65" />)}
    <path d="M92 68L98 89L119 96L98 102L92 123L86 102L65 96L86 89Z" stroke="currentColor" fill="currentColor" fillOpacity=".08" />
    <path d="M92 79V112M76 96H108" stroke="currentColor" strokeOpacity=".45" />
    <circle cx="145" cy="57" r="4" fill="currentColor" /><circle cx="41" cy="137" r="2.5" fill="currentColor" />
    <path d="M25 35H35M30 30V40M136 163H146M141 158V168" stroke="currentColor" strokeOpacity=".7" />
    <g fill="currentColor"><circle cx="53" cy="17" r="1" /><circle cx="159" cy="119" r="1" /><circle cx="67" cy="178" r="1.5" /><circle cx="18" cy="88" r="1" /></g>
  </svg>;
}
function InkEntryArt() {
  return <svg className="divination-entry-art" viewBox="0 0 170 200" fill="none" aria-hidden="true">
    <circle cx="95" cy="74" r="38" stroke="currentColor" strokeOpacity=".16" />
    <circle cx="95" cy="74" r="29" stroke="currentColor" strokeOpacity=".3" strokeDasharray="1 4" />
    <path d="M79 58H111V90H79ZM90 58V90M101 58V90M79 69H111M79 80H111" stroke="currentColor" strokeOpacity=".4" />
    <path d="M7 155L42 117L59 134L88 91L109 118L134 83L170 123V200H7Z" fill="currentColor" fillOpacity=".09" />
    <path d="M0 173L36 145L63 156L99 122L126 149L153 125L170 142V200H0Z" fill="currentColor" fillOpacity=".14" />
    <path d="M12 176C45 169 68 182 93 174C120 166 144 168 169 174M32 188C57 182 82 192 115 185" stroke="currentColor" strokeOpacity=".22" />
    <path d="M22 96Q43 84 60 92M119 110Q143 99 160 105" stroke="currentColor" strokeOpacity=".25" />
    <path d="M137 35V57H153V35ZM142 40H148M142 46H148M145 39V52" stroke="#a45746" strokeOpacity=".6" />
    <path d="M31 59Q36 54 41 59Q46 54 51 59" stroke="currentColor" strokeOpacity=".5" />
  </svg>;
}

function CardBack() {
  return <div className="tarot-card-back" aria-hidden="true">
    <svg className="tarot-back-engraving" viewBox="0 0 140 210" fill="none">
      <rect x="5" y="5" width="130" height="200" rx="8" stroke="currentColor" strokeOpacity=".7" />
      <rect x="10" y="10" width="120" height="190" rx="5" stroke="currentColor" strokeOpacity=".24" />
      <path d="M17 47V17H47M93 17H123V47M17 163V193H47M93 193H123V163" stroke="currentColor" strokeOpacity=".7" />
      <path d="M70 25L75 35L70 45L65 35ZM70 165L75 175L70 185L65 175Z" stroke="currentColor" strokeOpacity=".65" />
      <path d="M26 30L28 36L34 38L28 40L26 46L24 40L18 38L24 36ZM114 164L116 170L122 172L116 174L114 180L112 174L106 172L112 170Z" fill="currentColor" fillOpacity=".65" />
      <path d="M106 37H120M113 30V44M20 173H34M27 166V180" stroke="currentColor" strokeOpacity=".6" />
      <ellipse cx="70" cy="105" rx="37" ry="69" transform="rotate(32 70 105)" stroke="currentColor" strokeOpacity=".16" />
      <ellipse cx="70" cy="105" rx="37" ry="69" transform="rotate(-32 70 105)" stroke="currentColor" strokeOpacity=".16" />
      <circle cx="70" cy="105" r="52" stroke="currentColor" strokeOpacity=".45" />
      <circle cx="70" cy="105" r="44" stroke="currentColor" strokeOpacity=".25" />
      <circle cx="70" cy="105" r="32" stroke="currentColor" strokeOpacity=".4" />
      {Array.from({ length: 48 }, (_, index) => <path key={index} d={`M70 55V${index % 6 === 0 ? 62 : 58}`}
        transform={`rotate(${index * 7.5} 70 105)`} stroke="currentColor" strokeOpacity={index % 6 === 0 ? '.85' : '.4'} />)}
      {Array.from({ length: 8 }, (_, index) => <g key={index} transform={`rotate(${index * 45} 70 105)`}>
        <path d={`M70 ${index % 2 === 0 ? 65 : 77}L77 105L70 113L63 105Z`} stroke="currentColor" strokeWidth=".6" fill="currentColor" fillOpacity=".08" />
        <path d={`M70 ${index % 2 === 0 ? 65 : 77}V113L63 105Z`} fill="currentColor" fillOpacity={index % 2 === 0 ? '.7' : '.35'} />
      </g>)}
      <circle cx="70" cy="105" r="8" fill="#24202f" stroke="currentColor" />
      <path d="M70 99L72 103L76 105L72 107L70 111L68 107L64 105L68 103Z" fill="currentColor" />
      <path d="M40 56L42 61L47 63L42 65L40 70L38 65L33 63L38 61ZM100 140L102 145L107 147L102 149L100 154L98 149L93 147L98 145Z" fill="currentColor" fillOpacity=".75" />
      <g fill="currentColor" fillOpacity=".55"><circle cx="27" cy="76" r="1" /><circle cx="113" cy="134" r="1" /><circle cx="101" cy="51" r="1.5" /><circle cx="39" cy="159" r="1.5" /><circle cx="70" cy="20" r="1" /><circle cx="70" cy="190" r="1" /></g>
    </svg>
  </div>;
}

function CardFace({ draw }: { draw: TarotDrawnCard }) {
  const card = tarotCard(draw.cardId);
  const Icon = card.suit === 'major' ? motifs[card.rank] : suitIcons[card.suit];
  const style: CSSProperties & { '--tarot-tone': string } = { '--tarot-tone': tones[card.suit] };
  const pips = card.suit === 'major' ? 7 : Math.min(card.rank, 10);
  return (
    <div className="tarot-card-face" style={style} data-reversed={draw.reversed}>
      <span className="tarot-card-number">{card.suit === 'major' ? String(card.rank).padStart(2, '0') : card.rank > 10 ? ['P', 'N', 'Q', 'K'][card.rank - 11] : card.rank}</span>
      <div className="tarot-card-art" aria-hidden="true">
        <svg viewBox="0 0 100 125" fill="none">
          <path d="M10 106V39C10 2 90 2 90 39V106" stroke="currentColor" strokeOpacity=".35" />
          <ellipse cx="50" cy="62" rx="30" ry="40" stroke="currentColor" strokeOpacity=".2" />
          <path d="M20 106H80M28 112H72M50 8V19" stroke="currentColor" strokeOpacity=".55" />
          {Array.from({ length: pips }, (_, i) => {
            const angle = (i / pips) * Math.PI * 2 - Math.PI / 2;
            return <circle key={i} cx={50 + Math.cos(angle) * 35} cy={62 + Math.sin(angle) * 44} r="1.6" fill="currentColor" />;
          })}
        </svg>
        <Icon size={36} strokeWidth={1.1} />
        {card.rank > 10 && card.suit !== 'major' && <Crown className="tarot-court-mark" size={15} strokeWidth={1.2} />}
      </div>
      <strong>{card.name}</strong>
      <small>{card.english}</small>
    </div>
  );
}

function TarotDeckRibbon({ draft, onPick }: { draft: Draft; onPick: (index: number) => void }) {
  const ribbonRef = useRef<HTMLDivElement>(null);
  const browse = (direction: number) => {
    const ribbon = ribbonRef.current;
    ribbon?.scrollBy({ left: direction * ribbon.clientWidth * .8,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <section className="tarot-deck" aria-label="完整塔罗牌带">
    <div className="tarot-deck-heading"><span>THE CELESTIAL DECK</span><span>{draft.deck.length} 张 · 完整牌组</span></div>
    <div className="tarot-deck-ribbon" ref={ribbonRef}>
      <div className="tarot-deck-fan">{draft.deck.map((id, index) => {
        const selected = draft.picked.includes(index);
        const style: CSSProperties & { '--fan-angle': string; '--fan-lift': string } = {
          '--fan-angle': `${(index % 9 - 4) * 1.2}deg`, '--fan-lift': `${Math.abs(index % 9 - 4) * 2}px`,
        };
        return <button type="button" key={id} style={style} disabled={!!draft.recordId || selected}
          aria-label={`第 ${index + 1} 张牌${selected ? '，已选取' : '，点击抽取'}`} aria-pressed={selected}
          onClick={() => onPick(index)} className={`tarot-ribbon-card${selected ? ' is-picked' : ''}`}>
          <CardBack /><span className="tarot-ribbon-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          {selected && <span className="tarot-ribbon-check" aria-hidden="true"><Check size={18} /></span>}
        </button>;
      })}</div>
    </div>
    <div className="tarot-deck-navigation"><button type="button" aria-label="向前浏览牌组" onClick={() => browse(-1)}><ArrowLeft size={17} /></button>
      <p>左右滑动，让直觉停在某一张</p><button type="button" aria-label="向后浏览牌组" onClick={() => browse(1)}><ArrowRight size={17} /></button></div>
  </section>;
}

function Topbar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return <div className="tarot-topbar"><button type="button" onClick={onBack} aria-label="返回占卜上一级"><ArrowLeft size={15} /></button><h2>{title}</h2>{right ?? <span className="tarot-topbar-spacer" />}</div>;
}

export function DivinationApp({ userName, people, onInterpret, onShare }: Props) {
  const [view, setView] = useState<View>('lobby');
  const [records, setRecords] = useState(loadTarotRecords);
  const [spreadId, setSpreadId] = useState<TarotSpreadId>('daily');
  const [question, setQuestion] = useState('');
  const [includeReversed, setIncludeReversed] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const [recordId, setRecordId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestRef = useRef<{ controller: AbortController; recordId: string; attemptId: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cancelRequest = () => {
    const request = requestRef.current;
    if (!request) return;
    requestRef.current = null;
    request.controller.abort();
    const record = loadTarotRecords().find(item => item.id === request.recordId);
    if (record) patchTarotRecord(record.id, current => ({ ...current, interpretations: current.interpretations.map(attempt => attempt.id === request.attemptId
      ? { ...attempt, status: 'error', error: '解读已取消。再次请求需要调用 1 次 AI。' } : attempt) }));
    else console.warn('The tarot record was removed before its interpretation could be cancelled.');
  };
  useEffect(() => {
    const unsubscribe = subscribeTarot(() => setRecords(loadTarotRecords()));
    const stored = loadTarotRecords();
    if (stored.some(record => record.interpretations.some(attempt => attempt.status === 'pending'))) saveTarotRecords(recoverTarotInterpretations(stored));
    return () => { unsubscribe(); cancelRequest(); };
  }, []);
  useEffect(() => {
    let element = rootRef.current?.parentElement ?? null;
    while (element && !/(auto|scroll)/.test(getComputedStyle(element).overflowY)) element = element.parentElement;
    element?.scrollTo({ top: 0 });
  }, [view, recordId]);
  const go = (next: View) => { cancelRequest(); setBusy(false); setError(''); setView(next); };
  const begin = () => {
    try {
      const next: Draft = { spreadId, question, includeReversed, deck: shuffleTarotDeck().map(card => card.id), picked: [], draws: [] };
      draftRef.current = next; setDraft(next); go('draw');
    } catch (caught) { setError(caught instanceof Error ? caught.message : '洗牌失败，请重新尝试。'); }
  };
  const pick = (index: number) => {
    const current = draftRef.current;
    if (!current || current.recordId || current.picked.includes(index)) return;
    const spread = tarotSpread(current.spreadId);
    if (current.draws.length >= spread.positions.length) return;
    try {
      const next = { ...current, picked: [...current.picked, index], draws: [...current.draws,
        makeTarotDraw(current.deck[index], spread.positions[current.draws.length], current.includeReversed)] };
      if (next.draws.length === spread.positions.length) {
        const record = createTarotRecord({ ...next, cards: next.draws, userName });
        saveTarotRecords([record, ...loadTarotRecords()]);
        next.recordId = record.id;
      }
      draftRef.current = next; setDraft(next); setError('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : '抽牌未能保存，请重新铺牌。'); }
  };
  const interpret = async (record: TarotRecord, reader: TarotReader) => {
    if (requestRef.current) return;
    const request = { controller: new AbortController(), recordId: record.id, attemptId: `reading-${crypto.randomUUID()}` };
    requestRef.current = request; setBusy(true); setError('');
    try {
      patchTarotRecord(record.id, current => ({ ...current, interpretations: [...current.interpretations,
        { id: request.attemptId, reader, status: 'pending', text: '', createdAt: new Date().toISOString() }] }));
      const text = (await onInterpret({ record, reader, signal: request.controller.signal })).trim();
      if (request.controller.signal.aborted) return;
      if (!text || text.length > 12000) throw new Error('AI 解读为空或过长，请重新请求。');
      patchTarotRecord(record.id, current => ({ ...current, interpretations: current.interpretations.map(attempt => attempt.id === request.attemptId
        ? { ...attempt, status: 'done', text } : attempt) }));
    } catch (caught) {
      if (!request.controller.signal.aborted) {
        const message = (caught instanceof Error ? caught.message : 'AI 解读失败，请手动重试。').slice(0, 1000);
        if (loadTarotRecords().some(item => item.id === record.id)) patchTarotRecord(record.id, current => ({ ...current,
          interpretations: current.interpretations.map(attempt => attempt.id === request.attemptId ? { ...attempt, status: 'error', error: message } : attempt) }));
        setError(message);
      }
    } finally { if (requestRef.current === request) { requestRef.current = null; setBusy(false); } }
  };
  const record = records.find(item => item.id === recordId);
  const alert = error && <p role="alert" className="tarot-error">{error}</p>;
  const footer = <p className="tarot-disclaimer">给心事一点新的视角，不替未来下结论。<br />仅供娱乐与自我探索，不替代现实沟通或专业建议。</p>;

  if (view === 'astrology') return <Suspense fallback={<div className="tarot-root"><p className="tarot-disclaimer">正在展开星图…</p></div>}>
    <AstrologyApp userName={userName} people={people} onBack={() => go('lobby')} onInterpret={onInterpret} onShare={onShare} />
  </Suspense>;
  if (view === 'qimen') return <Suspense fallback={<div className="tarot-root"><p className="tarot-disclaimer">正在展开山河手卷…</p></div>}>
    <QimenApp people={people} onBack={() => go('lobby')} onInterpret={onInterpret} onShare={onShare} />
  </Suspense>;

  return (
    <div className="tarot-root" ref={rootRef}>
      {view === 'lobby' && <>
        <div className="tarot-lobby-top"><span>NOCTURNE</span></div>
        <header className="tarot-lobby-hero"><p className="tarot-eyebrow">A QUIET MOMENT FOR YOURSELF</p><h2>把心事，<br />交给一点<span>星光。</span></h2><p>不必先懂规则，<br />从一张牌、一个小问题开始。</p><CelestialSeal /></header>
        <div className="tarot-content">
          <button type="button" className="tarot-lobby-card" onClick={() => go('setup')}>
            <div><span className="tarot-eyebrow">THE ART OF REFLECTION</span><h3>Arcana</h3><p>塔罗 · 在牌面之间，<br />听见自己</p><span className="tarot-entry-action">开始一段小仪式<ArrowRight size={14} /></span></div>
            <div className="tarot-lobby-deck"><CardBack /><CardBack /><CardBack /></div>
          </button>
          <button type="button" className="tarot-lobby-card tarot-stellar-entry" onClick={() => go('astrology')}>
            <div><span className="tarot-eyebrow">A LETTER FROM YOUR SKY</span><h3>Stellar</h3><p>星座 · 星空来信<br />在交错的星轨里，读懂彼此</p><span className="tarot-entry-action">展开属于你的星图<ArrowRight size={14} /></span></div><StellarEntryArt />
          </button>
          <button type="button" className="tarot-lobby-card tarot-qimen-entry" onClick={() => go('qimen')}>
            <div><span className="tarot-eyebrow">THE ART OF TIMING</span><h3>山河秘仪</h3><p>奇门遁甲 · 九宫问时<br />借一局清风，安放心事</p><span className="tarot-entry-action">为此刻，起一局<ArrowRight size={14} /></span></div><InkEntryArt />
          </button>
          {footer}
        </div>
      </>}
      {view === 'setup' && <>
        <Topbar title="Arcana · 塔罗" onBack={() => go('lobby')} right={<button type="button" onClick={() => go('history')} aria-label="查看塔罗手记"><History size={15} /></button>} />
        <div className="tarot-content">
          <header className="tarot-intro"><p className="tarot-eyebrow">BEFORE THE CARDS TURN</p><h3>此刻，你想聊什么？</h3><p>牌阵只是「抽几张、每张用来聊什么」。<br />挑一个适合你的入口就好。</p></header>
          <div className="tarot-spread-options">{TAROT_SPREADS.map(spread => (
            <button type="button" key={spread.id} onClick={() => setSpreadId(spread.id)} aria-pressed={spreadId === spread.id} className="tarot-spread-option">
              <span className="tarot-spread-symbol">{spread.id === 'daily' ? <Sun size={21} /> : spread.id === 'focus' ? <Star size={21} /> : spread.id === 'insight' ? <Eye size={21} /> : <Heart size={21} />}</span>
              <span><strong>{spread.name}</strong><small>{spread.description}</small></span><i>{spread.positions.length} 张</i>{spreadId === spread.id && <Check size={14} />}
            </button>
          ))}</div>
          <form onSubmit={event => { event.preventDefault(); begin(); }} className="tarot-panel">
            <label className="tarot-label">想问的事 <span>选填</span><textarea aria-label="想问的事" rows={3} maxLength={300} value={question} onChange={event => setQuestion(event.target.value)} placeholder={tarotSpread(spreadId).question} className="tarot-field" /></label>
            <p className="tarot-help">留空就围绕这个入口的默认问题抽牌。尽量问「我可以怎样做」，而不是要求牌替你决定。</p>
            <label className="tarot-toggle"><input type="checkbox" checked={includeReversed} onChange={event => setIncludeReversed(event.target.checked)} /><span>启用正逆位<small>逆位只是另一个视角，不等于坏事。</small></span></label>
            {alert}<button type="submit" className="tarot-primary"><RefreshCw size={15} />洗匀牌，开始抽牌</button>
            <p className="tarot-cost">完整 78 张牌 · 本地抽取 · 不调用 AI</p>
          </form>
          {footer}
        </div>
      </>}
      {view === 'draw' && draft && <>
        <Topbar title="凭直觉，挑一张" onBack={() => go('setup')} />
        <div className="tarot-content">
          <header className="tarot-intro"><p className="tarot-eyebrow">LET THE CARDS SPEAK SOFTLY</p><h3>{draft.recordId ? '这一组牌，为你展开了。' : tarotSpread(draft.spreadId).positions[draft.draws.length]}</h3><p>完整 {draft.deck.length} 张牌已洗匀，静候你的选择。<br />{draft.recordId ? '抽牌结果已保存，可以慢慢读。' : '滑动星罗牌带，轻触一张与你此刻有缘的牌。'}</p></header>
          <TarotDeckRibbon draft={draft} onPick={pick} />
          <p className="tarot-draw-selected" role="status">已选 {draft.draws.length} / {tarotSpread(draft.spreadId).positions.length} 张{!draft.recordId && ` · 下一张：${tarotSpread(draft.spreadId).positions[draft.draws.length]}`}</p>
          <div className={`tarot-result-cards tarot-draw-slots${tarotSpread(draft.spreadId).positions.length === 1 ? ' is-single' : tarotSpread(draft.spreadId).positions.length === 5 ? ' is-five' : ''}`}>
            {tarotSpread(draft.spreadId).positions.map((position, index) => {
              const draw = draft.draws[index];
              return <div key={position}><span className="tarot-position">{position}</span>{draw
                ? <div className="tarot-slot-reveal"><CardFace draw={draw} /></div>
                : <div className="tarot-slot-empty"><Star size={22} strokeWidth={1} /><span>{String(index + 1).padStart(2, '0')}</span></div>}
                <span className="tarot-orientation">{draw ? draw.reversed ? '逆位 · 另一个视角' : '正位' : '等待翻开'}</span></div>;
            })}
          </div>
          {alert}
          <button type="button" className="tarot-primary" disabled={!draft.recordId} onClick={() => { if (draft.recordId) { setRecordId(draft.recordId); go('result'); } }}><Sparkles size={15} />展开这次牌阵</button>
          <p className="tarot-cost">抽满后自动收藏；尚未完成的铺牌不会记入手记。</p>
        </div>
      </>}
      {view === 'result' && record && <TarotResult key={record.id} record={record} people={people} busy={busy} error={error}
        onBack={() => go('history')} onAgain={() => go('setup')} onInterpret={reader => { void interpret(record, reader); }} onShare={onShare} />}
      {view === 'result' && !record && <div className="tarot-content"><p role="alert" className="tarot-error">这条手记已不存在。</p><button type="button" className="tarot-secondary" onClick={() => go('history')}>返回手记</button></div>}
      {view === 'history' && <>
        <Topbar title="收藏过的星光" onBack={() => go('lobby')} />
        <div className="tarot-content"><header className="tarot-intro"><p className="tarot-eyebrow">YOUR LITTLE ARCHIVE</p><h3>那些认真问过的小事。</h3><p>牌面与解读都留在这里，不会因再次抽牌而覆盖。</p></header>
          {!records.length && <div className="tarot-empty"><CelestialSeal /><h3>第一页，等你翻开。</h3><p>抽完一组牌，就会自动收藏在这里。</p><button type="button" className="tarot-secondary" onClick={() => go('setup')}>去抽一张牌<ArrowRight size={14} /></button></div>}
          {records.map(item => <article className="tarot-history-record" key={item.id}>
            <button type="button" className="tarot-history-open" onClick={() => { setRecordId(item.id); go('result'); }}>
              <span className="tarot-history-icon"><Moon size={21} strokeWidth={1.2} /></span><span><strong>{tarotSpread(item.spreadId).name}</strong><small>{item.question}</small><time dateTime={item.createdAt}>{stamp(item.createdAt)} · {item.userName}</time></span><ChevronRight size={14} />
            </button>
            <button type="button" aria-label="删除塔罗记录" className="tarot-delete" onClick={() => {
              if (window.confirm('删除这次塔罗手记？已经转发到聊天里的卡片不受影响。')) saveTarotRecords(loadTarotRecords().filter(entry => entry.id !== item.id));
            }}><Trash2 size={15} /></button>
          </article>)}
          {footer}
        </div>
      </>}
    </div>
  );
}

function TarotResult({ record, people, busy, error, onBack, onAgain, onInterpret, onShare }: {
  record: TarotRecord; people: Person[]; busy: boolean; error: string; onBack: () => void; onAgain: () => void;
  onInterpret: (reader: TarotReader) => void; onShare: Props['onShare'];
}) {
  const [mode, setMode] = useState<'oracle' | 'character'>('oracle');
  const [actorId, setActorId] = useState(people[0]?.id ?? '');
  const [readerError, setReaderError] = useState('');
  const [sharing, setSharing] = useState(false), [recipients, setRecipients] = useState<string[]>([]);
  const [shareBusy, setShareBusy] = useState(false), [shareError, setShareError] = useState(''), [notice, setNotice] = useState('');
  const shareLock = useRef(false);
  const actor = people.find(person => person.id === actorId);
  const ask = () => {
    setReaderError('');
    if (mode === 'oracle') onInterpret({ mode });
    else if (actor) onInterpret({ mode, actorId: actor.id, actorName: actor.name });
    else setReaderError('请选择仍在通讯录中的解读角色。');
  };
  const share = async () => {
    if (shareLock.current) return;
    const valid = recipients.filter(id => people.some(person => person.id === id));
    if (!valid.length) { setShareError('请选择仍在通讯录中的接收角色。'); return; }
    shareLock.current = true; setShareBusy(true); setShareError(''); setNotice('');
    try { await onShare(record, valid); setNotice('塔罗手记已转发'); setSharing(false); }
    catch (caught) { setShareError(caught instanceof Error ? caught.message : '转发失败，请重试。'); }
    finally { shareLock.current = false; setShareBusy(false); }
  };
  return <>
    <Topbar title="这一刻的塔罗手记" onBack={onBack} right={<button type="button" onClick={onAgain} aria-label="再抽一组"><RefreshCw size={15} /></button>} />
    <div className="tarot-content">
      <header className="tarot-result-heading"><p className="tarot-eyebrow">A MOMENT, KEPT IN THE CARDS</p><h3>{tarotSpread(record.spreadId).name}</h3><p>{record.question}</p><time dateTime={record.createdAt}>{stamp(record.createdAt)} · {record.userName}</time><span className="tarot-saved"><Check size={11} />已收藏</span></header>
      <div className={`tarot-result-cards${record.cards.length === 1 ? ' is-single' : record.cards.length === 5 ? ' is-five' : ''}`}>{record.cards.map(draw => <div key={draw.cardId}>
        <span className="tarot-position">{draw.position}</span><CardFace draw={draw} /><span className="tarot-orientation">{draw.reversed ? '逆位 · 另一个视角' : '正位'}</span>
      </div>)}</div>
      <section className="tarot-panel"><div className="tarot-section-heading"><Flower2 size={16} /><h3>先读一读牌面的提示</h3><small>无需 AI</small></div>
        {record.cards.map(draw => { const card = tarotCard(draw.cardId); return <article className="tarot-meaning" key={draw.cardId}><span>{draw.position}</span><h4>{card.name}<small>{card.keywords}</small></h4><p>{draw.reversed ? card.reversed : card.upright}</p></article>; })}
        {record.spreadId === 'relationship' && <p className="tarot-help">「对方」牌位是帮助你换位思考的象征，不代表读到了对方真实的想法。</p>}
      </section>
      <section className="tarot-panel">
        <div className="tarot-section-heading"><Sparkles size={16} /><h3>想听更完整的解读吗？</h3></div>
        <label className="tarot-label">谁来解读<select className="tarot-field" aria-label="塔罗解读方式" value={mode} disabled={busy} onChange={event => setMode(event.target.value === 'character' ? 'character' : 'oracle')}><option value="oracle">AI 占卜师 · 中立解读</option><option value="character">指定角色 · 用 TA 的语气解读</option></select></label>
        {mode === 'character' && <label className="tarot-label">邀请一位角色<select className="tarot-field" aria-label="塔罗解读角色" value={actor?.id ?? ''} disabled={busy} onChange={event => setActorId(event.target.value)}><option value="">选择角色</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
        {mode === 'character' && !people.length && <p className="tarot-help">通讯录里还没有角色，可以先请 AI 占卜师解读。</p>}
        {readerError && <p role="alert" className="tarot-error">{readerError}</p>}
        <button type="button" className="tarot-primary" disabled={busy || mode === 'character' && !actor} onClick={ask}>{busy ? <><Loader2 className="tarot-spinner" size={15} />正在解读整组牌…</> : <><Sparkles size={15} />{record.interpretations.some(attempt => attempt.status === 'done') ? '再听一次解读' : '请 AI 解读'} · 1 次</>}</button>
        <p className="tarot-cost">只在点击后请求 · 整组牌 1 次 AI · 失败不自动重试</p>
        {busy && <p className="tarot-help">离开占卜或返回上一级会取消当前解读，已抽到的牌不会改变。</p>}
        {error && <p role="alert" className="tarot-error">{error}</p>}
      </section>
      {record.interpretations.filter(attempt => attempt.status !== 'pending').map(attempt => <section className="tarot-panel tarot-reading" key={attempt.id}>
        <p className="tarot-eyebrow">{attempt.reader.mode === 'oracle' ? 'THE ORACLE' : 'A VOICE YOU KNOW'}</p><h3>{attempt.reader.mode === 'oracle' ? 'AI 占卜师' : attempt.reader.actorName}的解读</h3>
        {attempt.status === 'done' ? <p className="tarot-reading-text">{attempt.text}</p> : <p role="alert" className="tarot-error">{attempt.error}</p>}
        <time dateTime={attempt.createdAt}>{stamp(attempt.createdAt)}</time>
      </section>)}
      <section className="tarot-panel">
        <div className="tarot-section-heading"><Send size={15} /><h3>把这一刻，分享给 TA</h3></div><p className="tarot-help">转发牌阵、内置牌义与已保存的 AI 解读，不额外调用 AI。</p>
        <button type="button" className="tarot-secondary" aria-expanded={sharing} disabled={shareBusy} onClick={() => { setSharing(!sharing); setNotice(''); }}>转发塔罗手记<Send size={13} /></button>
        {sharing && <div className="tarot-share-picker">{people.map(person => <label className="tarot-recipient" key={person.id}><input type="checkbox" disabled={shareBusy} checked={recipients.includes(person.id)} onChange={() => setRecipients(current => current.includes(person.id) ? current.filter(id => id !== person.id) : [...current, person.id])} /><span>{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <i>{Array.from(person.name)[0]}</i>}{person.name}</span></label>)}
          {!people.length && <p className="tarot-help">先在通讯录里添加一位角色，才能转发。</p>}
          <button type="button" className="tarot-primary" disabled={shareBusy || !recipients.some(id => people.some(person => person.id === id))} onClick={() => { void share(); }}>{shareBusy ? '正在转发…' : `发送给 ${recipients.filter(id => people.some(person => person.id === id)).length} 位角色`}</button>
        </div>}
        {notice && <p role="status" className="tarot-share-notice">{notice}</p>}{shareError && <p role="alert" className="tarot-error">{shareError}</p>}
      </section>
      <p className="tarot-disclaimer">塔罗仅供娱乐与自我探索。<br />不预言灾祸，不替代现实沟通、健康或财务方面的专业建议。</p>
    </div>
  </>;
}
