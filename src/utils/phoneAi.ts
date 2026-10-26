import type {
  CharacterPhoneData,
  PhoneAgentTurn,
  PhoneBrowserItem,
  PhoneIcityDiary,
  PhoneNoteItem,
  PhonePhotoItem,
  PhoneRatingItem,
  PhoneWeChatThread,
} from '../apps/PhoneExplorerApp';
import { requestConfiguredAiText } from './aiApi';
import { readCharacterBrief } from './coupleSpaceData';
import { PhoneHealth, PhoneWallet, readCharacterWallet, readRecentMoneyEvents } from './phoneData';
import { buildPrompt } from './buildPrompt';
import { readStorageString } from './localStorage';
import { buildMemoryInjection } from './memoryData';
import { guardMemoryArchive } from './memoryArchives';

export type PhoneGenScope = 'wechat' | 'album' | 'browser' | 'notes' | 'icity' | 'agent' | 'wallet' | 'health' | 'douban' | 'shopping';
export const PHONE_GEN_SCOPES: PhoneGenScope[] = ['wechat', 'album', 'browser', 'notes', 'icity', 'agent', 'wallet', 'health', 'douban', 'shopping'];

export interface PhoneGenContext {
  charId: string;
  charName: string;
  userName: string;
  npcs: Array<{ name: string; persona?: string }>;
}

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown, max = 600) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isRecord) : []);
const num = (value: unknown, fallback: number) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const parseJson = (text: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) return parsed;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed: unknown = JSON.parse(match[0]);
        if (isRecord(parsed)) return parsed;
      } catch {
        // fall through
      }
    }
  }
  throw new Error('AI 返回的内容不是有效的 JSON，请重试。');
};

const SCOPE_LABEL: Record<PhoneGenScope, string> = {
  wechat: '微信里与朋友/同事/长辈的聊天',
  album: '相册',
  browser: '浏览器搜索历史',
  notes: '备忘录',
  icity: 'icity 私密日记',
  agent: '与 AI 助手（豆包、Claude）的对话记录',
  wallet: '钱包（资产与收支）',
  health: '健康数据（睡眠、步数、屏幕使用时间）',
  douban: '豆瓣（近期读过的书、看过的电影/纪录片、玩过的游戏及评分短评）',
  shopping: '购物车（角色可能加购的商品）',
};

