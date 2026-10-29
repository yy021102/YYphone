import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { clearBuiltinToolCache } from './builtinTools';
import { buildMcpDirectPlan, defaultMcpTriggerRules, pendingMcpInput, sharedMcpUrls } from './mcpTriggers';
import { builtinSearchTools, emptyMcpSettings, isMcpSettings, newSearchTool, readMcpSettings, runMcpDecision, saveMcpSettings, type McpSettings } from './mcpTools';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size; },
} } });
beforeEach(async () => { await clearDbStorage(); clearBuiltinToolCache(); });
afterEach(() => mock.restoreAll());
const json = (value: unknown) => Response.json(value);
const base = (): McpSettings => ({ ...emptyMcpSettings(), enabled: true, decisionEnabled: false, tools: builtinSearchTools() });
const mainApi = { endpoint: '', apiKey: '' };
const run = (query: string, settings = base(), signal?: AbortSignal) => runMcpDecision({ allowed: true, query, history: [], mainApi, settings, signal });

test('keyword-only idle chats make no decision request even with broken secondary credentials and old trigger words in history', async () => {
  const settings = base(); settings.decisionApi = { endpoint: 'broken', apiKey: 'PRIVATE_KEY', model: '' };
  const network = mock.method(globalThis, 'fetch', async () => { throw new Error('must not connect'); });
  assert.deepEqual(await runMcpDecision({ allowed: true, query: '今天一起散步吧', history: [{ from: '角色', text: '热搜 https://example.com/old' }], mainApi, settings }), { context: '', status: '' });
  assert.deepEqual(await run('别搜索', settings), { context: '', status: '' });
  assert.equal(network.mock.callCount(), 0);
});

test('mandatory links and keyword routes still obey the global and per-character MCP switches', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => { throw new Error('must not connect'); });
  for (const query of ['https://example.com/private-switch', '今天微博']) {
    assert.deepEqual(await runMcpDecision({ allowed: false, query, history: [], mainApi, settings: base() }), { context: '', status: '' });
    assert.deepEqual(await run(query, { ...base(), enabled: false }), { context: '', status: '' });
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('default hot keywords call a public hot-list tool directly without sending private chat or calling an API', async () => {
  const settings = base(); settings.decisionApi = { endpoint: 'bad', apiKey: '', model: '' };
  const requests: string[] = [];
  mock.method(globalThis, 'fetch', async (url: unknown) => { requests.push(String(url)); return json({ code: 200, data: [{ title: '真实热榜', link: 'https://news.invalid/hot' }] }); });
  const result = await run('PRIVATE_CHAT 今天微博', settings);
  assert.equal(requests.length, 1); assert.match(requests[0], /weibo/); assert(!requests[0].includes('PRIVATE_CHAT'));
  assert.match(result.context, /真实热榜/); assert.doesNotMatch(result.status, /决策失败/);
});

test('search keywords extract only the following topic and deduplicate overlapping phrases', async () => {
  const settings = base(); settings.tools.push(newSearchTool('tavily'), newSearchTool('bocha'));
  let calls = 0;
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    calls++; assert.equal(String(url), 'https://api.tavily.com/search');
    assert.equal(JSON.parse(String(init?.body)).query, '猫能吃南瓜吗'); assert(!String(init?.body).includes('PRIVATE_CHAT'));
    return json({ results: [{ title: '搜索结果', url: 'https://news.invalid/cat', content: '公开资料' }] });
  });
  assert.match((await run('PRIVATE_CHAT 你去搜一下 猫能吃南瓜吗\nPRIVATE_CHAT_NEXT_MESSAGE', settings)).context, /公开资料/);
  assert.equal(calls, 1);
});

