import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { extractFirstZipEntry, generateImage, imageDimensions, isImageGenerationSettings } from './imageGeneration';
import { buildMinimaxUrl, buildSpeechUrl, getVoiceLanguageCodes, hexToBytes, isVoiceModelSettings, synthesizeVoice, DEFAULT_VOICE_MODEL_SETTINGS } from './voiceModel';
import { isImageReference } from './imageReference';

const buildZip = (name: string, content: Uint8Array, method: 0 | 8) => {
  const data = method === 8 ? new Uint8Array(deflateRawSync(content)) : content;
  const nameBytes = new TextEncoder().encode(name);
  const local = new Uint8Array(30 + nameBytes.length + data.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(8, method, true);
  localView.setUint32(18, data.length, true);
  localView.setUint32(22, content.length, true);
  localView.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);
  local.set(data, 30 + nameBytes.length);
  const central = new Uint8Array(46 + nameBytes.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(10, method, true);
  centralView.setUint32(20, data.length, true);
  centralView.setUint32(24, content.length, true);
  centralView.setUint16(28, nameBytes.length, true);
  centralView.setUint32(42, 0, true);
  central.set(nameBytes, 46);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length, true);
  const zip = new Uint8Array(local.length + central.length + end.length);
  zip.set(local, 0);
  zip.set(central, local.length);
  zip.set(end, local.length + central.length);
  return zip;
};

test('NovelAI zip responses are unpacked for stored and deflated entries', async () => {
  const png = new Uint8Array(Array.from({ length: 300 }, (_, index) => index % 7));
  assert.deepEqual(await extractFirstZipEntry(buildZip('image_0.png', png, 0)), png);
  assert.deepEqual(await extractFirstZipEntry(buildZip('image_0.png', png, 8)), png);
  await assert.rejects(extractFirstZipEntry(new Uint8Array(40)), /压缩包格式无效/);
});

test('voice helpers build provider URLs and decode MiniMax hex audio', () => {
  assert.equal(buildMinimaxUrl('https://api.minimaxi.com/', '123').href, 'https://api.minimaxi.com/v1/t2a_v2?GroupId=123');
  assert.equal(buildMinimaxUrl('https://api.minimax.io/v1', '').href, 'https://api.minimax.io/v1/t2a_v2');
  assert.equal(buildSpeechUrl('https://tts.example.com/v1').href, 'https://tts.example.com/v1/audio/speech');
  assert.throws(() => buildSpeechUrl('ftp://tts.example.com'), /HTTP/);
  assert.deepEqual([...hexToBytes('49443303')], [0x49, 0x44, 0x33, 0x03]);
  assert.throws(() => hexToBytes('abc'), /格式无效/);
  assert.deepEqual(getVoiceLanguageCodes('粤语'), { iso: 'yue', minimax: 'Chinese,Yue' });
});

test('image generation routes Gemini and Imagen requests to Google endpoints', async (t) => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    const payload = String(url).includes(':predict')
      ? { predictions: [{ bytesBase64Encoded: 'AAA', mimeType: 'image/png' }] }
      : { candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/jpeg', data: 'BBB' } }] } }] };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  assert.equal(await generateImage('a cat', { provider: 'imagen', apiKey: 'k', prompt: 'anime' }), 'data:image/png;base64,AAA');
  assert.equal(await generateImage('a dog', { provider: 'gemini' }, {
    endpoint: 'https://generativelanguage.googleapis.com', apiKey: 'shared',
  }), 'data:image/jpeg;base64,BBB');
  assert.match(calls[0].url, /models\/imagen-4\.0-generate-001:predict$/);
  assert.deepEqual(calls[0].body.instances, [{ prompt: 'anime\na cat' }]);
  assert.match(calls[1].url, /models\/gemini-2\.5-flash-image:generateContent$/);
  await assert.rejects(generateImage('x', { provider: 'novelai' }), /API Key/);
});

const referenceImage = 'data:image/png;base64,iVBORw0KGgo=';
const api = { endpoint: 'https://media.example/v1', apiKey: 'test-key' };

test('legacy media settings remain valid and new speed/size values are validated', () => {
  const { speed: _speed, ...legacyVoice } = DEFAULT_VOICE_MODEL_SETTINGS;
  assert(isVoiceModelSettings(legacyVoice));
  assert(isVoiceModelSettings({ ...legacyVoice, speed: 1.35 }));
  assert(!isVoiceModelSettings({ ...legacyVoice, speed: NaN }));
  assert(!isVoiceModelSettings({ ...legacyVoice, speed: 3 }));
  assert(isImageGenerationSettings({ provider: 'openai', endpoint: '', apiKey: '', model: '' }));
  assert(!isImageGenerationSettings({ provider: 'openai', endpoint: '', apiKey: '', model: '', size: 'huge' }));
  assert(isImageReference(referenceImage));
  assert(!isImageReference('https://external.test/secret.png'));
  assert(!isImageReference('data:text/html;base64,AAA='));
  assert.deepEqual(imageDimensions('novelai'), { width: 832, height: 1216, size: '832x1216', aspectRatio: '3:4' });
});

