import { currentAliasUser } from './aliasAccounts';
import { activeMemoryArchive } from './memoryArchives';
import { readStoredValue } from './localStorage';
import { isObject } from './divination';
import { copySipRecipe, createSipDrink, sipRecipeText, sipShareText, updateSip, type SipDrink, type SipRecipe } from './littleSip';

const CHATS_KEY = 'yyphone:wechat-chats';
interface SipMessage {
  id: string; senderId: string; text: string; createdAt: string;
  kind?: string; title?: string; content?: string; source?: string;
}
interface SipChat {
  id: string; type: string; participantIds: string[]; messages: SipMessage[];
  activeArchiveId?: string; archiveRevision?: string | number; blocked?: boolean; updatedAt: string;
}
export interface SipChatScope {
  actorId: string; userId: string; archiveKey: string; chatId: string; archiveRevision: string | number;
}
export interface SipResponse { text: string; scope: SipChatScope }
export type SipRecordRequest = {
  scope: SipChatScope; syncToChat: boolean; signal?: AbortSignal;
} & ({ kind: 'recipe'; recipe: SipRecipe } | { kind: 'taste'; drinkId: string; tastingId: string; text: string });

function chats(): SipChat[] {
  const value = readStoredValue<unknown>(CHATS_KEY, [], (_v): _v is unknown => true);
  if (!Array.isArray(value) || !value.every((c): c is SipChat => isObject(c) && typeof c.id === 'string' &&
    typeof c.type === 'string' && Array.isArray(c.participantIds) && c.participantIds.every(id => typeof id === 'string') &&
    Array.isArray(c.messages) && c.messages.every(m => isObject(m) && typeof m.id === 'string')))
    throw new Error('聊天记录格式异常，未保存饮品同步记录。');
  return value;
}
const directChat = (all: SipChat[], actorId: string) => all.find(c =>
  c.type === 'direct' && c.participantIds.length === 1 && c.participantIds[0] === actorId);
