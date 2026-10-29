import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { isChatSendKey } from './chatSendKey';
import { DEFAULT_CHAT_RUNTIME, readChatRuntimeSettings } from './chatRuntime';
import { clearDbStorage } from './dbStorage';
import { writeStoredValue } from './localStorage';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v),
  removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null,
  get length() { return values.size; },
} } });
beforeEach(async () => clearDbStorage());
test('Enter sends once, while Shift+Enter, IME confirmation, repeat keys and prevented events do not send', () => {
  assert(isChatSendKey({ key: 'Enter' }));
  for (const event of [{ key: 'a' }, { key: 'Enter', shiftKey: true }, { key: 'Enter', isComposing: true },
    { key: 'Enter', nativeEvent: { isComposing: true } }, { key: 'Enter', nativeEvent: { keyCode: 229 } },
    { key: 'Enter', keyCode: 229 }, { key: 'Enter', repeat: true }, { key: 'Enter', defaultPrevented: true }]) assert(!isChatSendKey(event));
});
test('the new option defaults off and old notification/call/keepalive settings survive migration independently', () => {
  assert.equal(readChatRuntimeSettings().autoReplyOnEnter, false);
  const legacy = { keepAlive: true, banners: true, systemNotifications: false, allowIncomingCalls: true };
  writeStoredValue('yyphone:chat-runtime', legacy);
  assert.deepEqual(readChatRuntimeSettings(), { ...legacy, autoReplyOnEnter: false });
  writeStoredValue('yyphone:chat-runtime', { ...legacy, autoReplyOnEnter: true });
  assert.deepEqual(readChatRuntimeSettings(), { ...legacy, autoReplyOnEnter: true });
  writeStoredValue('yyphone:chat-runtime', DEFAULT_CHAT_RUNTIME);
  assert.deepEqual(readChatRuntimeSettings(), DEFAULT_CHAT_RUNTIME);
});
