import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Leaf, Plus, Save, Trash2, X } from 'lucide-react';
import { QNA_CATEGORIES, QNA_MAX_OPTIONS, QNA_MAX_QUESTIONS, qnaId, type QnaBank, type QnaQuestion } from '../utils/qnaGame';

type Props = { bank: QnaBank; isNew: boolean; onSave: (bank: QnaBank) => void; onCancel: () => void };

const field = 'qna-field';

export function QnaBankEditor({ bank, isNew, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<QnaBank>(() => ({ ...bank, questions: bank.questions.map(question => ({ ...question, options: [...question.options] })) }));
  const [error, setError] = useState('');
  const patch = (value: Partial<QnaBank>) => setDraft(current => ({ ...current, ...value }));
  const patchQuestion = (id: string, value: Partial<QnaQuestion>) =>
    setDraft(current => ({ ...current, questions: current.questions.map(question => question.id === id ? { ...question, ...value } : question) }));
  const move = (index: number, delta: number) => setDraft(current => {
    const target = index + delta;
    if (target < 0 || target >= current.questions.length) return current;
    const questions = [...current.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    return { ...current, questions };
  });
  const setType = (question: QnaQuestion, type: QnaQuestion['type']) =>
    patchQuestion(question.id, { type, options: type === 'choice' && question.options.length < 2 ? ['', ''] : question.options });
  const addQuestion = () => {
    if (draft.questions.length >= QNA_MAX_QUESTIONS) return setError(`一个题库最多 ${QNA_MAX_QUESTIONS} 题。`);
    patch({ questions: [...draft.questions, { id: qnaId('q'), type: 'choice', text: '', options: ['', ''] }] });
  };
  const save = () => {
    const title = draft.title.trim();
    if (!title) return setError('请给题库起个名字。');
    if (!draft.questions.length) return setError('至少需要一道题。');
    const questions: QnaQuestion[] = [];
    for (const [index, question] of draft.questions.entries()) {
      const text = question.text.trim();
      if (!text) return setError(`第 ${index + 1} 题还没有写题目。`);
      if (question.type === 'text') { questions.push({ ...question, text, options: [] }); continue; }
      const options = [...new Set(question.options.map(option => option.trim()).filter(Boolean))];
      if (options.length < 2) return setError(`第 ${index + 1} 题需要至少两个不同的选项。`);
      questions.push({ ...question, text, options });
    }
    onSave({ ...draft, title, description: draft.description.trim(), category: draft.category.trim() || '趣味', emoji: draft.emoji.trim() || '💌', questions, updatedAt: new Date().toISOString() });
  };

  return (
    <section className="qna-page">
      <div className="qna-topbar">
        <button type="button" onClick={onCancel} aria-label="返回" className="qna-back"><ArrowLeft size={15} /><span>手记</span></button>
        <h2>{isNew ? '新建题库' : '编辑题库'}</h2>
        <button type="button" onClick={save} className="qna-small-action"><Save size={13} />保存</button>
      </div>
      <div className="qna-content">
        <div className="qna-page-intro">
          <p className="qna-eyebrow"><Leaf size={12} strokeWidth={1.4} />A NOTE OF YOUR OWN</p>
          <h3>写一本，关于你们的问答。</h3>
          <p className="qna-muted">给小小的好奇取个名字，把想问的话留在纸上。</p>
        </div>
        {error && <p role="alert" className="qna-error">{error}</p>}
        <div className="qna-paper">
          <p className="qna-label">封面与名字</p>
          <div className="qna-editor-cover">
            <input aria-label="封面表情" value={draft.emoji} onChange={event => patch({ emoji: Array.from(event.target.value).slice(0, 2).join('') })} className={`${field} qna-emoji-field`} />
            <input aria-label="题库名称" value={draft.title} onChange={event => patch({ title: event.target.value.slice(0, 30) })} placeholder="题库名称" className={field} />
          </div>
          <textarea aria-label="题库简介" value={draft.description} onChange={event => patch({ description: event.target.value.slice(0, 120) })} placeholder="一句话介绍，写给即将翻开它的人（可选）" rows={2} className={field} />
          <div className="qna-field-group mt-5">
            <p className="qna-label">给它一个主题</p>
            <div className="qna-chips">
              {[...new Set([...QNA_CATEGORIES, draft.category].filter(Boolean))].map(category => (
                <button key={category} type="button" onClick={() => patch({ category })} aria-pressed={draft.category === category} className="qna-chip">{category}</button>
              ))}
            </div>
            <input aria-label="自定义类型" value={QNA_CATEGORIES.includes(draft.category) ? '' : draft.category} onChange={event => patch({ category: event.target.value.slice(0, 12) })} placeholder="或输入自定义类型" className={`${field} mt-3`} />
          </div>
        </div>

        {draft.questions.map((question, index) => (
          <div key={question.id} className="qna-paper">
            <div className="qna-editor-question-top">
              <span className="qna-editor-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="qna-type-switch">
                {(['choice', 'text'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setType(question, type)} aria-pressed={question.type === type}>{type === 'choice' ? '选择' : '填写'}</button>
                ))}
              </div>
              <div className="qna-editor-controls">
                <button type="button" aria-label="上移" disabled={index === 0} onClick={() => move(index, -1)} className="qna-icon-button"><ArrowUp size={14} /></button>
                <button type="button" aria-label="下移" disabled={index === draft.questions.length - 1} onClick={() => move(index, 1)} className="qna-icon-button"><ArrowDown size={14} /></button>
                <button type="button" aria-label="删除题目" onClick={() => patch({ questions: draft.questions.filter(item => item.id !== question.id) })} className="qna-icon-button qna-danger"><Trash2 size={14} /></button>
              </div>
            </div>
            <textarea aria-label={`第 ${index + 1} 题题目`} value={question.text} onChange={event => patchQuestion(question.id, { text: event.target.value.slice(0, 200) })} placeholder="有什么想问 TA 的？" rows={2} className={field} />
            {question.type === 'choice' && (
              <div className="qna-editor-options">
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="qna-editor-option">
                    <span className="qna-option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                    <input aria-label={`第 ${index + 1} 题选项 ${optionIndex + 1}`} value={option} onChange={event => patchQuestion(question.id, { options: question.options.map((item, i) => i === optionIndex ? event.target.value.slice(0, 60) : item) })} placeholder={`选项 ${optionIndex + 1}`} className={field} />
                    <button type="button" aria-label="删除选项" disabled={question.options.length <= 2} onClick={() => patchQuestion(question.id, { options: question.options.filter((_, i) => i !== optionIndex) })} className="qna-icon-button"><X size={14} /></button>
                  </div>
                ))}
                {question.options.length < QNA_MAX_OPTIONS && (
                  <button type="button" onClick={() => patchQuestion(question.id, { options: [...question.options, ''] })} className="qna-link"><Plus size={12} />添加选项</button>
                )}
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={addQuestion} className="qna-add-question"><Plus size={14} />再添一个小问题</button>
        <div className="qna-editor-footer"><button type="button" onClick={save} className="qna-primary qna-wide"><Save size={14} />保存这本问答集</button></div>
        <p className="qna-note"><Leaf size={12} />修改题库不会影响已经保存的问答记录。</p>
      </div>
    </section>
  );
}
