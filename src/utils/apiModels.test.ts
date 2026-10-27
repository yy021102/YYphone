import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fetchApiModels, modelListRequest, parseModelList } from './apiModels';
const nativeFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = nativeFetch; });
test('OpenAI-compatible catalogs normalize base, chat, image and models endpoints without changing query routing', () => {
  for (const path of ['/v1', '/v1/chat/completions', '/v1/completions', '/v1/images/generations', '/v1/images/edits', '/v1/models']) {
    const r = modelListRequest({ endpoint: `https://proxy.invalid${path}?tenant=mine#fragment`, apiKey: ' secret ', purpose: 'image' });
    assert.equal(r.url.pathname, '/v1/models'); assert.equal(r.url.searchParams.get('tenant'), 'mine'); assert.equal(r.url.hash, ''); assert.equal(r.headers.Authorization, 'Bearer secret');
  }
  assert.equal(modelListRequest({ endpoint: 'https://api.openai.com', apiKey: 'key' }).url.pathname, '/v1/models');
});
test('native Google catalogs handle full generate/predict URLs, use key headers and reset pagination', () => {
  for (const endpoint of ['https://generativelanguage.googleapis.com', 'https://google-proxy.invalid/v1beta', 'https://google-proxy.invalid/v1beta/models/imagen:predict?key=old&pageToken=old', 'https://google-proxy.invalid/v1/models/gemini:generateContent']) {
    const r = modelListRequest({ endpoint, apiKey: 'new', protocol: 'google' });
    assert(r.url.pathname.endsWith('/models')); assert(!r.url.pathname.includes('/v1/v1beta')); assert(!r.url.searchParams.has('key')); assert(!r.url.searchParams.has('pageToken')); assert.equal(r.headers['x-goog-api-key'], 'new'); assert.equal(r.headers.Authorization, undefined);
  }
});
test('image catalogs retain predict-based and unfamiliar image models rather than applying a text-only filter', () => {
  const payload = { models: [{ name: 'models/imagen-model', supportedGenerationMethods: ['predict'] }, { name: 'models/gemini-image', displayName: '图片模型', supportedGenerationMethods: ['generateContent'] }, { id: 'custom-picture' }, { id: 'custom-picture' }] };
  const images = parseModelList(payload, 'image'); assert.equal(images.length, 3); assert(images.some(m => m.id === 'imagen-model')); assert.equal(images[1].label, '图片模型 (gemini-image)');
  assert(!parseModelList(payload, 'decision').some(m => m.id === 'imagen-model')); assert.deepEqual(parseModelList({ data: ['model-a', { id: 'model-b' }, null] }).map(m => m.id), ['model-a', 'model-b']);
});
test('Google pagination is followed without dropping image models, leaking keys in URLs or generating content', async () => {
  const urls: string[] = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input)); urls.push(url.toString()); assert.equal(options?.method, 'GET'); assert.equal(options?.body, undefined); assert.equal((options?.headers as any)['x-goog-api-key'], 'TOP_SECRET');
    return new Response(JSON.stringify(url.searchParams.has('pageToken') ? { models: [{ name: 'models/imagen-b', supportedGenerationMethods: ['predict'] }] } : { models: [{ name: 'models/image-a' }], nextPageToken: 'next-token' }));
  };
  const result = await fetchApiModels({ endpoint: 'https://google.invalid', protocol: 'google', apiKey: 'TOP_SECRET', purpose: 'image' }); assert.equal(result.length, 2); assert.equal(urls.length, 2); assert(!urls.join('').includes('TOP_SECRET'));
});
test('catalog errors retain no invented defaults and never echo credentials from an error body', async () => {
  globalThis.fetch = async () => new Response('credential=TOP_SECRET', { status: 403 });
  await assert.rejects(fetchApiModels({ endpoint: 'https://proxy.invalid/v1', apiKey: 'TOP_SECRET' }), e => e instanceof Error && /403/.test(e.message) && !e.message.includes('TOP_SECRET'));
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [] })); await assert.rejects(fetchApiModels({ endpoint: 'https://proxy.invalid/v1', apiKey: 'key' }), /没有返回可用模型/);
  globalThis.fetch = async () => { throw new Error('must not fetch'); }; await assert.rejects(fetchApiModels({ endpoint: 'https://image.novelai.net', apiKey: 'key', unsupported: true }), /手动填写/);
  assert.throws(() => modelListRequest({ endpoint: 'javascript:bad', apiKey: 'key' }), /HTTP/);
});
test('aborted requests and repeated pagination tokens cannot return a stale or partial successful list', async () => {
  const controller = new AbortController(); globalThis.fetch = async () => { controller.abort(); return new Response(JSON.stringify({ data: [{ id: 'old' }] })); };
  await assert.rejects(fetchApiModels({ endpoint: 'https://proxy.invalid/v1', apiKey: 'key' }, controller.signal), { name: 'AbortError' });
  globalThis.fetch = async () => new Response(JSON.stringify({ models: [{ name: 'models/one' }], nextPageToken: 'same' }));
  await assert.rejects(fetchApiModels({ endpoint: 'https://google.invalid', apiKey: 'key', protocol: 'google' }), /分页异常/);
});
