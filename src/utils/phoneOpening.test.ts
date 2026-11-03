import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mock, test } from 'node:test';
import { isOpeningStyle, OPENING_STYLES, openingMedia, readOpeningStyle } from './phoneOpening';
import { SETTINGS_KEYS } from './settings';

test('old settings keep pearl; all styles persist independently and invalid preferences are reported', () => {
  const items = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key: string) => items.get(key) ?? null } } });
  assert.equal(readOpeningStyle(), 'pearl');
  items.set(SETTINGS_KEYS.openingAnimation, 'false');
  items.set(SETTINGS_KEYS.openingStyle, '"rain"');
  assert.equal(readOpeningStyle(), 'rain');
  items.set(SETTINGS_KEYS.openingStyle, '"across"');
  assert.equal(readOpeningStyle(), 'across');
  items.set(SETTINGS_KEYS.openingStyle, '"cream"');
  assert.equal(readOpeningStyle(), 'cream');
  items.set(SETTINGS_KEYS.openingStyle, '"unknown"');
  const warning = mock.method(console, 'warn', () => {});
  try { assert.equal(readOpeningStyle(), 'pearl'); assert.equal(warning.mock.callCount(), 1); }
  finally { warning.mock.restore(); }
  assert.equal(items.get(SETTINGS_KEYS.openingAnimation), 'false');
  for (const value of [undefined, null, '', true, {}, 'RAIN']) assert.equal(isOpeningStyle(value), false);
  for (const style of OPENING_STYLES) assert.ok(isOpeningStyle(style.id));
  assert.equal(OPENING_STYLES.find(style => style.id === 'across')?.name, '屏幕两端');
  assert.equal(OPENING_STYLES.find(style => style.id === 'cream')?.name, '奶油来信');
  assert.deepEqual(OPENING_STYLES.map(style => style.id), ['pearl', 'rain', 'across', 'cream']);
});

test('both local and repository-subpath deployments resolve their own video and poster', () => {
  assert.deepEqual(openingMedia('/'), { video: '/openings/rain-window.mp4', poster: '/openings/rain-window-poster.webp' });
  assert.deepEqual(openingMedia('/YYphone/'), { video: '/YYphone/openings/rain-window.mp4', poster: '/YYphone/openings/rain-window-poster.webp' });
  assert.equal(openingMedia('/YYphone').video, '/YYphone/openings/rain-window.mp4');
});

test('runtime clip is small, silent, H.264, exactly four seconds and optimized for startup', () => {
  const data = readFileSync(resolve('public', 'openings', 'rain-window.mp4'));
  const poster = readFileSync(resolve('public', 'openings', 'rain-window-poster.webp'));
  assert.ok(data.length < 650_000);
  assert.ok(poster.length < 50_000);
  assert.equal(poster.toString('ascii', 8, 12), 'WEBP');
  const boxes = (start: number, end: number) => {
    const out: { type: string; start: number; payload: number; end: number }[] = [];
    for (let p = start; p + 8 <= end;) {
      let size = data.readUInt32BE(p), header = 8;
      if (size === 1) { size = Number(data.readBigUInt64BE(p + 8)); header = 16; }
      if (!size) size = end - p;
      assert.ok(size >= header && p + size <= end);
      out.push({ type: data.toString('ascii', p + 4, p + 8), start: p, payload: p + header, end: p + size });
      p += size;
    }
    return out;
  };
  type Box = ReturnType<typeof boxes>[number];
  const child = (box: Box, type: string): Box => {
    const found = boxes(box.payload, box.end).find(item => item.type === type);
    assert.ok(found, `Missing MP4 box ${type}`); return found;
  };
  const top = boxes(0, data.length), moov = top.find(item => item.type === 'moov'), mdat = top.find(item => item.type === 'mdat');
  assert.ok(moov && mdat && moov.start < mdat.start);
  const tracks = boxes(moov.payload, moov.end).filter(item => item.type === 'trak');
  assert.equal(tracks.length, 1);
  const mdia = child(tracks[0], 'mdia'), hdlr = child(mdia, 'hdlr'), mdhd = child(mdia, 'mdhd');
  assert.equal(data.toString('ascii', hdlr.payload + 8, hdlr.payload + 12), 'vide');
  assert.equal(data[mdhd.payload], 0);
  assert.equal(data.readUInt32BE(mdhd.payload + 16) / data.readUInt32BE(mdhd.payload + 12), 4);
  const tkhd = child(tracks[0], 'tkhd'), stsd = child(child(child(mdia, 'minf'), 'stbl'), 'stsd');
  assert.equal(data.readUInt32BE(tkhd.end - 8) / 65536, 404);
  assert.equal(data.readUInt32BE(tkhd.end - 4) / 65536, 720);
  assert.equal(data.toString('ascii', stsd.payload + 12, stsd.payload + 16), 'avc1');
});
