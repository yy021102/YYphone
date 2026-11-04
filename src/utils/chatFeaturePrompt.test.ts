import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatFeatureInstructions, chatGiftAvailable, chatPendingTransferInstructions } from './chatFeaturePrompt';
import { canGenerateChatPayment } from './chatRegeneration';
import { estimateTextTokens } from './chatTokens';

const normalScene = {
  type: 'direct' as const, regenerate: false, hasCharacter: true,
  allowIncomingCall: true, narratorEnabled: false, canSendPayments: true,
  stickerCatalog: '日常：[smile|微笑]', stickerPermissions: 'char-a：日常',
};

const availableTypes = (prompt: string) => prompt.match(/支持类型：([^。]+)/)?.[1].split('、') ?? [];

test('scene prompts retain spontaneous chat abilities without any topic or keyword gate', () => {
  const prompt = chatFeatureInstructions(normalScene);
  assert.deepEqual(availableTypes(prompt), [
    'text', 'image', 'voice', 'location', 'link', 'pat', 'sticker', 'red-packet', 'transfer', 'video-call',
  ]);
  assert.match(prompt, /主动发表情包/);
  assert.match(prompt, /主动送礼物或外卖/);
  assert.match(prompt, /主动发起一次视频来电/);
  assert.match(prompt, /char-a：日常/);
  assert.doesNotMatch(prompt, /groupTitle|groupNicknames|privateMessage/);
  assert.equal(chatGiftAvailable(normalScene), true);
  assert.equal(chatGiftAvailable({ ...normalScene, type: 'group' }), true);
});

test('calls omit attachment schemas and sticker catalogs rather than merely overriding them', () => {
  const catalog = Array.from({ length: 60 }, (_, i) => `[sticker-${i}|日常心情${i}]`).join('');
  const normal = chatFeatureInstructions({ ...normalScene, stickerCatalog: catalog });
  for (const callMode of ['voice', 'video'] as const) {
    const scene = { ...normalScene, callMode, stickerCatalog: catalog };
    const prompt = chatFeatureInstructions(scene);
    assert.match(prompt, callMode === 'video' ? /text 或 narration/ : /仅使用 text，/);
    assert.doesNotMatch(prompt, /sticker-|stickerId|amount|existingProductId|title\/source|thought|转写|video-call/);
    assert.equal(chatGiftAvailable(scene), true);
    assert.match(prompt, /主动送礼物或外卖/);
    assert.ok(estimateTextTokens(prompt) < estimateTextTokens(normal) / 5);
  }
});

test('unavailable stickers and incoming calls have only prohibitions, not examples or catalogs', () => {
  const prompt = chatFeatureInstructions({ ...normalScene, stickerCatalog: '', allowIncomingCall: false });
  assert.ok(!availableTypes(prompt).includes('sticker'));
  assert.ok(!availableTypes(prompt).includes('video-call'));
  assert.match(prompt, /无可用表情包，禁止返回 sticker/);
  assert.match(prompt, /禁止返回 video-call/);
  assert.doesNotMatch(prompt, /stickerId|分类选择|主动发表情包|"kind":"video-call"/);
  assert.ok(estimateTextTokens(prompt) < estimateTextTokens(chatFeatureInstructions(normalScene)));
});

test('observer, NPC and regeneration gift limits do not remove valid replacement payments', () => {
  const observer = chatFeatureInstructions({ ...normalScene, type: 'observer' });
  for (const kind of ['pat', 'red-packet', 'transfer', 'video-call']) assert.ok(!availableTypes(observer).includes(kind));
  assert.ok(availableTypes(observer).includes('narration'));
  assert.match(observer, /本轮不执行 gift/);
  for (const scene of [
    { ...normalScene, type: 'observer' as const }, { ...normalScene, hasCharacter: false },
    { ...normalScene, regenerate: true },
  ]) assert.equal(chatGiftAvailable(scene), false);
  for (const settledPaymentCount of [0, 1]) {
    const prompt = chatFeatureInstructions({
      ...normalScene, regenerate: true, allowIncomingCall: false,
      canSendPayments: canGenerateChatPayment(false, true, settledPaymentCount),
    });
    assert.equal(availableTypes(prompt).includes('transfer'), settledPaymentCount === 0);
    assert.equal(availableTypes(prompt).includes('red-packet'), settledPaymentCount === 0);
    assert.match(prompt, /本轮不执行 gift/);
  }
});

test('pending-transfer schemas and IDs are provided only when a permitted action exists', () => {
  const transfers = [{ messageId: 'pending-a', recipientId: 'char-a', amount: '24', note: '午饭' }];
  const prompt = chatPendingTransferInstructions(transfers, true);
  assert.match(prompt, /paymentActions:\[/);
  assert.match(prompt, /received（收取）或 returned（退还）/);
  assert.ok(prompt.includes(JSON.stringify(transfers)));
  for (const disabled of [chatPendingTransferInstructions([], true), chatPendingTransferInstructions(transfers, false)]) {
    assert.match(disabled, /禁止 paymentActions/);
    assert.doesNotMatch(disabled, /messageId|pending-a|received|returned/);
    assert.ok(estimateTextTokens(disabled) < estimateTextTokens(prompt) / 4);
  }
});
