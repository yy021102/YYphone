import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, Copy, Download, Flower2, Heart, History, Leaf, Loader2, Moon, Pencil, Plus, RotateCcw,
  Send, Sparkles, Trash2, Upload,
} from 'lucide-react';
import {
  BUILTIN_QNA_BANKS, QNA_CATEGORIES, buildShareText, exportBanks, findReusableAnswers, loadCustomBanks, loadRecords, markInflight,
  matchLabel, matchStats, normalizeBank, normalizeCharacterAnswers, parseBankImport, qnaId, reconcileInterrupted, saveCustomBanks,
  saveRecords, subscribeQna, updateRecord, type QnaBank, type QnaPerson, type QnaQuestion, type QnaRecord,
} from '../utils/qnaGame';
import { QnaBankEditor } from './QnaBankEditor';
import './qnaGame.css';

export type QnaAnswerInput = { actor: QnaPerson; bankTitle: string; category: string; questions: QnaQuestion[] };
export type QnaGenerateInput = { requirement: string; count: number; mix: 'mixed' | 'choice' | 'text'; category: string };
type Props = {
  people: QnaPerson[];
  shareTargets: QnaPerson[];
  userName: string;
  userAvatarUrl?: string;
  onAnswer: (input: QnaAnswerInput) => Promise<unknown>;
  onGenerateBank: (input: QnaGenerateInput) => Promise<unknown>;
  onShare: (result: { id: string; title: string; detail: string }, recipients: string[]) => void;
};
type View =
  | { name: 'home' }
  | { name: 'editor'; bank: QnaBank; isNew: boolean }
  | { name: 'generate' }
  | { name: 'start'; bank: QnaBank }
  | { name: 'answer'; recordId: string }
  | { name: 'result'; recordId: string };

const MAX_PARTNERS = 6;
const AVATAR_COLORS = ['#eee1dd', '#dfe8de', '#e0e8eb', '#eae4d8', '#e8e1ed'];
const hash = (text: string) => [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
const fmtDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const bankOfRecord = (record: QnaRecord): QnaBank => ({
  id: record.bankId, title: record.bankTitle, category: record.bankCategory, emoji: record.emoji, description: '',
  questions: record.questions, createdAt: record.createdAt, updatedAt: record.createdAt,
});

function Avatar({ name, url, size = 36 }: { name: string; url?: string; size?: number }) {
  return (
    <span className="qna-avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: AVATAR_COLORS[hash(name) % AVATAR_COLORS.length] }}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : Array.from(name)[0] ?? '?'}
    </span>
  );
}

function LetterIllustration() {
  return (
    <svg className="qna-letter-art" viewBox="0 0 170 195" fill="none" aria-hidden="true">
      <ellipse cx="94" cy="108" rx="68" ry="73" fill="#e7eee3" fillOpacity=".65" />
      <circle cx="140" cy="41" r="14" fill="#f0ddd7" fillOpacity=".8" />
      <g transform="rotate(9 86 100)">
        <rect x="37" y="48" width="94" height="114" rx="4" fill="#dde5d8" />
      </g>
      <g transform="rotate(-8 86 100)">
        <rect x="30" y="40" width="104" height="123" rx="5" fill="#fffdf8" stroke="#d6ded2" />
        <path d="M45 58H105M45 66H84" stroke="#d5ddcf" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M61 143C65 109 76 91 93 71M74 112C81 106 88 98 94 89" stroke="#819779" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M67 123C50 119 51 104 51 104C66 103 72 113 67 123Z" fill="#b1c0a5" />
        <path d="M74 108C64 98 67 84 67 84C81 85 83 100 74 108Z" fill="#c8d2bd" />
        <path d="M80 97C82 86 91 82 98 84C99 93 91 101 80 97Z" fill="#aabb9e" />
        <path d="M89 78C81 72 83 60 90 58C99 64 98 72 89 78Z" fill="#c8d2bd" />
        <g transform="translate(98 74)">
          <ellipse cx="-6" cy="0" rx="8" ry="5" transform="rotate(-30)" fill="#edc8bf" />
          <ellipse cx="5" cy="-5" rx="5" ry="8" transform="rotate(25)" fill="#f1d8cd" />
          <ellipse cx="5" cy="5" rx="6" ry="8" transform="rotate(-25)" fill="#e9bcb2" />
          <circle r="3" fill="#ba9275" />
        </g>
      </g>
      <path d="M22 119L80 83L142 119V174H22V119Z" fill="#eee5d9" stroke="#d8cfbf" />
      <path d="M22 120L82 153L142 120" stroke="#d2c6b4" />
      <path d="M22 173L65 143M142 173L99 143" stroke="#d8cfbf" />
      <circle cx="82" cy="146" r="11" fill="#b9c9ab" stroke="#9faf92" />
      <path d="M78 147C75 144 78 140 82 144C86 140 89 144 86 147L82 151L78 147Z" fill="#f8faf1" />
      <path d="M17 63L18 68L23 69L18 70L17 75L16 70L11 69L16 68Z" fill="#b2bea5" />
      <circle cx="145" cy="91" r="2" fill="#cda898" />
      <path d="M38 185C55 188 112 188 128 184" stroke="#d7dfce" strokeLinecap="round" />
    </svg>
  );
}

function BankCover({ bank }: { bank: Pick<QnaBank, 'category' | 'emoji' | 'builtIn'> }) {
  const tone = bank.category === '恋爱' ? 'rose' : bank.category === '深聊' ? 'night' : bank.category === '默契问答' ? 'blue' : 'sage';
  const Icon = tone === 'rose' ? Flower2 : tone === 'night' ? Moon : tone === 'blue' ? Sparkles : Heart;
  return (
    <span className="qna-bank-cover" data-tone={tone} aria-hidden="true">
      <span className="qna-cover-lines" />
      {bank.builtIn ? <Icon size={24} strokeWidth={1.3} /> : <span className="qna-custom-emoji">{bank.emoji}</span>}
      <span className="qna-cover-caption">for us</span>
    </span>
  );
}

export function QnaGameSpotlight({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="qna-app qna-spotlight">
      <button type="button" onClick={onOpen} aria-label="A Little Closer · 相性问答" className="qna-hero qna-spotlight-button">
        <p className="qna-eyebrow"><Leaf size={12} strokeWidth={1.4} />相性问答 · 双人手记</p>
        <h3 className="qna-spotlight-title">A Little<br />Closer</h3>
        <p className="qna-muted">把喜欢，写进答案里。</p>
        <span className="qna-spotlight-action">一起翻开<ArrowUpRight size={14} strokeWidth={1.5} /></span>
        <div className="qna-hero-art"><LetterIllustration /></div>
      </button>
    </div>
  );
}

const shell = 'qna-page';
const primaryButton = 'qna-primary';

function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="qna-topbar">
      <button type="button" onClick={onBack} aria-label="返回" className="qna-back"><ArrowLeft size={15} /><span>手记</span></button>
      <h2>{title}</h2>
      {right}
    </div>
  );
}

