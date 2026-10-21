import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { extractFirstZipEntry, generateImage } from './imageGeneration';
import { buildMinimaxUrl, buildSpeechUrl, getVoiceLanguageCodes, hexToBytes } from './voiceModel';

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
