import type { SearchTool } from './mcpTools';
import { publicLink } from './linkPreview';

export const BUILTIN_HOT_ENDPOINT = 'https://60s.b23.run/v2';
export const BUILTIN_WIKI_ENDPOINT = `${BUILTIN_HOT_ENDPOINT}/baike`;
const LEGACY_HOT = 'https://60s.viki.moe/v2';
const WIKIPEDIA = 'https://zh.wikipedia.org/w/api.php';
const MICROLINK = 'https://api.microlink.io';
// Anonymous public GET only; never route chat APIs, credentials or private URLs here.
const PUBLIC_HTML_PROXY = 'https://proxy.cors.dev/';
type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, limit = 2400) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const cache = new Map<string, { until: number; value: string }>();
const pending = new Map<string, Promise<string>>();
export const clearBuiltinToolCache = () => { cache.clear(); pending.clear(); };

export class BuiltinToolError extends Error {
  constructor(message: string) { super(message); this.name = 'BuiltinToolError'; }
}

export function searchToolErrorMessage(error: unknown, builtin = false): string {
  if (error instanceof BuiltinToolError) return error.message;
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return '请求超时，请稍后重试或检查当前网络。';
  if (error instanceof TypeError) return `无法连接：当前网络不可达或浏览器跨域拦截。${builtin ? '这是免 Key 工具，不需要填写 API 密钥。' : '请检查服务地址、网络和服务端跨域配置。'}`;
  if (error instanceof SyntaxError) return '接口没有返回有效的 JSON 数据，可能返回了网页或拦截页面。';
  return error instanceof Error ? error.message : '工具请求失败，请稍后重试。';
}

async function fetchPublic(url: string, max: number, timeout = 8000, headOnly = false): Promise<string> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) {
      const reason = response.status === 429 ? '公共服务限流（HTTP 429）'
        : response.status === 401 || response.status === 403 ? `服务拒绝访问（HTTP ${response.status}）`
        : response.status === 404 ? '接口或网页不存在（HTTP 404）' : `服务暂不可用（HTTP ${response.status}）`;
      throw new BuiltinToolError(reason);
    }
    if (!response.body) throw new BuiltinToolError('接口返回为空');
    const reader = response.body.getReader(), decoder = new TextDecoder(); let result = '', size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > max) throw new BuiltinToolError('接口返回过大，未读取完整内容');
        result += decoder.decode(value, { stream: true });
        if (headOnly) {
          const end = /<\/head\s*>|<body\b/i.exec(result);
          if (end) { result = result.slice(0, end.index + (end[0].startsWith('</') ? end[0].length : 0)); break; }
        }
      }
      result += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    if (!result.trim()) throw new BuiltinToolError('接口返回为空');
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new BuiltinToolError('访问超时，请检查当前网络');
    throw error;
  } finally { clearTimeout(timer); }
}

// Cache only after the caller has checked the actual result, never an empty list/error document.
async function readPublic<T>(url: string, parse: (raw: string) => T, max = 200000, timeout = 8000, headOnly = false): Promise<T> {
  const key = `${headOnly ? 'head:' : ''}${url}`;
  const saved = cache.get(key);
  if (saved && saved.until > Date.now()) return parse(saved.value);
  let request = pending.get(key);
  if (!request) { request = fetchPublic(url, max, timeout, headOnly); pending.set(key, request); }
  try {
    const raw = await request, result = parse(raw);
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { value: raw, until: Date.now() + 300000 });
    return result;
  } finally { if (pending.get(key) === request) pending.delete(key); }
}

function json(raw: string): Row {
  if (/^\s*(?:<!doctype|<html)/i.test(raw)) throw new BuiltinToolError('接口返回了网页或拦截页面');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new BuiltinToolError('接口没有返回有效的 JSON 数据'); }
  if (!record(value)) throw new BuiltinToolError('接口返回格式不符');
  if (value.error || value.success === false || value.status === 'error' || (typeof value.code === 'number' && ![0, 200].includes(value.code))) {
    throw new BuiltinToolError(value.code === 429 ? '公共服务限流（HTTP 429）' : '公共服务返回错误，未获得查询结果');
  }
  return value;
}

