import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { OPENING_TIMING, PhoneOpening, YYphoneMark } from './PhoneOpening';
import { CreamWordmark } from './CreamOpeningScene';

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

test('opening is an accessible modal with a full-surface entry target, not a visible skip button', () => {
  const html = renderToStaticMarkup(<PhoneOpening ready onComplete={() => assert.fail('Rendering must not complete the opening')} />);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /tabindex="-1"/);
  assert.match(html, /aria-label="进入YYphone"/);
  assert.match(html, /class="yy-opening-enter"/);
  assert.match(html, /aria-label="YYphone 开机动画"/);
  assert.match(html, /歪歪机/);
  assert.doesNotMatch(html, /跳过|yy-opening-skip|disabled|progressbar|[0-9]+%/);
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
  assert.equal(OPENING_TIMING.rainIntro, 4000);
  assert.equal(OPENING_TIMING.acrossIntro, 4500);
  assert.equal(OPENING_TIMING.creamIntro, 4700);
});

test('rain uses layered English words and a small wordmark without the pearl sculpture', () => {
  const html = renderToStaticMarkup(<PhoneOpening ready openingStyle="rain" onComplete={() => {}} />);
  assert.match(html, /aria-label="Rain outside\. You are here\."/);
  assert.equal((html.match(/class="yy-rain-word"/g) ?? []).length, 5);
  assert.match(html, /--word-delay:550ms/);
  assert.match(html, /--word-delay:1650ms/);
  assert.match(html, /class="yy-rain-brand"/);
  assert.match(html, /playsInline=""/i);
  assert.doesNotMatch(html, /yy-opening-sculpture|yy-opening-skip|跳过|loop=|autoPlay=|src="[^"]+\.mp4"/i);
});

test('reduced-motion rain does not even mount a video element', () => {
  reducedMotion = true;
  try {
    const html = renderToStaticMarkup(<PhoneOpening ready openingStyle="rain" onComplete={() => {}} />);
    assert.match(html, /rain-window-poster\.webp/);
    assert.doesNotMatch(html, /<video/);
  } finally { reducedMotion = false; }
});

test('across the screen has two lights, a glass boundary and staggered English without external media', () => {
  const html = renderToStaticMarkup(<PhoneOpening ready openingStyle="across" onComplete={() => {}} />);
  assert.match(html, /data-style="across"/);
  assert.match(html, /data-intro-ready="true"/);
  assert.match(html, /aria-label="A screen between us\. Still, I reach for you\."/);
  for (const name of ['yy-across-glass', 'yy-across-orb-far', 'yy-across-orb-near', 'yy-across-ripple', 'yy-across-brand']) assert.ok(html.includes(name));
  assert.doesNotMatch(html, /<video|<img|https?:|yy-opening-sculpture|yy-rain-scene|data-leaving/);
  const css = readFileSync(resolve('src', 'components', 'phoneOpening.css'), 'utf8');
  assert.match(css, /animation: yy-rain-word 1200ms 2200ms/);
  assert.match(css, /animation-delay: 1000ms/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.yy-across-ripple \{ display: none; \}/);
});

test('across the screen respects reduced motion and blocks early entry until ready', () => {
  reducedMotion = true;
  try {
    const html = renderToStaticMarkup(<PhoneOpening ready={false} openingStyle="across" onComplete={() => {}} />);
    assert.match(html, /data-reduced-motion="true"/);
    assert.match(html, /--opening-exit:160ms/);
    assert.match(html, /<button[^>]*disabled=""/);
    assert.doesNotMatch(html, /data-leaving|<video/);
  } finally { reducedMotion = false; }
});

test('cream opening features a central bubble-letter card and handmade decorations without English copy or media', () => {
  const html = renderToStaticMarkup(<PhoneOpening ready openingStyle="cream" onComplete={() => {}} />);
  assert.match(html, /data-style="cream"/);
  assert.match(html, /data-intro-ready="true"/);
  assert.match(html, /<h1[^>]*aria-label="YYphone 歪歪机"/);
  for (const name of ['yy-cream-wordmark', 'yy-cream-card', 'yy-cream-flap', 'yy-cream-pocket', 'yy-cream-seal', 'yy-cream-frame']) assert.ok(html.includes(name));
  assert.equal((html.match(/class="yy-cream-sugar is-/g) ?? []).length, 7);
  assert.doesNotMatch(html, /<video|<img|<image|<text|https?:|yy-rain-brand|yy-opening-signature|A little sweetness|just for you/i);
});

test('bubble lettering is original vector artwork with distinct IDs for thumbnail and scene', () => {
  const html = renderToStaticMarkup(<><CreamWordmark /><CreamWordmark /></>);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(html.includes(`url(#${id})`) || html.includes(`href="#${id}"`));
  assert.doesNotMatch(html, /<text|<image|font-family|https?:/);
  assert.match(html, /stroke-width="14"/);
  assert.match(html, /stroke-width="7\.2"/);
  assert.match(html, /stop-color="#f3d0df"/);
  assert.match(html, /stop-color="#c7e4f5"/);
  assert.match(html, /stop-color="#f4e3b2"/);
  assert.match(html, /<feSpecularLighting/);
});

test('cream opening is static in reduced motion and never exposes an unready phone', () => {
  reducedMotion = true;
  try {
    const html = renderToStaticMarkup(<PhoneOpening ready={false} openingStyle="cream" onComplete={() => {}} />);
    assert.match(html, /data-reduced-motion="true"/);
    assert.match(html, /--opening-exit:160ms/);
    assert.match(html, /<button[^>]*disabled=""/);
    assert.doesNotMatch(html, /data-leaving|<video/);
  } finally { reducedMotion = false; }
});
