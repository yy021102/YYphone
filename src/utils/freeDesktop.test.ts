import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_APPS } from '../data/mockData';
import { portableHomeBeauty } from './homeAppearance';
import {
  canRemoveDesktopWidget, completeFreeDesktopLayout, defaultFreeDesktopLayout, DESKTOP_WIDGET_TEMPLATES, isFreeDesktopLayout, moveDesktopItem, newDesktopTemplate, REQUIRED_WIDGET_TYPES, WIDGET_TYPES,
  newDesktopWidget, putDesktopWidget, removeDesktopWidget, type FreeDesktopLayout,
} from './freeDesktop';

const appIds = (layout: FreeDesktopLayout) => [...layout.dock, ...layout.pages.flat().flatMap(item => item.kind === 'app' ? [item.appId] : [])].sort();
const assertComplete = (layout: FreeDesktopLayout) => {
  assert.ok(isFreeDesktopLayout(layout));
  assert.deepEqual(appIds(layout), ALL_APPS.map(app => app.id).sort());
};
test('default free desktop has two collision-free pages, eight main apps, six second-page apps and the requested shared dock', () => {
  const layout = defaultFreeDesktopLayout();
  assertComplete(layout);
  assert.deepEqual(layout.dock, ['settings', 'customizer', 'memory', 'wechat']);
  assert.equal(layout.pages[0].filter(item => item.kind === 'widget').length, 3);
});
test('all eight widget types can be added repeatedly, resized and removed without deleting apps or changing the source layout', () => {
  const initial = defaultFreeDesktopLayout(), original = JSON.stringify(initial);
  let layout = initial;
  for (const [index, type] of (['clock', 'calendar', 'photo', 'text', 'countdown', 'character', 'music', 'profile'] as const).entries()) {
    const widget = newDesktopWidget(type, `test:${index}`);
    layout = putDesktopWidget(layout, 1, widget);
    layout = putDesktopWidget(layout, 1, { ...widget, w: 4, h: 3 });
    assertComplete(layout);
    layout = removeDesktopWidget(layout, widget.id);
    assertComplete(layout);
  }
  assert.equal(JSON.stringify(initial), original);
});
test('same-page and cross-page app swaps preserve every app exactly once', () => {
  let layout = defaultFreeDesktopLayout();
  layout = moveDesktopItem(layout, 'app:world_book', { zone: 'page', page: 0, x: 1, y: 4 });
  assertComplete(layout);
  assert.ok(layout.pages[0].some(item => item.id === 'app:phone_explorer' && item.x === 0 && item.y === 4));
  layout = moveDesktopItem(layout, 'app:world_book', { zone: 'page', page: 1, x: 0, y: 0 });
  assertComplete(layout);
  assert.ok(layout.pages[0].some(item => item.id === 'app:text-adventure'));
  assert.ok(layout.pages[1].some(item => item.id === 'app:world_book'));
});
test('a full dock swaps the displaced app back into the source cell; dock ordering and dragging out preserve app identities', () => {
  let layout = moveDesktopItem(defaultFreeDesktopLayout(), 'app:world_book', { zone: 'dock', index: 3 });
  assertComplete(layout);
  assert.equal(layout.dock[3], 'world_book');
  assert.ok(layout.pages[0].some(item => item.id === 'app:wechat' && item.kind === 'app' && item.appId === 'wechat' && item.x === 0 && item.y === 4));
  layout = moveDesktopItem(layout, 'app:world_book', { zone: 'dock', index: 0 });
  assert.equal(layout.dock[0], 'world_book');
  layout = moveDesktopItem(layout, 'app:world_book', { zone: 'page', page: 1, x: 3, y: 3 });
  assert.equal(layout.dock.length, 3);
  assertComplete(layout);
  layout = moveDesktopItem(layout, 'app:world_book', { zone: 'dock', index: 3 });
  assertComplete(layout);
});
test('widgets reflow neighbors without collisions and cannot enter the dock', () => {
  const initial = defaultFreeDesktopLayout();
  const next = moveDesktopItem(initial, 'widget:default-profile', { zone: 'page', page: 1, x: 3, y: 0 });
  assertComplete(next);
  assert.equal(next.pages[1].find(item => item.id === 'widget:default-profile')?.x, 0);
  assert.throws(() => moveDesktopItem(initial, 'widget:default-profile', { zone: 'dock', index: 0 }), /不能放进底栏/);
  assert.throws(() => moveDesktopItem(initial, 'missing', { zone: 'page', page: 0, x: 0, y: 0 }), /不存在/);
});
test('import validation rejects collisions, duplicate apps, invalid geometry/settings and supports additive app completion', () => {
  const layout = defaultFreeDesktopLayout();
  const roundTrip: unknown = JSON.parse(JSON.stringify(layout));
  assert.ok(isFreeDesktopLayout(roundTrip));
  const duplicate = structuredClone(layout);
  duplicate.dock[0] = 'wechat';
  assert.equal(isFreeDesktopLayout(duplicate), false);
  const collision = structuredClone(layout);
  collision.pages[1][1].x = 0;
  assert.equal(isFreeDesktopLayout(collision), false);
  for (const patch of [{ w: 5 }, { y: -1 }, { h: 1 }, { settings: { ...newDesktopWidget('profile', 'a').settings, date: '2026-02-31' } }]) {
    const invalid = structuredClone(layout);
    Object.assign(invalid.pages[0][0], patch);
    assert.equal(isFreeDesktopLayout(invalid), false);
  }
  const incomplete = structuredClone(layout);
  incomplete.pages[1] = incomplete.pages[1].filter(item => item.id !== 'app:kitchen');
  assert.ok(isFreeDesktopLayout(incomplete));
  assertComplete(completeFreeDesktopLayout(incomplete));
});
test('long sequences of cross-page moves and resizes neither lose apps nor mutate prior snapshots', () => {
  let layout = defaultFreeDesktopLayout();
  for (let index = 0; index < 60; index++) {
    const before = JSON.stringify(layout);
    const previous = layout;
    const app = ALL_APPS[index % ALL_APPS.length];
    layout = moveDesktopItem(layout, `app:${app.id}`, { zone: 'page', page: index % 2 as 0 | 1, x: index % 4, y: index % 8 });
    assertComplete(layout);
    assert.equal(JSON.stringify(previous), before);
  }
});

