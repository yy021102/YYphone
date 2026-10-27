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

test('DeepSeek catalogs support official base and full endpoints and never duplicate copied Bearer authentication', async () => {
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); requests.push(url.pathname);
    assert.equal(url.origin, 'https://api.deepseek.com'); assert.equal(init?.method, 'GET'); assert.equal(init?.body, undefined);
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer ds-test-secret'); assert.equal(init?.credentials, 'omit');
    return Response.json({ object: 'list', data: [{ id: 'deepseek-flash', object: 'model', owned_by: 'deepseek', name: 'DeepSeek' }] });
  };
  for (const path of ['', '/', '/v1', '/v1/', '/chat/completions', '/v1/chat/completions', '/models', '/v1/models']) {
    const models = await fetchApiModels({ endpoint: `https://api.deepseek.com${path}`, apiKey: '  Bearer ds-test-secret  ', purpose: 'decision' });
    assert.equal(models[0].id, 'deepseek-flash');
  }
  assert.deepEqual([...new Set(requests)].sort(), ['/models', '/v1/models']);
  assert.throws(() => modelListRequest({ endpoint: 'https://api.deepseek.com', apiKey: 'Bearer' }), /不能只填写 Bearer/);
});

test('catalog requests accept copied punctuation and invisible marks without changing gateway routing', async () => {
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    assert.equal(String(input), 'https://api.deepseek.com/v1/models?tenant=Keep%2fCase');
    return Response.json({ data: [{ id: 'returned-model' }] });
  };
  for (const endpoint of ['“https：//api.deepseek.com/v1?tenant=Keep%2fCase”', '\u200Fhttps://api.deepseek.com/v1?tenant=Keep%2fCase']) {
    assert.equal((await fetchApiModels({ endpoint, apiKey: 'key' }))[0].id, 'returned-model');
  }
  assert.equal(calls, 2);
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
