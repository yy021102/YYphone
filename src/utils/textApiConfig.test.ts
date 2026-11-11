import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { apiTemperature, apiMaxTokens, apiOutputLimit, textApiConfig } from './textApiConfig';
import { readAiTextResponse } from './aiTextResponse';
import { requestConfiguredAiText, getActiveApiPreset } from './aiApi';
import { requestChatReply } from './chatReply';
import { clearDbStorage } from './dbStorage';
import { writeStoredValue } from './localStorage';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v),
  removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null,
  get length() { return values.size; },
} } });
const connection = { endpoint: 'https://test.invalid/v1', apiKey: 'mock', model: 'chat-model' };
const messages = [{ role: 'system' as const, content: '聊天' }, { role: 'user' as const, content: '你好' }];
const response = (text = '{"reply":["你好"]}') => Response.json({ choices: [{ message: { content: text } }] });
beforeEach(async () => {
  await clearDbStorage();
  writeStoredValue('yyphone:api-presets', [{ id: 'main', name: '主 API', ...connection, temperature: 0 }]);
});
afterEach(() => mock.restoreAll());

test('chat and Little P requests pass cancellation to fetch and discard responses arriving after stop', async () => {
  for (const google of [false, true]) {
    const api = google ? { ...connection, endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-test' } : connection;
    for (const chat of [false, true]) {
      const controller = new AbortController(); let calls = 0, usages = 0;
      mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
        assert.equal(init?.signal, controller.signal); calls++;
        controller.abort(); // A gateway may finish its response even after the browser cancels.
        return google ? Response.json({ candidates: [{ content: { parts: [{ text: 'bad response' }] } }] }) : response('bad response');
      });
      await assert.rejects(chat
        ? requestChatReply(messages, api, () => usages++, undefined, { signal: controller.signal })
        : requestConfiguredAiText('小P', '你好', { api, signal: controller.signal, includeGlobalWorldBooks: false }), { name: 'AbortError' });
      assert.equal(calls, 1); assert.equal(usages, 0); // No format-correction request after cancellation.
      mock.restoreAll();
    }
  }
});
test('an already stopped request never starts a network request', async () => {
  const controller = new AbortController(); controller.abort();
  const fetch = mock.method(globalThis, 'fetch', async () => response());
  await assert.rejects(requestChatReply(messages, connection, () => {}, undefined, { signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(requestConfiguredAiText('小P', '你好', { api: connection, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 0);
});

test('temperature accepts zero and finite provider range, ignoring malformed imported values', () => {
  assert.equal(apiTemperature(0), 0); assert.equal(apiTemperature(2), 2); assert.equal(apiTemperature(.7), .7);
  for (const value of [-.1, 2.1, NaN, Infinity, '1', null, undefined]) assert.equal(apiTemperature(value), undefined);
});
test('text routing preserves gateway paths and query strings and accepts base URLs or full completion routes', () => {
  for (const endpoint of ['https://test.invalid/v1', 'https://test.invalid/v1/', '“https://test.invalid/v1/chat/completions”']) {
    const config = textApiConfig({ ...connection, endpoint, apiKey: 'Bearer mock' });
    assert.equal(config.url, 'https://test.invalid/v1/chat/completions'); assert.equal(config.headers.Authorization, 'Bearer mock');
  }
  assert.equal(textApiConfig({ ...connection, endpoint: 'https://test.invalid/Proxy/V1?signature=Ab%2fCd' }).url, 'https://test.invalid/Proxy/V1/chat/completions?signature=Ab%2fCd');
  assert.equal(textApiConfig({ ...connection, endpoint: 'https://api.deepseek.com' }).url, 'https://api.deepseek.com/chat/completions');
  assert.throws(() => textApiConfig({ ...connection, apiKey: 'Bearer ' }), /Key/);
  assert.throws(() => textApiConfig({ ...connection, endpoint: 'javascript:invalid' }), /HTTP/);
});
test('Gemini roots, versioned bases and complete generation URLs share a single route and query authentication', () => {
  for (const endpoint of ['https://generativelanguage.googleapis.com', 'https://generativelanguage.googleapis.com/v1beta', 'https://generativelanguage.googleapis.com/v1beta/models', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?old=1']) {
    const config = textApiConfig({ endpoint, apiKey: 'mock', model: 'gemini-test' });
    const url = new URL(config.url);
    assert.equal(url.pathname, '/v1beta/models/gemini-test:generateContent'); assert.equal(url.searchParams.get('key'), 'mock');
    assert(!config.headers.Authorization);
  }
  assert.equal(new URL(textApiConfig({ ...connection, endpoint: 'https://gateway.invalid/google/v1beta', model: 'models/gemini-test' }).url).pathname, '/google/v1beta/models/gemini-test:generateContent');
});
test('saved zero temperature reaches normal chat and its single format correction, while model-default omits the parameter', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)); assert.equal(payload.temperature, 0); calls++;
    return response(calls === 1 ? 'broken' : '{"reply":["你好"]}');
  });
  await requestChatReply(messages, getActiveApiPreset(), () => {}); assert.equal(calls, 2);
  mock.restoreAll(); mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert(!Object.hasOwn(JSON.parse(String(init?.body)), 'temperature')); return response();
  });
  await requestChatReply(messages, connection, () => {});
});
test('content generation inherits saved temperature without overriding dedicated task or secondary API settings', async () => {
  const bodies: Record<string, unknown>[] = [];
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => { bodies.push(JSON.parse(String(init?.body))); return response('OK'); });
  await requestConfiguredAiText('测试', '你好', { includeGlobalWorldBooks: false });
  await requestConfiguredAiText('测试', '你好', { includeGlobalWorldBooks: false, temperature: .3 });
  await requestConfiguredAiText('测试', '你好', { includeGlobalWorldBooks: false, api: { ...connection, endpoint: 'https://secondary.invalid/v1' } });
  assert.equal(bodies[0].temperature, 0); assert.equal(bodies[1].temperature, .3); assert(!Object.hasOwn(bodies[2], 'temperature'));
});
test('both Gemini generation paths apply temperature in generationConfig and leave default unset', async () => {
  const api = { ...connection, endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-test', temperature: .6 };
  const bodies: any[] = [];
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    assert.equal(new URL(String(url)).pathname, '/v1beta/models/gemini-test:generateContent');
    bodies.push(JSON.parse(String(init?.body))); return Response.json({ candidates: [{ content: { parts: [{ text: '{"reply":["你好"]}' }] } }] });
  });
  await requestChatReply(messages, api, () => {});
  await requestConfiguredAiText('测试', '你好', { api, includeGlobalWorldBooks: false });
  await requestConfiguredAiText('测试', '你好', { api: { ...api, temperature: undefined }, includeGlobalWorldBooks: false });
  assert.equal(bodies[0].generationConfig.temperature, .6); assert.equal(bodies[1].generationConfig.temperature, .6);
  assert(!Object.hasOwn(bodies[2].generationConfig ?? {}, 'temperature'));
});

