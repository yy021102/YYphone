import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { REGEX_EXAMPLE, REGEX_EXAMPLE_TEXT, saveChatRegex, validateChatRegex, type ChatRegexRule, type ChatRegexSettings } from '../utils/chatRegex';
import { RegexMessage } from './RegexMessage';

export function ChatRegexSettings({ settings, dark = false }: { settings: ChatRegexSettings; dark?: boolean }) {
  const [draft, setDraft] = useState<ChatRegexRule | null>(null), [text, setText] = useState(REGEX_EXAMPLE_TEXT);
  const [error, setError] = useState(''), [previewError, setPreviewError] = useState(''), [notice, setNotice] = useState('');
  const preview = useMemo<ChatRegexSettings>(() => ({ enabled: true, rules: draft ? [{ ...draft, enabled: true }] : [] }), [draft]);
  const save = (next: ChatRegexSettings) => { try { saveChatRegex(next); setError(''); setNotice('已保存'); return true; } catch (e) { setError(e instanceof Error ? e.message : '保存失败'); return false; } };
  const update = (patch: Partial<ChatRegexRule>) => { setDraft(current => current ? { ...current, ...patch } : current); setNotice(''); setError(''); };
  const move = (index: number, offset: number) => { const rules = [...settings.rules]; [rules[index], rules[index + offset]] = [rules[index + offset], rules[index]]; save({ ...settings, rules }); };
  const input = 'mt-1 w-full rounded-xl border border-white bg-white/80 px-3 py-2 text-xs text-slate-600 outline-none';
  return <div className="space-y-4 p-4 pb-8 text-[#566D7D]">
    <section className="rounded-[24px] border border-white bg-gradient-to-br from-pink-50/90 to-sky-50/90 p-4 shadow-sm">
      <label className="flex items-center justify-between gap-3 text-sm font-semibold">消息正则美化<input type="checkbox" aria-label="启用消息正则美化" checked={settings.enabled} onChange={e => save({ ...settings, enabled: e.target.checked })} /></label>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">匹配文字后显示为 HTML 卡片，原消息保留。按顺序使用首条匹配规则，仅处理普通文字消息。</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <button type="button" onClick={() => { setDraft({ ...REGEX_EXAMPLE, id: crypto.randomUUID(), enabled: true }); setText(REGEX_EXAMPLE_TEXT); setError(''); setNotice(''); }} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2"><Plus size={13} />新建规则</button>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white px-3 py-2"><Upload size={13} />导入规则<input aria-label="导入正则 JSON" type="file" accept=".json,application/json" className="hidden" onChange={async event => {
          const file = event.target.files?.[0]; event.currentTarget.value = ''; if (!file) return;
          try {
            if (file.size > 6000000) throw new Error('规则文件过大。');
            const raw = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
            if (raw.format !== 'yyphone-chat-regex' || raw.version !== 1) throw new Error('请选择歪歪机导出的正则文件。');
            const imported = validateChatRegex(raw.settings);
            if (save({ ...settings, rules: [...settings.rules, ...imported.rules.map(rule => ({ ...rule, id: crypto.randomUUID() }))] })) setNotice('规则已导入');
          } catch (e) { setError(e instanceof Error ? e.message : '导入失败'); }
        }} /></label>
        <button type="button" disabled={!settings.rules.length} onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'yyphone-chat-regex', version: 1, settings }, null, 2)], { type: 'application/json' }));
          const link = document.createElement('a'); link.href = url; link.download = 'yyphone-regex.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 disabled:opacity-40"><Download size={13} />导出规则</button>
      </div>
    </section>
    {settings.rules.map((rule, index) => <section key={rule.id} className="rounded-2xl border border-white bg-white/75 p-3">
      <div className="flex items-center gap-2"><input type="checkbox" aria-label={`启用${rule.name}`} checked={rule.enabled} onChange={e => save({ ...settings, rules: settings.rules.map(item => item.id === rule.id ? { ...item, enabled: e.target.checked } : item) })} />
        <strong className="min-w-0 flex-1 truncate text-xs">{rule.name}</strong>
        <button type="button" disabled={index === 0} aria-label={`上移${rule.name}`} onClick={() => move(index, -1)} className="p-1 disabled:opacity-25"><ArrowUp size={13} /></button>
        <button type="button" disabled={index === settings.rules.length - 1} aria-label={`下移${rule.name}`} onClick={() => move(index, 1)} className="p-1 disabled:opacity-25"><ArrowDown size={13} /></button>
        <button type="button" aria-label={`编辑${rule.name}`} onClick={() => { setDraft({ ...rule }); setNotice(''); }} className="p-1"><Pencil size={13} /></button>
        <button type="button" aria-label={`删除${rule.name}`} onClick={() => { if (window.confirm(`删除「${rule.name}」？原聊天消息不会被删除。`)) { save({ ...settings, rules: settings.rules.filter(item => item.id !== rule.id) }); if (draft?.id === rule.id) setDraft(null); } }} className="p-1 text-rose-400"><Trash2 size={13} /></button>
      </div><p className="mt-2 truncate font-mono text-[10px] text-slate-400">{rule.pattern}</p>
    </section>)}
    {!settings.rules.length && !draft && <p className="py-6 text-center text-xs text-slate-400">还没有规则，点「新建规则」试试来信示例。</p>}
    {draft && <section className="space-y-3 rounded-[24px] border border-white bg-white/65 p-4">
      <h3 className="text-sm font-semibold">规则编辑</h3>
      <label className="block text-[11px]">名称<input aria-label="正则规则名称" maxLength={80} value={draft.name} onChange={e => update({ name: e.target.value })} className={input} /></label>
      <label className="block text-[11px]">应用于<select aria-label="正则应用对象" value={draft.target} onChange={e => update({ target: e.target.value as ChatRegexRule['target'] })} className={input}><option value="character">角色消息</option><option value="user">我的消息</option><option value="both">双方消息</option></select></label>
      <label className="block text-[11px]">查找正则<textarea aria-label="查找正则" rows={3} maxLength={2000} value={draft.pattern} onChange={e => update({ pattern: e.target.value })} className={`${input} font-mono resize-y`} /></label>
      <label className="block text-[11px]">标志<input aria-label="正则标志" value={draft.flags} onChange={e => update({ flags: e.target.value })} className={`${input} font-mono`} /><span className="mt-1 block text-[10px] text-slate-400">g 全部匹配 · i 忽略大小写 · m 多行 · s 跨行 · u Unicode，也可填写 /表达式/g。</span></label>
      <label className="block text-[11px]">替换为 HTML<textarea aria-label="正则 HTML 模板" rows={9} maxLength={40000} value={draft.replacement} onChange={e => update({ replacement: e.target.value })} className={`${input} font-mono resize-y`} /></label>
      <p className="text-[10px] leading-relaxed text-slate-400">$1、$2 填入括号捕获的内容，$& 为完整匹配，$$ 为美元符号。支持 HTML 与 CSS 样式，不执行脚本或按钮功能。</p>
      <div className="space-y-2 rounded-2xl bg-gradient-to-br from-pink-50 to-sky-50 p-3">
        <label className="block text-[11px]">测试消息<textarea aria-label="正则测试消息" rows={4} maxLength={20000} value={text} onChange={e => setText(e.target.value)} className={`${input} resize-y`} /></label>
        <p className="text-[10px] text-slate-400">预览</p>
        <div className="whitespace-pre-wrap rounded-xl bg-white/70 p-2 text-xs"><RegexMessage text={text} sender={draft.target === 'user' ? 'user' : 'character'} settings={preview} dark={dark} onError={setPreviewError} /></div>
        {previewError && <p className="text-[10px] text-rose-500">{previewError}</p>}
      </div>
      <details className="text-[10px] text-slate-400"><summary className="cursor-pointer">让角色发出示例格式</summary><p className="mt-2 whitespace-pre-wrap leading-relaxed">在角色人设、世界书或聊天补充中约定：想写信时，用 [信件]标题|正文[/信件] 输出一条普通文字消息。标签格式与正则需对应。保存规则后，符合格式的旧消息也会显示美化。</p></details>
      <div className="flex gap-2"><button type="button" onClick={() => {
        const existing = settings.rules.some(rule => rule.id === draft.id);
        if (save({ ...settings, rules: existing ? settings.rules.map(rule => rule.id === draft.id ? draft : rule) : [...settings.rules, draft] })) setDraft(null);
      }} className="flex-1 rounded-xl bg-gradient-to-r from-sky-200 to-pink-200 py-2.5 text-xs font-semibold">保存规则</button><button type="button" onClick={() => setDraft(null)} className="px-3 text-xs text-slate-400">取消</button></div>
    </section>}
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    {notice && <p role="status" className="text-xs text-sky-700">{notice}</p>}
  </div>;
}
