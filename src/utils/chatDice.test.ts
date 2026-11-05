import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatDice } from '../components/ChatDice';
import { CHAT_DICE_FACE_IMAGES, CHAT_DICE_IMAGES, CHAT_DICE_ROLL_MS, CHAT_DICE_STICKER_ID, CHAT_DICE_VALUES, chatDiceRollRemaining, readChatDiceValue } from './chatDice';
import { BUILTIN_STICKERS, resolveChatSticker } from './chatStickers';
import { chatFeatureInstructions } from './chatFeaturePrompt';
import { permittedSticker } from './chatRuntime';
import { parseChatResponse } from './aiResponse';
import { toMessageContent } from './buildPrompt';
import { favoriteShareContent, snapshotFavoriteMessage } from './wechatFavorites';
import { littlePHistory, parseLittlePReply } from './littleP';

afterEach(() => mock.restoreAll());
const dice = BUILTIN_STICKERS[0];

test('dice is pinned first in the default sticker category without renumbering existing built-ins or bypassing character permissions', () => {
  assert.equal(dice.id, CHAT_DICE_STICKER_ID);
  assert.equal(dice.category, '默认'); assert.equal(dice.description, '骰子');
  assert.equal(BUILTIN_STICKERS[1].id, 'builtin-1');
  assert.equal(BUILTIN_STICKERS.at(-1)?.id, 'builtin-13');
  assert.equal(new Set(BUILTIN_STICKERS.map(s => s.id)).size, BUILTIN_STICKERS.length);
  assert.equal(permittedSticker(undefined, dice), true);
  assert.equal(permittedSticker(['默认'], dice), true);
  assert.equal(permittedSticker(['萌'], dice), false);
  assert.equal(permittedSticker([], dice), false);
  assert.equal(resolveChatSticker(BUILTIN_STICKERS[1]), BUILTIN_STICKERS[1]);
});

test('each send rolls one of all six faces with matching persisted text and self-contained artwork; neither render nor read rerolls', () => {
  for (const [index, value] of CHAT_DICE_VALUES.entries()) {
    let draws = 0;
    mock.method(Math, 'random', () => { draws++; return index / 6 + 0.001; });
    const sent = resolveChatSticker(dice);
    assert.equal(draws, 1);
    assert.equal(sent.id, CHAT_DICE_STICKER_ID);
    assert.equal(sent.description, `骰子：${value}点`);
    const message = { kind: 'sticker', text: sent.description, imageUrl: sent.imageUrl };
    const restored = JSON.parse(JSON.stringify(message));
    for (let i = 0; i < 3; i++) assert.equal(readChatDiceValue(restored), value);
    const artwork = decodeURIComponent(sent.imageUrl.slice('data:image/svg+xml,'.length));
    const top = artwork.match(/<g data-face="top"[^>]*>([\s\S]*?)<\/g>/);
    assert.ok(top); assert.equal((top[1].match(/<circle /g) ?? []).length, value);
    assert.match(top[0], new RegExp(`data-value="${value}"`));
    assert.match(artwork, /data-face="left"/); assert.match(artwork, /data-face="right"/);
    assert.match(artwork, /radialGradient/);
    assert.match(artwork, /viewBox="0 0 100 100"/);
    assert.doesNotMatch(artwork, /<(?:image|script)|href=|onload=/);
    assert.equal(draws, 1);
  }
  assert.equal(dice.description, '骰子'); assert.equal(dice.imageUrl, CHAT_DICE_IMAGES[0]);
  assert.equal(readChatDiceValue({ kind: 'image', imageUrl: CHAT_DICE_IMAGES[0] }), undefined);
  assert.equal(readChatDiceValue({ kind: 'sticker', imageUrl: 'https://example.invalid/ordinary.png' }), undefined);
  for (const [index, imageUrl] of CHAT_DICE_FACE_IMAGES.entries()) {
    assert.equal(readChatDiceValue({ kind: 'sticker', imageUrl }), CHAT_DICE_VALUES[index]);
  }
});