test('widget limits and invalid resizes fail explicitly without replacing the saved layout', () => {
  let layout = defaultFreeDesktopLayout();
  for (let index = 0; index < 29; index++) layout = putDesktopWidget(layout, 1, { ...newDesktopWidget('clock', `limit:${index}`), w: 1, h: 1 });
  const before = JSON.stringify(layout);
  assert.throws(() => putDesktopWidget(layout, 1, newDesktopWidget('text', 'too-many')), /32/);
  assert.equal(JSON.stringify(layout), before);
  assert.throws(() => putDesktopWidget(defaultFreeDesktopLayout(), 0, { ...newDesktopWidget('music', 'widget:default-music'), w: 1 }), /无效/);
});
test('portable beauty includes exact free layout, widget images and edits while never embedding live personal or character data', () => {
  const widget = newDesktopWidget('photo', 'portable:photo');
  widget.settings.images = ['data:image/jpeg;base64,AAAA'];
  widget.settings.text = '只保存我自己填写的组件文字';
  const freeDesktop = putDesktopWidget(defaultFreeDesktopLayout(), 1, widget);
  const settings = { homeStyle: 'free' as const, freeDesktop, themeId: 'ocean-dawn', wallpaperId: 'dreamy-sky', wallpapers: { lockScreen: '', homeScreen: '' }, appIcons: {} };
  const roundTrip = JSON.parse(JSON.stringify(portableHomeBeauty(settings)));
  assert.deepEqual(roundTrip.freeDesktop, freeDesktop);
  assert.ok(isFreeDesktopLayout(roundTrip.freeDesktop));
  assert.ok(!JSON.stringify(roundTrip).includes('avatarUrl'));
});
test('character widgets can pair the current player with one role without exporting either live avatar', () => {
  const widget = newDesktopWidget('character', 'paired:player');
  widget.settings.includePlayer = true;
  widget.settings.characterIds = ['role-a'];
  const layout = putDesktopWidget(defaultFreeDesktopLayout(), 1, widget);
  assertComplete(layout);
  assert.throws(() => putDesktopWidget(layout, 1, { ...widget, settings: { ...widget.settings, characterIds: ['role-a', 'role-b'] } }), /无效/);
  assert.ok(!JSON.stringify(layout).includes('avatarUrl'));
});
test('the last profile, music and calendar are protected across both pages, while extra copies remain removable', () => {
  for (const type of REQUIRED_WIDGET_TYPES) {
    const original = defaultFreeDesktopLayout(), before = JSON.stringify(original);
    const id = `widget:default-${type}`;
    assert.equal(canRemoveDesktopWidget(original, id), false);
    assert.throws(() => removeDesktopWidget(original, id), /至少需要保留一个/);
    assert.equal(JSON.stringify(original), before);
    let layout = moveDesktopItem(original, id, { zone: 'page', page: 1, x: 0, y: 3 });
    const extra = newDesktopWidget(type, `extra:${type}`);
    layout = putDesktopWidget(layout, 0, extra);
    assert.equal(canRemoveDesktopWidget(layout, id), true);
    assert.equal(canRemoveDesktopWidget(layout, extra.id), true);
    layout = removeDesktopWidget(layout, id);
    assert.equal(canRemoveDesktopWidget(layout, extra.id), false);
    assert.throws(() => removeDesktopWidget(layout, extra.id), /至少需要保留一个/);
    assert.throws(() => putDesktopWidget(layout, 0, { ...extra, widgetType: 'clock' }), /不能更改/);
    assertComplete(layout);
  }
  assert.equal(canRemoveDesktopWidget(defaultFreeDesktopLayout(), 'missing'), false);
});
test('legacy layouts restore missing essential widgets without dropping apps, customization or occupied IDs', () => {
  const legacy = defaultFreeDesktopLayout();
  legacy.pages[0] = legacy.pages[0].filter(item => item.kind !== 'widget');
  const note = newDesktopWidget('text', 'widget:default-profile');
  note.settings.text = '保留原来的便签';
  const saved = putDesktopWidget(legacy, 1, note), before = JSON.stringify(saved);
  const repaired = completeFreeDesktopLayout(saved);
  assert.equal(JSON.stringify(saved), before);
  for (const type of REQUIRED_WIDGET_TYPES) assert.equal(repaired.pages.flat().filter(item => item.kind === 'widget' && item.widgetType === type).length, 1);
  assert.deepEqual(repaired.pages[1].find(item => item.id === note.id), saved.pages[1].find(item => item.id === note.id));
  assert.deepEqual(completeFreeDesktopLayout(repaired), repaired);
  assertComplete(repaired);
});
test('essential-widget restoration reports a full layout rather than silently deleting or replacing existing widgets', () => {
  const saved = defaultFreeDesktopLayout();
  saved.pages[0] = saved.pages[0].filter(item => item.kind !== 'widget');
  let full = saved;
  for (let index = 0; index < 32; index++) full = putDesktopWidget(full, 1, { ...newDesktopWidget('clock', `legacy:${index}`), w: 1, h: 1 });
  const before = JSON.stringify(full);
  assert.throws(() => completeFreeDesktopLayout(full), /先移除多余组件/);
  assert.equal(JSON.stringify(full), before);
});
test('every widget supports an independent portable background, including legacy, cleared and invalid-image settings', () => {
  for (const type of WIDGET_TYPES) {
    const widget = newDesktopWidget(type, `background:${type}`);
    const initial = defaultFreeDesktopLayout();
    assertComplete(putDesktopWidget(initial, 1, widget));
    widget.settings.backgroundImage = 'data:image/jpeg;base64,AAAA';
    const layout = putDesktopWidget(initial, 1, widget);
    assert.deepEqual(JSON.parse(JSON.stringify(layout)), layout);
    assertComplete(layout);
    assert.equal(initial.pages.flat().some(item => item.kind === 'widget' && !!item.settings.backgroundImage), false);
    assertComplete(putDesktopWidget(layout, 1, { ...widget, settings: { ...widget.settings, backgroundImage: '' } }));
    for (const backgroundImage of ['javascript:alert(1)', 'data:text/html;base64,AAAA', 'data:image/svg+xml;base64,AAAA', 'x'.repeat(1_500_001)]) {
      assert.throws(() => putDesktopWidget(initial, 1, { ...widget, settings: { ...widget.settings, backgroundImage } }), /无效/);
    }
  }
});
test('all five original templates have editable portable defaults and keep all existing desktop apps', () => {
  let layout = defaultFreeDesktopLayout();
  for (const template of DESKTOP_WIDGET_TEMPLATES) {
    const widget = newDesktopTemplate(template.id, `template:${template.id}`);
    assert.equal(widget.settings.template, template.id);
    assert.equal(widget.widgetType, template.widgetType);
    assert.ok(widget.w >= 2 && widget.h >= 2);
    widget.settings.images = ['data:image/webp;base64,AAAA'];
    widget.settings.title = '我的标题';
    widget.settings.text = '只保存玩家填写的文字';
    layout = putDesktopWidget(layout, 1, widget);
    assertComplete(layout);
    const roundTrip: unknown = JSON.parse(JSON.stringify(layout));
    assert.ok(isFreeDesktopLayout(roundTrip));
    assert.deepEqual(roundTrip, layout);
  }
});
test('template validation rejects unsupported, incompatible, undersized and invalid-name settings without mutating saved data', () => {
  const layout = defaultFreeDesktopLayout(), before = JSON.stringify(layout);
  const photo = newDesktopTemplate('heart', 'invalid:template');
  for (const patch of [{ template: 'custom-html' }, { template: 'vinyl' }, { personNames: ['a', 'b', 'c'] }, { personNames: ['x'.repeat(81)] }, { personNames: [1] }]) {
    const widget = structuredClone(photo);
    Object.assign(widget.settings, patch);
    assert.throws(() => putDesktopWidget(layout, 1, widget), /无效/);
  }
  assert.throws(() => putDesktopWidget(layout, 1, { ...photo, w: 1 }), /无效/);
  assert.equal(JSON.stringify(layout), before);
});
test('switching a template keeps player content and a vinyl music widget counts toward the essential music minimum', () => {
  const widget = newDesktopTemplate('heart', 'switch:photo');
  widget.settings.images = ['https://example.test/photo.png'];
  widget.settings.text = '不要丢掉';
  let layout = putDesktopWidget(defaultFreeDesktopLayout(), 1, widget);
  layout = putDesktopWidget(layout, 1, { ...widget, settings: { ...widget.settings, template: 'bow' } });
  layout = putDesktopWidget(layout, 1, { ...widget, settings: { ...widget.settings, template: undefined } });
  const saved = layout.pages[1].find(item => item.id === widget.id);
  assert.ok(saved?.kind === 'widget');
  assert.deepEqual(saved.settings, { ...widget.settings, template: undefined });
  const vinyl = newDesktopTemplate('vinyl', 'essential:vinyl');
  layout = putDesktopWidget(layout, 1, vinyl);
  layout = removeDesktopWidget(layout, 'widget:default-music');
  assert.equal(canRemoveDesktopWidget(layout, vinyl.id), false);
  assert.throws(() => removeDesktopWidget(layout, vinyl.id), /至少需要保留一个/);
  assertComplete(layout);
});
test('vinyl color and opacity are optional, instance-specific and preserved at both opacity boundaries', () => {
  const original = defaultFreeDesktopLayout();
  const legacy = newDesktopTemplate('vinyl', 'vinyl:legacy');
  assert.equal(legacy.settings.vinylColor, undefined);
  assert.equal(legacy.settings.vinylOpacity, undefined);
  for (const opacity of [0, 40, 100]) {
    const widget = newDesktopTemplate('vinyl', `vinyl:${opacity}`);
    widget.settings.vinylColor = '#e8cdda';
    widget.settings.vinylOpacity = opacity;
    const layout = putDesktopWidget(putDesktopWidget(original, 1, legacy), 1, widget);
    const roundTrip: unknown = JSON.parse(JSON.stringify(layout));
    assert.ok(isFreeDesktopLayout(roundTrip));
    assert.deepEqual(roundTrip, layout);
    const savedLegacy = layout.pages[1].find(item => item.id === legacy.id);
    assert.ok(savedLegacy?.kind === 'widget');
    assert.equal(savedLegacy.settings.vinylColor, undefined);
    assert.equal(savedLegacy.settings.vinylOpacity, undefined);
  }
});
test('vinyl appearance rejects invalid colors and non-integer or out-of-range opacity without changing the saved layout', () => {
  const layout = defaultFreeDesktopLayout(), before = JSON.stringify(layout);
  for (const patch of [
    { vinylColor: '#123' }, { vinylColor: 'red' }, { vinylColor: 1 }, { vinylOpacity: -1 }, { vinylOpacity: 101 },
    { vinylOpacity: 0.5 }, { vinylOpacity: NaN }, { vinylOpacity: Infinity }, { vinylOpacity: '40' }, { vinylOpacity: null },
  ]) {
    const widget = newDesktopTemplate('vinyl', 'vinyl:invalid');
    Object.assign(widget.settings, patch);
    assert.throws(() => putDesktopWidget(layout, 1, widget), /无效/);
  }
  assert.equal(JSON.stringify(layout), before);
});

