import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { availableSearchTools, defaultMcpTriggerRules, parseMcpKeywords, type McpSettings, type McpTriggerRule } from '../utils/mcpTools';

export function McpTriggerSettings({ settings, onChange }: { settings: McpSettings; onChange: (settings: McpSettings) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const rules = settings.triggerRules ?? defaultMcpTriggerRules(), tools = availableSearchTools(settings);
  const saveRules = (next: McpTriggerRule[]) => onChange({ ...settings, triggerRules: next });
  const update = (id: string, patch: Partial<McpTriggerRule>) => saveRules(rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule));
  return <div className="space-y-3">
    <label className="flex items-center justify-between text-xs text-slate-600">启用 AI 决策<input aria-label="启用 AI 决策" type="checkbox" checked={settings.decisionEnabled !== false} onChange={event => onChange({ ...settings, decisionEnabled: event.target.checked })}/></label>
    <p className="text-[10px] leading-relaxed text-slate-400">关闭后只按网页链接与关键词查询，不额外请求决策模型。开启后，未命中的消息由主或副 API 判断。</p>
    <details className="rounded-2xl bg-white/60 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-slate-600">关键词触发</summary>
      <div className="mt-3 space-y-3">
        <p className="text-[10px] leading-relaxed text-slate-400">命中后直接调用对应工具。搜索内容写在关键词后，例如「去搜 猫能吃南瓜吗」。只匹配当前消息。</p>
        {rules.map((rule, index) => <div key={rule.id} className="space-y-2 rounded-xl border border-white bg-sky-50/60 p-3">
          <div className="flex items-center gap-2"><label className="min-w-0 flex-1 text-[11px] text-slate-600">查询工具<select aria-label={`关键词规则${index + 1}工具`} value={rule.toolId} onChange={event => update(rule.id, { toolId: event.target.value })} className="mt-1 w-full rounded-xl border border-white bg-white/70 p-2 text-xs text-slate-700 outline-none">
            <option value="@hot">热搜（自动选择）</option><option value="@search">搜索（自动选择）</option>
            {!['@hot', '@search'].includes(rule.toolId) && !tools.some(tool => tool.id === rule.toolId) && <option value={rule.toolId}>原工具已停用或删除</option>}
            {tools.map(tool => <option value={tool.id} key={tool.id}>{tool.name}</option>)}
          </select></label><button type="button" aria-label={`删除关键词规则${index + 1}`} onClick={() => saveRules(rules.filter(item => item.id !== rule.id))} className="mt-4 rounded-lg p-2 text-slate-400"><Trash2 size={14}/></button></div>
          <label className="block text-[11px] text-slate-600">触发关键词<textarea aria-label={`关键词规则${index + 1}关键词`} rows={2} value={drafts[rule.id] ?? rule.keywords.join('、')} onChange={event => {
            const value = event.target.value; setDrafts(current => ({ ...current, [rule.id]: value }));
            update(rule.id, { keywords: parseMcpKeywords(value).filter(word => word.length <= 100).slice(0, 100) });
          }} onBlur={() => setDrafts(current => { const next = { ...current }; delete next[rule.id]; return next; })} placeholder="用逗号或换行分隔" className="mt-1 w-full resize-y rounded-xl border border-white bg-white/70 p-2 text-xs leading-relaxed text-slate-700 outline-none"/></label>
        </div>)}
        <div className="flex gap-2"><button type="button" disabled={rules.length >= 50} onClick={() => saveRules([...rules, { id: crypto.randomUUID(), toolId: '@search', keywords: [] }])} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-sky-100 py-2 text-[11px] text-sky-700 disabled:opacity-50"><Plus size={13}/>添加规则</button><button type="button" onClick={() => { setDrafts({}); saveRules(defaultMcpTriggerRules()); }} className="rounded-xl bg-white/80 px-3 py-2 text-[11px] text-slate-500">恢复默认关键词</button></div>
      </div>
    </details>
  </div>;
}