test('custom keywords route to the selected REST tool and persist with decision switch, while old settings retain credentials', async () => {
  const settings = base(), tool = { ...newSearchTool('rest'), endpoint: 'https://custom.invalid/search' };
  settings.tools.push(tool); settings.triggerRules = [{ id: 'custom', toolId: tool.id, keywords: ['打听'] }];
  settings.decisionApi = { endpoint: 'https://secondary.invalid', apiKey: 'KEEP_KEY', model: 'keep-model' };
  saveMcpSettings(settings);
  assert.equal(readMcpSettings().decisionEnabled, false); assert.deepEqual(readMcpSettings().triggerRules, settings.triggerRules);
  assert.equal(isMcpSettings({ ...settings, triggerRules: [{ id: 'bad', toolId: 'x', keywords: [2] }] }), false);
  let calls = 0;
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    calls++; assert.equal(String(url), tool.endpoint); assert.equal(JSON.parse(String(init?.body)).query, '公开展览'); return json({ text: '展览资料' });
  });
  assert.match((await run('帮我打听 公开展览', readMcpSettings())).context, /展览资料/); assert.equal(calls, 1);
  const legacy = { ...settings }; delete legacy.decisionEnabled; delete legacy.triggerRules;
  saveMcpSettings(legacy); assert.deepEqual(readMcpSettings().decisionApi, settings.decisionApi); assert.equal(readMcpSettings().decisionEnabled, undefined);
});

test('keyword searches call a discovered read-only MCP tool with its schema-specific arguments without any decision API', async () => {
  const settings = base();
  settings.tools.push({ ...newSearchTool('mcp'), endpoint: 'https://mcp.invalid/mcp', remoteTools: [{ name: 'public_search', description: '公开搜索', enabled: true,
    inputSchema: { type: 'object', properties: { search_query: { type: 'string' }, limit: { type: 'integer', default: 5 } }, required: ['search_query'], additionalProperties: false } }] });
  const methods: string[] = [];
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    assert.equal(String(url), 'https://mcp.invalid/mcp');
    if (init?.method === 'DELETE') { methods.push('DELETE'); return new Response(null, { status: 204 }); }
    const rpc = JSON.parse(String(init?.body)); methods.push(rpc.method);
    if (rpc.method === 'initialize') return Response.json({ id: rpc.id, result: { protocolVersion: '2025-06-18' } }, { headers: { 'Mcp-Session-Id': 'keyword-session' } });
    if (rpc.method === 'notifications/initialized') return new Response(null, { status: 202 });
    assert.deepEqual(rpc.params.arguments, { search_query: '猫能吃南瓜吗', limit: 5 });
    return json({ id: rpc.id, result: { content: [{ type: 'text', text: '已取得的公开资料' }] } });
  });
  assert.match((await run('去搜 猫能吃南瓜吗', settings)).context, /已取得的公开资料/);
  assert.deepEqual(methods, ['initialize', 'notifications/initialized', 'tools/call', 'DELETE']);
});

test('a shared long URL is mandatory, bypasses invalid decision settings, keeps signature parameters, and does not trigger keyword searches', async () => {
  const settings = { ...base(), decisionEnabled: true, decisionApi: { endpoint: 'broken', apiKey: '', model: '' } };
  const url = `https://example.com/article?token=${'a'.repeat(600)}&source=share`;
  let calls = 0;
  mock.method(globalThis, 'fetch', async (address: unknown) => {
    calls++; assert.equal(String(address), `https://r.jina.ai/${url}`);
    return new Response('Title: 公开文章\nMarkdown Content:\n# 正文\n\n实际取得的文章内容。');
  });
  const result = await run(`去搜索 这篇 ${url}，`, settings);
  assert.equal(calls, 1); assert.match(result.context, /实际取得的文章内容/); assert.match(result.context, /fullTextRead\\":true/);
});

test('failed full text falls back to metadata without decision calls or inventing article details', async () => {
  const settings = base(); let full = 0, summary = 0;
  mock.method(globalThis, 'fetch', async (url: unknown) => {
    const target = String(url);
    if (target.startsWith('https://r.jina.ai')) { full++; return new Response('', { status: 403 }); }
    const parsed = new URL(target); assert.equal(parsed.hostname, 'api.microlink.io');
    if (parsed.searchParams.has('data.markdown.attr')) { full++; return json({ status: 'success', statusCode: 403, data: {} }); }
    summary++; return json({ status: 'success', statusCode: 200, data: { title: '文章标题', description: '网页简介', markdown: 'FAKE_ARTICLE_BODY' } });
  });
  const result = await run('https://example.com/blocked');
  assert.equal(full, 2); assert.equal(summary, 1); assert.match(result.status, /仅标题与简介/);
  assert.match(result.context, /文章标题/); assert.match(result.context, /fullTextRead\\":false/); assert.doesNotMatch(result.context, /FAKE_ARTICLE_BODY/);
});

test('disabled tools remain disabled and failures never fall through to a decision call or claim a successful read', async () => {
  const settings = base(); settings.decisionEnabled = true;
  settings.tools.filter(tool => ['reader', 'summary'].includes(tool.provider)).forEach(tool => { tool.enabled = false; });
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return new Response('', { status: 403 }); });
  const disabled = await run('https://example.com/off', settings); assert.match(disabled.status, /均未启用/); assert.equal(calls, 0);
  settings.tools.filter(tool => ['reader', 'summary'].includes(tool.provider)).forEach(tool => { tool.enabled = true; });
  const failed = await run('https://example.com/fail', settings); assert.match(failed.status, /查询失败/); assert.match(failed.context, /没有取得外部内容/);
  assert.equal(calls, 4, 'only reader and metadata public services are attempted');
});