const sse = (events: unknown[], suffix = 'data: [DONE]\r\n\r\n') => {
  const bytes = new TextEncoder().encode(': keepalive\r\n\r\n' + events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join('') + suffix);
  let position = 0;
  return new Response(new ReadableStream({ pull(controller) {
    if (position === bytes.length) { controller.close(); return; }
    controller.enqueue(bytes.slice(position, ++position)); // Splits UTF-8 and CRLF across network chunks.
  } }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
};

test('output limits accept positive safe integers, cap task limits and preserve unset defaults', () => {
  assert.equal(apiMaxTokens(1), 1); assert.equal(apiMaxTokens(65536), 65536);
  for (const value of [0, -1, 1.5, Infinity, NaN, '1024', Number.MAX_SAFE_INTEGER + 1]) assert.equal(apiMaxTokens(value), undefined);
  assert.equal(apiOutputLimit(1000, 2000), 1000); assert.equal(apiOutputLimit(4000, 2000), 2000);
  assert.equal(apiOutputLimit(undefined, 1500), 1500); assert.equal(apiOutputLimit(undefined), undefined);
});

test('chat and content generation use streaming and saved output limits on both API protocols', async () => {
  for (const google of [false, true]) {
    const api = { ...connection, ...(google ? { endpoint: 'https://gemini.invalid/v1beta', model: 'gemini-test' } : {}), maxTokens: 3000, stream: true };
    let calls = 0;
    mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)); calls++;
      if (google) {
        assert.equal(new URL(String(url)).pathname, '/v1beta/models/gemini-test:streamGenerateContent');
        assert.equal(new URL(String(url)).searchParams.get('alt'), 'sse');
        assert.equal(body.generationConfig.maxOutputTokens, calls === 1 ? 3000 : 1000);
        return sse([{ candidates: [{ content: { parts: [{ text: '不可展示的推理', thought: true }, { text: '{"reply":[' }] } }] },
          { candidates: [{ content: { parts: [{ text: '"你好呀"]}' }] }, finishReason: 'STOP' }] }], '');
      }
      assert.equal(body.stream, true); assert.equal(body.max_tokens, calls === 1 ? 3000 : 1000);
      return sse([{ choices: [{ index: 0, delta: { role: 'assistant', reasoning_content: '不应展示的推理' } }] },
        { choices: [{ index: 0, delta: { content: '{"reply":[' } }] },
        { choices: [{ index: 0, delta: { content: '"你好呀"]}' }, finish_reason: 'stop' }] }]);
    });
    assert.deepEqual((await requestChatReply(messages, api, () => {})).reply, ['你好呀']);
    assert.equal(await requestConfiguredAiText('测试', '你好', { api, maxTokens: 1000, includeGlobalWorldBooks: false }), '{"reply":["你好呀"]}');
    assert.equal(calls, 2); mock.restoreAll();
  }
});

