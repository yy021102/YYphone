import React, { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { showYyError } from './ErrorDialog';
import { JournalRegenerator } from './JournalRegenerator';
import { JournalSummaryText } from './JournalSummaryText';
import {
  activateGrowthNote,
  archiveGrowthNote,
  compressJournal,
  deleteGrowthNote,
  generateGrowthNote,
  growthStatus,
  runJournal,
  regenerateJournal,
  updateActiveGrowthNote,
  updateJournalEntryContent,
} from '../utils/journalAi';
import {
  countPendingForJournal,
  deleteJournalEntry,
  entriesOf,
  GrowthNote,
  JOURNAL_LEVEL_LABEL,
  JournalEntry,
  JournalLevel,
  JournalSettings,
  readGrowthNotes,
  readDirectMessages,
  readJournalSettings,
  writeJournalSettings,
} from '../utils/journalData';

const cardClass = 'memory-card rounded-[22px] border border-white/90 bg-white/75 backdrop-blur-xl shadow-[0_6px_20px_-10px_rgba(148,163,184,0.3)]';
const pillBtn = 'rounded-full border border-white bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#6F7F8E] active:scale-95 disabled:opacity-50';
const gradBtn = 'rounded-full bg-gradient-to-r from-[#F5C6D6] to-[#BFD9F0] px-4 py-2 text-xs font-bold text-[#5F6F7E] active:scale-95 disabled:opacity-50';
const inputClass = 'w-full rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-700 outline-none focus:border-pink-200';

interface PanelProps {
  charId: string;
  charName: string;
  flash: (text: string) => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
};
const spanText = (e: JournalEntry) => (fmtDate(e.from) === fmtDate(e.to) ? fmtDate(e.from) : `${fmtDate(e.from)}–${fmtDate(e.to)}`);

// ==================== 流水账 ====================
export const JournalPanel: React.FC<PanelProps> = ({ charId, charName, flash }) => {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [showMerged, setShowMerged] = useState(false);
  const refresh = () => setVersion((v) => v + 1);
  void version;

  const settings = readJournalSettings();
  const [promptDraft, setPromptDraft] = useState(settings.journalPrompt);
  useEffect(() => setPromptDraft(settings.journalPrompt), [settings.journalPrompt]);
  const patchSettings = (patch: Partial<JournalSettings>) => {
    writeJournalSettings({ ...readJournalSettings(), ...patch });
    refresh();
  };
  const entries = entriesOf(charId);
  const pending = countPendingForJournal(charId, settings);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { created, merged } = await runJournal(charId);
      flash(created === 0 && merged === 0 ? '没有足够的新消息可以整理（至少 10 条）' : `新增 ${created} 篇${merged > 0 ? `，压缩合并 ${merged} 次` : ''}`);
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '整理流水账失败');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const compressOnly = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const merged = await compressJournal(charId);
      flash(merged === 0 ? '还没有超出上限的篇章，不需要压缩' : `压缩合并了 ${merged} 次`);
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '压缩流水账失败');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const renderEntry = (entry: JournalEntry, dim = false) => (
    <div key={entry.id} className={`${cardClass} p-3.5 ${dim ? 'opacity-55' : ''}`}>
      <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-400">
        <span>
          <span className="mr-1.5 rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-[#5B7485]">{JOURNAL_LEVEL_LABEL[entry.level]}</span>
          {spanText(entry)} · {entry.messageCount} 条消息
        </span>
        <span className="flex gap-0.5">
          <button type="button" aria-label="编辑" onClick={() => setEditing({ id: entry.id, text: entry.content })} className="rounded-full p-1.5 text-slate-400 hover:bg-white"><Pencil className="h-3 w-3" /></button>
          <button
            type="button"
            aria-label="删除"
            onClick={() => {
              if (!window.confirm('删除这一篇？（它合并过的下层记录会恢复为未合并）')) return;
              deleteJournalEntry(entry.id);
              refresh();
            }}
            className="rounded-full p-1.5 text-rose-300 hover:bg-white"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      </div>
      {editing?.id === entry.id ? (
        <div className="space-y-2">
          <textarea aria-label="个人流水账正文" maxLength={20000} className={`${inputClass} h-32 resize-none leading-relaxed`} value={editing.text} onChange={(e) => setEditing({ id: entry.id, text: e.target.value })} />
          <div className="flex gap-2">
            <button
              type="button"
              className={gradBtn}
              onClick={() => {
                try {
                  updateJournalEntryContent(entry.id, editing.text);
                  setEditing(null);
                  refresh();
                } catch (error) {
                  showYyError(error instanceof Error ? error.message : String(error), '保存流水账失败');
                }
              }}
            >
              保存
            </button>
            <button type="button" className={pillBtn} onClick={() => setEditing(null)}>取消</button>
          </div>
        </div>
      ) : (
        <JournalSummaryText content={entry.content} />
      )}
    </div>
  );

  const levels: JournalLevel[] = [3, 2, 1];
  const merged = entries.filter((e) => e.mergedInto);

  return (
    <div className="space-y-3">
      <div className={`${cardClass} space-y-2.5 p-3.5`}>
        <p className="text-sm font-bold text-[#4A5A6A]">{charName}的流水账</p>
        <p className="text-[10px] leading-relaxed text-slate-400">
          按聊天条数把相处经历一篇篇记下来，越老的越压缩，总量不会无限变长。注入提示词时，只带「不在最近原文窗口里」的部分，不和原文重复。
        </p>
        <p className="text-[11px] text-slate-500">待整理的新消息 {pending} 条</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={gradBtn} disabled={busy} onClick={() => void run()}>{busy ? '整理中…' : '整理流水账'}</button>
          <button type="button" className={pillBtn} disabled={busy} onClick={() => void compressOnly()}>压缩合并</button>
        </div>
        <JournalRegenerator key={charId} total={readDirectMessages(charId).length} busy={busy} batchSize={settings.journalEvery} onGenerate={async (range) => {
          if (busy) return;
          setBusy(true);
          try {
            const created = await regenerateJournal(charId, range);
            flash(`已重新生成 ${created} 篇流水账，可点篇章右上角铅笔编辑`);
          } catch (error) {
            showYyError(error instanceof Error ? error.message : String(error), '重新生成流水账失败');
          } finally { setBusy(false); refresh(); }
        }} />
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={settings.journalAuto} onChange={(e) => patchSettings({ journalAuto: e.target.checked })} />
          <span>自动整理：聊天累计到一定条数后，后台写一篇（会额外消耗请求）</span>
        </label>
        <label className="block space-y-1 text-xs text-slate-600">
          <span>每累计 {settings.journalEvery} 条新消息写一篇</span>
          <input type="range" min={30} max={400} step={10} disabled={busy} className="w-full" value={settings.journalEvery} onChange={(e) => patchSettings({ journalEvery: Number(e.target.value) })} />
        </label>
        <label className="block space-y-1 text-xs text-slate-600">
          <span>每篇流水账最多 {settings.journalMaxChars} 字（个人与群聊共用）</span>
          <input aria-label="流水账字数上限" type="range" min={200} max={1200} step={100} disabled={busy} className="w-full" value={settings.journalMaxChars} onChange={e => patchSettings({ journalMaxChars: Number(e.target.value) })} />
        </label>
        <p className="text-[10px] leading-relaxed text-slate-400">自动整理每 {settings.journalEvery} 条生成一篇；手动整理将待整理聊天合为一篇，指定范围重做也只生成一篇。阶段/长篇回顾分别最多 {Math.round(settings.journalMaxChars * 1.5)} / {settings.journalMaxChars * 2} 字。字数设置仅影响新生成内容。</p>
        {settings.lastError && <p className="rounded-xl bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-400">上次自动整理失败：{settings.lastError}</p>}
      </div>

      {entries.length === 0 && (
        <div className={`${cardClass} p-6 text-center text-[11px] leading-relaxed text-slate-400`}>还没有流水账，点「整理流水账」，或者等聊天累计到设定条数后自动生成。</div>
      )}

      <details className={`${cardClass} memory-prompt-editor p-4`}>
        <summary className="cursor-pointer text-xs font-bold text-[#6F7F8E]">总结提示词 <span className="ml-1 font-normal text-slate-400">{settings.journalPrompt ? '自定义已启用' : '使用默认写法'}</span></summary>
        <p className="my-3 text-[11px] leading-relaxed text-slate-500">可指定人称、语气、格式、重点和详略。个人与群聊的自动、手动、重做及压缩合并都会采用；字数仍遵循上方设置，旧篇不会自动改写。</p>
        <textarea aria-label="流水账总结提示词" value={promptDraft} onChange={event => setPromptDraft(event.target.value)} maxLength={6000} rows={6} disabled={busy}
          placeholder="例如：用第一人称写成简短日记，按日期分段。重点保留关系变化、重要对话和未完成的约定，语气自然，不重复琐碎寒暄。留空则使用默认总结规则。"
          className={`${inputClass} resize-y leading-relaxed`} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} className={gradBtn} onClick={() => { patchSettings({ journalPrompt: promptDraft.trim() }); flash('总结提示词已保存，新生成的流水账会按此整理'); }}>保存总结提示词</button>
          <button type="button" disabled={busy} className={pillBtn} onClick={() => { setPromptDraft(''); patchSettings({ journalPrompt: '' }); flash('已恢复默认总结提示词'); }}>恢复默认提示词</button>
        </div>
      </details>

      {levels.map((level) => {
        const list = entries.filter((e) => e.level === level && !e.mergedInto);
        if (list.length === 0) return null;
        return (
          <div key={level} className="space-y-2">
            <p className="px-1 text-[11px] font-semibold text-slate-400">{JOURNAL_LEVEL_LABEL[level]}（{list.length}）</p>
            {list.map((e) => renderEntry(e))}
          </div>
        );
      })}

      {merged.length > 0 && (
        <div className="space-y-2">
          <button type="button" className={pillBtn} onClick={() => setShowMerged((v) => !v)}>
            {showMerged ? '收起' : '查看'}已合并的原始记录（{merged.length}）
          </button>
          {showMerged && merged.map((e) => renderEntry(e, true))}
        </div>
      )}
    </div>
  );
};

