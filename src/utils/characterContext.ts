export interface CharacterContextEvent {
  id: string;
  charId: string;
  createdAt: string;
  content: string;
  source: 'taobao' | 'xianyu';
}

export const CHARACTER_CONTEXT_STORAGE_KEY = 'yyphone:character-context-events';

export const appendCharacterContextEvent = (
  charId: string,
  content: string,
  source: CharacterContextEvent['source']
) => {
  const raw = window.localStorage.getItem(CHARACTER_CONTEXT_STORAGE_KEY);
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) throw new Error('角色上下文数据格式无效，无法保存互动记录。');
  const events = parsed.filter((event): event is CharacterContextEvent =>
    !!event &&
    typeof event === 'object' &&
    typeof (event as CharacterContextEvent).id === 'string' &&
    typeof (event as CharacterContextEvent).charId === 'string' &&
    typeof (event as CharacterContextEvent).createdAt === 'string' &&
    typeof (event as CharacterContextEvent).content === 'string' &&
    ((event as CharacterContextEvent).source === 'taobao' ||
      (event as CharacterContextEvent).source === 'xianyu')
  );
  events.push({
    id: `context-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    charId,
    createdAt: new Date().toISOString(),
    content,
    source,
  });
  window.localStorage.setItem(CHARACTER_CONTEXT_STORAGE_KEY, JSON.stringify(events));
};