const scopeSpec = (scope: PhoneGenScope, ctx: PhoneGenContext, prevWallet: PhoneWallet | null): string => {
  switch (scope) {
    case 'wechat': {
      const npcText = ctx.npcs.length
        ? `必须使用这些已关联的人物作为对话对象（最多取 2 位）：${ctx.npcs.slice(0, 2).map((n) => `${n.name}${n.persona ? `（${n.persona.slice(0, 60)}）` : ''}`).join('、')}。`
        : '没有关联人物，请根据角色背景虚构 2 位对话对象（好友、同事、长辈等），名字自然。';
      return `${npcText}每个对话 7~8 条消息，口吻像真人微信（极少标点，可有语气词），内容可以暗戳戳聊到玩家「${ctx.userName}」。同时给出角色给玩家「${ctx.userName}」的专属备注 userRemark（由角色的人设和与玩家的关系决定，简短）。
返回 JSON：{"userRemark":"备注","threads":[{"name":"对象名","messages":[{"from":"other或char","text":"内容","time":"HH:MM"}]}]}`;
    }
    case 'album':
      return `生成普通相册 4~5 张（日常抓拍、工作/学业随手拍、偷拍玩家背影、合照等）和私密相册 3~4 张（最隐秘的文字图：深夜胡言乱语草稿、偷偷珍藏的玩家睡颜、角色受挫时的私密自拍等）。每张是“文字图卡”：用文字描述画面。
返回 JSON：{"photos":[{"isPrivate":false,"dateStr":"10月12日","location":"地点","sceneDesc":"画面描述","charThought":"角色拍下时的一句备注"}]}`;
    case 'browser':
      return `生成 5 条带时间的搜索记录，有反差感和窥探感：工作相关的硬核问题、关于玩家的纠结小心思、以及至少 1 条成人向/生理需求相关的私密搜索（tag 用“私密18+”，可以直白，但只写搜索词和简短摘要，不要描写性行为细节）。其余 tag 用“日常”或“情感”。
返回 JSON：{"items":[{"query":"搜索词","urlDomain":"网站域名","timeStr":"如 昨天 18:20","tag":"日常|情感|私密18+","summary":"简短摘要"}]}`;
    case 'notes':
      return `生成 2~3 条极私密的备忘录：随手记下的关于玩家「${ctx.userName}」的琐碎喜好清单，或遇到挫折、隐忍克制时的心理独白/计划草案。
返回 JSON：{"notes":[{"title":"标题","content":"内容，可换行","updatedAt":"如 昨天 23:10"}]}`;
    case 'icity':
      return `本次只生成一篇完整的第一人称私密日记，diaries 数组必须恰好一项。建议400~900字，允许自然分段，不能拆成多篇、多个日期或日记合集。时间与当前剧情相符，不强制深夜；天气不明确时写“未记录”，不要把猜测当事实。
从最近对话或记忆中一件具体的小事切入，写清事情的起因、当时的反应、事后反复想起的细节，以及此刻怎样理解自己的感受，形成完整叙事。重点剖析内心世界：为什么一句话令自己在意、期待与顾虑怎样冲突、表面表现与真实动机有何距离、自己不愿承认什么。情绪要有具体依据与变化，细腻真实，保留人设中的表达习惯、克制程度、价值观和自我辩解，不强行煽情、吃醋或告白，不堆砌抒情形容词和心理学术语。
结合提供的对话、人设、当前存档记忆和世界书，准确区分谁说过什么、谁与谁经历了什么；不把其他人的经历写成自己亲历，不把约定写成已发生。可以对真实事件作主观理解，但不要虚构重大往事或关系进展；资料少时围绕已知细节与当下心绪展开，不编造共同经历。不要复述聊天流水账、写总结报告或给玩家的信；结尾自然落在一个未解的念头、细微的领悟或打算上，不必强行圆满。
返回 JSON：{"diaries":[{"dateStr":"10月16日","timeStr":"02:40","weather":"天气","mood":"心情","content":"日记正文"}]}`;
    case 'shopping':
      return `生成3~5件角色可能放进购物车、尚未购买的商品。根据人设、职业、收入、生活习惯、兴趣，以及最近对话和记忆中的实际需求挑选，品类自然多样，不要全部都是送玩家的礼物。价格符合角色经济状况；选购理由体现角色个人心思，用一句本人语气的简短备注。不能把加购写成已购买、已送出或已扣款，不制造订单或收支。商品不必是真实品牌，不编造真实商品链接。返回JSON：{"items":[{"name":"商品名称","category":"品类","price":89.9,"emoji":"商品表情","variant":"规格或款式","note":"角色自己的加购备注"}]}`;
    case 'agent':
      return `生成角色与两个 AI 助手的对话记录。豆包：琐碎日常、查天气食谱、吐槽无厘头问题等；Claude：深夜探讨复杂的心思、情感困局、道德拉扯、心理状况。各 4~6 轮，role 为 char 表示角色提问，ai 表示 AI 回复；AI 的回复要像真实的 AI 助手风格。
返回 JSON：{"doubaoTopic":"主题","doubaoTurns":[{"role":"char或ai","content":"内容"}],"claudeTopic":"主题","claudeTurns":[{"role":"char或ai","content":"内容"}]}`;
    case 'wallet': {
      const money = readRecentMoneyEvents(ctx.charId);
      const prev = prevWallet
        ? `当前钱包：资产 ¥${prevWallet.balance}，最近记录：${prevWallet.records.slice(0, 6).map((r) => `${r.timeStr}${r.title}${r.amount}`).join('；')}。请在此基础上延续，只生成“新增”的收支，并给出更新后的总资产。`
        : '这是第一次生成钱包，请根据角色身份和经济状况设定一个合理的总资产。';
      return `${prev}
与玩家「${ctx.userName}」之间发生过的转账、红包、礼物/订单（务必据实体现在收支里，方向和金额要对；若没有则不要编造）：
${money || '（暂无）'}
另外请生成一些符合人设的日常收支（工资、餐饮、交通、数码、请客、给家人转账等）。新增 5~8 条，金额为数字，收入为正、支出为负。
返回 JSON：{"balance":总资产数字,"records":[{"title":"名目","amount":数字,"timeStr":"如 10月16日 12:30","note":"可选备注"}]}`;
    }
    case 'health':
      return `生成今日的健康数据，要与角色人设、作息、现在的时间相符（现在是 ${new Date().toLocaleString('zh-CN')}，今日步数和屏幕使用时间不能超过到目前为止合理的量）。
返回 JSON：{"sleepHours":昨晚睡眠小时数(一位小数),"sleepNote":"一句睡眠备注，如 入睡较晚 / 中途醒过两次","steps":今日步数整数,"screenTimeMinutes":今日屏幕使用分钟数整数}`;
    case 'douban':
      return `生成至少 3 条角色最近实际读过、看过或玩过的书籍、电影、纪录片、游戏等作品评分记录。必须结合角色「${ctx.charName}」的人设和最近剧情：可以选择角色喜欢的作品，也可以写偶尔看到/读到/玩到的失望作品或烂片，形成自然真实的评价分布，不要所有条目都迎合角色口味。评价要像角色本人写的豆瓣短评，具体、有个人判断，不要模板化；不虚构作品本身的不存在情节，不把未发生的经历说成事实。条目类型从“书籍、电影、纪录片、游戏、其他”中选；评分为 1.0 到 5.0 分（满分 5 分），允许一位小数；日期用“YYYY年M月D日”。评分必须与短评的态度和结论严格一致：4.5–5.0 表示强烈喜欢并明确称赞，3.5–4.4 表示总体喜欢但有保留，2.5–3.4 表示褒贬参半或一般，1.5–2.4 表示明显不满，1.0–1.4 表示强烈不喜欢；不能出现短评明显称赞却给低分，或明显批评却给高分。至少 3 条，类型尽量多样，标题不可重复，每条短评说明喜欢或不喜欢的具体原因。
返回 JSON：{"items":[{"type":"书籍|电影|纪录片|游戏|其他","title":"作品名","creator":"作者/导演/开发者，可留空","rating":4.5,"review":"角色口吻的具体短评","date":"2026年10月21日"}]}`;
  }
};