export function captureSipChatScope(actorId: string): SipChatScope {
  const chat = directChat(chats(), actorId);
  return { actorId, userId: currentAliasUser().id, archiveKey: activeMemoryArchive(actorId),
    chatId: chat?.id ?? '', archiveRevision: chat?.archiveRevision ?? '' };
}
export function assertSipChatScope(scope: SipChatScope): void {
  const contacts = readStoredValue<unknown>('pocketos:wechat-contacts', [], (_v): _v is unknown => true);
  const chat = directChat(chats(), scope.actorId);
  if (currentAliasUser().id !== scope.userId || activeMemoryArchive(scope.actorId) !== scope.archiveKey ||
    (chat?.id ?? '') !== scope.chatId || (chat?.archiveRevision ?? '') !== scope.archiveRevision ||
    !Array.isArray(contacts) || !contacts.some(c => isObject(c) && c.id === scope.actorId))
    throw new Error('当前玩家、角色或存档已变化，已取消本次饮品操作，请重新请求。');
}
export function sipChatChanges(scope: SipChatScope, drink: SipDrink, kind: 'recipe' | 'taste' | 'serve', tastingId?: string): Record<string, unknown> {
  assertSipChatScope(scope);
  const all = chats(), current = directChat(all, scope.actorId), now = new Date().toISOString();
  if (current?.blocked) throw new Error('这位角色的聊天已拉黑，不能同步饮品记录。');
  const user = currentAliasUser();
  let id: string, title: string, detail: string;
  if (kind === 'recipe') {
    if (drink.recipe.maker.actorId !== scope.actorId) throw new Error('这不是所选角色制作的配方，未同步。');
    id = `little-sip-made-${drink.id}-${scope.actorId}`;
    title = `${drink.recipe.name} · 角色制作记录`;
    detail = `【一杯之间的制作经历记录，并非角色在主号发出的新消息】\n${drink.recipe.adapted
      ? `${drink.recipe.maker.name}提供配方，${user.name}在此基础上调整并完成了这一杯`
      : `${drink.recipe.maker.name}为${user.name}调制了这一杯`}，玩家已确认收下并加入饮品单。\n${sipRecipeText(drink.recipe)}`;
  } else {
    const serving = drink.servings.find(s => s.actorId === scope.actorId);
    if (!serving) throw new Error('这杯饮品尚未送给所选角色。');
    if (kind === 'taste') {
      const tasting = serving.tastings.find(t => t.id === tastingId && t.status === 'done');
      if (!tasting) throw new Error('试饮尚未完成，不能同步未完成的反馈。');
      id = `little-sip-taste-${drink.id}-${tasting.id}`;
      title = `${drink.recipe.name} · ${serving.actorName}的试饮记录`;
      detail = `【一杯之间的试饮经历记录，并非角色在主号发出的新消息】\n${user.name}请${serving.actorName}品尝了这杯饮品。\n${sipRecipeText(drink.recipe)}\n${serving.actorName}的本次实际试饮反馈：\n${tasting.text}`;
    } else {
      id = `little-sip-${drink.id}-${scope.actorId}`;
      title = `${drink.recipe.name} · 给${serving.actorName}的一杯`;
      detail = sipShareText(drink, scope.actorId);
    }
  }
  const card = { id, senderId: 'user', kind: 'link', source: '微信 · 一杯之间', title, text: detail, content: detail, createdAt: now };
  const base = current ?? { id: `chat-${crypto.randomUUID()}`, type: 'direct', participantIds: [scope.actorId],
    noteName: '', context: '', narratorEnabled: false, blocked: false, pinned: false, avatars: {}, messages: [],
    timeZone: 'Asia/Shanghai', allowIncomingCalls: false, currentChatHistoryCount: 200, replyMessageMin: 1, replyMessageMax: 6, updatedAt: now };
  const next = { ...base, updatedAt: now, messages: base.messages.some(m => m.id === id)
    ? base.messages.map(m => m.id === id ? { ...card, createdAt: m.createdAt } : m) : [...base.messages, card] };
  return { [CHATS_KEY]: current ? all.map(c => c.id === current.id ? next : c) : [next, ...all] };
}
export async function recordSipResult(input: SipRecordRequest): Promise<SipDrink> {
  const created = input.kind === 'recipe' ? createSipDrink(input.recipe) : undefined;
  let saved: SipDrink | undefined;
  await updateSip(state => {
    input.signal?.throwIfAborted();
    assertSipChatScope(input.scope);
    if (input.kind === 'recipe' && created) {
      if (created.recipe.maker.actorId !== input.scope.actorId) throw new Error('配方署名与角色不符，未保存。');
      const drink = state.drinks.find(d => d.recipe.id === created.recipe.id) ?? created;
      if (JSON.stringify(drink.recipe) !== JSON.stringify(created.recipe)) throw new Error('配方已变化，请重新确认。');
      saved = drink;
      return { recipes: state.recipes.some(r => r.id === drink.recipe.id) ? state.recipes : [copySipRecipe(drink.recipe), ...state.recipes],
        drinks: state.drinks.some(d => d.id === drink.id) ? state.drinks : [drink, ...state.drinks] };
    }
    if (input.kind !== 'taste') throw new Error('饮品记录类型无效。');
    const drink = state.drinks.find(d => d.id === input.drinkId);
    const serving = drink?.servings.find(s => s.actorId === input.scope.actorId);
    const tasting = serving?.tastings.find(t => t.id === input.tastingId);
    if (!drink || !tasting || tasting.status !== 'pending' || !input.text.trim() || input.text.length > 5000)
      throw new Error('试饮记录已变化或反馈无效，请重新邀请试饮。');
    const completed = { ...drink, servings: drink.servings.map(s => s.actorId === input.scope.actorId ? { ...s,
      tastings: s.tastings.map(t => t.id === input.tastingId ? { ...t, status: 'done' as const, text: input.text.trim() } : t) } : s) };
    saved = completed;
    return { ...state, drinks: state.drinks.map(d => d.id === drink.id ? completed : d) };
  }, () => {
    if (!saved) throw new Error('饮品记录未生成。');
    input.signal?.throwIfAborted();
    return input.syncToChat ? sipChatChanges(input.scope, saved, input.kind, input.kind === 'taste' ? input.tastingId : undefined) : {};
  });
  if (!saved) throw new Error('饮品记录未保存。');
  return saved;
}
