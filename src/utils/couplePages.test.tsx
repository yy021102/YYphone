import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoupleSpacePages } from '../components/CoupleSpacePages';
import { appendDiaryAnnotation, deleteCoupleMood, diaryAnnotations, editCoupleRecord, removeDiaryAnnotation } from './coupleRecords';
import { applyCoupleSeenAfterChat, buildCoupleSpaceInjection, createEmptyCoupleSpace, readCoupleSpaces, writeCoupleSpaces } from './coupleSpaceData';
import { clearDbStorage } from './dbStorage';
import type { CharacterCoupleSpace } from '../apps/CoupleSpaceApp';

const makeSpace = (): CharacterCoupleSpace => ({ ...createEmptyCoupleSpace('a'), bindStatus: 'bound' as const,
  diaries: [{ id: 'mine', author: 'user' as const, authorName: '小舟', dateStr: '2026-10-26', title: '我的日记', content: '今天一起散步', replyComment: '旧批注' },
    { id: 'theirs', author: 'char' as const, authorName: '林渡', dateStr: '2026-10-26', title: '角色的日记', content: '等你走到路口' }] });
test('each couple section renders a full page, diaries have two author columns and records remain intact', () => {
  const space = makeSpace(); space.stickyNotes = [{ id: 'n', author: 'user', authorName: '小舟', content: '记得带伞', colorBg: '#FFE0E9', createdAt: '2026-10-26' }];
  space.qaList = [{ id: 'q', dateStr: '2026-10-26', askedBy: 'char', question: '周末去哪？' }];
  for (const page of ['anniversary','diary','qa','sticky'] as const) {
    const html = renderToStaticMarkup(<CoupleSpacePages page={page} space={space} user={{ name: '小舟' }} character={{ name: '林渡' }} busy={false} message="" onBack={() => {}} onDismiss={() => {}} onUpdate={() => {}} onEdit={() => {}} runAi={async () => {}} />);
    assert.match(html, /couple-page-scroll/); assert.match(html, /返回上一级/); assert.doesNotMatch(html, /aria-modal/);
    if (page === 'diary') { assert.match(html, /小舟的日记/); assert.match(html, /林渡的日记/); assert.match(html, /我的日记/); assert.match(html, /角色的日记/); }
    if (page === 'sticky') { assert.match(html, /couple-note-wall/); assert.match(html, /记得带伞/); }
    if (page === 'qa') { assert.match(html, /couple-mailbox/); assert.match(html, /周末去哪/); }
  }
});
test('mutual annotations retain legacy replies, persist authors, never recreate deleted diaries and edit compatibly', () => {
  const space = makeSpace();
  assert.equal(diaryAnnotations(space.diaries[0], '林渡')[0].content, '旧批注');
  const first = appendDiaryAnnotation(space, 'theirs', { id: 'u', author: 'user', authorName: '小舟', content: ' 我也记得 ', createdAt: '2026-10-26T12:00:00Z' });
  const second = appendDiaryAnnotation(first, 'theirs', { id: 'c', author: 'char', authorName: '林渡', content: '下次还等你', createdAt: '2026-10-26T12:01:00Z' });
  assert.equal(second.diaries[1].seenByChar, false); assert.equal(diaryAnnotations(second.diaries[1], '林渡').length, 2);
  assert.deepEqual(diaryAnnotations(second.diaries[1], '林渡').map(note => note.author), ['user','char']);
  const edited = editCoupleRecord(second, { kind: 'diary', id: 'theirs', date: '2026-10-25', title: '标题', content: '日记', authorName: '林渡', replyComment: '修改批注' });
  assert.equal(edited.diaries[1].annotations?.[1].content, '修改批注');
  const removed = removeDiaryAnnotation(second, 'theirs', 'c'); assert.equal(removed.diaries[1].replyComment, undefined); assert.equal(diaryAnnotations(removed.diaries[1], '林渡').length, 1);
  const legacyRemoved = removeDiaryAnnotation(space, 'mine', 'legacy:mine'); assert.equal(diaryAnnotations(legacyRemoved.diaries[0], '林渡').length, 0);
  assert.equal(appendDiaryAnnotation({ ...space, diaries: [] }, 'gone', { id: 'u', author: 'user', authorName: '我', content: '批注', createdAt: '' }).diaries.length, 0);
  assert.equal(space.diaries[1].annotations, undefined);
});
test('deleting either mood preserves the other person, and the empty day disappears', () => {
  const space = { ...makeSpace(), moods: { '2026-10-26': { dateStr: '2026-10-26', userMoodId: 'happy_1', userNote: '我的心情', charMoodId: 'calm_1', charNote: '他的心情', seenByChar: false } } };
  const mineDeleted = deleteCoupleMood(space, '2026-10-26', 'user');
  assert.equal(mineDeleted.moods['2026-10-26'].charNote, '他的心情'); assert.equal(mineDeleted.moods['2026-10-26'].userMoodId, undefined);
  const theirsDeleted = deleteCoupleMood(space, '2026-10-26', 'char'); assert.equal(theirsDeleted.moods['2026-10-26'].userNote, '我的心情');
  assert.deepEqual(deleteCoupleMood(mineDeleted, '2026-10-26', 'char').moods, {});
  assert.equal(space.moods['2026-10-26'].userMoodId, 'happy_1');
});

const values = new Map<string,string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } } } });
test('player annotations on character diaries reach only that direct chat and changed annotations stay unread', async () => {
  await clearDbStorage();
  const space = appendDiaryAnnotation(makeSpace(), 'theirs', { id: 'a1', author: 'user', authorName: '小舟', content: '我想听后面的故事', createdAt: '2026-10-26' });
  writeCoupleSpaces({ a: space });
  const injection = buildCoupleSpaceInjection(['a'], 'direct', () => '林渡'); assert(injection.text.includes('我想听后面的故事')); assert(injection.text.includes('玩家批注了你的日记'));
  assert.equal(buildCoupleSpaceInjection(['b'], 'direct', () => '别人').text, ''); assert.equal(buildCoupleSpaceInjection(['a','b'], 'group', () => '').text, '');
  const changed = appendDiaryAnnotation(space, 'theirs', { id: 'a2', author: 'user', authorName: '小舟', content: '后来呢', createdAt: '2026-10-26' }); writeCoupleSpaces({ a: changed }); applyCoupleSeenAfterChat(injection);
  assert.equal(readCoupleSpaces().a.diaries[1].seenByChar, false);
  applyCoupleSeenAfterChat(buildCoupleSpaceInjection(['a'], 'direct', () => '林渡')); assert.equal(readCoupleSpaces().a.diaries[1].seenByChar, true);
});