export const generatePhoneScope = async (
  scope: PhoneGenScope | 'all',
  ctx: PhoneGenContext,
  prev: CharacterPhoneData
): Promise<Partial<CharacterPhoneData>> => {
  const assertArchive = guardMemoryArchive(ctx.charId);
  const brief = readCharacterBrief(ctx.charId, { configuredHistory: true });
  const memory = ['icity', 'shopping', 'all'].includes(scope) ? await buildMemoryInjection([ctx.charId], 'direct', brief.recentChat.slice(-1600), () => ctx.charName, { localOnly: true }) : undefined;
  assertArchive();
  const prevWallet = scope === 'wallet' ? (prev.wallet ?? readCharacterWallet(ctx.charId)) : null;
  const chats: unknown = JSON.parse(readStorageString('yyphone:wechat-chats') ?? '[]');
  const chat = Array.isArray(chats) ? chats.find((item: unknown) => isRecord(item) &&
    item.type === 'direct' && Array.isArray(item.participantIds) &&
    item.participantIds.length === 1 && item.participantIds[0] === ctx.charId) : undefined;
  const background = buildPrompt({ chatId: chat && typeof chat.id === 'string' ? chat.id : '',
    backgroundCharacterId: ctx.charId, currentInput: '', memoryInjection: memory });
  const scopes = scope === 'all' ? PHONE_GEN_SCOPES : [scope];
  const system = [
    ...background.filter((message) => message.role === 'system').map((message) => message.content),
    '【当前唯一任务：生成查手机内容】以上微信输出协议和社交动作只作背景，不要执行；只按本次查手机 JSON 格式输出。',
    `你要为角色「${ctx.charName}」生成他/她自己手机里的「${scopes.map((item) => SCOPE_LABEL[item]).join('、')}」内容，供玩家“查手机”时偷看。`,
    `角色人设：${brief.persona || '（无详细人设，请合理发挥）'}`,
    '要求：完全贴合人设与当前剧情，有生活感和细节，不要套话、不要客服腔；内容必须是角色自己的真实痕迹，不要出现“作为AI”之类的字眼；只返回 JSON，不要多余文字。',
  ].filter(Boolean).join('\n');
  const task = scope === 'all'
    ? `一次生成以下所有模块，返回一个以 ${scopes.join('、')} 为键的 JSON 对象，每个值按对应模块的格式填写，不能遗漏：\n${scopes.map((item) =>
      `【${item}】\n${scopeSpec(item, ctx, item === 'wallet' ? prev.wallet ?? readCharacterWallet(ctx.charId) : null)}`).join('\n\n')}`
    : scopeSpec(scope, ctx, prevWallet);
  const result = parseJson(await requestConfiguredAiText(system, task, {
    json: true, includeGlobalWorldBooks: false,
    history: background.flatMap((message) => message.role === 'system' ? [] : [{ role: message.role, content: message.content }]),
    ...(scope === 'all' ? { maxTokens: 16000 } : {}),
  }));
  assertArchive();
  if (scope !== 'all') return parsePhoneScope(scope, result, ctx, prev, prevWallet);
  return Object.assign({}, ...scopes.map((item) => {
    const section = result[item];
    if (!isRecord(section)) throw new Error(`AI 遗漏了手机模块 ${SCOPE_LABEL[item]}，未保存，请重试。`);
    if (item === 'agent' && ['doubaoTurns', 'claudeTurns'].some((key) =>
      !list(section[key]).some((turn) => str(turn.content, 800)))) {
      throw new Error('AI 未生成两个助手的完整对话，未保存，请重试。');
    }
    return parsePhoneScope(item, section, ctx, prev, item === 'wallet' ? prev.wallet ?? readCharacterWallet(ctx.charId) : null);
  }));
};

