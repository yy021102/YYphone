import type { CharacterCoupleSpace } from '../apps/CoupleSpaceApp';
import { localDateString } from './coupleSpaceData';

export type CoupleRecordEdit =
  | { kind: 'mood'; originalDate: string; date: string; author: 'user' | 'char'; moodId: string; note: string }
  | { kind: 'diary'; id: string; date: string; title: string; content: string; replyComment: string; authorName: string }
  | { kind: 'qa'; id: string; date: string; question: string; userAnswer: string; charAnswer: string }
  | { kind: 'note'; id: string; date: string; content: string; colorBg: string; authorName: string }
  | { kind: 'anniversary'; id: string; date: string; title: string; type: 'countdown' | 'elapsed' };

export const isRecordDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getDate() === Number(value.slice(8, 10));
};

export const coupleRecordDate = (value: string): string | undefined => {
  if (isRecordDate(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : localDateString(date);
};

export const editCoupleRecord = (space: CharacterCoupleSpace, edit: CoupleRecordEdit): CharacterCoupleSpace => {
  if (!isRecordDate(edit.date)) throw new Error('请选择有效的记录日期。');
  if (edit.kind === 'mood') {
    if (!/^(happy|calm|sad|angry|tired)_[12]$/.test(edit.moodId)) throw new Error('请选择有效的心情。');
    const source = space.moods[edit.originalDate];
    const moodKey = edit.author === 'user' ? 'userMoodId' : 'charMoodId';
    const noteKey = edit.author === 'user' ? 'userNote' : 'charNote';
    const target = space.moods[edit.date];
    if (edit.date !== edit.originalDate && (target?.[moodKey] || target?.[noteKey])) {
      throw new Error('目标日期已有这一方的心情，请先编辑目标记录或将其移到其他日期，避免覆盖。');
    }
    const moods = { ...space.moods };
    if (edit.date !== edit.originalDate && source) {
      const remaining = { ...source };
      delete remaining[moodKey];
      delete remaining[noteKey];
      if (edit.author === 'user') delete remaining.seenByChar;
      if (remaining.userMoodId || remaining.userNote || remaining.charMoodId || remaining.charNote) {
        moods[edit.originalDate] = remaining;
      } else delete moods[edit.originalDate];
    }
    moods[edit.date] = {
      ...(target ?? { dateStr: edit.date }),
      dateStr: edit.date,
      [moodKey]: edit.moodId,
      [noteKey]: edit.note.trim(),
      ...(edit.author === 'user' ? { seenByChar: false } : {}),
    };
    return { ...space, moods };
  }
  const missing = () => { throw new Error('这条记录已不存在，请关闭编辑后重试。'); };
  if (edit.kind === 'diary') {
    if (!space.diaries.some((entry) => entry.id === edit.id)) return missing();
    if (!edit.content.trim()) throw new Error('日记内容不能为空。');
    return {
      ...space,
      diaries: space.diaries.map((entry) => entry.id === edit.id ? {
        ...entry, dateStr: edit.date, title: edit.title.trim() || '今日小记', content: edit.content.trim(),
        authorName: edit.authorName.trim(), replyComment: edit.replyComment.trim(),
        ...(entry.author === 'user' ? { seenByChar: false } : {}),
      } : entry),
    };
  }
  if (edit.kind === 'qa') {
    if (!space.qaList.some((entry) => entry.id === edit.id)) return missing();
    if (!edit.question.trim()) throw new Error('问题不能为空。');
    return {
      ...space,
      qaList: space.qaList.map((entry) => entry.id === edit.id ? {
        ...entry, dateStr: edit.date, question: edit.question.trim(), userAnswer: edit.userAnswer.trim(),
        charAnswer: edit.charAnswer.trim(), seenByChar: false,
      } : entry),
    };
  }
  if (edit.kind === 'note') {
    if (!space.stickyNotes.some((entry) => entry.id === edit.id)) return missing();
    if (!edit.content.trim()) throw new Error('便签内容不能为空。');
    if (!/^#[\da-f]{6}$/i.test(edit.colorBg)) throw new Error('请选择有效的便签颜色。');
    return {
      ...space,
      stickyNotes: space.stickyNotes.map((entry) => entry.id === edit.id ? {
        ...entry, createdAt: edit.date, content: edit.content.trim(), colorBg: edit.colorBg,
        authorName: edit.authorName.trim(),
        ...(entry.author === 'user' ? { seenByChar: false } : {}),
      } : entry),
    };
  }
  if (!space.anniversaries.some((entry) => entry.id === edit.id)) return missing();
  if (!edit.title.trim()) throw new Error('纪念日标题不能为空。');
  return {
    ...space,
    anniversaries: space.anniversaries.map((entry) => entry.id === edit.id ? {
      ...entry, title: edit.title.trim(), targetDate: edit.date, type: edit.type,
    } : entry),
  };
};