test('stream errors, truncation and early disconnection never trigger a paid format retry or return partial replies', async () => {
  for (const events of [
    [{ choices: [{ delta: { content: '{"reply":[' } }] }, { error: { message: '网关生成失败' } }],
    [{ choices: [{ delta: { content: '{"reply":["半句"]}' }, finish_reason: 'length' }] }],
    [{ choices: [{ delta: { content: '{"reply":["未完成"]}' } }] }],
  ]) {
    const fetch = mock.method(globalThis, 'fetch', async () => sse(events, ''));
    await assert.rejects(requestChatReply(messages, { ...connection, stream: true }, () => {}), /失败|Token|提前结束/);
    assert.equal(fetch.mock.callCount(), 1); mock.restoreAll();
  }
  await assert.rejects(readAiTextResponse(sse([{ candidates: [{ finishReason: 'MAX_TOKENS' }] }], ''), true), /Token/);
});

test('stopping a waiting stream cancels its reader and never commits usage or triggers retry', async () => {
  const controller = new AbortController(); let cancelled = false, usage = 0;
  const fetch = mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(stream) { stream.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n')); setTimeout(() => controller.abort(), 10); },
    cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/event-stream' } }));
  await assert.rejects(requestChatReply(messages, { ...connection, stream: true }, () => usage++, undefined, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(cancelled, true); assert.equal(usage, 0); assert.equal(fetch.mock.callCount(), 1);
});

test('streaming gracefully accepts a gateway JSON response and non-streaming retains content arrays', async () => {
  mock.method(globalThis, 'fetch', async () => response());
  assert.deepEqual((await requestChatReply(messages, { ...connection, stream: true, maxTokens: 3000 }, () => {})).reply, ['你好']);
  assert.equal(await readAiTextResponse(Response.json({ choices: [{ message: { content: [{ type: 'text', text: '文字' }, { type: 'text', text: '内容' }] } }] }), false), '文字内容');
  const url = new URL(textApiConfig({ ...connection, endpoint: 'https://google.invalid/v1beta/models/gemini-test:streamGenerateContent?alt=sse' }).url);
  assert.equal(url.pathname, '/v1beta/models/gemini-test:generateContent'); assert.equal(url.searchParams.has('alt'), false);
});
