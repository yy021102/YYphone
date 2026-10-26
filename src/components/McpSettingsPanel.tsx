import { useState } from 'react';
import { ChevronDown, Globe, Plus, Trash2 } from 'lucide-react';
import { executeSearchTool, isBuiltinSearchTool, listMcpTools, newSearchTool, readMcpSettings, saveMcpSettings, type McpSettings, type SearchProvider, type SearchTool } from '../utils/mcpTools';

const providers: Array<[SearchProvider, string]> = [['tavily', 'Tavily Search'], ['bocha', '博查搜索（REST）'], ['exa', 'Exa 语义搜索'], ['rest', '自定义 REST'], ['mcp', '远程 MCP（HTTP）']];
const inputClass = 'mt-1 w-full min-w-0 rounded-xl border border-white bg-white/70 px-3 py-2 text-xs text-slate-700 outline-none';
export function McpSettingsPanel() {
  const [settings, setSettings] = useState(readMcpSettings);
  const [provider, setProvider] = useState<SearchProvider>('tavily');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState<Record<string, string>>({});
  const [discovered, setDiscovered] = useState<Record<string, Awaited<ReturnType<typeof listMcpTools>>>>({});
  const save = (next: McpSettings) => { try { saveMcpSettings(next); setSettings(next); } catch { setStatus(s => ({ ...s, global: '保存失败，请检查存储空间。' })); } };
  const update = (id: string, change: Partial<SearchTool>) => save({ ...settings, tools: settings.tools.map(t => t.id === id ? { ...t, ...change } : t) });
  const field = (label: string, value: string, change: (v: string) => void, type = 'text', placeholder = '') => <label className="block text-[11px] text-slate-600">{label}<input aria-label={label} type={type} value={value} onChange={e => change(e.target.value)} placeholder={placeholder} className={inputClass} autoComplete="off" /></label>;
  const area = (label: string, value: string, change: (v: string) => void) => <label className="block text-[11px] text-slate-600">{label}<textarea aria-label={label} rows={3} value={value} onChange={e => change(e.target.value)} className={`${inputClass} font-mono`} /></label>;
  const test = async (tool: SearchTool) => {
    setBusy(tool.id); setStatus(s => ({ ...s, [tool.id]: '' }));
    try {
      if (tool.provider === 'mcp') {
        const tools = await listMcpTools(tool); setDiscovered(s => ({ ...s, [tool.id]: tools }));
        setStatus(s => ({ ...s, [tool.id]: tools.length ? '已连接，请选择查询工具。' : '已连接，服务没有提供工具。' }));
      } else {
        const result = await executeSearchTool(tool, ['reader', 'summary'].includes(tool.provider) ? 'https://example.com' : tool.provider === 'wiki' ? '猫' : ['hot', 'builtin-hot'].includes(tool.provider) ? '微博热搜' : '今天天气');
        let preview = result.slice(0, 240);
        if (isBuiltinSearchTool(tool)) {
          const data = JSON.parse(result);
          preview = tool.provider === 'builtin-hot' ? data.boards.map((b: { platform: string }) => b.platform).join('、')
            : tool.provider === 'wiki' ? data.results.map((p: { title: string }) => p.title).join('、') || '接口正常，未找到相关词条'
            : tool.provider === 'reader' ? '网页正文已读取' : '网页标题和简介已获取';
        }
        setStatus(s => ({ ...s, [tool.id]: `连接成功 · ${preview}` }));
      }
    } catch (e) { setStatus(s => ({ ...s, [tool.id]: e instanceof TypeError ? '无法连接。请检查地址、网络，以及接口是否允许浏览器跨域访问。' : e instanceof Error && /^(MCP|工具|接口|请|没有|服务|请求头|参数)/.test(e.message) ? e.message : '连接失败，请检查地址、密钥和参数。' })); }
    finally { setBusy(''); }
  };
  return <details open={settings.expanded} onToggle={e => { if (e.currentTarget.open !== settings.expanded) save({ ...settings, expanded: e.currentTarget.open }); }} className="settings-card settings-model-panel" data-tone="blue">
    <summary className="settings-panel-heading"><span className="settings-icon"><Globe size={18} strokeWidth={1.7} /></span><span className="settings-heading-copy"><strong>MCP 与搜索工具</strong><small>按需查询与联网工具</small></span><ChevronDown size={16} className="settings-chevron" /></summary>
    <div className="settings-panel-body space-y-4">
      <label className="flex items-center justify-between text-xs text-slate-600">启用工具服务<input aria-label="启用工具服务" type="checkbox" checked={settings.enabled} onChange={e => save({ ...settings, enabled: e.target.checked })} /></label>
      <p className="text-[10px] leading-relaxed text-slate-400">在角色的对话设置中开启后，由决策模型按需查询。外部搜索只发送查询词；决策模型会读取最近几条对话。</p>
      <details className="rounded-2xl bg-sky-50/60 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">决策副 API</summary><div className="mt-3 space-y-3">
        <p className="text-[10px] text-slate-400">全部留空使用当前主 API；填写后使用独立的副 API 判断是否调用工具。</p>
        {field('决策 API 地址', settings.decisionApi.endpoint, endpoint => save({ ...settings, decisionApi: { ...settings.decisionApi, endpoint } }), 'url', 'https://…/v1')}
        {field('决策 API Key', settings.decisionApi.apiKey, apiKey => save({ ...settings, decisionApi: { ...settings.decisionApi, apiKey } }), 'password')}
        {field('决策模型', settings.decisionApi.model || '', model => save({ ...settings, decisionApi: { ...settings.decisionApi, model } }))}
      </div></details>
      <details aria-label="内置免 Key 工具" open={settings.builtinExpanded !== false} onToggle={e => { if (e.currentTarget.open !== (settings.builtinExpanded !== false)) save({ ...settings, builtinExpanded: e.currentTarget.open }); }} className="space-y-2 rounded-2xl bg-[#f1f6f5]/70 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">内置工具 <span className="ml-1 text-[10px] font-normal text-slate-400">免 Key</span></summary>
        {settings.tools.filter(isBuiltinSearchTool).map(tool => <div key={tool.id} className="rounded-xl bg-white/70 p-3">
          <label className="flex items-center justify-between gap-2 text-xs text-slate-600">{tool.name}<input aria-label={`启用内置${tool.name}`} type="checkbox" checked={tool.enabled} onChange={e => update(tool.id, { enabled: e.target.checked })} /></label>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{tool.provider === 'builtin-hot' ? '微博、百度、知乎、抖音、B站' : tool.provider === 'wiki' ? '维基百科词条与介绍' : tool.provider === 'reader' ? '将网页正文转换为 Markdown' : '仅获取网页标题和简介，适用于无法读取全文时'}</p>
          <button type="button" disabled={!!busy} onClick={() => void test(tool)} className="mt-2 text-[10px] text-sky-700 disabled:opacity-40" aria-label={`测试${tool.name}`}>{busy === tool.id ? '测试中…' : '测试'}</button>
          {status[tool.id] && <p role="status" className="mt-1 break-words text-[10px] text-slate-500">{status[tool.id]}</p>}
        </div>)}
      </details>
      <div className="flex gap-2"><select aria-label="工具类型" className={`${inputClass} mt-0 flex-1`} value={provider} onChange={e => setProvider(e.target.value as SearchProvider)}>{providers.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button type="button" onClick={() => save({ ...settings, tools: [...settings.tools, newSearchTool(provider)] })} className="flex items-center gap-1 rounded-xl bg-[#dfeaf0] px-3 text-xs text-slate-600"><Plus size={14} />添加</button></div>
      {settings.tools.filter(tool => !isBuiltinSearchTool(tool)).map(tool => <details key={tool.id} className="rounded-2xl border border-white bg-white/60 p-3"><summary className="cursor-pointer truncate text-xs font-semibold text-slate-600">{tool.name || '未命名工具'}<span className="ml-2 text-[10px] font-normal text-slate-400">{tool.enabled ? '已启用' : '已停用'}</span></summary><div className="mt-3 space-y-3">
        <label className="flex items-center justify-between text-xs text-slate-600">启用此工具<input type="checkbox" aria-label={`启用${tool.name}`} checked={tool.enabled} onChange={e => update(tool.id, { enabled: e.target.checked })} /></label>
        {field(`${tool.name}名称`, tool.name, name => update(tool.id, { name }))}
        {field(`${tool.name}用途`, tool.description, description => update(tool.id, { description }))}
        {field(`${tool.name}接口地址`, tool.endpoint, endpoint => update(tool.id, { endpoint }), 'url')}
        {field(`${tool.name}API Key`, tool.apiKey, apiKey => update(tool.id, { apiKey }), 'password')}
        {tool.provider === 'mcp' ? <>
          <p className="text-[10px] text-slate-400">支持 Streamable HTTP。填写远程 /mcp 地址，仅添加用于查询的工具；本地 stdio 服务需通过 HTTP 网关连接。</p>
          {discovered[tool.id]?.length ? <label className="block text-[11px] text-slate-600">选择远程工具<select aria-label={`${tool.name}远程工具`} value={tool.toolName} onChange={e => { const selected = discovered[tool.id].find(t => t.name === e.target.value); if (selected) update(tool.id, { toolName: selected.name, description: selected.description || tool.description, inputSchema: JSON.stringify(selected.inputSchema, null, 2) }); }} className={inputClass}><option value="">请选择</option>{discovered[tool.id].map(t => <option key={t.name} value={t.name}>{t.name}</option>)}</select></label> : null}
          {field(`${tool.name}工具名`, tool.toolName, toolName => update(tool.id, { toolName }))}
          {area(`${tool.name}参数 schema`, tool.inputSchema, inputSchema => update(tool.id, { inputSchema }))}
        </> : <label className="block text-[11px] text-slate-600">请求方法<select aria-label={`${tool.name}请求方法`} value={tool.method} onChange={e => update(tool.id, { method: e.target.value as 'GET' | 'POST' })} className={inputClass}><option>GET</option><option>POST</option></select></label>}
        <details><summary className="cursor-pointer text-[11px] text-slate-500">高级参数</summary><div className="mt-2 space-y-3">
          {area(`${tool.name}请求头 JSON`, tool.headers, headers => update(tool.id, { headers }))}
          {['hot', 'rest', 'mcp'].includes(tool.provider) && <>{area(`${tool.name}参数模板 JSON`, tool.body, body => update(tool.id, { body }))}<p className="text-[10px] text-slate-400">{'{{query}} 为查询词，{{apiKey}} 为密钥；GET 参数会加入网址，POST 使用 JSON。'}</p></>}
          {field(`${tool.name}结果路径`, tool.resultPath, resultPath => update(tool.id, { resultPath }), 'text', '留空使用完整结果，例如 data.items')}
        </div></details>
        <div className="flex gap-2"><button type="button" disabled={!!busy} onClick={() => void test(tool)} className="flex-1 rounded-xl bg-sky-50 py-2 text-xs text-slate-600 disabled:opacity-50">{busy === tool.id ? '连接中…' : tool.provider === 'mcp' ? '连接并获取工具' : '连接测试'}</button><button type="button" disabled={!!busy} aria-label={`删除${tool.name}`} onClick={() => save({ ...settings, tools: settings.tools.filter(t => t.id !== tool.id) })} className="rounded-xl bg-rose-50 px-3 text-rose-500"><Trash2 size={14} /></button></div>
        {status[tool.id] && <p role="status" className="break-words text-[10px] leading-relaxed text-slate-500">{status[tool.id]}</p>}
      </div></details>)}
      {status.global && <p role="alert" className="text-xs text-rose-500">{status.global}</p>}
    </div>
  </details>;
}
