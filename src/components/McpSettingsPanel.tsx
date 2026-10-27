import { useRef, useState } from 'react';
import { ChevronDown, Globe, Plus, Trash2 } from 'lucide-react';
import { changeSearchProvider, configuredToolRelay, executeSearchTool, isBuiltinSearchTool, listMcpTools, mergeMcpDiscovery, newSearchTool, newTavilyMcpTool, readMcpSettings, redactSearchSecrets, saveMcpSettings, searchToolAuthType, type McpSettings, type SearchProvider, type SearchTool } from '../utils/mcpTools';
import { searchToolErrorMessage } from '../utils/builtinTools';
import { ApiModelPicker } from './ApiModelPicker';
import { normalizeApiEndpoint } from '../utils/apiEndpoint';

const providers: Array<[SearchProvider | 'tavily-mcp', string]> = [['tavily-mcp', 'Tavily（MCP）'], ['mcp', '自定义 MCP'], ['tavily', 'Tavily（REST）'], ['bocha', '博查搜索（REST）'], ['exa', 'Exa（REST）'], ['rest', '自定义 REST']];
const inputClass = 'mt-1 w-full min-w-0 rounded-xl border border-white bg-white/70 px-3 py-2 text-xs text-slate-700 outline-none';
export function McpSettingsPanel() {
  const [settings, setSettings] = useState(readMcpSettings);
  const [provider, setProvider] = useState<SearchProvider | 'tavily-mcp'>('tavily-mcp');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState<Record<string, string>>({});
  const [testQueries, setTestQueries] = useState<Record<string, string>>({});
  const [testArguments, setTestArguments] = useState<Record<string, string>>({});
  const [testTools, setTestTools] = useState<Record<string, string>>({});
  const latest = useRef(settings);
  const save = (next: McpSettings) => { try { saveMcpSettings(next); latest.current = next; setSettings(next); } catch { setStatus(s => ({ ...s, global: '保存失败，请检查存储空间。' })); } };
  const update = (id: string, change: Partial<SearchTool>) => {
    const source = latest.current;
    save({ ...source, tools: source.tools.map(t => t.id === id ? { ...t, ...change,
      ...(t.provider === 'mcp' && ['endpoint', 'apiKey', 'authType', 'authHeaderName', 'headers'].some(key => key in change) ? { remoteTools: undefined, toolName: '' } : {}) } : t) });
    setStatus(s => ({ ...s, [id]: '' }));
  };
  const field = (label: string, value: string, change: (v: string) => void, type = 'text', placeholder = '', onBlur?: () => void) => <label className="block text-[11px] text-slate-600">{label}<input aria-label={label} type={type} value={value} onChange={e => change(e.target.value)} onBlur={onBlur} placeholder={placeholder} className={inputClass} autoComplete="off" /></label>;
  const setDecisionEndpoint = (endpoint: string) => save({ ...latest.current, decisionApi: { ...latest.current.decisionApi, endpoint } });
  const area = (label: string, value: string, change: (v: string) => void) => <label className="block text-[11px] text-slate-600">{label}<textarea aria-label={label} rows={3} value={value} onChange={e => change(e.target.value)} className={`${inputClass} font-mono`} /></label>;
  const test = async (tool: SearchTool, call = false) => {
    setBusy(tool.id); setStatus(s => ({ ...s, [tool.id]: '' }));
    try {
      if (tool.provider === 'mcp' && !call) {
        const tools = await listMcpTools(tool, configuredToolRelay(latest.current));
        const source = latest.current;
        save({ ...source, tools: source.tools.map(t => t.id === tool.id ? mergeMcpDiscovery(t, tools) : t) });
        setStatus(s => ({ ...s, [tool.id]: tools.length ? `连接成功 · 已获取 ${tools.length} 个工具` : '已连接，服务没有提供工具。' }));
      } else {
        const remote = tool.remoteTools?.find(t => t.name === (testTools[tool.id] || tool.remoteTools?.find(t => t.enabled !== false)?.name));
        if (tool.provider === 'mcp' && tool.remoteTools && (!remote || remote.enabled === false || remote.annotations?.readOnlyHint === false || remote.annotations?.destructiveHint === true)) throw new Error('请先选择一个已启用的查询工具。');
        const selected = remote ? { ...tool, toolName: remote.name, inputSchema: JSON.stringify(remote.inputSchema) } : tool;
        const rawArgs = testArguments[tool.id]?.trim(); let args: Record<string, unknown> | undefined;
        if (tool.provider === 'mcp' && rawArgs) {
          let parsed: unknown; try { parsed = JSON.parse(rawArgs); } catch { throw new Error('测试参数不是有效的 JSON。'); }
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('测试参数需要是 JSON 对象。');
          args = parsed as Record<string, unknown>;
        }
        const result = await executeSearchTool(selected, isBuiltinSearchTool(tool) ? ['reader', 'summary'].includes(tool.provider) ? 'https://example.com' : tool.provider === 'wiki' ? '猫' : '微博热搜' : testQueries[tool.id] || '今日新闻', args, configuredToolRelay(latest.current));
        let preview = result.slice(0, 240);
        if (isBuiltinSearchTool(tool)) {
          const data = JSON.parse(result);
          preview = tool.provider === 'builtin-hot' ? `${data.boards.map((b: { platform: string }) => b.platform).join('、')} · ${data.boards[0]?.items[0]?.title || ''}${data.unavailable?.length ? `（${data.unavailable.join('、')}暂不可用）` : ''}`
            : tool.provider === 'wiki' ? `${data.source} · ${data.results.map((p: { title: string }) => p.title).join('、') || '未找到相关词条'}`
            : tool.provider === 'reader' ? `网页正文已读取 · ${data.source || '阅读服务'}` : `仅标题与简介 · ${data.title || '无标题'}`;
        }
        setStatus(s => ({ ...s, [tool.id]: `${call ? '调用成功' : '连接成功'} · ${preview}` }));
      }
    } catch (e) { setStatus(s => ({ ...s, [tool.id]: redactSearchSecrets(e instanceof TypeError && !isBuiltinSearchTool(tool)
      ? `连接失败：网络不可达或服务未允许浏览器跨域访问。${configuredToolRelay(latest.current) ? '请检查中转服务是否可用。' : '这类服务可通过「连接中转」连接。'}`
      : searchToolErrorMessage(e, isBuiltinSearchTool(tool)), tool) })); }
    finally { setBusy(''); }
  };
  return <details open={settings.expanded} onToggle={e => { if (e.currentTarget.open !== settings.expanded) save({ ...settings, expanded: e.currentTarget.open }); }} className="settings-card settings-model-panel" data-tone="blue">
    <summary className="settings-panel-heading"><span className="settings-icon"><Globe size={18} strokeWidth={1.7} /></span><span className="settings-heading-copy"><strong>MCP 与搜索工具</strong><small>按需查询与联网工具</small></span><ChevronDown size={16} className="settings-chevron" /></summary>
    <div className="settings-panel-body space-y-4">
      <label className="flex items-center justify-between text-xs text-slate-600">启用工具服务<input aria-label="启用工具服务" type="checkbox" checked={settings.enabled} onChange={e => save({ ...settings, enabled: e.target.checked })} /></label>
      <p className="text-[10px] leading-relaxed text-slate-400">在角色的对话设置中开启后，由决策模型按需查询。外部搜索只发送查询词；决策模型会读取最近几条对话。</p>
      <details className="rounded-2xl bg-sky-50/60 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">决策副 API</summary><div className="mt-3 space-y-3">
        <p className="text-[10px] text-slate-400">全部留空使用当前主 API；填写后使用独立的副 API 判断是否调用工具。</p>
        {field('决策 API 地址', settings.decisionApi.endpoint, setDecisionEndpoint, 'url', 'https://…/v1', () => {
          const endpoint = normalizeApiEndpoint(latest.current.decisionApi.endpoint);
          if (endpoint !== latest.current.decisionApi.endpoint) setDecisionEndpoint(endpoint);
        })}
        <p className="text-[10px] leading-relaxed text-slate-400">支持 DeepSeek 等 OpenAI 兼容接口。<button type="button" aria-label="使用 DeepSeek 官方地址" className="text-sky-700 underline underline-offset-2" onClick={() => setDecisionEndpoint('https://api.deepseek.com')}>填入 DeepSeek 官方地址</button>，使用对应开放平台的 API Key。</p>
        {field('决策 API Key', settings.decisionApi.apiKey, apiKey => save({ ...settings, decisionApi: { ...settings.decisionApi, apiKey } }), 'password')}
        {field('决策模型', settings.decisionApi.model || '', model => save({ ...settings, decisionApi: { ...settings.decisionApi, model } }))}
        <ApiModelPicker label="决策" identity={JSON.stringify([normalizeApiEndpoint(settings.decisionApi.endpoint), settings.decisionApi.apiKey])}
          resolveConnection={() => ({ ...latest.current.decisionApi, purpose: 'decision' })} model={settings.decisionApi.model || ''}
          onSelect={model => save({ ...latest.current, decisionApi: { ...latest.current.decisionApi, model } })} />
      </div></details>
      <details aria-label="内置免 Key 工具" open={settings.builtinExpanded !== false} onToggle={e => { if (e.currentTarget.open !== (settings.builtinExpanded !== false)) save({ ...settings, builtinExpanded: e.currentTarget.open }); }} className="space-y-2 rounded-2xl bg-[#f1f6f5]/70 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">内置工具 <span className="ml-1 text-[10px] font-normal text-slate-400">免 Key</span></summary>
        <p className="text-[10px] leading-relaxed text-slate-400">仍需联网，公共服务可能限流，部分网站会限制读取。</p>
        {settings.tools.filter(isBuiltinSearchTool).map(tool => <div key={tool.id} className="rounded-xl bg-white/70 p-3">
          <label className="flex items-center justify-between gap-2 text-xs text-slate-600">{tool.name}<input aria-label={`启用内置${tool.name}`} type="checkbox" checked={tool.enabled} onChange={e => update(tool.id, { enabled: e.target.checked })} /></label>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{tool.provider === 'builtin-hot' ? '微博、百度、知乎、抖音、B站' : tool.provider === 'wiki' ? '百科词条与介绍，自动尝试备用来源' : tool.provider === 'reader' ? '将网页正文转换为 Markdown' : '仅获取网页标题和简介，适用于无法读取全文时'}</p>
          <button type="button" disabled={!!busy} onClick={() => void test(tool)} className="mt-2 text-[10px] text-sky-700 disabled:opacity-40" aria-label={`测试${tool.name}`}>{busy === tool.id ? '测试中…' : '测试'}</button>
          {status[tool.id] && <p role="status" className="mt-1 whitespace-pre-line break-words text-[10px] text-slate-500">{status[tool.id]}</p>}
        </div>)}
      </details>
      <details className="rounded-2xl bg-sky-50/60 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">连接中转 <span className="ml-1 text-[10px] font-normal text-slate-400">可选</span></summary><div className="mt-3 space-y-3">
        <label className="flex items-center justify-between text-xs text-slate-600">使用连接中转<input type="checkbox" aria-label="使用连接中转" disabled={!!busy} checked={settings.relay?.enabled ?? false} onChange={e => save({ ...settings, relay: { endpoint: '', token: '', ...settings.relay, enabled: e.target.checked } })} /></label>
        <p className="text-[10px] leading-relaxed text-slate-400">用于不允许浏览器跨域的 MCP / REST 服务。中转会接收服务密钥，请填写自己控制或信任的地址。</p>
        {field('中转地址', settings.relay?.endpoint || '', endpoint => save({ ...settings, relay: { enabled: false, token: '', ...settings.relay, endpoint } }), 'url', 'https://你的中转.workers.dev')}
        {field('中转口令', settings.relay?.token || '', token => save({ ...settings, relay: { enabled: false, endpoint: '', ...settings.relay, token } }), 'password')}
      </div></details>
      <div className="flex gap-2"><select aria-label="工具类型" className={`${inputClass} mt-0 flex-1`} value={provider} onChange={e => setProvider(e.target.value as SearchProvider | 'tavily-mcp')}>{providers.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button type="button" disabled={!!busy} onClick={() => save({ ...settings, tools: [...settings.tools, provider === 'tavily-mcp' ? newTavilyMcpTool() : newSearchTool(provider)] })} className="flex items-center gap-1 rounded-xl bg-[#dfeaf0] px-3 text-xs text-slate-600"><Plus size={14} />添加</button></div>
      {settings.tools.filter(tool => !isBuiltinSearchTool(tool)).map(tool => <details key={tool.id} className="rounded-2xl border border-white bg-white/60 p-3"><summary className="cursor-pointer truncate text-xs font-semibold text-slate-600">{tool.name || '未命名工具'}<span className="ml-2 text-[10px] font-normal text-slate-400">{tool.provider === 'mcp' ? 'MCP' : 'REST'} · {tool.enabled ? '已启用' : '已停用'}</span></summary><fieldset disabled={!!busy} className="mt-3 min-w-0 space-y-3">
        <label className="flex items-center justify-between text-xs text-slate-600">启用此工具<input type="checkbox" aria-label={`启用${tool.name}`} checked={tool.enabled} onChange={e => update(tool.id, { enabled: e.target.checked })} /></label>
        <label className="block text-[11px] text-slate-600">连接类型<select aria-label={`${tool.name}连接类型`} className={inputClass} value={tool.provider === 'mcp' ? 'mcp' : 'rest'} onChange={e => update(tool.id, changeSearchProvider(tool, e.target.value === 'mcp' ? 'mcp' : /mcp\.tavily\.com/.test(tool.endpoint) ? 'tavily' : 'rest'))}><option value="mcp">MCP 标准</option><option value="rest">REST API</option></select></label>
        {tool.provider !== 'mcp' && <label className="block text-[11px] text-slate-600">REST 服务<select aria-label={`${tool.name}REST服务`} className={inputClass} value={tool.provider} onChange={e => update(tool.id, changeSearchProvider(tool, e.target.value as SearchProvider))}>{providers.filter(([id]) => !['mcp', 'tavily-mcp'].includes(id)).map(([id, label]) => <option key={id} value={id}>{label}</option>)}{tool.provider === 'hot' && <option value="hot">自定义热搜接口</option>}</select></label>}
        {field(`${tool.name}名称`, tool.name, name => update(tool.id, { name }))}
        {field(`${tool.name}用途`, tool.description, description => update(tool.id, { description }))}
        {field(`${tool.name}接口地址`, tool.endpoint, endpoint => update(tool.id, { endpoint }), 'url')}
        <label className="block text-[11px] text-slate-600">身份验证<select aria-label={`${tool.name}身份验证`} value={searchToolAuthType(tool)} onChange={e => update(tool.id, { authType: e.target.value as SearchTool['authType'] })} className={inputClass}><option value="none">无</option><option value="bearer">Bearer</option><option value="header">Header</option></select></label>
        {searchToolAuthType(tool) === 'header' && field(`${tool.name}认证 Header 名称`, tool.authHeaderName ?? (tool.provider === 'exa' ? 'x-api-key' : ''), authHeaderName => update(tool.id, { authHeaderName }), 'text', 'x-api-key')}
        {searchToolAuthType(tool) !== 'none' && field(`${tool.name}${searchToolAuthType(tool) === 'bearer' ? ' Bearer Token' : '认证 Header 值'}`, tool.apiKey, apiKey => update(tool.id, { apiKey }), 'password')}
        {tool.provider === 'mcp' ? <>
          <p className="text-[10px] leading-relaxed text-slate-400">支持 Streamable HTTP，连接后自动发现工具。服务需允许浏览器跨域访问；本地 stdio 需转为 HTTP。</p>
          {tool.remoteTools && <div className="space-y-2 rounded-xl bg-sky-50/70 p-3"><p className="text-[11px] font-medium text-slate-600">查询工具</p>{tool.remoteTools.map(remote => <label key={remote.name} className="flex items-start gap-2 text-[11px] text-slate-600"><input type="checkbox" className="mt-0.5 shrink-0" aria-label={`启用远程工具${remote.name}`} disabled={remote.annotations?.readOnlyHint === false || remote.annotations?.destructiveHint === true} checked={remote.enabled !== false && remote.annotations?.readOnlyHint !== false && remote.annotations?.destructiveHint !== true} onChange={e => update(tool.id, { remoteTools: tool.remoteTools!.map(t => t.name === remote.name ? { ...t, enabled: e.target.checked } : t) })} /><span className="min-w-0 break-words"><strong className="font-medium">{remote.name}</strong><small className="mt-0.5 block line-clamp-2 text-[10px] leading-relaxed text-slate-400">{remote.annotations?.readOnlyHint === false || remote.annotations?.destructiveHint === true ? '此处仅支持查询工具' : remote.description}</small></span></label>)}</div>}
        </> : <label className="block text-[11px] text-slate-600">请求方法<select aria-label={`${tool.name}请求方法`} value={tool.method} onChange={e => update(tool.id, { method: e.target.value as 'GET' | 'POST' })} className={inputClass}><option>GET</option><option>POST</option></select></label>}
        <details><summary className="cursor-pointer text-[11px] text-slate-500">高级参数</summary><div className="mt-2 space-y-3">
          {area(`${tool.name}请求头 JSON`, tool.headers, headers => update(tool.id, { headers }))}
          {tool.provider === 'mcp' && !tool.remoteTools && <>{field(`${tool.name}工具名`, tool.toolName, toolName => update(tool.id, { toolName }))}{area(`${tool.name}参数 schema`, tool.inputSchema, inputSchema => update(tool.id, { inputSchema }))}</>}
          {['hot', 'rest', 'mcp'].includes(tool.provider) && <>{area(`${tool.name}参数模板 JSON`, tool.body, body => update(tool.id, { body }))}<p className="text-[10px] text-slate-400">{'{{query}} 为查询词，{{apiKey}} 为密钥；GET 参数会加入网址，POST 使用 JSON。'}</p></>}
          {field(`${tool.name}结果路径`, tool.resultPath, resultPath => update(tool.id, { resultPath }), 'text', '留空使用完整结果，例如 data.items')}
        </div></details>
        {!isBuiltinSearchTool(tool) && <details><summary className="cursor-pointer text-[11px] text-slate-500">测试查询</summary><div className="mt-2 space-y-3">
          {field(`${tool.name}测试查询词`, testQueries[tool.id] ?? '今日新闻', query => setTestQueries(s => ({ ...s, [tool.id]: query })))}
          {tool.provider === 'mcp' && <>
            {tool.remoteTools && <label className="block text-[11px] text-slate-600">测试工具<select aria-label={`${tool.name}测试工具`} className={inputClass} value={testTools[tool.id] || tool.remoteTools.find(t => t.enabled !== false)?.name || ''} onChange={e => setTestTools(s => ({ ...s, [tool.id]: e.target.value }))}><option value="">请选择</option>{tool.remoteTools.filter(t => t.enabled !== false && t.annotations?.readOnlyHint !== false && t.annotations?.destructiveHint !== true).map(t => <option key={t.name} value={t.name}>{t.name}</option>)}</select></label>}
            {area(`${tool.name}测试参数 JSON（可留空）`, testArguments[tool.id] || '', args => setTestArguments(s => ({ ...s, [tool.id]: args })))}
            <button type="button" onClick={() => void test(tool, true)} className="w-full rounded-xl bg-sky-50 py-2 text-xs text-slate-600">测试调用</button>
          </>}
        </div></details>}
        <div className="flex gap-2"><button type="button" disabled={!!busy} onClick={() => void test(tool)} className="flex-1 rounded-xl bg-sky-50 py-2 text-xs text-slate-600 disabled:opacity-50">{busy === tool.id ? '连接中…' : tool.provider === 'mcp' ? '连接并获取工具' : '连接测试'}</button><button type="button" disabled={!!busy} aria-label={`删除${tool.name}`} onClick={() => save({ ...settings, tools: settings.tools.filter(t => t.id !== tool.id) })} className="rounded-xl bg-rose-50 px-3 text-rose-500"><Trash2 size={14} /></button></div>
        {status[tool.id] && <p role="status" className="whitespace-pre-line break-words text-[10px] leading-relaxed text-slate-500">{status[tool.id]}</p>}
      </fieldset></details>)}
      {status.global && <p role="alert" className="text-xs text-rose-500">{status.global}</p>}
    </div>
  </details>;
}
