import type { AdventureShare } from '../components/TextAdventureSimulator';

export function formatAdventureShare(snapshot: AdventureShare, recipientId: string): { content: string; aiContext: string } {
  const together = snapshot.companionId === recipientId;
  const participation = together
    ? `你和玩家在这个世界里共同扮演主角。你是同行者${snapshot.companionName}。`
    : snapshot.companionId
      ? `玩家和${snapshot.companionName}在这个世界里共同扮演主角；你是这张卡片的接收者，不是该局同行者。`
      : '玩家独自在这个世界里体验剧情；你是这张卡片的接收者。';
  const status = snapshot.status === 'completed' ? '已结束' : '中途暂停';
  const content = `${status} · 第${snapshot.turn + 1}回合\n${snapshot.chapter} · ${snapshot.place}\n${snapshot.sceneTitle}：${snapshot.progress.slice(0, 130)}`;
  const aiContext = `这是玩家分享的沉浸式文字冒险游戏进度卡片，属于共同扮演的番外玩法，不是真实穿越，也不是你和玩家在现实中亲身经历的事件。${participation}\n世界：${snapshot.worldTitle}（${snapshot.worldTag}）｜状态：${status}｜第${snapshot.turn + 1}回合\n当前：${snapshot.chapter} · ${snapshot.place} · ${snapshot.sceneTitle}\n剧情进展：${snapshot.progress}`;
  return { content, aiContext };
}
