import { useState } from 'react';
import { BookHeart, CalendarDays, ChevronLeft, Heart, Inbox, Mail, MessageCircle, Pencil, Plus, Send, Sparkles, StickyNote, Trash2, X } from 'lucide-react';
import { AppHeader } from './AppHeader';
import type { CharacterCoupleSpace, DiaryEntry } from '../apps/CoupleSpaceApp';
import { appendDiaryAnnotation, coupleRecordDate, diaryAnnotations, removeDiaryAnnotation, type CoupleRecordEdit } from '../utils/coupleRecords';
import { localDateString } from '../utils/coupleSpaceData';
import { generateCharDiary, generateDiaryReply, generateQaAnswer, generateQaQuestion, generateStickyNote } from '../utils/coupleSpaceAi';

export type CouplePage = 'anniversary' | 'diary' | 'qa' | 'sticky';
type Person = { name: string; avatarUrl?: string };
type Props = { page: CouplePage; space: CharacterCoupleSpace; user: Person; character: Person; busy: boolean; message: string;
  onBack: () => void; onDismiss: () => void; onUpdate: (change: (space: CharacterCoupleSpace) => CharacterCoupleSpace) => void;
  onEdit: (edit: CoupleRecordEdit) => void; runAi: (key: string, task: () => Promise<void | string>) => Promise<void> };