async function fallback<T>(label: string, sources: Array<{ name: string; read: () => Promise<T> }>): Promise<T> {
  const failures: string[] = [];
  for (const source of sources) {
    try { return await source.read(); }
    catch (error) { failures.push(`${source.name}：${searchToolErrorMessage(error, true)}`); }
  }
  throw new BuiltinToolError(`${label}暂不可用。\n${failures.join('\n')}`);
}

const bases = (endpoint: string) => [...new Set([endpoint.trim().replace(/\/+$/, '') || BUILTIN_HOT_ENDPOINT, BUILTIN_HOT_ENDPOINT, LEGACY_HOT])];
const checkedAddress = (value: string) => {
  const safe = publicLink(value.trim());
  if (!safe) throw new BuiltinToolError('请提供公开的 HTTP(S) 网页链接，不支持本机或内网地址。');
  const url = new URL(safe); url.hash = ''; return url;
};

async function hot(tool: SearchTool, query: string) {
  const sources = [{ key: 'weibo', name: '微博', match: /微博|weibo/i }, { key: 'baidu/hot', name: '百度', match: /百度|baidu/i },
    { key: 'zhihu', name: '知乎', match: /知乎|zhihu/i }, { key: 'douyin', name: '抖音', match: /抖音|douyin/i }, { key: 'bili', name: 'B站', match: /哔哩|B站|bilibili/i }];
  const chosen = sources.filter(source => source.match.test(query)), selected = chosen.length ? chosen : sources.slice(0, 3);
  const results = await Promise.allSettled(selected.map(source => fallback(source.name, [
    ...bases(tool.endpoint).map(base => ({ name: new URL(base).hostname, url: `${base}/${source.key}` })),
    { name: 'UAPI', url: `https://uapis.cn/api/v1/misc/hotboard?type=${source.key === 'baidu/hot' ? 'baidu' : source.key === 'bili' ? 'bilibili' : source.key}` },
  ].map(({ name, url }) => ({
    name,
    read: () => {
      return readPublic(url, raw => {
        const data = json(raw), payload = data.data;
        const rows = Array.isArray(payload) ? payload : record(payload) ? payload.list : data.list;
        if (!Array.isArray(rows)) throw new BuiltinToolError('热榜返回格式不符');
        const items = rows.filter(record).flatMap(item => {
          const title = text(item.title ?? item.word ?? item.keyword, 500);
          return title ? [{ title, url: publicLink(text(item.url ?? item.link, 3000)), hot: item.hot ?? item.hot_value ?? item.score }] : [];
        }).slice(0, 12);
        if (!items.length) throw new BuiltinToolError('热榜没有有效条目');
        return { platform: source.name, source: url, items };
      });
    },
  })))));
  const boards = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  const failures = results.flatMap((result, i) => result.status === 'rejected' ? [{ platform: selected[i].name, reason: searchToolErrorMessage(result.reason, true) }] : []);
  if (!boards.length) throw new BuiltinToolError(`热搜聚合暂不可用。\n${failures.map(item => item.reason).join('\n')}`);
  return { fetchedAt: new Date().toISOString(), boards, unavailable: failures.map(item => item.platform), failures };
}

async function encyclopedia(tool: SearchTool, query: string) {
  const topic = query.trim().slice(0, 300);
  if (!topic) throw new BuiltinToolError('请填写要查询的百科词条。');
  const baike = () => {
    const url = new URL(BUILTIN_WIKI_ENDPOINT); url.search = new URLSearchParams({ word: topic }).toString();
    return readPublic(url.href, raw => {
      const payload = json(raw), data = payload.data;
      if (!record(data) || !text(data.title) || !text(data.abstract ?? data.description)) throw new BuiltinToolError('未取得有效的百科词条');
      const link = publicLink(text(data.link ?? data.url, 3000));
      if (!link) throw new BuiltinToolError('百科结果缺少来源链接');
      return { source: '百度百科', results: [{ title: text(data.title, 500), url: link, extract: text(data.abstract ?? data.description) }] };
    });
  };
  const wiki = (endpoint = WIKIPEDIA) => {
    const url = checkedAddress(endpoint);
    url.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', generator: 'search', gsrsearch: topic, gsrlimit: '3', prop: 'extracts|info', exintro: '1', explaintext: '1', exchars: '2400', inprop: 'url' }).toString();
    return readPublic(url.href, raw => {
      const data = json(raw), pages = record(data.query) ? data.query.pages : undefined;
      if (!pages) return { source: '维基百科', results: [], message: '未找到相关词条' };
      const results = (Array.isArray(pages) ? pages : record(pages) ? Object.values(pages) : []).filter(record).flatMap(page => {
        const title = text(page.title, 500), url = publicLink(text(page.fullurl, 3000)), extract = text(page.extract);
        return title && url && extract ? [{ title, url, extract }] : [];
      });
      if (!results.length) throw new BuiltinToolError('百科接口没有返回有效的词条简介');
      return { source: '维基百科', results };
    });
  };
  const customWiki = tool.endpoint.trim() && tool.endpoint !== BUILTIN_WIKI_ENDPOINT;
  return fallback('百科词条', customWiki ? [{ name: '百科接口', read: () => wiki(tool.endpoint) }, { name: '百度百科', read: baike }]
    : [{ name: '百度百科', read: baike }, { name: '维基百科', read: () => wiki() }]);
}

