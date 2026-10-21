import { useState } from 'react';
import { showYyError } from './ErrorDialog';
import { JournalRegenerator } from './JournalRegenerator';
import { JOURNAL_LEVEL_LABEL } from '../utils/journalData';
import {
  deleteGroupJournalEntry, editGroupJournalEntry, readGroupJournal,
  runGroupJournal, setGroupJournalSettings, regenerateGroupJournal,
} from '../utils/groupJournal';

export const GroupJournalPanel = ({ chatId }: { chatId: string }) => {
  const [version, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [showMerged, setShowMerged] = useState(false);
  void version;
  let journal: ReturnType<typeof readGroupJournal>;
  try {
    journal = readGroupJournal(chatId);
  } catch (error) {
    return <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-500">
      {error instanceof Error ? error.message : String(error)}
    </p>;
  }
  const act = (action: () => void) => {
    try {
      action();
      refresh((value) => value + 1);
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '群聊流水账操作失败');
    }
  };
  const run = async (compressOnly = false) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await runGroupJournal(chatId, { compressOnly });
      setMessage(result.created || result.merged
        ? `新增 ${result.created} 篇，压缩合并 ${result.merged} 次`
        : compressOnly ? '还不需要压缩合并' : '没有足够的新消息可整理（至少 10 条）');
    } catch (error) {
      showYyError(error instanceof Error ? error.message : String(error), '整理群聊流水账失败');
    } finally {
      setBusy(false);
      refresh((value) => value + 1);
    }
  };
  return <section className="space-y-3 rounded-xl bg-slate-50 p-3">
    <h3 className="text-xs font-bold text-[#2C4A5C]">本群流水账</h3>
    <p className="text-[10px] leading-relaxed text-slate-500">
      普通群聊和旁观聊天均按本群、本存档独立保存。第三人称记录群名、成员、发言归属与约定；
      旧篇逐层压缩，只补充近期原文之外的部分。挂载本群时也会读取旧流水账，但不写入角色个人记忆。
      整理会调用记忆 API（未单独配置时使用主 API），不会删除聊天原文。
    </p>
    <label className="flex items-center gap-2 text-[11px] text-slate-600">
      <input type="checkbox" checked={journal.auto} disabled={busy}
        onChange={(event) => act(() => setGroupJournalSettings(chatId, { auto: event.target.checked }))} />
      本群自动整理（默认关闭，独立于其他群与单聊）
    </label>
    <label className="block text-[11px] text-slate-600">
      每累计 {journal.every} 条新消息整理一次
      <input type="range" min={30} max={400} step={10} value={journal.every} disabled={busy}
        className="mt-1 w-full"
        onChange={(event) => act(() => setGroupJournalSettings(chatId, { every: Number(event.target.value) }))} />
    </label>
    <p className="text-[10px] text-slate-500">本存档待整理 {journal.pending} 条；以下设置即时保存</p>
    <div className="flex gap-2">
      <button type="button" disabled={busy} onClick={() => void run()}
        className="rounded-full bg-sky-100 px-3 py-1.5 text-[11px] text-sky-700 disabled:opacity-50">
        {busy ? '整理中…' : '整理流水账'}
      </button>
      <button type="button" disabled={busy} onClick={() => void run(true)}
        className="rounded-full bg-white px-3 py-1.5 text-[11px] text-slate-600 disabled:opacity-50">压缩合并</button>
    </div>
    <JournalRegenerator key={chatId} total={journal.messageCount} busy={busy} onGenerate={async (range) => {
      if (busy) return;
      setBusy(true); setMessage('');
      try {
        const created = await regenerateGroupJournal(chatId, range);
        setMessage(`已重新生成 ${created} 篇，可在下方编辑`);
      } catch (error) {
        showYyError(error instanceof Error ? error.message : String(error), '重新生成群聊流水账失败');
      } finally { setBusy(false); refresh((value) => value + 1); }
    }} />
    {message && <p role="status" className="text-[10px] text-sky-600">{message}</p>}
    {journal.lastError && <p role="alert" className="text-[10px] text-rose-500">上次整理失败：{journal.lastError}</p>}
    {!journal.entries.length && <p className="text-[10px] text-slate-400">本存档还没有流水账，可手动整理已有群聊。</p>}
    <label className="flex items-center gap-2 text-[10px] text-slate-500">
      <input type="checkbox" checked={showMerged} onChange={(event) => setShowMerged(event.target.checked)} />
      显示已被压缩的原篇章
    </label>
    <div className="max-h-72 space-y-2 overflow-y-auto">
      {journal.entries.filter((entry) => showMerged || !entry.mergedInto).map((entry) =>
        <article key={entry.id} className={`space-y-2 rounded-xl bg-white p-3 ${entry.mergedInto ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>{JOURNAL_LEVEL_LABEL[entry.level]} · {entry.messageCount} 条 · {entry.from.slice(0, 10)} 至 {entry.to.slice(0, 10)}</span>
            <div className="flex shrink-0 gap-2">
              <button type="button" disabled={busy} onClick={() => setEditing({ id: entry.id, text: entry.content })}>编辑</button>
              <button type="button" disabled={busy} className="text-rose-400" onClick={() => {
                if (window.confirm('删除这篇流水账？不会删除聊天原文；它合并过的下层篇章会恢复。')) {
                  act(() => deleteGroupJournalEntry(chatId, entry.id));
                }
              }}>删除</button>
            </div>
          </div>
          <details className="text-[9px] text-slate-400">
            <summary>整理时的群聊来源与成员</summary>
            <p className="whitespace-pre-wrap break-words">{entry.source}</p>
          </details>
          {editing?.id === entry.id ? <div className="space-y-2">
            <textarea aria-label="群聊流水账正文" maxLength={4000} className="h-28 w-full rounded-lg border p-2 text-xs"
              value={editing.text} onChange={(event) => setEditing({ id: entry.id, text: event.target.value })} />
            <button type="button" className="mr-3 text-xs text-sky-600" onClick={() => act(() => {
              editGroupJournalEntry(chatId, entry.id, editing.text);
              setEditing(null);
            })}>保存</button>
            <button type="button" className="text-xs text-slate-500" onClick={() => setEditing(null)}>取消</button>
          </div> : <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">{entry.content}</p>}
        </article>)}
    </div>
  </section>;
};
