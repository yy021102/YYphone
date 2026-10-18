import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { CoupleRecordEdit } from '../utils/coupleRecords';

interface Props {
  initial: CoupleRecordEdit;
  onSave: (edit: CoupleRecordEdit) => void;
  onClose: () => void;
  moods: Array<{ id: string; label: string; kaomoji: string }>;
}

export const CoupleRecordEditor: React.FC<Props> = ({ initial, onSave, onClose, moods }) => {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const field = (label: string, value: string, change: (value: string) => void, type = 'text') => (
    <label className="block text-xs text-slate-600">
      {label}
      {type === 'textarea' ? (
        <textarea aria-label={label} rows={4} value={value} onChange={(event) => change(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs" />
      ) : (
        <input aria-label={label} type={type} value={value} onChange={(event) => change(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs" />
      )}
    </label>
  );
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-label="编辑情侣空间记录"
        className="max-h-[90%] w-full max-w-sm space-y-3 overflow-y-auto rounded-3xl bg-white p-5 shadow-xl">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">编辑情侣空间记录</h3>
          <button type="button" onClick={onClose} aria-label="关闭记录编辑"><X className="h-4 w-4 text-slate-500" /></button>
        </header>
        {field('记录日期', draft.date, (date) => setDraft({ ...draft, date }), 'date')}
        {draft.kind === 'mood' && (
          <>
            <label className="block text-xs text-slate-600">
              {draft.author === 'user' ? '我的心情' : '角色的心情'}
              <select aria-label={draft.author === 'user' ? '我的心情' : '角色的心情'}
                value={draft.moodId} onChange={(event) => setDraft({ ...draft, moodId: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2">
                {moods.map((mood) => <option key={mood.id} value={mood.id}>{mood.label} {mood.kaomoji}</option>)}
              </select>
            </label>
            {field('心情小记', draft.note, (note) => setDraft({ ...draft, note }), 'textarea')}
            <p className="text-[10px] text-slate-500">更改日期只移动这一方的心情，另一方保持不变；目标日期已有同一方记录时不会覆盖。</p>
          </>
        )}
        {draft.kind === 'diary' && (
          <>
            {field('作者显示名', draft.authorName, (authorName) => setDraft({ ...draft, authorName }))}
            {field('日记标题', draft.title, (title) => setDraft({ ...draft, title }))}
            {field('日记正文', draft.content, (content) => setDraft({ ...draft, content }), 'textarea')}
            {field('角色回复批注', draft.replyComment, (replyComment) => setDraft({ ...draft, replyComment }), 'textarea')}
          </>
        )}
        {draft.kind === 'qa' && (
          <>
            {field('问题', draft.question, (question) => setDraft({ ...draft, question }))}
            {field('我的回答', draft.userAnswer, (userAnswer) => setDraft({ ...draft, userAnswer }), 'textarea')}
            {field('角色的回答', draft.charAnswer, (charAnswer) => setDraft({ ...draft, charAnswer }), 'textarea')}
          </>
        )}
        {draft.kind === 'note' && (
          <>
            {field('作者显示名', draft.authorName, (authorName) => setDraft({ ...draft, authorName }))}
            {field('便签正文', draft.content, (content) => setDraft({ ...draft, content }), 'textarea')}
            {field('便签颜色', draft.colorBg, (colorBg) => setDraft({ ...draft, colorBg }), 'color')}
          </>
        )}
        {draft.kind === 'anniversary' && (
          <>
            {field('纪念日标题', draft.title, (title) => setDraft({ ...draft, title }))}
            <label className="block text-xs text-slate-600">纪念日类型
              <select aria-label="纪念日类型" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value === 'elapsed' ? 'elapsed' : 'countdown' })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2">
                <option value="countdown">倒计时</option><option value="elapsed">已过去</option>
              </select>
            </label>
          </>
        )}
        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
        <button type="button" onClick={() => {
          try {
            onSave(draft);
          } catch (error) {
            console.error('Could not edit couple space record.', error);
            setError(error instanceof Error ? error.message : '记录保存失败，请重试。');
          }
        }} className="w-full rounded-xl bg-sky-600 py-2 text-xs font-bold text-white">保存记录</button>
      </section>
    </div>
  );
};