function microlinkUrl(target: URL, endpoint = MICROLINK, markdown = false) {
  const url = checkedAddress(endpoint);
  url.search = new URLSearchParams({ url: target.href, meta: markdown ? 'false' : 'true', screenshot: 'false', video: 'false', audio: 'false', palette: 'false',
    ...(markdown ? { 'data.markdown.attr': 'markdown' } : {}) }).toString();
  return url.href;
}
function microlinkData(raw: string) {
  const payload = json(raw);
  if (typeof payload.statusCode === 'number' && payload.statusCode >= 400) throw new BuiltinToolError(`目标网站拒绝读取（HTTP ${payload.statusCode}），未获得网页内容`);
  if (payload.status !== 'success' || !record(payload.data)) throw new BuiltinToolError('网页读取服务未返回有效结果');
  return payload.data;
}

function htmlDocument(raw: string) {
  if (typeof DOMParser === 'undefined') throw new BuiltinToolError('当前环境无法解析网页');
  if (!/<(?:!doctype|html|head|body|article|main)\b/i.test(raw)) throw new BuiltinToolError('未取得有效网页内容');
  // Parse inert HTML without loading page resources or executing third-party scripts.
  const safe = raw.replace(/<(?:img|iframe|link|video|audio|source|object|embed)\b[^>]*>/gi, '');
  const doc = new DOMParser().parseFromString(safe, 'text/html');
  if (/^(?:access denied|403 forbidden|404 not found|just a moment|attention required|verify (?:you|your)|安全验证|访问受限|页面不存在)/i.test(doc.title.trim())) throw new BuiltinToolError('目标网站返回了拦截页面');
  return doc;
}

/** Convert actual public article HTML locally; no AI summary and no synthesized missing text. */
function htmlMarkdown(raw: string, target: URL): string {
  const doc = htmlDocument(raw);
  doc.querySelectorAll('script,style,noscript,nav,footer,aside,form,button,[hidden],[aria-hidden="true"]').forEach(node => node.remove());
  const root = doc.querySelector('article,main,[role="main"]') || doc.body;
  const convert = (node: Node): string => {
    if (node.nodeType === 3) return (node.textContent || '').replace(/\s+/g, ' ');
    if (node.nodeType !== 1) return '';
    const element = node as Element, tag = element.tagName.toLowerCase();
    const children = () => [...node.childNodes].map(convert).join('');
    if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${children().trim()}\n\n`;
    if (tag === 'br') return '\n';
    if (tag === 'hr') return '\n\n---\n\n';
    if (tag === 'pre') return `\n\n\`\`\`\n${node.textContent?.trim() || ''}\n\`\`\`\n\n`;
    if (tag === 'code') return `\`${children()}\``;
    if (tag === 'strong' || tag === 'b') return `**${children()}**`;
    if (tag === 'em' || tag === 'i') return `*${children()}*`;
    if (tag === 'li') return `\n- ${children().trim()}`;
    if (tag === 'blockquote') return `\n\n> ${children().trim().replace(/\n/g, '\n> ')}\n\n`;
    if (tag === 'a') {
      const label = children().trim();
      try { const href = element.getAttribute('href'); const url = href && publicLink(new URL(href, target).href); return url ? `[${label || url}](${url})` : label; } catch { return label; }
    }
    if (['p', 'div', 'section', 'article', 'main', 'ul', 'ol', 'table', 'tr'].includes(tag)) return `\n\n${children().trim()}\n\n`;
    if (tag === 'td' || tag === 'th') return `${children().trim()} | `;
    return children();
  };
  const body = convert(root).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (body.length < 40 || /^(?:enable javascript|please enable|access denied|请开启JavaScript|请启用JavaScript)/i.test(body)) throw new BuiltinToolError('网页未提供可读取的正文，可能需要登录或动态加载');
  return body;
}