const parsePhoneScope = (
  scope: PhoneGenScope, result: Record<string, unknown>, ctx: PhoneGenContext,
  prev: CharacterPhoneData, prevWallet: PhoneWallet | null
): Partial<CharacterPhoneData> => {
  switch (scope) {
    case 'wechat': {
      const threads: PhoneWeChatThread[] = list(result.threads).slice(0, 3).map((thread, index) => {
        const name = str(thread.name, 20) || `联系人${index + 1}`;
        return {
          id: uid('npc-thread'),
          targetId: `npc-${index + 1}`,
          name,
          remark: name,
          avatarText: name.slice(0, 1),
          avatarBg: ['#DCE6DF', '#DEE6EF', '#EDE4EA'][index % 3],
          messages: list(thread.messages).slice(0, 12).map((m) => ({
            id: uid('m'),
            sender: m.from === 'char' ? 'char' as const : 'other' as const,
            senderName: m.from === 'char' ? ctx.charName : name,
            text: str(m.text, 300),
            time: str(m.time, 8),
          })).filter((m) => m.text),
        };
      }).filter((thread) => thread.messages.length > 0);
      if (threads.length === 0) throw new Error('AI 没有生成有效的微信对话，请重试。');
      return { userRemark: str(result.userRemark, 24) || prev.userRemark, npcThreads: threads };
    }
    case 'album': {
      const photos: PhonePhotoItem[] = list(result.photos).slice(0, 10).map((p) => ({
        id: uid('p'),
        isPrivate: p.isPrivate === true,
        dateStr: str(p.dateStr, 16),
        location: str(p.location, 30),
        sceneDesc: str(p.sceneDesc, 300),
        charThought: str(p.charThought, 120),
      })).filter((p) => p.sceneDesc);
      if (photos.length === 0) throw new Error('AI 没有生成有效的相册内容，请重试。');
      return { photos };
    }
    case 'browser': {
      const items: PhoneBrowserItem[] = list(result.items).slice(0, 8).map((item) => ({
        id: uid('b'),
        query: str(item.query, 80),
        urlDomain: str(item.urlDomain, 40),
        timeStr: str(item.timeStr, 16),
        tag: item.tag === '私密18+' ? '私密18+' as const : item.tag === '情感' ? '情感' as const : '日常' as const,
        summary: str(item.summary, 160),
      })).filter((item) => item.query);
      if (items.length === 0) throw new Error('AI 没有生成有效的搜索记录，请重试。');
      return { browserHistory: items };
    }
    case 'notes': {
      const notes: PhoneNoteItem[] = list(result.notes).slice(0, 5).map((n) => ({
        id: uid('n'),
        title: str(n.title, 30),
        content: str(n.content, 800),
        updatedAt: str(n.updatedAt, 16),
      })).filter((n) => n.content);
      if (notes.length === 0) throw new Error('AI 没有生成有效的备忘录，请重试。');
      return { notes };
    }
    case 'icity': {
      if (!Array.isArray(result.diaries) || result.diaries.length !== 1 || !isRecord(result.diaries[0]) || typeof result.diaries[0].content !== 'string' || result.diaries[0].content.length > 4000) throw new Error('本次需要一篇完整日记，AI 返回的篇数或内容不符合要求，未保存，请重试。');
      const diaries: PhoneIcityDiary[] = list(result.diaries).map((d) => ({
        id: uid('d'),
        dateStr: str(d.dateStr, 16),
        timeStr: str(d.timeStr, 8),
        weather: str(d.weather, 10),
        mood: str(d.mood, 10),
        content: str(d.content, 4000),
      })).filter((d) => d.content);
      if (diaries.length === 0) throw new Error('AI 没有生成有效的日记，请重试。');
      return { icityDiaries: diaries };
    }
    case 'shopping': {
      if (!Array.isArray(result.items) || result.items.length < 3 || result.items.length > 5) throw new Error('购物车需要3～5件商品，未保存，请重试。');
      const items = list(result.items).map(item => ({ id: uid('cart'), name: str(item.name, 80), category: str(item.category, 24), price: typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0 ? Math.round(item.price * 100) / 100 : -1, emoji: str(item.emoji, 12) || '🛍️', variant: str(item.variant, 80), note: str(item.note, 240) }));
      if (items.length !== result.items.length || items.some(item => !item.name || item.price < 0 || !item.note) || new Set(items.map(item => item.name)).size !== items.length) throw new Error('购物车商品信息不完整或重复，未保存，请重试。');
      return { shoppingCart: items };
    }
    case 'agent': {
      const turns = (value: unknown): PhoneAgentTurn[] =>
        list(value).slice(0, 12).map((t) => ({
          id: uid('t'),
          role: t.role === 'char' ? 'char' as const : 'ai' as const,
          content: str(t.content, 800),
        })).filter((t) => t.content);
      const doubaoTurns = turns(result.doubaoTurns);
      const claudeTurns = turns(result.claudeTurns);
      if (doubaoTurns.length === 0 && claudeTurns.length === 0) throw new Error('AI 没有生成有效的智能体对话，请重试。');
      return {
        agentSession: {
          doubaoTopic: str(result.doubaoTopic, 40) || prev.agentSession.doubaoTopic,
          doubaoTurns: doubaoTurns.length ? doubaoTurns : prev.agentSession.doubaoTurns,
          claudeTopic: str(result.claudeTopic, 40) || prev.agentSession.claudeTopic,
          claudeTurns: claudeTurns.length ? claudeTurns : prev.agentSession.claudeTurns,
        },
      };
    }
    case 'wallet': {
      const newRecords = list(result.records).slice(0, 12).map((r) => ({
        id: uid('w'),
        title: str(r.title, 30),
        amount: Math.round(num(r.amount, 0) * 100) / 100,
        timeStr: str(r.timeStr, 20),
        ...(str(r.note, 40) ? { note: str(r.note, 40) } : {}),
      })).filter((r) => r.title && r.amount !== 0);
      const balance = num(result.balance, NaN);
      if (!Number.isFinite(balance) || newRecords.length === 0) throw new Error('AI 没有生成有效的钱包数据，请重试。');
      return {
        wallet: {
          balance: Math.max(0, Math.round(balance * 100) / 100),
          records: [...newRecords, ...(prevWallet?.records ?? [])].slice(0, 40),
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case 'health': {
      if (!['sleepHours', 'steps', 'screenTimeMinutes'].every((key) =>
        typeof result[key] === 'number' && Number.isFinite(result[key])) ||
        typeof result.sleepNote !== 'string') {
        throw new Error('AI 没有生成完整的健康数据，未保存，请重试。');
      }
      const health: PhoneHealth = {
        sleepHours: Math.min(14, Math.max(0, Math.round(num(result.sleepHours, 7) * 10) / 10)),
        sleepNote: str(result.sleepNote, 40),
        steps: Math.max(0, Math.round(num(result.steps, 3000))),
        screenTimeMinutes: Math.max(0, Math.round(num(result.screenTimeMinutes, 120))),
      };
      return { health };
    }
    case 'douban': {
      const ratings: PhoneRatingItem[] = list(result.items).slice(0, 20).map((item) => {
        const rating = num(item.rating, NaN);
        const type: PhoneRatingItem['type'] = item.type === '书籍' || item.type === '电影' ||
          item.type === '纪录片' || item.type === '游戏' ? item.type : '其他';
        return {
          id: uid('rating'),
          type,
          title: str(item.title, 100),
          creator: str(item.creator, 80),
          rating: Number.isFinite(rating) ? Math.min(5, Math.max(1, Math.round(rating * 10) / 10)) : 0,
          review: str(item.review, 800),
          date: str(item.date, 24),
        };
      }).filter((item) => item.title && item.review && item.rating > 0);
      if (ratings.length < 3) throw new Error('豆瓣内容至少需要 3 条有效评分记录，未保存，请重试。');
      return { ratings };
    }
  }
};
