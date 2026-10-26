import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { extractSharedLink, fallbackLinkPreview, fetchLinkPreview, publicLink } from './linkPreview';
afterEach(() => mock.restoreAll());
test('recognises social share links, strips sentence punctuation and retains site and caption on fallback', () => {
  assert.equal(extractSharedLink('这篇很好 https://www.zhihu.com/question/123。'), 'https://www.zhihu.com/question/123');
  assert.equal(extractSharedLink('分享 http://xhslink.com/abc ，复制打开'), 'http://xhslink.com/abc');
  assert.equal(fallbackLinkPreview('https://xhslink.com/a', '今天的穿搭 https://xhslink.com/a').source, '小红书');
  assert.equal(fallbackLinkPreview('https://xhslink.com/a', '今天的穿搭 https://xhslink.com/a').title, '今天的穿搭');
  for (const url of ['javascript:alert(1)', 'file:///a', 'http://127.0.0.1/a', 'http://10.0.0.1/a', 'https://u:p@example.com']) assert.equal(publicLink(url), undefined);
});
test('retrieves only metadata, sanitises cover URLs and deduplicates simultaneous requests', async () => {
  let calls = 0; let endpoint = '';
  mock.method(globalThis, 'fetch', async (url: unknown) => { calls++; endpoint = String(url); return Response.json({ status: 'success', data: { title: '真实标题', description: '网页简介', image: { url: 'https://images.example.com/cover.png' } } }); });
  const [a,b] = await Promise.all([fetchLinkPreview('https://example.com/share-test'),fetchLinkPreview('https://example.com/share-test')]);
  assert.equal(calls,1); assert.deepEqual(a,b); assert.equal(a.title,'真实标题'); assert.equal(a.image,'https://images.example.com/cover.png'); assert.match(endpoint,/meta=true/); assert(!endpoint.includes('apiKey'));
});
test('unavailable pages reject without inventing a title or summary', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ status:'fail' }));
  await assert.rejects(fetchLinkPreview('https://example.com/unavailable-test'));
  assert.equal(fallbackLinkPreview('https://www.zhihu.com/question/1').title,'知乎分享');
});