async function reader(tool: SearchTool, target: URL) {
  const endpoint = checkedAddress(tool.endpoint || 'https://r.jina.ai').href.replace(/\/+$/, '');
  const result = await fallback('网页全文', [
    { name: 'Jina Reader', read: () => readPublic(`${endpoint}/${target.href}`, raw => {
      if (/^\s*(?:\{|<!doctype|<html)/i.test(raw)) throw new BuiltinToolError('阅读服务返回了错误页，未读取正文');
      const marker = raw.indexOf('Markdown Content:');
      const content = (marker >= 0 ? raw.slice(marker + 17) : raw).trim();
      if (!content || /^(?:Error|Warning):.*(?:403|429|blocked|denied|captcha)/im.test(content) || /Warning: Target URL returned error [45]\d\d/i.test(raw)) throw new BuiltinToolError('目标网站拒绝读取正文');
      return { content, source: 'Jina Reader' };
    }, 2000000) },
    { name: '备用阅读服务', read: () => readPublic(microlinkUrl(target, MICROLINK, true), raw => {
      const data = microlinkData(raw), content = text(data.markdown, 2000000);
      if (!content) throw new BuiltinToolError('没有取得 Markdown 正文');
      return { content, source: 'Microlink' };
    }, 2000000, 12000) },
    { name: '公开网页正文', read: () => {
      if (typeof DOMParser === 'undefined') throw new BuiltinToolError('当前环境无法解析网页');
      return readPublic(`${PUBLIC_HTML_PROXY}${target.href}`, raw => ({ content: htmlMarkdown(raw, target), source: '公开网页 HTML 转换' }), 2000000, 10000);
    } },
  ]);
  return { url: target.href, format: 'markdown', source: result.source, fullTextRead: true, content: result.content.slice(0, 30000), truncated: result.content.length > 30000 };
}

async function summary(tool: SearchTool, target: URL) {
  const metadata = (title: string, description: string) => {
    if (!title && !description) throw new BuiltinToolError('网页没有提供可读取的标题或简介');
    return { url: target.href, kind: '网页标题与简介', title, description, fullTextRead: false,
      note: '仅取得网页标题和简介，未读取正文，不据此推断全文细节。' };
  };
  const fromHead = (raw: string) => {
    const doc = htmlDocument(raw);
    return metadata(text(doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.querySelector('title')?.textContent, 500),
      text(doc.querySelector('meta[property="og:description"],meta[name="description"],meta[name="twitter:description"]')?.getAttribute('content'), 2000));
  };
  return fallback('网页标题与简介', [
    { name: '网页预览服务', read: () => readPublic(microlinkUrl(target, tool.endpoint || MICROLINK), raw => {
      const data = microlinkData(raw); return metadata(text(data.title, 500), text(data.description, 2000));
    }) },
    { name: '网页公开元信息', read: () => readPublic(target.href, fromHead, 500000, 4000, true) },
    { name: '备用元信息读取', read: () => {
      if (typeof DOMParser === 'undefined') throw new BuiltinToolError('当前环境无法解析网页元信息');
      return readPublic(`${PUBLIC_HTML_PROXY}${target.href}`, fromHead, 500000, 10000, true);
    } },
  ]);
}

export async function executeBuiltinTool(tool: SearchTool, query: string): Promise<string> {
  if (tool.provider === 'builtin-hot') return JSON.stringify(await hot(tool, query));
  if (tool.provider === 'wiki') return JSON.stringify(await encyclopedia(tool, query));
  const target = checkedAddress(query);
  if (tool.provider === 'summary') return JSON.stringify(await summary(tool, target));
  if (tool.provider === 'reader') return JSON.stringify(await reader(tool, target));
  throw new BuiltinToolError('不支持的内置工具。');
}
