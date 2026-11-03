import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { OPENING_TIMING, PhoneOpening, YYphoneMark } from './PhoneOpening';

let reducedMotion = false;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { matchMedia: () => ({ matches: reducedMotion }) },
});

test('double-Y artwork is self-contained and each instance has distinct gradient IDs', () => {
  const html = renderToStaticMarkup(<><YYphoneMark /><YYphoneMark /></>);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(html.includes(`url(#${id})`));
  assert.equal((html.match(/<svg /g) ?? []).length, 2);
  assert.doesNotMatch(html, /<image|<img|https?:|<text/);
});

test('opening is an accessible, focusable modal with an explicitly named skip button', () => {
  const html = renderToStaticMarkup(<PhoneOpening ready onComplete={() => assert.fail('Rendering must not complete the opening')} />);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /tabindex="-1"/);
  assert.match(html, /aria-label="跳过开机动画"/);
  assert.match(html, /aria-label="YYphone 开机动画"/);
  assert.match(html, /歪歪机/);
  assert.doesNotMatch(html, /disabled|progressbar|[0-9]+%/);
});

test('skip cannot expose a phone that is not ready', () => {
  const html = renderToStaticMarkup(<PhoneOpening ready={false} onComplete={() => {}} />);
  assert.match(html, /<button[^>]*disabled=""/);
  assert.doesNotMatch(html, /data-leaving/);
});

test('reduced motion is recognized at mount and its stylesheet removes all opening animations', () => {
  reducedMotion = true;
  try {
    const html = renderToStaticMarkup(<PhoneOpening ready onComplete={() => {}} />);
    assert.match(html, /data-reduced-motion="true"/);
    assert.match(html, /--opening-exit:160ms/);
    const css = readFileSync(resolve('src', 'components', 'phoneOpening.css'), 'utf8');
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
    assert.match(css, /\.yy-opening-beam, \.yy-opening-reflection \{ display: none; \}/);
  } finally {
    reducedMotion = false;
  }
});

test('normal opening is approximately three seconds; skipping and reduced motion are brief', () => {
  const normal = OPENING_TIMING.intro + OPENING_TIMING.exit;
  assert.ok(normal >= 2000 && normal <= 3100);
  assert.ok(OPENING_TIMING.reducedIntro + OPENING_TIMING.shortExit < 1000);
  assert.ok(OPENING_TIMING.shortExit <= 200);
});
