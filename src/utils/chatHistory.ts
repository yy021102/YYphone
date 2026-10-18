export const DEFAULT_CHAT_HISTORY_COUNT = 200;

export const resolveChatHistoryCount = (value: unknown, fallback = DEFAULT_CHAT_HISTORY_COUNT): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;

interface ChatSource {
  id: string;
  type: 'direct' | 'group' | 'observer';
  participantIds: string[];
  groupTitle?: string;
  noteName?: string;
  groupNicknames?: Record<string, string>;
}

export const describeChatSource = (
  chat: ChatSource,
  nameOf: (id: string) => string | undefined,
  userName = '玩家'
) => {
  const title = chat.groupTitle?.trim() || chat.noteName?.trim() ||
    chat.participantIds.map((id) => nameOf(id) || id).join('、') || '未命名聊天';
  const type = chat.type === 'observer' ? '旁观群聊' : chat.type === 'group' ? '群聊' : '单聊';
  const members = [...new Set([
    ...(chat.type === 'observer' ? [] : ['user']),
    ...chat.participantIds.filter((id) => chat.type !== 'observer' || id !== 'user'),
  ])].map((id) => {
    const name = id === 'user' ? userName : nameOf(id) || id;
    const nickname = chat.groupNicknames?.[id]?.trim();
    return `${name}（ID：${id}${nickname && nickname !== name ? `；群昵称：${nickname}` : ''}）`;
  }).join('、');
  return {
    title,
    label: `${type}「${title}」`,
    text: [
      `聊天类型：${type}；名称：${title}；聊天ID：${chat.id}`,
      `聊天成员：${members || '无'}`,
      chat.type === 'observer'
        ? '玩家不在这个群里；玩家操作旁观界面不代表入群，不能把成员间的对话当作对玩家说的话。'
        : chat.type === 'group'
          ? '玩家是这个群的成员；群内消息属于公开群聊，不是与某个角色的单独私聊。'
          : '这是玩家与该角色的单聊，不是群内公开发言。',
    ].join('\n'),
  };
};

export const buildGroupPrivateContext = (
  chat: ChatSource,
  nameOf: (id: string) => string | undefined,
  userName: string,
  reason: string
) => [
  '【群聊触发私信的来源】',
  describeChatSource(chat, nameOf, userName).text,
  `你因这个群里的情境转到私聊联系玩家，私发动机：${reason}`,
  '这是已经发生的群聊背景，不是玩家在私聊里刚说的话；其他群成员并不知道这封私信的正文，不要重复发送。',
].join('\n');
