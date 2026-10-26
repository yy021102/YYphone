export type LinkPreview = { url: string; title: string; description: string; image: string; source: string };
export function publicLink(value: string): string | undefined {
  try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || /^(localhost|.*\.local|127\.|10\.|192\.168\.|169\.254\.|0\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname)) return; return url.href; } catch { return; }
}
export function extractSharedLink(text: string): string | undefined {
  const match = text.match(/(?:https?:\/\/|www\.)[^\s<>"“”]+/i)?.[0]?.replace(/[，。！？；、）】》」.,!?;:)]+$/g, '');
  return match ? publicLink(match.startsWith('www.') ? `https://${match}` : match) : undefined;
}
export function fallbackLinkPreview(url: string, text = ''): LinkPreview {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const source = /(^|\.)(xiaohongshu\.com|xhslink\.com)$/.test(host) ? '小红书' : /(^|\.)zhihu\.com$/.test(host) ? '知乎' : /(^|\.)bilibili\.com$/.test(host) || host === 'b23.tv' ? '哔哩哔哩' : host === 'mp.weixin.qq.com' ? '微信公众号' : /(^|\.)(douyin\.com|iesdouyin\.com)$/.test(host) ? '抖音' : host;
  const caption = text.replace(/(?:https?:\/\/|www\.)[^\s<>"“”]+/gi, '').replace(/复制[^\n]*(?:打开|查看)[^\n]*/g, '').trim();
  return { url, title: caption.slice(0, 120) || `${source}分享`, description: '', image: '', source };
}
const cache = new Map<string, { until: number; request: Promise<LinkPreview> }>();
export function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const safe = publicLink(url); if (!safe) return Promise.reject(new Error('无效的外部链接'));
  const cached = cache.get(safe); if (cached && cached.until > Date.now()) return cached.request;
  const request = (async () => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const query = new URLSearchParams({ url: safe, meta: 'true', screenshot: 'false', video: 'false', audio: 'false', palette: 'false' });
      const response = await fetch(`https://api.microlink.io?${query}`, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('暂时无法读取网页预览');
      const raw = await response.text(); if (raw.length > 250000) throw new Error('预览过大');
      const result = JSON.parse(raw); if (result.status !== 'success' || !result.data) throw new Error('网页暂不可读取');
      const data = result.data, base = fallbackLinkPreview(safe);
      return { ...base, title: typeof data.title === 'string' ? data.title.trim().slice(0, 300) : '', description: typeof data.description === 'string' ? data.description.trim().slice(0, 1200) : '', image: typeof data.image?.url === 'string' ? publicLink(data.image.url) ?? '' : '' };
    } finally { clearTimeout(timer); }
  })();
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(safe, { until: Date.now() + 10 * 60000, request });
  void request.catch(() => { cache.delete(safe); }); return request;
}
