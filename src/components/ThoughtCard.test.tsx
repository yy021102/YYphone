import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThoughtCard } from './ThoughtCard';
import { BUILTIN_THOUGHT_PRESETS, builtinThoughtLayout, makeThoughtSnapshot } from '../utils/thoughtPresets';

test('all built-in thoughts render at natural height without an iframe canvas or nested scrolling', () => {
  for (const preset of BUILTIN_THOUGHT_PRESETS) {
    const values = Object.fromEntries(preset.fields.filter(field => field.key !== 'thought').map(field => [field.key, `${field.label}的内容`]));
    const snapshot = makeThoughtSnapshot(preset, values, '一段完整的心声。', '测试角色', '2026-11-03T16:00:00Z');
    const original = JSON.stringify(snapshot);
    const html = renderToStaticMarkup(<ThoughtCard snapshot={snapshot} />);
    assert.match(html, /<article class="yy-thought-native"/);
    assert.match(html, new RegExp(`data-layout="${preset.id === 'diary' ? 'diary' : 'soft'}"`));
    assert.match(html, /一段完整的心声。/);
    for (const field of preset.fields) assert.ok(html.includes(field.label));
    assert.doesNotMatch(html, /<iframe|height:|overflow|srcdoc=/);
    assert.equal(JSON.stringify(snapshot), original, 'existing snapshots must not be rewritten');
  }
});

test('long native thoughts preserve every line and safely escape markup', () => {
  const text = `${'完整的心声内容。\n'.repeat(200)}<script>不是代码</script>`;
  const snapshot = makeThoughtSnapshot(BUILTIN_THOUGHT_PRESETS[0], {}, text, '<角色>', '2026-11-03T16:00:00Z');
  const html = renderToStaticMarkup(<ThoughtCard snapshot={snapshot} />);
  assert.equal((html.match(/完整的心声内容。/g) ?? []).length, 200);
  assert.match(html, /&lt;script&gt;不是代码&lt;\/script&gt;/);
  assert.match(html, /&lt;角色&gt;/);
  assert.doesNotMatch(html, /<script/);
});

test('copies using the exact built-in layout grow naturally, but edited markup or CSS stays sandboxed', () => {
  const copy = { ...structuredClone(BUILTIN_THOUGHT_PRESETS[0]), id: 'my-copy', name: '我的心声' };
  assert.equal(builtinThoughtLayout(copy), 'soft');
  assert.equal(builtinThoughtLayout({ ...copy, css: `${copy.css}\nbody{color:red}` }), undefined);
  assert.equal(builtinThoughtLayout({ ...copy, html: '<div>{{thought}}</div>' }), undefined);
  assert.equal(builtinThoughtLayout(BUILTIN_THOUGHT_PRESETS[2]), 'diary');
});
