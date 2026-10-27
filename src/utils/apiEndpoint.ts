// Clean formatting introduced by copying an API address from chat or a document.
// Keep paths and query strings intact: gateways can use case-sensitive routes or signatures.
export function normalizeApiEndpoint(value: string): string {
  const wrappers: Record<string, string> = { '"': '"', "'": "'", '`': '`', '“': '”', '‘': '’', '<': '>' };
  const trimOutside = (input: string) => {
    const start = input.trim().replace(/^[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]+/, '').trim();
    const end = start.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]+$/, '').trim();
    // A mark at the end of an opaque query may be intentional; only trim it
    // outside a surrounding quote, or when there is no query/fragment.
    return !/[?#]/.test(start) || wrappers[start[0]] === end.at(-1) ? end : start;
  };
  let endpoint = trimOutside(value);
  for (let i = 0; i < 3 && endpoint.length > 1 && wrappers[endpoint[0]] === endpoint.at(-1); i++) {
    endpoint = trimOutside(endpoint.slice(1, -1));
  }
  return endpoint.replace(/^([^:/／?#]+)[:：]([/／]{2})([^/／?#]*)/, (prefix, scheme: string, _slashes: string, authority: string) => {
    const clean = (part: string) => part.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, '');
    const protocol = clean(scheme);
    return /^https?$/i.test(protocol) ? `${protocol}://${clean(authority)}` : prefix;
  });
}

export function parseApiEndpoint(value: string): URL {
  let url: URL;
  try { url = new URL(normalizeApiEndpoint(value)); }
  catch { throw new Error('接口地址格式无效，请填写完整的 HTTP(S) 地址，检查是否混入说明文字。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('请使用不含账号密码的 HTTP(S) 接口地址。');
  }
  return url;
}
