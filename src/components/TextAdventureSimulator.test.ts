import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAdventureBeat } from './TextAdventureSimulator';
import { builtinWorlds, validateAdventureWorld } from './adventureWorldData';

const response = {
  reply: ['钟楼里的灯熄了，伊薇决定先封锁桥。'],
  chapter: '第一幕', place: '雾港', title: '熄灯',
  choices: [
    { title: '去桥边调查', detail: '留意足迹', trait: 'insight', item: '不应提前发放' },
    { title: '留下帮忙', detail: '照顾街上的人', trait: 'fate' },
  ],
  companionAction: '伊薇先询问目击者。', gainedItem: '星纹硬币', summary: '伊薇封锁了桥，玩家得到了硬币。',
};

test('a generated beat records earned items only after the outcome', () => {
  const beat = parseAdventureBeat(response, 4);
  assert.equal(beat.scene.choices[0].item, undefined);
  assert.equal(beat.gainedItem, '星纹硬币');
  assert.equal(beat.summary, response.summary);
  assert.equal(parseAdventureBeat(response, 3).summary, '');
});

test('invalid dynamic scenes cannot replace the current scene', () => {
  assert.throws(() => parseAdventureBeat({ ...response, choices: [] }, 1));
  assert.throws(() => parseAdventureBeat({ ...response, reply: [] }, 1));
  assert.throws(() => parseAdventureBeat({ ...response, companionAction: '' }, 1, true));
  assert.equal(parseAdventureBeat(response, 1, true).companionAction, response.companionAction);
});

test('exported worlds validate with exactly three fixed opening choices', () => {
  const original = { ...builtinWorlds()[0], worldBookIds: ['book-1', 'book-2'] };
  const imported = validateAdventureWorld(JSON.parse(JSON.stringify(original)), 'custom-imported');
  assert.equal(imported.world.id, 'custom-imported');
  assert.equal(imported.world.scenes[0].choices.length, 3);
  assert.equal(imported.lore.npcs.length, original.lore.npcs.length);
  assert.deepEqual(imported.worldBookIds, ['book-1', 'book-2']);
  assert.deepEqual(validateAdventureWorld({ ...original, worldBookIds: undefined }).worldBookIds, []);
  assert.throws(() => validateAdventureWorld({ ...original, lore: { ...original.lore, conflicts: [] } }));
});
