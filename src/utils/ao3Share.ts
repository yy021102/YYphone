import { isAo3Work, type Ao3Work } from './ao3Data';
import { readAo3Characters } from './ao3Generation';
import { mutateDirectChat } from './coupleSpaceData';

export function ao3ShareContent(work: Ao3Work): string {
  return ['【玩家分享的 AO3 同人作品】',

    `标题：${work.title}\n作者：${work.author}\n同人圈：${work.fandom}\n关系：${work.relationship}\n分级：${work.rating}\n预警：${work.warning}`,
    `简介：${work.summary}`, ...(work.notes ? [`作者的话：${work.notes}`] : []),
    ...work.chapters.map((c, i) => `【第 ${i + 1} 章：${c.title}】\n${c.body}`),
    '【读者评论】', ...work.comments.map(c => {
      const parent = work.comments.find(p => p.id === c.replyTo);
      return `${parent ? `【回复 ${parent.author}：${parent.body.slice(0, 100)}】\n` : ''}${c.author}：${c.body}`;
    })].join('\n\n');
}
/** Share an independent snapshot, never a live reference or a character's hidden identity. */
export function shareAo3Work(work: Ao3Work, charId: string) {
  if (!isAo3Work(work)) throw new Error('作品内容不完整，未发送。');
  if (!readAo3Characters().some(c => c.id === charId)) throw new Error('角色已不在通讯录中。');
  const content = ao3ShareContent(work);
  mutateDirectChat(charId, chat => {
    if (chat.blocked || chat.blockedByChar) throw new Error('当前对话已被拉黑，暂时无法分享。');
    chat.messages.push({ id: `ao3-share-${crypto.randomUUID()}`, senderId: 'user', kind: 'link', title: work.title,
      text: `分享 AO3 作品《${work.title}》`, source: 'AO3', content, createdAt: new Date().toISOString() });
  });
}
