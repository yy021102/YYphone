import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeScreen } from '../components/HomeScreen';
import { DesktopPageNavigation } from '../components/DesktopPager';
import { AppLoading } from '../components/EveryAppLoading';
import { ALL_APPS, DOCK_APPS, INITIAL_USER_PROFILE, MAIN_GRID_APPS, SECOND_PAGE_APPS } from '../data/mockData';
import { desktopPageAfterSwipe, isDesktopActivity } from './desktopNavigation';

test('desktop identities are unique, place WeChat in the shared dock and route all six second-page activities', () => {
  assert.deepEqual(MAIN_GRID_APPS.map(app => app.id), ['world_book', 'phone_explorer', 'alipay', 'taobao', 'forum', 'pomodoro', 'offline_mode', 'couple_space']);
  assert.deepEqual(DOCK_APPS.map(app => app.id), ['settings', 'customizer', 'memory', 'wechat']);
  assert.deepEqual(SECOND_PAGE_APPS.map(app => app.id), ['text-adventure', 'time-capsule', 'divination', 'little-sip', 'character-perspective', 'kitchen', 'ao3']);
  assert.equal(new Set(ALL_APPS.map(app => app.id)).size, ALL_APPS.length);
  assert.equal(ALL_APPS.length, MAIN_GRID_APPS.length + DOCK_APPS.length + SECOND_PAGE_APPS.length);
  for (const app of SECOND_PAGE_APPS) assert.equal(isDesktopActivity(app.id), app.id !== 'ao3');
  for (const app of [...MAIN_GRID_APPS, ...DOCK_APPS]) assert.equal(isDesktopActivity(app.id), false);
  assert.equal(isDesktopActivity(null), false);
  assert.equal(isDesktopActivity(undefined), false);
});

test('desktop swipes require intentional horizontal motion and never wrap at either edge', () => {
  assert.equal(desktopPageAfterSwipe(0, -48, 0), 1);
  assert.equal(desktopPageAfterSwipe(1, 48, 0), 0);
  assert.equal(desktopPageAfterSwipe(0, -47, 0), 0);
  assert.equal(desktopPageAfterSwipe(1, 47, 0), 1);
  assert.equal(desktopPageAfterSwipe(0, -60, 80), 0);
  assert.equal(desktopPageAfterSwipe(1, 60, 80), 1);
  assert.equal(desktopPageAfterSwipe(0, 100, 0), 0);
  assert.equal(desktopPageAfterSwipe(1, -100, 0), 1);
  assert.equal(desktopPageAfterSwipe(0, -140, 100), 1);
});

test('page controls expose two named keyboard-operable buttons and the current page', () => {
  for (const page of [0, 1] as const) {
    const markup = renderToStaticMarkup(createElement(DesktopPageNavigation, { page, onChange: () => {} }));
    assert.equal((markup.match(/type="button"/g) ?? []).length, 2);
    assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(markup, new RegExp(`aria-label="第${page + 1}页" aria-current="page"`));
    assert.ok(!markup.includes('日常') && !markup.includes('闲暇'));
    assert.ok(!markup.includes('<span'));
  }
});

test('desktop release distinguishes a quick flick, a slow short drag and vertical scrolling', () => {
  assert.equal(desktopPageAfterSwipe(0, -35, 2, 390, 60), 1);
  assert.equal(desktopPageAfterSwipe(1, 35, 2, 390, 60), 0);
  assert.equal(desktopPageAfterSwipe(0, -35, 2, 390, 600), 0);
  assert.equal(desktopPageAfterSwipe(0, -80, 2, 390, 600), 0);
  assert.equal(desktopPageAfterSwipe(0, -90, 2, 390, 600), 1);
  assert.equal(desktopPageAfterSwipe(0, -35, 40, 390, 60), 0);
  assert.equal(desktopPageAfterSwipe(1, -120, 0, 820, 60), 1);
  assert.equal(desktopPageAfterSwipe(0, 120, 0, 820, 60), 0);
});

test('all four leisure themes render second-page apps, a shared dock and replaceable custom icons without requiring new stored data', () => {
  for (const homeStyle of ['classic', 'minimal', 'moonlit', 'halloween'] as const) {
    const markup = renderToStaticMarkup(createElement(HomeScreen, {
      page: 1, onPageChange: () => {}, homeStyle, userProfile: INITIAL_USER_PROFILE,
      apps: MAIN_GRID_APPS, dockApps: DOCK_APPS, onOpenApp: () => {}, onSaveUserProfile: () => true,
      appIcons: { divination: 'custom-divination.png', kitchen: 'custom-kitchen.png', settings: 'custom-settings.png' },
    }));
    assert.match(markup, new RegExp(`leisure-${homeStyle}`));
    for (const app of [...SECOND_PAGE_APPS, ...DOCK_APPS]) assert.ok(markup.includes(`>${app.name}</span>`), app.name);
    assert.equal((markup.match(/class="leisure-app(?: has-custom-icon)?"/g) ?? []).length, SECOND_PAGE_APPS.length);
    assert.equal((markup.match(/class="home-system-app"/g) ?? []).length, DOCK_APPS.length);
    assert.equal((markup.match(/aria-label="系统应用"/g) ?? []).length, 1);
    assert.equal((markup.match(/has-custom-icon/g) ?? []).length, 3);
    for (const name of ['custom-divination.png', 'custom-kitchen.png', 'custom-settings.png']) assert.ok(markup.includes(`src="${name}"`));
    assert.ok(!markup.includes('日常应用'));
    assert.ok(!markup.includes('<header') && !markup.includes('<section') && !markup.includes('<footer'));
    assert.ok(!markup.includes('<h1') && !markup.includes('MAKE TIME') && !markup.includes('LITTLE JOYS'));
    assert.ok(markup.indexOf('class="home-system-dock') < markup.indexOf('class="desktop-page-navigation'));
    assert.ok(!markup.includes('>游戏</span>'));
  }
});

test('all six standalone activities have different illustrated loading scenes rather than a shared placeholder', () => {
  const illustrations = new Set<string>();
  for (const app of SECOND_PAGE_APPS.filter(app => isDesktopActivity(app.id))) {
    const markup = renderToStaticMarkup(createElement(AppLoading, { app: app.id, onBack: () => {} }));
    assert.ok(markup.includes(`soft-app-opening-${app.id}`));
    const illustration = markup.match(/<svg class="soft-opening-svg every-opening-art"[\s\S]*?<\/svg>/)?.[0];
    assert.ok(illustration, app.id);
    illustrations.add(illustration);
    assert.ok(!markup.includes('留一点时间，给喜欢的事。'));
  }
  assert.equal(illustrations.size, 6);
});

test('every desktop app has a valid lazy-loading scene including all six additions', () => {
  for (const app of ALL_APPS) {
    const markup = renderToStaticMarkup(createElement(AppLoading, { app: app.id, onBack: () => {} }));
    assert.ok(markup.includes(`正在打开${app.name}`), app.id);
  }
});