test('every widget and template preserves opacity with uploaded images through save and beauty export, including legacy defaults', () => {
  const original = defaultFreeDesktopLayout();
  const widgets = [
    ...WIDGET_TYPES.map(type => newDesktopWidget(type, `opacity:${type}`)),
    ...DESKTOP_WIDGET_TEMPLATES.map(template => newDesktopTemplate(template.id, `opacity:${template.id}`)),
  ];
  for (const widget of widgets) {
    assert.equal(widget.settings.opacity, undefined);
    widget.settings.backgroundImage = 'data:image/png;base64,AAAA';
    widget.settings.images = ['https://example.test/photo.png'];
    for (const opacity of [0, 35, 100]) {
      const layout = putDesktopWidget(original, 1, { ...widget, settings: { ...widget.settings, opacity } });
      const portable = portableHomeBeauty({ themeId: 'test', wallpaperId: 'test', wallpapers: { lockScreen: '', homeScreen: '' }, appIcons: {}, freeDesktop: layout });
      const imported = JSON.parse(JSON.stringify(portable)).freeDesktop;
      assert.ok(isFreeDesktopLayout(imported));
      const saved = imported.pages[1].find(item => item.id === widget.id);
      assert.ok(saved?.kind === 'widget');
      assert.equal(saved.settings.opacity, opacity);
      assert.equal(saved.settings.backgroundImage, widget.settings.backgroundImage);
      assert.deepEqual(saved.settings.images, widget.settings.images);
      assert.equal(original.pages[0].find(item => item.kind === 'widget')?.settings.opacity, undefined);
    }
  }
});

test('invalid widget opacity is rejected without changing the stored layout', () => {
  const layout = defaultFreeDesktopLayout(), before = JSON.stringify(layout);
  for (const opacity of [-1, 101, .5, NaN, Infinity, '50', null]) {
    const widget = newDesktopWidget('photo', 'opacity:invalid');
    Object.assign(widget.settings, { opacity });
    assert.throws(() => putDesktopWidget(layout, 1, widget), /无效/);
  }
  assert.equal(JSON.stringify(layout), before);
});