// ==================== 成长笔记 ====================
const NoteFields: React.FC<{
  note: GrowthNote;
  draft: { relationship: string; changes: string; habits: string };
  onChange: (draft: { relationship: string; changes: string; habits: string }) => void;
}> = ({ draft, onChange }) => (
  <div className="space-y-2 text-xs">
    <label className="block space-y-1">
      <span className="font-semibold text-slate-600">关系现状</span>
      <textarea className={`${inputClass} h-14 resize-none`} value={draft.relationship} onChange={(e) => onChange({ ...draft, relationship: e.target.value })} />
    </label>
    <label className="block space-y-1">
      <span className="font-semibold text-slate-600">近来的变化</span>
      <textarea className={`${inputClass} h-24 resize-none`} value={draft.changes} onChange={(e) => onChange({ ...draft, changes: e.target.value })} />
    </label>
    <label className="block space-y-1">
      <span className="font-semibold text-slate-600">你们之间的默契</span>
      <textarea className={`${inputClass} h-20 resize-none`} value={draft.habits} onChange={(e) => onChange({ ...draft, habits: e.target.value })} />
    </label>
  </div>
);

export const GrowthPanel: React.FC<PanelProps> = ({ charId, charName, flash }) => {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { relationship: string; changes: string; habits: string }>>({});
  const [showHistory, setShowHistory] = useState(false);
  const refresh = () => setVersion((v) => v + 1);
  void version;

  const settings = readJournalSettings();
  const patchSettings = (patch: Partial<JournalSettings>) => {
    writeJournalSettings({ ...readJournalSettings(), ...patch });
    refresh();
  };
  const notes = readGrowthNotes().filter((n) => n.charId === charId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pendingNote = notes.find((n) => n.status === 'pending');
  const activeNote = notes.find((n) => n.status === 'active');
  const archived = notes.filter((n) => n.status === 'archived');
  const status = growthStatus(charId);

  const draftOf = (note: GrowthNote) =>
    drafts[note.id] ?? { relationship: note.relationship, changes: note.changes, habits: note.habits };
  const setDraft = (note: GrowthNote, draft: { relationship: string; changes: string; habits: string }) =>
    setDrafts((prev) => ({ ...prev, [note.id]: draft }));

  const generate = async () => {
    if (busy) return;
    if (pendingNote && !window.confirm('已经有一份待确认的笔记，再生成会多出一份。继续吗？')) return;
    setBusy(true);
    try {
      const note = await generateGrowthNote(charId);
      flash(note.status === 'pending' ? '已生成，请确认后生效' : '已生成并生效');
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '整理成长笔记失败');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="space-y-3">
      <div className={`${cardClass} space-y-2.5 p-3.5`}>
        <p className="text-sm font-bold text-[#4A5A6A]">{charName}的成长笔记</p>
        <p className="text-[10px] leading-relaxed text-slate-400">
          随着相处，{charName}会有一些幽微的变化：习惯、关注点、默契，不一定是性格。它是独立的一层，不会改动人设卡；生效后每轮聊天都会带上。
        </p>
        <p className="text-[11px] text-slate-500">
          距上次整理 {status.days} 天 · 之后新消息 {status.newMessages} 条
          {status.due && <span className="ml-1 text-pink-400">· 可以整理了</span>}
        </p>
        <button type="button" className={gradBtn} disabled={busy} onClick={() => void generate()}>{busy ? '整理中…' : '整理成长笔记'}</button>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={settings.growthConfirm} onChange={(e) => patchSettings({ growthConfirm: e.target.checked })} />
          <span>生成后先让我确认再生效</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={settings.growthAuto} onChange={(e) => patchSettings({ growthAuto: e.target.checked })} />
          <span>到时间后自动整理一份（至少聊了 80 条新消息）</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span>间隔</span>
          <select className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs" value={settings.growthIntervalDays} onChange={(e) => patchSettings({ growthIntervalDays: Number(e.target.value) })}>
            {[7, 14, 30, 60].map((d) => <option key={d} value={d}>{d} 天</option>)}
          </select>
        </label>
        {settings.lastError && <p className="rounded-xl bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-400">上次自动整理失败：{settings.lastError}</p>}
      </div>

      {pendingNote && (
        <div className={`${cardClass} space-y-2.5 border-pink-200 p-3.5`}>
          <p className="text-xs font-bold text-pink-400">待确认的新笔记（可以直接修改）</p>
          <NoteFields note={pendingNote} draft={draftOf(pendingNote)} onChange={(d) => setDraft(pendingNote, d)} />
          <div className="flex gap-2">
            <button
              type="button"
              className={gradBtn}
              onClick={() => {
                activateGrowthNote(pendingNote.id, draftOf(pendingNote));
                flash('已生效，下次聊天起就会带上');
                refresh();
              }}
            >
              采纳并生效
            </button>
            <button type="button" className={pillBtn} onClick={() => { deleteGrowthNote(pendingNote.id); refresh(); }}>丢弃</button>
          </div>
        </div>
      )}

      {activeNote ? (
        <div className={`${cardClass} space-y-2.5 p-3.5`}>
          <p className="text-xs font-bold text-[#5B7485]">当前生效的笔记 · {activeNote.createdAt.slice(0, 10)}</p>
          <NoteFields note={activeNote} draft={draftOf(activeNote)} onChange={(d) => setDraft(activeNote, d)} />
          <div className="flex gap-2">
            <button type="button" className={gradBtn} onClick={() => { updateActiveGrowthNote(activeNote.id, draftOf(activeNote)); flash('已保存'); refresh(); }}>保存修改</button>
            <button
              type="button"
              className={pillBtn}
              onClick={() => {
                if (!window.confirm('停用后，TA 不再带着这份变化聊天（笔记会保留在历史里）。')) return;
                archiveGrowthNote(activeNote.id);
                refresh();
              }}
            >
              停用
            </button>
          </div>
        </div>
      ) : (
        !pendingNote && <div className={`${cardClass} p-6 text-center text-[11px] leading-relaxed text-slate-400`}>还没有生效的成长笔记。</div>
      )}

      {archived.length > 0 && (
        <div className="space-y-2">
          <button type="button" className={pillBtn} onClick={() => setShowHistory((v) => !v)}>{showHistory ? '收起' : '查看'}历史版本（{archived.length}）</button>
          {showHistory && archived.map((note) => (
            <div key={note.id} className={`${cardClass} space-y-1.5 p-3.5 opacity-80`}>
              <p className="text-[10px] text-slate-400">{note.createdAt.slice(0, 10)}</p>
              {note.relationship && <p className="text-[12px] leading-relaxed text-slate-600">关系：{note.relationship}</p>}
              {note.changes && <p className="text-[12px] leading-relaxed text-slate-600">变化：{note.changes}</p>}
              {note.habits && <p className="text-[12px] leading-relaxed text-slate-600">默契：{note.habits}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" className={pillBtn} onClick={() => { activateGrowthNote(note.id); flash('已恢复为当前版本'); refresh(); }}>恢复这一版</button>
                <button type="button" className="rounded-full border border-white bg-rose-50 px-3 py-1.5 text-[11px] text-rose-400" onClick={() => { deleteGrowthNote(note.id); refresh(); }}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