test('missing keyword targets and missing search topics ask for setup or a topic without paid decision requests', async () => {
  const settings = base(); settings.decisionEnabled = true;
  const fetch = mock.method(globalThis, 'fetch', async () => { throw new Error('must not connect'); });
  assert.match((await run('去搜 猫', settings)).status, /配置并启用一个搜索工具/);
  settings.tools.push(newSearchTool('tavily'));
  assert.match((await run('去搜', settings)).status, /写上要查询的内容/);
  assert.equal(fetch.mock.callCount(), 0);
});

test('unmatched messages use the selected decision API only when enabled, and explicit decision testing still works in keyword-only mode', async () => {
  const settings = base(); settings.decisionApi = { endpoint: 'https://secondary.invalid/v1', apiKey: 'PRIVATE_KEY', model: 'decision' };
  let calls = 0;
  mock.method(globalThis, 'fetch', async (url: unknown) => { calls++; assert.match(String(url), /secondary.invalid/); return json({ choices: [{ message: { content: '{"calls":[]}' } }] }); });
  await run('晚安', settings); assert.equal(calls, 0);
  settings.decisionEnabled = true; assert.match((await run('晚安', settings)).status, /无需查询/); assert.equal(calls, 1);
  settings.decisionEnabled = false;
  const result = await runMcpDecision({ allowed: true, testOnly: true, query: '今天微博热搜', history: [], mainApi, settings });
  assert.match(result.status, /决策连接正常/); assert.equal(calls, 2);
});

test('only newly pending player messages trigger tools, including a URL card followed by another message', () => {
  const old = [{ senderId: 'user', text: 'https://example.com/old' }, { senderId: 'char', text: '热搜，搜索 https://example.com/character' }];
  assert.equal(pendingMcpInput([...old, { senderId: 'user', text: '晚安' }], ['char']), '晚安');
  assert.equal(pendingMcpInput(old, ['char']), '');
  const pending = pendingMcpInput([...old, { senderId: 'user', text: '网页卡片', externalUrl: 'https://example.com/new' }, { senderId: 'narrator', text: '不要作为玩家指令' }, { senderId: 'user', text: '看看这篇' }], ['char']);
  assert.equal(pending, '网页卡片\nhttps://example.com/new\n看看这篇');
  assert.deepEqual(sharedMcpUrls(pending), ['https://example.com/new']);
  assert.deepEqual(sharedMcpUrls('https://example.com/new， https://example.com/new。 http://127.0.0.1/private'), ['https://example.com/new']);
});

test('duplicate URLs do not repeat calls and multiple pages retain an explicit unread notice beyond the bounded batch', async () => {
  const settings = base(); let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return new Response('Markdown Content:\n实际公开文章。'); });
  const result = await run('https://example.com/a https://example.com/a https://example.com/b https://example.com/c https://example.com/d', settings);
  assert.equal(calls, 3); assert.match(result.context, /其余链接本轮未读取/);
  assert.equal(buildMcpDirectPlan('什么都没提', settings.tools, defaultMcpTriggerRules()).matched, false);
});

test('cancelling a direct read returns promptly and never starts automatic metadata fallback or decision', async () => {
  const controller = new AbortController(); let finish: (response: Response) => void, calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return new Promise<Response>(resolve => { finish = resolve; }); });
  const pending = run('https://example.com/cancelled', base(), controller.signal);
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
  finish!(new Response('Markdown Content:\n这次读取已取消，不交给角色。'));
  await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(calls, 1);
  await assert.rejects(run('https://example.com/not-started', base(), controller.signal), { name: 'AbortError' }); assert.equal(calls, 1);
});
