import { readStoredValue, writeStoredValue } from './localStorage';

export const FORUM_HANDLES_KEY = 'yyphone:forum-character-handles';

export const normalizeForumHandle = (value: string): string => {
  const handle = value.trim().replace(/^@/, '');
  if (value.trim() && !/^[\p{L}\p{N}_.-]{2,40}$/u.test(handle)) {
    throw new Error('论坛 ID 需为 2–40 个字母、数字、汉字、下划线、短横线或英文句点，不含空格。');
  }
  return handle;
};

export const readGeneratedForumHandles = (): Record<string, string> =>
  readStoredValue(FORUM_HANDLES_KEY, {}, (value): value is Record<string, string> =>
    !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value).every((handle) => typeof handle === 'string' && /^[\p{L}\p{N}_.-]{2,40}$/u.test(handle))
  );

export const resolveForumHandle = (
  contact: { id: string; forumHandle?: string },
  generated: unknown
): string => {
  const configured = normalizeForumHandle(contact.forumHandle ?? '');
  if (configured) return configured;
  const handles = readGeneratedForumHandles();
  if (handles[contact.id]) return handles[contact.id];
  const handle = normalizeForumHandle(typeof generated === 'string' ? generated : '');
  if (!handle || handle === contact.id) throw new Error('AI 未生成有效的角色论坛 ID，请重试或在角色编辑页手动填写。');
  writeStoredValue(FORUM_HANDLES_KEY, { ...handles, [contact.id]: handle });
  return handle;
};