export function QnaGame({ people, shareTargets, userName, userAvatarUrl, onAnswer, onGenerateBank, onShare }: Props) {
  const [view, setView] = useState<View>({ name: 'home' });
  const [tab, setTab] = useState<'banks' | 'records'>('banks');
  const [customBanks, setCustomBanks] = useState(loadCustomBanks);
  const [records, setRecords] = useState(loadRecords);
  const [notice, setNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;
  const noticeTimer = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeQna(() => { setCustomBanks(loadCustomBanks()); setRecords(loadRecords()); });
    reconcileInterrupted();
    setRecords(loadRecords());
    return () => { unsubscribe(); window.clearTimeout(noticeTimer.current); };
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600);
  };
  const banks = [...BUILTIN_QNA_BANKS, ...customBanks];
  const home = () => setView({ name: 'home' });

  const generateFor = async (recordId: string, person: QnaPerson) => {
    markInflight(recordId, person.id, true);
    updateRecord(recordId, record => ({ ...record, results: { ...record.results, [person.id]: { status: 'pending', answers: {} } } }));
    try {
      const record = loadRecords().find(item => item.id === recordId);
      if (!record) return;
      const raw = await onAnswerRef.current({ actor: person, bankTitle: record.bankTitle, category: record.bankCategory, questions: record.questions });
      const answers = normalizeCharacterAnswers(record.questions, raw);
      updateRecord(recordId, current => ({ ...current, results: { ...current.results, [person.id]: { status: 'done', answers } } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败，请重试。';
      updateRecord(recordId, current => ({ ...current, results: { ...current.results, [person.id]: { status: 'error', answers: {}, error: message } } }));
    } finally {
      markInflight(recordId, person.id, false);
    }
  };

  const startSession = (bank: QnaBank, partners: QnaPerson[], reused: Record<string, string>) => {
    const now = new Date().toISOString();
    const record: QnaRecord = {
      id: qnaId('qna'), bankId: bank.id, bankTitle: bank.title, bankCategory: bank.category, emoji: bank.emoji,
      createdAt: now, updatedAt: now, questions: bank.questions.map(question => ({ ...question, options: [...question.options] })),
      userName, userAnswers: reused, people: partners.map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl })),
      results: Object.fromEntries(partners.map(person => [person.id, { status: 'pending' as const, answers: {} }])),
    };
    saveRecords([record, ...loadRecords()]);
    partners.forEach(person => void generateFor(record.id, person));
    setView({ name: 'answer', recordId: record.id });
  };

  const saveBank = (bank: QnaBank) => {
    saveCustomBanks(customBanks.some(item => item.id === bank.id) ? customBanks.map(item => item.id === bank.id ? bank : item) : [bank, ...customBanks]);
    flash('题库已保存');
    home();
  };
  const copyBank = (bank: QnaBank) => {
    const now = new Date().toISOString();
    setView({ name: 'editor', isNew: true, bank: { ...bank, id: qnaId('bank'), builtIn: false, title: `${bank.title}（副本）`.slice(0, 30), createdAt: now, updatedAt: now } });
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const imported = parseBankImport(await file.text());
      saveCustomBanks([...imported, ...customBanks]);
      flash(`已导入 ${imported.length} 个题库`);
    } catch (error) {
      flash(error instanceof Error ? error.message : '导入失败');
    }
  };

  const record = view.name === 'answer' || view.name === 'result' ? records.find(item => item.id === view.recordId) : undefined;
  useEffect(() => {
    if ((view.name === 'answer' || view.name === 'result') && !record) setView({ name: 'home' });
  }, [view, record]);

  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let element = topRef.current?.parentElement ?? null;
    while (element && !/(auto|scroll)/.test(getComputedStyle(element).overflowY)) element = element.parentElement;
    element?.scrollTo({ top: 0 });
  }, [view.name, 'recordId' in view ? view.recordId : '']);

  const noticeBar = notice && (
    <div className="qna-notice-position">
      <div role="status" className="qna-notice">{notice}</div>
    </div>
  );

  const renderView = (): ReactNode => {
    if (view.name === 'editor') return <QnaBankEditor bank={view.bank} isNew={view.isNew} onSave={saveBank} onCancel={home} />;
    if (view.name === 'generate') {
      return <>{noticeBar}<GenerateView onBack={home} onGenerate={onGenerateBank} onDone={bank => setView({ name: 'editor', bank, isNew: true })} /></>;
    }
    if (view.name === 'start') {
      return <StartView bank={view.bank} people={people} records={records} onBack={home} onStart={(partners, reused) => startSession(view.bank, partners, reused)} />;
    }
    if (view.name === 'answer' && record) {
      return <AnswerView key={record.id} record={record} onBack={home} onRetry={person => void generateFor(record.id, person)} onSubmitted={() => setView({ name: 'result', recordId: record.id })} />;
    }
    if (view.name === 'result' && record) {
      return (
        <>{noticeBar}<ResultView key={record.id}
          record={record} userAvatarUrl={userAvatarUrl} shareTargets={shareTargets} onBack={home}
          onRetry={person => void generateFor(record.id, person)}
          onAgain={() => setView({ name: 'start', bank: bankOfRecord(record) })}
          onShare={recipients => { onShare({ id: `qna-${record.id}`, title: `${record.bankTitle} · 问答结果`, detail: buildShareText(record) }, recipients); flash('结果卡片已转发'); }}
        /></>
      );
    }

    const done = records.filter(item => item.submittedAt);
    return (
      <section className={shell}>
        {noticeBar}
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={event => { void importFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        <div className="qna-hero">
          <p className="qna-eyebrow"><Leaf size={12} strokeWidth={1.4} />A LITTLE CLOSER</p>
          <h2>把喜欢，<br />写进<em>答案</em>里。</h2>
          <p className="qna-muted">从日常的小小偏好，<br />到只想告诉你的心事。</p>
          <div className="qna-hero-art"><LetterIllustration /></div>
          <div className="qna-hero-foot">
            <span>{banks.length} 本问答集</span><i /><span>{done.length} 份共同回忆</span>
          </div>
        </div>

        <div className="qna-tools">
          {([
            [Plus, '新建题库', () => { const now = new Date().toISOString(); setView({ name: 'editor', isNew: true, bank: { id: qnaId('bank'), title: '', description: '', category: '相性问答', emoji: '💌', questions: [{ id: qnaId('q'), type: 'choice', text: '', options: ['', ''] }], createdAt: now, updatedAt: now } }); }],
            [Sparkles, 'AI 出题', () => setView({ name: 'generate' })],
            [Upload, '导入', () => importRef.current?.click()],
          ] as const).map(([Icon, label, action]) => (
            <button key={label} type="button" onClick={action} className="qna-tool">
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        <div className="qna-tabs" role="tablist" aria-label="问答内容">
          {([['banks', '问答题库', banks.length], ['records', '我们的记录', records.length]] as const).map(([id, label, count]) => (
            <button key={id} type="button" role="tab" id={`qna-tab-${id}`} aria-selected={tab === id} aria-controls="qna-library" onClick={() => setTab(id)}>
              {label}<small>{count}</small>
            </button>
          ))}
        </div>

        {tab === 'banks' ? (
          <div className="qna-library" id="qna-library" role="tabpanel" aria-labelledby="qna-tab-banks">
            <p className="qna-library-note"><span>挑一本，慢慢了解彼此</span><Flower2 size={14} strokeWidth={1.3} /></p>
            {banks.map(bank => (
              <article key={bank.id} className="qna-bank">
                <div className="qna-bank-main">
                  <BankCover bank={bank} />
                  <div className="qna-bank-info">
                    <h3>{bank.title}</h3>
                    <div className="qna-bank-meta">
                      <span>{bank.category}</span><i>·</i><span>{bank.questions.length} 题</span>
                      <span className="qna-bank-source">{bank.builtIn ? '内置' : '自制'}</span>
                    </div>
                  </div>
                </div>
                {bank.description && <p className="qna-bank-description">{bank.description}</p>}
                <div className="qna-bank-footer">
                  <button type="button" onClick={() => setView({ name: 'start', bank })} className="qna-bank-start">开始作答<ArrowRight size={14} strokeWidth={1.5} /></button>
                  <IconButton label="导出题库" onClick={() => download(`${bank.title}.json`, exportBanks([bank]))}><Download size={15} /></IconButton>
                  {bank.builtIn
                    ? <IconButton label="复制为我的题库" onClick={() => copyBank(bank)}><Copy size={15} /></IconButton>
                    : <>
                      <IconButton label="编辑题库" onClick={() => setView({ name: 'editor', bank, isNew: false })}><Pencil size={15} /></IconButton>
                      <IconButton label="删除题库" danger onClick={() => { if (window.confirm(`删除题库「${bank.title}」？已有记录不受影响。`)) saveCustomBanks(customBanks.filter(item => item.id !== bank.id)); }}><Trash2 size={15} /></IconButton>
                    </>}
                </div>
              </article>
            ))}
            {customBanks.length > 0 && (
              <button type="button" onClick={() => download('相性问答题库.json', exportBanks(customBanks))} className="qna-link"><Download size={13} />导出全部自制题库</button>
            )}
          </div>
        ) : (
          <div className="qna-library" id="qna-library" role="tabpanel" aria-labelledby="qna-tab-records">
            <p className="qna-library-note"><span>那些一起认真回答过的小事</span><History size={13} strokeWidth={1.4} /></p>
            {records.length === 0 && (
              <div className="qna-empty"><LetterIllustration /><h3>第一页，等你们一起写</h3><p className="qna-muted">完成一份问答，便能把这一刻留在这里。</p><button type="button" className="qna-secondary" onClick={() => setTab('banks')}>挑一本问答集<ArrowRight size={13} /></button></div>
            )}
            {records.map(item => {
              const best = item.people.map(person => ({ person, stats: matchStats(item, person.id) })).filter(entry => entry.stats.total).sort((a, b) => b.stats.percent - a.stats.percent)[0];
              return (
                <div key={item.id} className="qna-record">
                  <button type="button" onClick={() => setView(item.submittedAt ? { name: 'result', recordId: item.id } : { name: 'answer', recordId: item.id })} className="qna-record-open">
                    <BankCover bank={{ category: item.bankCategory, emoji: item.emoji, builtIn: item.bankId.startsWith('builtin:') }} />
                    <span className="qna-record-info">
                      <span className="qna-record-title">{item.bankTitle}</span>
                      <span className="qna-record-people">{item.userName} · {item.people.map(person => person.name).join('、')}</span>
                      <time dateTime={item.createdAt}>{fmtDate(item.createdAt)}</time>
                    </span>
                    {item.submittedAt
                      ? best && <span className="qna-record-score" aria-label={`最高选项一致率 ${best.stats.percent}%`}>{best.stats.percent}<small>%</small></span>
                      : <span className="qna-record-draft">继续作答</span>}
                  </button>
                  <IconButton label="删除记录" onClick={() => { if (window.confirm('删除这条记录？')) saveRecords(records.filter(entry => entry.id !== item.id)); }}><Trash2 size={14} strokeWidth={1.5} /></IconButton>
                </div>
              );
            })}
          </div>
        )}
        <p className="qna-endnote">相同是默契，不同也值得珍藏</p>
      </section>
    );
  };

  return <div ref={topRef} className="qna-app flex min-h-full flex-col [&>section]:flex-1">{renderView()}</div>;
}

function IconButton({ label, onClick, children, danger }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={`qna-icon-button ${danger ? 'qna-danger' : ''}`}>{children}</button>;
}

function GenerateView({ onBack, onGenerate, onDone }: { onBack: () => void; onGenerate: (input: QnaGenerateInput) => Promise<unknown>; onDone: (bank: QnaBank) => void }) {
  const [requirement, setRequirement] = useState('');
  const [count, setCount] = useState(10);
  const [mix, setMix] = useState<QnaGenerateInput['mix']>('mixed');
  const [category, setCategory] = useState('相性问答');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const bank = normalizeBank(await onGenerate({ requirement: requirement.trim(), count, mix, category }));
      if (!bank) throw new Error('AI 返回的题库格式不正确，请重试。');
      onDone({ ...bank, category: bank.category || category });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={shell}>
      <TopBar title="AI 生成题库" onBack={onBack} />
      <div className="qna-content">
        <div className="qna-page-intro">
          <p className="qna-eyebrow"><Sparkles size={12} />MADE FOR YOU</p>
          <h3>想聊什么，就从这里开始。</h3>
          <p className="qna-muted">旅行、恋爱、某个难忘的夏天……<br />把灵感写下来，让 AI 为你们出一本题。</p>
        </div>
        <div className="qna-paper">
          <label className="qna-field-group block">
            <span className="qna-label">你的出题灵感</span>
            <textarea value={requirement} onChange={event => setRequirement(event.target.value.slice(0, 400))} rows={4} placeholder="例如：一起旅行时的小习惯，轻松一点，多一些有趣的选择。留空也可以，交给灵感。" className="qna-field" />
          </label>
          <div className="qna-field-group">
            <p className="qna-label">题目数量</p>
            <div className="qna-chips">{[5, 8, 10, 15, 20].map(value => <button key={value} type="button" onClick={() => setCount(value)} className="qna-chip" aria-pressed={count === value}>{value} 题</button>)}</div>
          </div>
          <div className="qna-field-group">
            <p className="qna-label">题型</p>
            <div className="qna-chips">{([['mixed', '混合'], ['choice', '全选择'], ['text', '全填写']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setMix(value)} className="qna-chip" aria-pressed={mix === value}>{label}</button>)}</div>
          </div>
          <div className="qna-field-group">
            <p className="qna-label">类型</p>
            <div className="qna-chips">{QNA_CATEGORIES.map(value => <button key={value} type="button" onClick={() => setCategory(value)} className="qna-chip" aria-pressed={category === value}>{value}</button>)}</div>
          </div>
        </div>
        {error && <p role="alert" className="qna-error"><AlertCircle size={15} />{error}</p>}
        <button type="button" disabled={busy} onClick={() => void submit()} className={`${primaryButton} qna-wide`}>
          {busy ? <><Loader2 size={16} className="qna-spinner" />正在出题…</> : <><Sparkles size={15} />生成题库</>}
        </button>
        <p className="qna-note"><Leaf size={12} />只调用 1 次 AI。生成后先预览、编辑，喜欢了再保存。</p>
      </div>
    </section>
  );
}

function StartView({ bank, people, records, onBack, onStart }: { bank: QnaBank; people: QnaPerson[]; records: QnaRecord[]; onBack: () => void; onStart: (partners: QnaPerson[], reused: Record<string, string>) => void }) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [reuseId, setReuseId] = useState('');
  const reusable = findReusableAnswers(records, bank.questions).slice(0, 4);
  const reuse = reusable.find(item => item.record.id === reuseId);
  const toggle = (id: string) => setChosen(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= MAX_PARTNERS ? current : [...current, id]);
  return (
    <section className={shell}>
      <TopBar title="一起作答" onBack={onBack} />
      <div className="qna-content">
        <div className="qna-start-heading">
          <BankCover bank={bank} />
          <div><p className="qna-eyebrow">A NEW CHAPTER</p><h3>{bank.title}</h3><p className="qna-muted">{bank.category} · {bank.questions.length} 题</p></div>
        </div>

        <div className="qna-paper">
          <div className="qna-section-heading"><h3>邀请谁，写下这一页？</h3><span>{chosen.length} / {MAX_PARTNERS}</span></div>
          {people.length === 0 ? <p className="qna-muted qna-centered">通讯录里还没有角色，先认识一位新朋友吧。</p> : (
            <div className="qna-person-grid">
              {people.map(person => {
                const active = chosen.includes(person.id);
                return (
                  <button key={person.id} type="button" onClick={() => toggle(person.id)} aria-pressed={active} className="qna-person">
                    <span className="qna-person-portrait">
                      <Avatar name={person.name} url={person.avatarUrl} size={42} />
                      {active && <span className="qna-person-check"><Check size={10} /></span>}
                    </span>
                    <span className="qna-person-name">{person.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="qna-paper">
          <div className="qna-section-heading"><h3>这一次，你想怎么回答？</h3></div>
          <div className="qna-choices">
            <ChoiceRow active={!reuseId} onClick={() => setReuseId('')} title="写一份新的回答" detail="跟着此刻的心情，一题一题慢慢答。" />
            {reusable.map(item => (
              <ChoiceRow key={item.record.id} active={reuseId === item.record.id} onClick={() => setReuseId(item.record.id)} title={`沿用「${item.record.bankTitle}」的回答`} detail={`${fmtDate(item.record.createdAt)} · 可套用 ${item.matched}/${bank.questions.length} 题，剩余的题再补答`} />
            ))}
          </div>
          <p className="qna-note qna-reuse-note"><Copy size={12} />旧答案只是复制到这一份手记，不会覆盖之前的回忆。</p>
        </div>
      </div>
      <div className="qna-start-footer">
        <button type="button" disabled={!chosen.length} onClick={() => onStart(chosen.flatMap(id => people.find(person => person.id === id) ?? []), reuse?.answers ?? {})} className={`${primaryButton} qna-wide`}>开始作答<ArrowRight size={15} /></button>
        <p className="qna-cost">{chosen.length ? `角色会与你同步作答 · 本次共调用 ${chosen.length} 次 AI` : '请选择至少一位角色，一起翻开第一页。'}</p>
      </div>
    </section>
  );
}

function ChoiceRow({ active, onClick, title, detail }: { active: boolean; onClick: () => void; title: string; detail: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="qna-choice-row">
      <span className="qna-choice-dot">{active && <Check size={10} />}</span>
      <span className="qna-choice-copy"><strong>{title}</strong><small>{detail}</small></span>
    </button>
  );
}

function PartnerStatus({ record, onRetry }: { record: QnaRecord; onRetry: (person: QnaPerson) => void }) {
  return (
    <div className="qna-partner-status" aria-label="角色作答进度">
      {record.people.map(person => {
        const status = record.results[person.id]?.status ?? 'pending';
        return (
          <button key={person.id} type="button" disabled={status !== 'error'} onClick={() => onRetry(person)} title={status === 'error' ? record.results[person.id]?.error : undefined} className="qna-partner">
            <Avatar name={person.name} url={person.avatarUrl} size={22} />
            <span className="qna-partner-name">{person.name}</span>
            <span className={`qna-partner-status-label ${status === 'error' ? 'qna-danger' : ''}`}>
              {status === 'pending' && <><Loader2 size={11} className="qna-spinner" />作答中</>}
              {status === 'done' && <><Check size={11} />已完成</>}
              {status === 'error' && <><RotateCcw size={11} />重试 · 1次</>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AnswerView({ record, onBack, onRetry, onSubmitted }: { record: QnaRecord; onBack: () => void; onRetry: (person: QnaPerson) => void; onSubmitted: () => void }) {
  const total = record.questions.length;
  const [answers, setAnswers] = useState(record.userAnswers);
  const [step, setStep] = useState(() => { const first = record.questions.findIndex(question => !record.userAnswers[question.id]?.trim()); return first < 0 ? total : first; });
  const saved = useRef(record.userAnswers);
  const latest = useRef(answers);
  latest.current = answers;
  const advance = useRef(0);
  const persist = () => {
    if (saved.current === latest.current) return;
    saved.current = latest.current;
    updateRecord(record.id, current => ({ ...current, userAnswers: latest.current }));
  };
  useEffect(() => { const timer = window.setTimeout(persist, 400); return () => window.clearTimeout(timer); }, [answers]);
  useEffect(() => () => { window.clearTimeout(advance.current); persist(); }, []);

  const question = record.questions[step];
  const answered = (id: string) => !!answers[id]?.trim();
  const unanswered = record.questions.filter(item => !answered(item.id));
  const moveStep = (next: number) => {
    window.clearTimeout(advance.current);
    setStep(next);
  };
  const setAnswer = (id: string, value: string) => setAnswers(current => ({ ...current, [id]: value }));
  const pick = (option: string) => {
    setAnswer(question.id, option);
    window.clearTimeout(advance.current);
    const from = step;
    advance.current = window.setTimeout(() => setStep(current => current === from ? from + 1 : current), 260);
  };
  const submit = () => {
    window.clearTimeout(advance.current);
    saved.current = latest.current;
    const now = new Date().toISOString();
    updateRecord(record.id, current => ({ ...current, userAnswers: latest.current, submittedAt: now }));
    onSubmitted();
  };

  return (
    <section className={shell}>
      <TopBar title={record.bankTitle} onBack={onBack} right={<span className="qna-muted">{Math.min(step + 1, total)} / {total}</span>} />
      <div className="qna-progress">
        <div className="qna-progress-head"><span>慢慢答，按你的心意就好</span><span>已答 {total - unanswered.length} 题</span></div>
        <div className="qna-progress-track" role="progressbar" aria-label="问卷完成度" aria-valuemin={0} aria-valuemax={total} aria-valuenow={total - unanswered.length}>
          <div className="qna-progress-fill" style={{ width: `${(total - unanswered.length) / total * 100}%` }} />
        </div>
        <PartnerStatus record={record} onRetry={onRetry} />
      </div>

      {question ? (
        <div className="qna-answer-body">
          <div key={question.id} className="qna-paper qna-question-paper">
            <div className="qna-question-heading"><Leaf size={12} strokeWidth={1.3} /><span>QUESTION {String(step + 1).padStart(2, '0')}</span><small>{question.type === 'choice' ? '单项选择' : '自由填写'}</small></div>
            <h3>{question.text}</h3>
            <p className="qna-muted">{question.type === 'choice' ? '选一个最像你的答案。' : '有些答案，只能由你亲手写下。'}</p>
            {question.type === 'choice' ? (
              <div className="qna-answer-options">
                {question.options.map((option, index) => {
                  const active = answers[question.id] === option;
                  return (
                    <button key={option} type="button" onClick={() => pick(option)} aria-pressed={active} className="qna-answer-option">
                      <span className="qna-option-letter">{String.fromCharCode(65 + index)}</span>
                      <span className="qna-option-copy">{option}</span>
                      {active && <Check size={15} strokeWidth={1.7} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="qna-written-answer">
                <textarea aria-label="你的回答" value={answers[question.id] ?? ''} onChange={event => setAnswer(question.id, event.target.value.slice(0, 200))} rows={5} placeholder="写下此刻的心里话…" className="qna-field" />
                <p className="qna-character-count">{(answers[question.id] ?? '').length} / 200</p>
              </div>
            )}
          </div>
          <div className="qna-answer-navigation">
            <button type="button" disabled={step === 0} onClick={() => moveStep(step - 1)} className="qna-secondary"><ArrowLeft size={14} />上一题</button>
            <button type="button" disabled={!answered(question.id)} onClick={() => moveStep(step + 1)} className={primaryButton}>{step === total - 1 ? '完成' : '下一题'}<ArrowRight size={14} /></button>
          </div>
          <p className="qna-answer-caption">答案会自动保存，也可以回来继续写。</p>
        </div>
      ) : (
        <div className="qna-content">
          <div className="qna-paper">
            <div className="qna-review-header"><p className="qna-eyebrow"><Check size={12} />READY TO REVEAL</p><h3>检查一下你的回答</h3><p className="qna-muted">点任意一题修改，让答案留下此刻的你。</p></div>
            <div>
              {record.questions.map((item, index) => (
                <button key={item.id} type="button" onClick={() => moveStep(index)} className="qna-review-row">
                  <span className="qna-review-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="qna-review-copy"><strong>{item.text}</strong><small className={answered(item.id) ? '' : 'qna-danger'}>{answers[item.id] || '还没有回答'}</small></span>
                  <Pencil size={12} strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
          <button type="button" disabled={unanswered.length > 0} onClick={submit} className={`${primaryButton} qna-wide`}><Heart size={15} strokeWidth={1.5} />提交，看看结果</button>
          {unanswered.length > 0 && <p className="qna-muted qna-danger qna-centered">还有 {unanswered.length} 题没有回答</p>}
        </div>
      )}
    </section>
  );
}

function MatchRing({ percent }: { percent: number }) {
  return (
    <span className="qna-match-ring" aria-label={`选项一致率 ${percent}%`}>
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle className="qna-ring-track" cx="32" cy="32" r="28" strokeWidth="2" />
        <circle className="qna-ring-fill" cx="32" cy="32" r="28" strokeWidth="2.5" pathLength="100" strokeDasharray={`${percent} 100`} strokeLinecap="round" />
      </svg>
      <span className="qna-ring-number">{percent}<small>%</small></span>
    </span>
  );
}

function ResultView({ record, userAvatarUrl, shareTargets, onBack, onRetry, onAgain, onShare }: {
  record: QnaRecord; userAvatarUrl?: string; shareTargets: QnaPerson[]; onBack: () => void;
  onRetry: (person: QnaPerson) => void; onAgain: () => void; onShare: (recipients: string[]) => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [recipients, setRecipients] = useState<string[]>(() => record.people.filter(person => shareTargets.some(target => target.id === person.id)).map(person => person.id));
  const pending = record.people.some(person => record.results[person.id]?.status === 'pending');
  const rows = [{ id: 'user', name: record.userName, avatarUrl: userAvatarUrl }, ...record.people];
  return (
    <section className={shell}>
      <TopBar title="问答结果" onBack={onBack} right={<button type="button" onClick={onAgain} aria-label="再答一次" className="qna-small-action"><RotateCcw size={12} />再答</button>} />
      <div className="qna-content">
        <div className="qna-result-title">
          <p className="qna-eyebrow"><Leaf size={12} strokeWidth={1.3} />OUR LITTLE KEEPSAKE</p>
          <h3>{record.bankTitle}</h3>
          <div className="qna-result-avatars">
            <Avatar name={record.userName} url={userAvatarUrl} size={38} />
            <Heart size={15} />
            <span>{record.people.map(person => <Avatar key={person.id} name={person.name} url={person.avatarUrl} size={38} />)}</span>
          </div>
          <p>{record.userName} 与 {record.people.map(person => person.name).join('、')}</p>
          <time dateTime={record.submittedAt ?? record.createdAt}>{fmtDate(record.submittedAt ?? record.createdAt)} · {record.questions.length} 个关于我们的小问题</time>
        </div>

        <div className="qna-match-list">
          {record.people.map(person => {
            const result = record.results[person.id];
            const stats = matchStats(record, person.id);
            return (
              <div key={person.id} className="qna-paper qna-match">
                {result?.status === 'done' && stats.total ? <MatchRing percent={stats.percent} /> : (
                  <span className="qna-match-neutral">{result?.status === 'done' ? <Flower2 size={23} strokeWidth={1.2} /> : result?.status === 'error' ? <AlertCircle size={20} className="qna-danger" /> : <Loader2 size={19} className="qna-spinner" />}</span>
                )}
                <div className="qna-match-copy">
                  <div className="qna-match-name"><Avatar name={person.name} url={person.avatarUrl} size={22} /><strong>{person.name}</strong></div>
                  {result?.status === 'done' && <><h4>{stats.total ? matchLabel(stats.percent, stats.total) : '心事各有回响'}</h4><p>{stats.total ? `${stats.total} 道选择题中，${stats.matched} 题与你相同` : '文字答案不打分，慢慢读一读彼此的心意。'}</p></>}
                  {result?.status === 'pending' && <p>正在认真作答中，稍等一会儿…</p>}
                  {result?.status === 'error' && <><p className="qna-danger" role="alert">{result.error}</p><button type="button" onClick={() => onRetry(person)} className="qna-link qna-danger"><RotateCcw size={11} />重新生成（1 次）</button></>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="qna-result-guide"><h3>一题一页，读懂彼此</h3><p>一致率只对照选择题的答案，不定义你们的关系。</p></div>
        <div className="qna-result-questions">
          {record.questions.map((question, index) => {
            const given = rows.map(row => record.results[row.id]?.answers[question.id] ?? (row.id === 'user' ? record.userAnswers[question.id] : '')).filter(Boolean);
            const same = question.type === 'choice' && given.length === rows.length && new Set(given).size === 1;
            return (
              <article key={question.id} className="qna-paper qna-result-question" data-match={same}>
                <div className="qna-result-question-heading">
                  <span className="qna-result-question-number">QUESTION {String(index + 1).padStart(2, '0')}</span>
                  {same && <span className="qna-same-label"><Heart size={11} strokeWidth={1.4} />心有灵犀</span>}
                </div>
                <h4>{question.text}</h4>
                <div className="qna-result-answer-list">
                  {rows.map(row => {
                    const user = row.id === 'user';
                    const answer = user ? record.userAnswers[question.id] : record.results[row.id]?.answers[question.id];
                    const status = user ? 'done' : record.results[row.id]?.status;
                    return (
                      <div key={row.id} className="qna-result-answer" data-user={user}>
                        <Avatar name={row.name} url={row.avatarUrl} size={28} />
                        <div className="qna-result-answer-copy">
                          <span className="qna-result-answer-name">{row.name}{user && ' · 我的答案'}</span>
                          <p>
                            {answer || (status === 'pending' ? <span className="qna-answer-pending"><Loader2 size={12} className="qna-spinner" />作答中</span> : <span className="qna-muted">没有回答</span>)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>

        <div className="qna-paper qna-share">
          <h3>把这一页，寄给 TA</h3>
          <p className="qna-muted">认真写下的答案，也想和你分享。</p>
          <button type="button" disabled={pending || !shareTargets.length} aria-expanded={sharing} onClick={() => setSharing(open => !open)} className={`${primaryButton} qna-wide`}><Send size={14} />转发结果卡片给角色</button>
          {pending && <p className="qna-cost">等角色都答完再转发吧</p>}
          {!shareTargets.length && <p className="qna-cost">通讯录中暂无可转发的角色。</p>}
          {sharing && !pending && (
            <div className="qna-share-picker">
              <div className="qna-person-grid">
                {shareTargets.map(person => {
                  const active = recipients.includes(person.id);
                  return (
                    <button key={person.id} type="button" aria-pressed={active} onClick={() => setRecipients(current => active ? current.filter(id => id !== person.id) : [...current, person.id])} className="qna-person">
                      <span className="qna-person-portrait">
                        <Avatar name={person.name} url={person.avatarUrl} size={40} />
                        {active && <span className="qna-person-check"><Check size={9} /></span>}
                      </span>
                      <span className="qna-person-name">{person.name}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" disabled={!recipients.length} onClick={() => { onShare(recipients); setSharing(false); }} className={`${primaryButton} qna-wide`}>发送给 {recipients.length} 位角色</button>
            </div>
          )}
        </div>
        <p className="qna-endnote">今天的你们，也被好好收藏了</p>
      </div>
    </section>
  );
}
