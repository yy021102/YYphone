import { mutateDirectChat } from './coupleSpaceData';

export type ContextNoteSource = 'offline' | 'phone-memory';

export interface ContextNoteInput {
  /** 固定 id 时重复调用会更新同一条，而不是新增 */
  id: string;
  source: ContextNoteSource;
  /** 聊天里显示的标题 */
  title: string;
  /** 聊天里显示的简短内容，可为空（比如私密的手机记忆只显示标题） */
  content?: string;
  /** 给 AI 看的完整内容，会进入聊天上下文和流水账 */
  detail: string;
}

/**
 * 在角色的微信单聊里放一条“上下文记录”：不是任何人说的话，但和聊天消息一样
 * 属于上下文——最近的会随原文一起发给 AI，更早的会被流水账总结进去。
 */
export const upsertContextNote = (charId: string, note: ContextNoteInput) => {
  mutateDirectChat(charId, (chat) => {
    const existing = chat.messages.find((message) => message.id === note.id);
    if (existing) {
      existing.title = note.title;
      existing.content = note.content ?? '';
      existing.aiContext = note.detail;
      existing.text = note.title;
      return;
    }
    chat.messages.push({
      id: note.id,
      senderId: 'narrator',
      kind: 'context-note',
      source: note.source,
      title: note.title,
      content: note.content ?? '',
      aiContext: note.detail,
      text: note.title,
      createdAt: new Date().toISOString(),
    });
  });
};

export const removeContextNote = (charId: string, id: string) => {
  mutateDirectChat(charId, (chat) => {
    chat.messages = chat.messages.filter((message) => message.id !== id);
  });
};
