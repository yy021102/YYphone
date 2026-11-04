import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isThoughtPreset, isThoughtSnapshot, type ThoughtSnapshot } from './thoughtPresets';
import { getRoundThought } from './chatRuntime';

const snapshot: ThoughtSnapshot = {
  version: 1,
  preset: {
    id: 'my-old-preset', name: '旧心声', height: 300, prompt: '',
    fields: [{ key: 'thought', label: '心声', instruction: '' }],
    html: '<section>{{thought}}</section>', css: 'body{color:pink}',
  },
  values: { thought: '历史心声仍然在这里。' }, characterName: '角色', at: '2026-11-03T14:00:00Z',
};

test('historical snapshots remain readable and unchanged after removing the workshop', () => {
  const saved = JSON.stringify(snapshot);
  assert.ok(isThoughtSnapshot(snapshot));
  const withoutHeight = structuredClone(snapshot);
  delete withoutHeight.preset.height;
  assert.ok(isThoughtSnapshot(withoutHeight));
  assert.equal(JSON.stringify(snapshot), saved);
  assert.equal(isThoughtSnapshot({ ...snapshot, values: {} }), false);
  assert.equal(isThoughtPreset({ ...snapshot.preset, fields: [] }), false);
});

test('plain thought lookup keeps character and batch isolation for existing conversations', () => {
  const messages = [
    { senderId: 'a', replyBatchId: 'old', thought: snapshot.values.thought, thoughtCard: snapshot },
    { senderId: 'a', replyBatchId: 'old', thought: '' },
    { senderId: 'b', replyBatchId: 'old', thought: '' },
  ];
  assert.equal(getRoundThought(messages[1], messages), snapshot.values.thought);
  assert.equal(getRoundThought(messages[2], messages), '');
});

test('chat UI and generation no longer use workshop markup, presets or status requirements', () => {
  const app = readFileSync(new URL('../apps/WeChatApp.tsx', import.meta.url), 'utf8');
  const request = readFileSync(new URL('./chatReply.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /ThoughtWorkshop|ThoughtCard|心声工坊|resolveThoughtPreset|thoughtInstructions|makeThoughtSnapshot/);
  assert.doesNotMatch(request, /thoughtPreset|validateThoughtResponse/);
  assert.match(app, /getRoundThought\(message, activeChat\.messages\)/);
  assert.match(app, /微信聊天心声必填/);
  assert.match(app, /\{activeThought\.thought\}/);
});