const titles = { anniversary: '纪念日', diary: '交换日记', qa: 'Q&A', sticky: '碎碎念' };
const colors = ['#FEF6C9', '#FFE0E9', '#DCEEFF', '#DCF5E3', '#EDE2FF'];
const id = () => crypto.randomUUID();
const dayDifference = (date: string) => Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${localDateString()}T12:00:00`).getTime()) / 86400000);
function Avatar({ person }: { person: Person }) { return <span className="couple-mini-avatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : person.name.slice(0, 1)}</span>; }

export function CoupleSpacePages({ page, space, user, character, busy, message, onBack, onDismiss, onUpdate, onEdit, runAi }: Props) {
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState(localDateString);
  const [color, setColor] = useState(colors[0]);
  const [anniversaryType, setAnniversaryType] = useState<'countdown' | 'elapsed'>('countdown');
  const [diaryId, setDiaryId] = useState('');
  const [annotation, setAnnotation] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [answer, setAnswer] = useState('');
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [filter, setFilter] = useState('all');
  const diary = space.diaries.find(entry => entry.id === diaryId);
  const question = space.qaList.find(entry => entry.id === questionId);
  const resetComposer = () => { setComposing(false); setTitle(''); setContent(''); setDate(localDateString()); };
  const back = () => { if (composing) resetComposer(); else if (diaryId || questionId) { setDiaryId(''); setQuestionId(''); setAnnotation(''); setEditingAnswer(false); } else onBack(); };
  const startComposer = () => { setDiaryId(''); setQuestionId(''); setTitle(''); setContent(''); setDate(localDateString()); setComposing(true); onDismiss(); };
  const editDiary = (entry: DiaryEntry) => onEdit({ kind: 'diary', id: entry.id, date: entry.dateStr, title: entry.title, content: entry.content, authorName: entry.authorName, replyComment: entry.replyComment || '' });
  const generate = () => {
    const charId = space.charId;
    if (page === 'diary') void runAi('diary', async () => {
      const result = await generateCharDiary(charId, user.name, space);
      const entry: DiaryEntry = { ...result, id: id(), author: 'char', authorName: character.name, dateStr: localDateString(), seenByChar: true };
      onUpdate(prev => ({ ...prev, diaries: [entry, ...prev.diaries] }));
    });
    else if (page === 'qa') void runAi('qa-ask', async () => {
      const question = await generateQaQuestion(charId, user.name, space);
      onUpdate(prev => ({ ...prev, qaList: [{ id: id(), dateStr: localDateString(), question, askedBy: 'char' }, ...prev.qaList] }));
    });
    else if (page === 'sticky') void runAi('sticky', async () => {
      const content = await generateStickyNote(charId, user.name, space);
      onUpdate(prev => ({ ...prev, stickyNotes: [{ id: id(), author: 'char', authorName: character.name, content, colorBg: colors[prev.stickyNotes.length % colors.length], createdAt: localDateString(), seenByChar: true }, ...prev.stickyNotes] }));
    });
  };
  const publish = () => {
    if (page === 'anniversary') {
      if (!title.trim() || !date) return;
      onUpdate(prev => ({ ...prev, anniversaries: [{ id: id(), title: title.trim(), targetDate: date, type: anniversaryType }, ...prev.anniversaries] }));
    } else if (page === 'diary') {
      if (!content.trim()) return;
      const diaryId = id();
      onUpdate(prev => ({ ...prev, diaries: [{ id: diaryId, author: 'user', authorName: user.name, title: title.trim() || '日记', content: content.trim(), dateStr: date, seenByChar: false }, ...prev.diaries] }));
      setDiaryId(diaryId);
    } else if (page === 'qa') {
      if (!content.trim()) return;
      onUpdate(prev => ({ ...prev, qaList: [{ id: id(), dateStr: localDateString(), question: content.trim(), askedBy: 'user', seenByChar: false }, ...prev.qaList] }));
    } else {
      if (!content.trim()) return;
      onUpdate(prev => ({ ...prev, stickyNotes: [{ id: id(), author: 'user', authorName: user.name, content: content.trim(), colorBg: color, createdAt: localDateString(), seenByChar: false }, ...prev.stickyNotes] }));
    }
    resetComposer();
  };
  const addAnnotation = () => {
    if (!diary || !annotation.trim()) return;
    onUpdate(prev => appendDiaryAnnotation(prev, diary.id, { id: id(), author: 'user', authorName: user.name, content: annotation, createdAt: new Date().toISOString() })); setAnnotation('');
  };
  const annotateAsCharacter = () => {
    if (!diary) return;
    void runAi(`reply-${diary.id}`, async () => {
      const content = await generateDiaryReply(space.charId, user.name, diary.title, diary.content, { author: diary.author, annotations: diaryAnnotations(diary, character.name) });
      onUpdate(prev => appendDiaryAnnotation(prev, diary.id, { id: id(), author: 'char', authorName: character.name, content, createdAt: new Date().toISOString() }));
    });
  };
  const headerTitle = composing ? page === 'diary' ? '写日记' : page === 'qa' ? '提问' : page === 'sticky' ? '写便签' : '添加纪念日' : diary ? '日记' : question ? '提问' : titles[page];

  return <section className={`couple-page couple-page-${page}`} aria-label={titles[page]}>
    <AppHeader title={headerTitle} onBack={back} rightAction={!composing && !diary && !question ? <div className="couple-page-toolbar">{page !== 'anniversary' && <button type="button" disabled={busy} aria-label={page === 'diary' ? '让角色写日记' : page === 'qa' ? '让角色提问' : '让角色贴便签'} onClick={generate}><Sparkles size={18} /></button>}<button type="button" aria-label={page === 'diary' ? '写日记' : page === 'qa' ? '提问' : page === 'sticky' ? '写便签' : '添加纪念日'} onClick={startComposer}><Plus size={20} /></button></div> : undefined} />
    <div className="couple-page-scroll" key={`${composing}-${diary?.id || question?.id || 'list'}`}>
      {message && <div className="couple-page-message" role="status"><span>{message}</span><button type="button" aria-label="关闭提示" onClick={onDismiss}><X size={14} /></button></div>}
      {composing ? <div className={`couple-page-compose ${page === 'sticky' ? 'is-stationery' : ''}`}>
        {(page === 'anniversary' || page === 'diary') && <><input aria-label={page === 'anniversary' ? '纪念日名称' : '日记标题'} placeholder={page === 'anniversary' ? '纪念日名称' : '标题'} maxLength={80} value={title} onChange={event => setTitle(event.target.value)} /><input type="date" aria-label="记录日期" value={date} onChange={event => setDate(event.target.value)} /></>}
        {page === 'anniversary' ? <div className="couple-segment">{([['countdown', '倒数日'], ['elapsed', '正数日']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={anniversaryType === value} onClick={() => setAnniversaryType(value)}>{label}</button>)}</div>
          : <textarea aria-label={page === 'diary' ? '日记正文' : page === 'qa' ? '问题' : '便签内容'} placeholder={page === 'qa' ? '想问什么？' : '写点什么…'} rows={page === 'diary' ? 12 : 5} maxLength={page === 'diary' ? 10000 : page === 'qa' ? 1000 : 2000} value={content} onChange={event => setContent(event.target.value)} />}
        {page === 'sticky' && <div className="couple-note-colors">{colors.map((value, index) => <button type="button" key={value} aria-label={`便签颜色${index + 1}`} aria-pressed={value === color} style={{ backgroundColor: value }} onClick={() => setColor(value)} />)}</div>}
        <button type="button" className="couple-primary" disabled={page === 'anniversary' ? !title.trim() || !date : !content.trim() || page === 'diary' && !date} onClick={publish}><Send size={15} />{page === 'sticky' ? '贴上' : page === 'qa' ? '投递' : '保存'}</button>
      </div> : diary ? <div className="couple-diary-detail">
        <div className="couple-entry-byline"><Avatar person={diary.author === 'user' ? user : character} /><span>{diary.authorName}<time>{diary.dateStr}</time></span><button type="button" aria-label="编辑日记" onClick={() => editDiary(diary)}><Pencil size={15} /></button><button type="button" disabled={busy} aria-label="删除日记" onClick={() => { if (window.confirm('删除这篇日记？')) { onUpdate(prev => ({ ...prev, diaries: prev.diaries.filter(entry => entry.id !== diary.id) })); setDiaryId(''); } }}><Trash2 size={15} /></button></div>
        <article className="couple-diary-paper"><h2>{diary.title}</h2><p>{diary.content}</p></article>
        <div className="couple-annotations-head"><h3>批注</h3>{(diary.author === 'user' || diary.annotations?.some(note => note.author === 'user')) && <button type="button" disabled={busy} onClick={annotateAsCharacter} aria-label="让角色批注"><Sparkles size={14} />{character.name}</button>}</div>
        <div className="couple-annotations">{diaryAnnotations(diary, character.name).map(note => <div className={`couple-annotation ${note.author === 'user' ? 'is-user' : ''}`} key={note.id}><Avatar person={note.author === 'user' ? user : character} /><div><header><strong>{note.authorName}</strong><time>{coupleRecordDate(note.createdAt) || note.createdAt}</time><button type="button" disabled={busy} aria-label={`删除批注：${note.content}`} onClick={() => onUpdate(prev => removeDiaryAnnotation(prev, diary.id, note.id))}><Trash2 size={12} /></button></header><p>{note.content}</p></div></div>)}</div>
        <div className="couple-inline-composer"><textarea aria-label="日记批注" rows={2} placeholder="批注" maxLength={2000} value={annotation} onChange={event => setAnnotation(event.target.value)} /><button type="button" className="couple-primary" aria-label="发送批注" disabled={!annotation.trim()} onClick={addAnnotation}><Send size={16} /></button></div>
      </div> : question ? <div className="couple-question-detail">
        <div className="couple-question-letter"><Mail size={25} strokeWidth={1.4} /><small>{question.askedBy === 'user' ? user.name : question.askedBy === 'char' ? character.name : 'Q&A'} · {question.dateStr}</small><h2>{question.question}</h2><div className="couple-letter-actions"><button type="button" aria-label="编辑问题" onClick={() => onEdit({ kind: 'qa', id: question.id, date: question.dateStr, question: question.question, userAnswer: question.userAnswer || '', charAnswer: question.charAnswer || '' })}><Pencil size={14} /></button><button type="button" disabled={busy} aria-label="删除问题" onClick={() => { if (window.confirm('删除这个问题？')) { onUpdate(prev => ({ ...prev, qaList: prev.qaList.filter(entry => entry.id !== question.id) })); setQuestionId(''); } }}><Trash2 size={14} /></button></div></div>
        <div className="couple-answer"><Avatar person={user} /><div><strong>{user.name}</strong>{question.userAnswer && !editingAnswer ? <><p>{question.userAnswer}</p><button type="button" onClick={() => { setAnswer(question.userAnswer || ''); setEditingAnswer(true); }}>编辑</button></> : <><textarea aria-label="我的回答" rows={4} placeholder="写下回答" maxLength={4000} value={answer} onChange={event => setAnswer(event.target.value)} /><button type="button" disabled={!answer.trim()} onClick={() => { onUpdate(prev => ({ ...prev, qaList: prev.qaList.map(entry => entry.id === question.id ? { ...entry, userAnswer: answer.trim(), seenByChar: false } : entry) })); setEditingAnswer(false); }}>保存</button></>}</div></div>
        <div className="couple-answer is-character"><Avatar person={character} /><div><strong>{character.name}</strong>{question.charAnswer ? <p>{question.charAnswer}</p> : <button type="button" disabled={busy} onClick={() => void runAi(`qa-${question.id}`, async () => { const answer = await generateQaAnswer(space.charId, user.name, question.question, question.userAnswer); onUpdate(prev => ({ ...prev, qaList: prev.qaList.map(entry => entry.id === question.id ? { ...entry, charAnswer: answer } : entry) })); })}><Sparkles size={14} />回答</button>}</div></div>
      </div> : page === 'diary' ? <div className="couple-diary-columns">
        {(['user', 'char'] as const).map(author => <section className={`couple-diary-column is-${author}`} aria-label={`${author === 'user' ? user.name : character.name}的日记`} key={author}><header><Avatar person={author === 'user' ? user : character} /><strong>{author === 'user' ? user.name : character.name}</strong></header><div>{[...space.diaries].filter(entry => entry.author === author).sort((a, b) => b.dateStr.localeCompare(a.dateStr)).map(entry => <button type="button" className="couple-diary-preview" key={entry.id} onClick={() => { setDiaryId(entry.id); setAnnotation(''); }}><time>{entry.dateStr}</time><h3>{entry.title}</h3><p>{entry.content}</p>{diaryAnnotations(entry, character.name).length > 0 && <small><MessageCircle size={11} />{diaryAnnotations(entry, character.name).length}</small>}</button>)}{!space.diaries.some(entry => entry.author === author) && <p className="couple-empty">暂无日记</p>}</div></section>)}
      </div> : page === 'sticky' ? <div className="couple-note-wall">{space.stickyNotes.map((note, index) => <article className="couple-paper-note" key={note.id} style={{ backgroundColor: /^#[\da-f]{6}$/i.test(note.colorBg) ? note.colorBg : colors[index % colors.length] }}><span className="couple-paper-tape" aria-hidden="true" /><p>{note.content}</p><footer><span>{note.authorName}<time>{coupleRecordDate(note.createdAt) || note.createdAt}</time></span><button type="button" aria-label={`编辑便签：${note.content}`} onClick={() => onEdit({ kind: 'note', id: note.id, date: coupleRecordDate(note.createdAt) || localDateString(), content: note.content, authorName: note.authorName, colorBg: note.colorBg })}><Pencil size={13} /></button><button type="button" disabled={busy} aria-label={`删除便签：${note.content}`} onClick={() => onUpdate(prev => ({ ...prev, stickyNotes: prev.stickyNotes.filter(entry => entry.id !== note.id) }))}><Trash2 size={13} /></button></footer></article>)}{!space.stickyNotes.length && <p className="couple-empty">暂无便签</p>}</div>
        : page === 'qa' ? <div className="couple-question-box"><div className="couple-mailbox" aria-hidden="true"><span /><Mail size={38} strokeWidth={1.2} /><Heart size={13} fill="currentColor" /></div><div className="couple-segment">{[['all', '全部'], ['pending', '待回答'], ['answered', '已回答']].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="couple-question-list">{space.qaList.filter(entry => filter === 'all' || (filter === 'answered' ? !!entry.userAnswer && !!entry.charAnswer : !entry.userAnswer || !entry.charAnswer)).map(entry => <button type="button" className="couple-question-envelope" key={entry.id} onClick={() => { setQuestionId(entry.id); setAnswer(entry.userAnswer || ''); setEditingAnswer(false); }}><span className="couple-envelope-stamp"><Heart size={15} /></span><small>{entry.askedBy === 'user' ? user.name : entry.askedBy === 'char' ? character.name : 'Q&A'}</small><h3>{entry.question}</h3><footer><time>{entry.dateStr}</time><span>{entry.userAnswer && entry.charAnswer ? '已回答' : '待回答'}</span></footer></button>)}{!space.qaList.some(entry => filter === 'all' || (filter === 'answered' ? entry.userAnswer && entry.charAnswer : !entry.userAnswer || !entry.charAnswer)) && <p className="couple-empty">暂无提问</p>}</div></div>
          : <div className="couple-anniversaries">{[...space.anniversaries].sort((a, b) => Math.abs(dayDifference(a.targetDate)) - Math.abs(dayDifference(b.targetDate))).map(entry => { const days = dayDifference(entry.targetDate); return <article className="couple-anniversary" key={entry.id}><div className="couple-anniversary-calendar"><span>{entry.targetDate.slice(0, 4)}</span><strong>{entry.targetDate.slice(5).replace('-', '/')}</strong></div><div><h3>{entry.title}</h3><time>{entry.targetDate}</time><div className="couple-entry-actions"><button type="button" aria-label={`编辑纪念日：${entry.title}`} onClick={() => onEdit({ kind: 'anniversary', id: entry.id, date: entry.targetDate, title: entry.title, type: entry.type })}><Pencil size={13} /></button><button type="button" aria-label={`删除纪念日：${entry.title}`} onClick={() => onUpdate(prev => ({ ...prev, anniversaries: prev.anniversaries.filter(item => item.id !== entry.id) }))}><Trash2 size={13} /></button></div></div><span className="couple-day-count"><small>{days > 0 ? '还有' : days === 0 ? '今天' : '已过'}</small><strong>{Math.abs(days)}</strong><small>天</small></span></article>; })}{!space.anniversaries.length && <p className="couple-empty">暂无纪念日</p>}</div>}
    </div>
  </section>;
}