test('a roll has a bounded animation window; revisiting history shows the saved face rather than playing or rolling again', () => {
  const started = Date.now();
  const createdAt = new Date(started).toISOString();
  assert.equal(chatDiceRollRemaining(createdAt, started), CHAT_DICE_ROLL_MS);
  assert.equal(chatDiceRollRemaining(createdAt, started + 400), CHAT_DICE_ROLL_MS - 400);
  assert.equal(chatDiceRollRemaining(createdAt, started + CHAT_DICE_ROLL_MS), 0);
  assert.equal(chatDiceRollRemaining(createdAt, started + 3600000), 0);
  assert.equal(chatDiceRollRemaining(createdAt, started - 1000), CHAT_DICE_ROLL_MS);
  assert.equal(chatDiceRollRemaining(''), 0);
  const rolling = renderToStaticMarkup(createElement(ChatDice, { value: 4, createdAt }));
  assert.match(rolling, /is-rolling/); assert.match(rolling, /骰子正在转动/);
  const old = renderToStaticMarkup(createElement(ChatDice, { value: 4, createdAt: new Date(started - 10000).toISOString() }));
  assert.doesNotMatch(old, /is-rolling|骰子正在转动/); assert.match(old, /骰子：4点/);
  assert.match(old, /data-dice-value="4"/);
  assert.doesNotMatch(old, /yy-chat-dice-face/);
  assert.match(old, /yy-chat-dice-image/);
  assert.equal((rolling.match(/yy-chat-dice-face/g) ?? []).length, 6);
});

test('characters use the existing sticker protocol and cannot set their result; calls and unavailable catalogs do not advertise dice', () => {
  const scene = { type: 'direct' as const, regenerate: false, hasCharacter: true, allowIncomingCall: false,
    narratorEnabled: false, canSendPayments: false, stickerCatalog: `默认：[${CHAT_DICE_STICKER_ID}|骰子]`, stickerPermissions: 'char-a：默认' };
  const raw = { kind: 'sticker', stickerId: CHAT_DICE_STICKER_ID };
  assert.deepEqual(parseChatResponse(JSON.stringify({ reply: [raw] })).reply, [raw]);
  for (const type of ['direct', 'group', 'observer'] as const) {
    const prompt = chatFeatureInstructions({ ...scene, type });
    assert.match(prompt, /"stickerId":"builtin-dice"/);
    assert.match(prompt, /不能通过 text 或其他字段指定/);
  }
  assert.doesNotMatch(chatFeatureInstructions({ ...scene, stickerCatalog: '' }), /builtin-dice/);
  assert.doesNotMatch(chatFeatureInstructions({ ...scene, stickerCatalog: '萌：[builtin-1|小猫爱心]' }), /builtin-dice/);
  assert.doesNotMatch(chatFeatureInstructions({ ...scene, callMode: 'voice' }), /builtin-dice/);
});

test('dice history, independent favorites and forwarding preserve the same face and point description', () => {
  mock.method(Math, 'random', () => 0.999999);
  const rolled = resolveChatSticker(dice);
  const message = { id: 'm', senderId: 'user', kind: 'sticker', text: rolled.description, imageUrl: rolled.imageUrl, createdAt: new Date().toISOString() };
  assert.match(toMessageContent(message), /骰子：6点/);
  const snapshot = snapshotFavoriteMessage(message);
  const shared = favoriteShareContent({ id: 'f', sourceChatId: 'chat', sourceMessageId: 'm', sourceChatTitle: '骰子游戏',
    sourceSenderName: '玩家', savedAt: message.createdAt, message: snapshot });
  assert.equal(readChatDiceValue(shared), 6); assert.equal(shared.text, message.text);
  assert.equal(shared.imageUrl, message.imageUrl);
});

test('the shared Little P catalog also resolves dice instead of sending the one-point picker icon as a fixed result', () => {
  mock.method(Math, 'random', () => 0.5);
  const [reply] = parseLittlePReply(JSON.stringify({ reply: [{ stickerId: CHAT_DICE_STICKER_ID }] }), BUILTIN_STICKERS);
  assert.equal(reply.sticker?.description, '骰子：4点');
  assert.equal(readChatDiceValue({ kind: 'sticker', imageUrl: reply.sticker?.imageUrl }), 4);
  assert.match(littlePHistory([{ ...reply, id: 'p', role: 'assistant' }])[0].content, /骰子：4点/);
});