test('voice synthesis uses draft settings, speed and cancellation for every provider', async (t) => {
  const calls: Array<{ url: string; init: RequestInit; body: any }> = [];
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    calls.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
    return String(url).includes('t2a_v2')
      ? new Response(JSON.stringify({ base_resp: { status_code: 0 }, data: { audio: '49443303' } }), { headers: { 'content-type': 'application/json' } })
      : new Response(new Uint8Array([0x49, 0x44, 0x33, 0x03]), { headers: { 'content-type': 'audio/mpeg' } });
  });
  const signal = new AbortController().signal;
  for (const provider of ['openai', 'minimax', 'moss'] as const) {
    const audio = await synthesizeVoice('测试', 'voice-test', '中文', { settings: { ...DEFAULT_VOICE_MODEL_SETTINGS, provider, domesticEndpoint: api.endpoint, key: api.apiKey, speed: 1.35 }, signal });
    assert.equal(audio.size, 4);
  }
  assert.equal(calls[0].body.speed, 1.35);
  assert.equal(calls[1].body.voice_setting.speed, 1.35);
  assert.equal(calls[2].body.speed, 1.35);
  assert(calls.every((call) => call.init.signal === signal));
  await synthesizeVoice('测试', 'voice-test', '中文', { settings: { ...DEFAULT_VOICE_MODEL_SETTINGS, domesticEndpoint: api.endpoint, key: api.apiKey, speed: undefined } });
  assert.equal(calls[3].body.speed, 1);
});

test('voice connection cannot report success for an HTML page, empty audio, or MiniMax error', async (t) => {
  const settings = { ...DEFAULT_VOICE_MODEL_SETTINGS, domesticEndpoint: api.endpoint, key: api.apiKey };
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>not audio</html>', { headers: { 'content-type': 'text/html' } }));
  await assert.rejects(synthesizeVoice('test', 'alloy', '中文', { settings }), /未返回音频/);
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array(), { headers: { 'content-type': 'audio/mpeg' } }));
  await assert.rejects(synthesizeVoice('test', 'alloy', '中文', { settings }), /空音频/);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ base_resp: { status_code: 1004, status_msg: 'invalid key' } }), { headers: { 'content-type': 'application/json' } }));
  await assert.rejects(synthesizeVoice('test', 'test', '中文', { settings: { ...settings, provider: 'minimax' } }), /1004.*invalid key/);
});

test('OpenAI images use selected dimensions and multipart edits with the actual reference bytes', async (t) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ data: [{ b64_json: 'AAA' }] }), { headers: { 'content-type': 'application/json' } });
  });
  const signal = new AbortController().signal;
  await generateImage('a cat', { provider: 'openai', size: 'landscape', ...api }, undefined, signal);
  assert.equal(JSON.parse(String(calls[0].init.body)).size, '1536x1024');
  await generateImage('a cat', { provider: 'openai', size: 'portrait', model: 'gpt-image-1', referenceImage, referenceSimilarity: 0.8, ...api }, undefined, signal);
  assert.match(calls[1].url, /\/images\/edits$/);
  const form = calls[1].init.body as FormData;
  assert.equal(form.get('size'), '1024x1536');
  assert.equal(form.get('input_fidelity'), 'high');
  assert(String(form.get('prompt')).includes('80%'));
  assert.deepEqual(new Uint8Array(await (form.get('image') as Blob).arrayBuffer()), new Uint8Array([137,80,78,71,13,10,26,10]));
  assert(!('Content-Type' in (calls[1].init.headers as Record<string, string>)));
  assert.equal(calls[1].init.signal, signal);
  await generateImage('a cat', { provider: 'openai', model: 'gpt-image-2', referenceImage, ...api });
  assert.equal((calls[2].init.body as FormData).get('input_fidelity'), null);
});

test('NovelAI reference similarity maps inversely to redraw strength and selected dimensions', async (t) => {
  let body: any;
  t.mock.method(globalThis, 'fetch', async (_url: URL, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
  });
  await generateImage('a cat', { provider: 'novelai', size: 'landscape', referenceImage, referenceSimilarity: 0.75, ...api });
  assert.equal(body.action, 'img2img');
  assert.equal(body.parameters.strength, 0.25);
  assert.equal(body.parameters.image, 'iVBORw0KGgo=');
  assert.equal(body.parameters.width, 1216);
  assert.equal(body.parameters.height, 832);
  await generateImage('a cat', { provider: 'novelai', ...api });
  assert.equal(body.action, 'generate');
  assert.equal(body.parameters.width, 832);
  assert.equal(body.parameters.height, 1216);
  assert.equal(body.parameters.image, undefined);
});

test('Gemini sends reference image parts and aspect ratio; Imagen rejects unsupported references', async (t) => {
  let body: any;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url: URL, init: RequestInit) => {
    calls++; body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: 'AAA', mimeType: 'image/png' } }] } }] }), { headers: { 'content-type': 'application/json' } });
  });
  await generateImage('a cat', { provider: 'gemini', size: 'portrait', referenceImage, referenceSimilarity: 0.4, apiKey: 'k' });
  assert.equal(body.generationConfig.imageConfig.aspectRatio, '3:4');
  assert.deepEqual(body.contents[0].parts[0], { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } });
  assert(body.contents[0].parts[1].text.includes('40%'));
  await assert.rejects(generateImage('a cat', { provider: 'imagen', referenceImage, apiKey: 'k' }), /不支持参考图/);
  await assert.rejects(generateImage('a cat', { provider: 'gemini', referenceImage: 'https://bad.test/private.png', apiKey: 'k' }), /参考图无效/);
  assert.equal(calls, 1);
});
