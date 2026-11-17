import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { isOpeningStyle, OPENING_STYLES, readOpeningStyle } from './phoneOpening';
import { SETTINGS_KEYS } from './settings';

test('old settings keep pearl; all styles persist independently and invalid preferences are reported', () => {
  const items = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key: string) => items.get(key) ?? null } } });
  assert.equal(readOpeningStyle(), 'pearl');
  items.set(SETTINGS_KEYS.openingAnimation, 'false');
  items.set(SETTINGS_KEYS.openingStyle, '"rain"');
  assert.equal(readOpeningStyle(), 'pearl');
  assert.equal(isOpeningStyle('rain'), false);
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
  assert.deepEqual(OPENING_STYLES.map(style => style.id), ['pearl', 'across', 'cream']);
});
