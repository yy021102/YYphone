import { readStoredValue, writeStoredValue } from './localStorage';

export const AO3_KEY = 'yyphone:ao3';
export const AO3_DRAFT_KEY = 'yyphone:ao3-draft';
export const AO3_RATINGS = ['General Audiences', 'Teen And Up Audiences', 'Mature', 'Explicit', 'Not Rated'] as const;
export const AO3_CATEGORIES = ['Gen', 'F/M', 'M/M', 'F/F', 'Multi', 'Other'] as const;
export type Ao3Rating = typeof AO3_RATINGS[number];
export type Ao3Category = typeof AO3_CATEGORIES[number];
export interface Ao3Chapter { title: string; body: string }
export interface Ao3Comment { id: string; author: string; body: string; createdAt: string }
export interface Ao3Generation {
  authorType: 'passerby' | 'character'; topic: 'fandom' | 'couple';
  authorCharId?: string; authorCharName?: string; pairCharId?: string; pairCharName?: string; playerName?: string;
}
export interface Ao3Work {
  id: string; title: string; author: string; fandom: string; relationship: string;
  characters: string[]; tags: string[]; rating: Ao3Rating; category: Ao3Category;
  warning: string; summary: string; notes: string; chapters: Ao3Chapter[];
  complete: boolean; language: string; createdAt: string; updatedAt: string;
  kudos: number; hits: number; comments: Ao3Comment[]; owned: boolean; generation?: Ao3Generation;
}
export interface Ao3History { workId: string; chapter: number; readAt: string }
export interface Ao3State {
  version: 1; works: Ao3Work[]; kudosed: string[]; bookmarks: string[]; later: string[]; history: Ao3History[];
}
export interface Ao3Draft {
  workId?: string; title: string; author: string; fandom: string; relationship: string;
  characters: string; tags: string; rating: Ao3Rating; category: Ao3Category;
  warning: string; summary: string; notes: string; chapters: Ao3Chapter[]; complete: boolean;
}
export interface Ao3Filters {
  query: string; fandom: string; rating: string; category: string; complete: 'all' | 'complete' | 'ongoing';
  exclude: string; sort: 'updated' | 'kudos' | 'words';
}
export const emptyAo3Filters = (): Ao3Filters => ({ query: '', fandom: '', rating: '', category: '', complete: 'all', exclude: '', sort: 'updated' });
export const splitAo3Tags = (value: string) => [...new Set(value.split(/[,，;；\n]/).map(tag => tag.trim()).filter(Boolean))].slice(0, 30);
export const ao3WordCount = (chapters: Ao3Chapter[]) => (chapters.map(c => c.body).join(' ').match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}]+/gu) ?? []).length;
const row = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
const strings = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every(v => str(v, 200));
const date = (value: unknown) => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const chapters = (value: unknown): value is Ao3Chapter[] => Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(c => row(c) && str(c.title, 200) && str(c.body, 200_000));
const isGeneration = (v: unknown): v is Ao3Generation => row(v) && (v.authorType === 'passerby' || v.authorType === 'character') &&
  (v.topic === 'fandom' || v.topic === 'couple') &&
  ['authorCharId', 'authorCharName', 'pairCharId', 'pairCharName', 'playerName'].every(k => v[k] === undefined || str(v[k], 200)) &&
  (v.authorType !== 'character' || !!v.authorCharId && !!v.authorCharName) &&
  (v.topic !== 'couple' || !!v.pairCharId && !!v.pairCharName && !!v.playerName);
export const isAo3Work = (value: unknown): value is Ao3Work => row(value) &&
  typeof value.id === 'string' && !!value.id && value.id.length <= 200 &&
  ['title', 'author', 'fandom', 'relationship', 'warning', 'language'].every(key => str(value[key], 200)) &&
  str(value.summary, 10_000) && str(value.notes, 10_000) && strings(value.characters) && strings(value.tags) &&
  AO3_RATINGS.some(r => r === value.rating) && AO3_CATEGORIES.some(c => c === value.category) &&
  chapters(value.chapters) && typeof value.complete === 'boolean' && typeof value.owned === 'boolean' &&
  date(value.createdAt) && date(value.updatedAt) && count(value.kudos) && count(value.hits) &&
  (value.generation === undefined || isGeneration(value.generation)) &&
  Array.isArray(value.comments) && value.comments.every(c => row(c) && str(c.id, 200) && str(c.author, 200) && str(c.body, 5000) && date(c.createdAt));
export function isAo3State(value: unknown): value is Ao3State {
  if (!row(value) || value.version !== 1 || !Array.isArray(value.works) || !value.works.every(isAo3Work)) return false;
  const works = value.works;
  const ids = new Set(works.map(w => w.id));
  return ids.size === works.length && ['kudosed', 'bookmarks', 'later'].every(k =>
    Array.isArray(value[k]) && value[k].every(id => typeof id === 'string' && ids.has(id)) && new Set(value[k]).size === value[k].length) &&
    Array.isArray(value.history) && value.history.every(h => row(h) && typeof h.workId === 'string' && ids.has(h.workId) &&
      typeof h.chapter === 'number' && Number.isInteger(h.chapter) && h.chapter >= 0 && h.chapter < works.find(w => w.id === h.workId)!.chapters.length && date(h.readAt));
}
export const isAo3Draft = (value: unknown): value is Ao3Draft => row(value) &&
  (value.workId === undefined || str(value.workId, 200)) &&
  ['title', 'author', 'fandom', 'relationship', 'warning'].every(k => str(value[k], 200)) &&
  str(value.characters, 6000) && str(value.tags, 6000) && str(value.summary, 10_000) && str(value.notes, 10_000) &&
  AO3_RATINGS.some(r => r === value.rating) && AO3_CATEGORIES.some(c => c === value.category) && chapters(value.chapters) && typeof value.complete === 'boolean';

// Original sample stories, kept entirely inside this phone's archive.
export function initialAo3State(): Ao3State {
  const base = { rating: 'General Audiences' as const, category: 'Gen' as const, warning: 'No Archive Warnings Apply',
    notes: '', complete: true, language: '中文', kudos: 0, hits: 0, comments: [], owned: false };
  return { version: 1, kudosed: [], bookmarks: [], later: [], history: [], works: [
    { ...base, id: 'ao3-sample-rain', title: '雨停之前', author: 'late_train', fandom: 'Original Work',
      relationship: '旅人 & 守站人', characters: ['旅人', '守站人'], tags: ['雨夜', '陌生人的善意', 'Slice of Life', '一发完'],
      summary: '末班车取消的那个晚上，他在一座即将停用的车站，等到了一杯不在售卖清单上的热茶。',
      createdAt: '2026-10-30T12:00:00.000Z', updatedAt: '2026-11-04T12:00:00.000Z',
      chapters: [{ title: '雨停之前', body: '站台上的时钟比手机慢了四分钟。\n\n他盯着它看了一会儿，直到广播第三次说末班车取消。雨水顺着行李箱的拉杆往下流，在脚边积成一个很小的湖。他挪了挪鞋，像这样就能把今晚挪过去。\n\n“等人？”\n\n值班室的窗开了一条缝。守站的人把一只搪瓷杯搁在窗台上，杯口冒着白气。\n\n“等雨。”他回答。\n\n“那得坐着等。雨不喜欢被催。”\n\n他想了想，拖着箱子坐到窗下的长椅上。椅子最里侧放着一块折好的旧报纸，恰好垫住漏下来的水。茶里浮着两片姜，辣得他打了个喷嚏。窗里传来很轻的一声笑。\n\n他们没有互通姓名。那个人擦着一本封皮磨损的登记簿，他捧着杯子，偶尔听见翻页的声音，才发现自己已经很久没待在一个不需要解释去处的地方了。\n\n“你们这里以后怎么办？”\n\n“下个月停。东西搬走，灯也拆。”\n\n他抬头看时钟。守站的人也看了一眼，说电池还新，拆下来带回家，挂厨房里。\n\n“它慢四分钟。”\n\n“知道。做饭总来得及关火。”\n\n凌晨两点，雨真的小了。守站的人替他叫了一辆车，转身去洗那个杯子。他站在门口，觉得该说些什么，但对方只是摆摆手，让他留意台阶。\n\n车开出很远，他在后视镜里看见那盏灯还亮着。\n\n他没有拍照。后来想起那个晚上，先记起来的总是姜的味道。' }] },
    { ...base, id: 'ao3-sample-moon', title: '月亮没有回信', author: 'paper_satellite', fandom: '星海来信 | Letters from the Stars',
      relationship: '领航员 / 通讯员', category: 'Other', rating: 'Teen And Up Audiences', characters: ['领航员', '通讯员'],
      tags: ['Space AU', 'Slow Burn', '重逢', '书信体'], complete: false,
      summary: '每一封发往深空的私人邮件，都会在延迟十七分钟后显示“已送达”。这一次，他等了七年。',
      createdAt: '2026-10-21T10:00:00.000Z', updatedAt: '2026-11-03T10:00:00.000Z',
      chapters: [
        { title: '已送达', body: '邮件的标题只有一个句号。\n\n值夜班的通讯员点开它，以为又是探测器传回的空包。屏幕上却浮出一句话：你还在用这个地址吗？\n\n他把椅子往前挪了一点。发件人那一栏是旧编号，早在七年前就从航线图上消失的那一串。他记得每一个数字，像记得一个已经不再拨打的电话号码。\n\n窗外的地球缓缓转过黑暗的一面。\n\n他起身给自己接水，杯子已经满了，才想起来没有按停止。水漫过指节，有一点凉。他关掉阀门，站在那里，慢慢把打好的那句“你在哪里”删掉。\n\n最后发出去的是：在。\n\n然后，他在值班表空白的角落，写下了今晚的日期。' },
        { title: '十七分钟', body: '回复抵达之前，他给盆栽浇了水。\n\n那是一株长得很慢的薄荷，养在报废的信号接收器里。每次换班，同事都说它快死了。但第二天来看，叶片又会抬起来一点。\n\n他曾经觉得等待是一件很大的事，会让人改变航向，或者至少停下脚步。后来发现它也可以很小，小到只是每个月续交一次邮箱的保留费用。\n\n屏幕闪了一下。\n\n“那就好。你那边的天，今天是什么颜色？”\n\n通讯员看向窗外。没有天空，只有大气层边缘的一圈蓝。他把这一圈蓝拍了下来，想了想，又拍了那株薄荷。\n\n这回他没有删字。\n\n“你上次说想看的那个，还活着。”' },
      ] },
    { ...base, id: 'ao3-sample-breakfast', title: '关于煎蛋的非正式协议', author: 'sunday_morning', fandom: 'Original Work',
      relationship: '室友 & 室友', characters: ['室友'], tags: ['Domestic Fluff', '日常', '早餐', 'Happy Ending'],
      summary: '合租协议第十一条：不许擅自吃掉对方的早餐。附注：如果本人起不来，可以酌情处理。',
      createdAt: '2026-10-28T08:00:00.000Z', updatedAt: '2026-11-01T08:00:00.000Z',
      chapters: [{ title: '第十一条', body: '便签贴在冰箱上，歪得很有个性。\n\n“是谁把我的鸡蛋煎了。”\n\n下面用另一支笔添了一行：“鸡蛋本人同意了。”\n\n他站在冰箱前读了两遍，决定暂时不追究鸡蛋的法律主体资格。厨房里传来油落进热锅的声音，那个人探出半张脸，问他今天要不要两面煎。\n\n“不是刚说不许动我的早餐？”\n\n“所以这是我的。多做了一个。”\n\n餐盘被推到他面前，蛋黄完整，边缘很脆。他拿了筷子，看到自己的那半边桌面放着一杯温水，旁边是昨晚随口提过的胃药。\n\n他低头吃了一口，没再说鸡蛋的事。\n\n下午，冰箱上多了一张新便签。\n\n“第十一条修正：早起的人负责早餐。晚起的人洗碗。”\n\n最下面有一个小小的勾，签名潦草，却画了很久。' }] },
  ] };
}
export const readAo3State = () => readStoredValue(AO3_KEY, initialAo3State(), isAo3State);
export const writeAo3State = (state: Ao3State) => writeStoredValue(AO3_KEY, state);
export const readAo3Draft = () => readStoredValue<Ao3Draft | null>(AO3_DRAFT_KEY, null, (v): v is Ao3Draft | null => v === null || isAo3Draft(v));
export const writeAo3Draft = (draft: Ao3Draft | null) => writeStoredValue(AO3_DRAFT_KEY, draft);
export const newAo3Draft = (author: string): Ao3Draft => ({ title: '', author, fandom: 'Original Work', relationship: '',
  characters: '', tags: '', rating: 'General Audiences', category: 'Gen', warning: 'No Archive Warnings Apply',
  summary: '', notes: '', chapters: [{ title: '', body: '' }], complete: true });
export const ao3DraftFromWork = (work: Ao3Work): Ao3Draft => ({ ...work, workId: work.id,
  characters: work.characters.join(', '), tags: work.tags.join(', '), chapters: work.chapters.map(c => ({ ...c })) });

export function filterAo3Works(works: Ao3Work[], filters: Ao3Filters): Ao3Work[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const excluded = splitAo3Tags(filters.exclude).map(s => s.toLocaleLowerCase());
  return works.filter(work => {
    const haystack = [work.title, work.author, work.fandom, work.relationship, ...work.characters, ...work.tags, work.summary].join('\n').toLocaleLowerCase();
    return (!query || haystack.includes(query)) && (!filters.fandom || work.fandom === filters.fandom) &&
      (!filters.rating || work.rating === filters.rating) && (!filters.category || work.category === filters.category) &&
      (filters.complete === 'all' || work.complete === (filters.complete === 'complete')) && !excluded.some(s => haystack.includes(s));
  }).sort((a, b) => filters.sort === 'kudos' ? b.kudos - a.kudos || b.updatedAt.localeCompare(a.updatedAt) :
    filters.sort === 'words' ? ao3WordCount(b.chapters) - ao3WordCount(a.chapters) : b.updatedAt.localeCompare(a.updatedAt));
}
export type Ao3Action = { type: 'kudos' | 'bookmark' | 'later'; id: string } |
  { type: 'read'; id: string; chapter: number; now: string; countHit?: boolean } |
  { type: 'comment'; id: string; comment: Ao3Comment } | { type: 'publish'; work: Ao3Work } | { type: 'discover'; work: Ao3Work } | { type: 'delete'; id: string };
/** Pure archive operations: one kudos per reader, chapter-aware history, no chat/memory side effects. */
export function updateAo3(state: Ao3State, action: Ao3Action): Ao3State {
  if (action.type === 'discover') {
    if (!isAo3Work(action.work) || action.work.owned || !action.work.generation) throw new Error('没有收到完整作品，请重新生成。');
    if (state.works.some(w => w.id === action.work.id)) return state;
    return { ...state, works: [action.work, ...state.works] };
  }
  if (action.type === 'publish') {
    if (!isAo3Work(action.work) || !action.work.owned) throw new Error('作品内容不完整，请检查后再发布。');
    const existing = state.works.find(w => w.id === action.work.id);
    if (existing && !existing.owned) throw new Error('只能编辑自己的作品。');
    return { ...state, works: existing ? state.works.map(w => w.id === action.work.id ? { ...action.work, kudos: w.kudos, hits: w.hits, comments: w.comments, createdAt: w.createdAt } : w) : [action.work, ...state.works],
      history: state.history.map(h => h.workId === action.work.id ? { ...h, chapter: Math.min(h.chapter, action.work.chapters.length - 1) } : h) };
  }
  const work = state.works.find(w => w.id === action.id);
  if (!work) return state;
  if (action.type === 'delete') {
    if (!work.owned && !work.generation) return state;
    return { ...state, works: state.works.filter(w => w.id !== action.id), kudosed: state.kudosed.filter(id => id !== action.id),
      bookmarks: state.bookmarks.filter(id => id !== action.id), later: state.later.filter(id => id !== action.id), history: state.history.filter(h => h.workId !== action.id) };
  }
  if (action.type === 'kudos') return state.kudosed.includes(action.id) ? state : { ...state, kudosed: [...state.kudosed, action.id], works: state.works.map(w => w.id === action.id ? { ...w, kudos: w.kudos + 1 } : w) };
  if (action.type === 'bookmark' || action.type === 'later') {
    const key = action.type === 'bookmark' ? 'bookmarks' : 'later';
    return { ...state, [key]: state[key].includes(action.id) ? state[key].filter(id => id !== action.id) : [...state[key], action.id] };
  }
  if (action.type === 'comment') {
    const c = action.comment;
    if (!c.body.trim() || c.body.length > 5000 || !c.author.trim() || !date(c.createdAt) || work.comments.some(old => old.id === c.id)) return state;
    return { ...state, works: state.works.map(w => w.id === action.id ? { ...w, comments: [...w.comments, c] } : w) };
  }
  if (action.type !== 'read' || !Number.isInteger(action.chapter) || action.chapter < 0 || action.chapter >= work.chapters.length || !date(action.now)) return state;
  return { ...state, works: action.countHit ? state.works.map(w => w.id === action.id ? { ...w, hits: w.hits + 1 } : w) : state.works,
    history: [{ workId: action.id, chapter: action.chapter, readAt: action.now }, ...state.history.filter(h => h.workId !== action.id)].slice(0, 200) };
}
export function publishAo3Draft(draft: Ao3Draft, existing?: Ao3Work): Ao3Work {
  if (!isAo3Draft(draft) || !draft.title.trim() || !draft.author.trim() || !draft.fandom.trim() || draft.chapters.some(c => !c.body.trim())) {
    throw new Error('请填写标题、作者、所属作品，以及每一章的正文。');
  }
  if (draft.workId && (!existing || existing.id !== draft.workId || !existing.owned)) throw new Error('原作品已不存在，请将内容另存为新作品。');
  const now = new Date().toISOString();
  return { id: existing?.id ?? `ao3-${crypto.randomUUID()}`, title: draft.title.trim(), author: draft.author.trim(), fandom: draft.fandom.trim(),
    relationship: draft.relationship.trim(), characters: splitAo3Tags(draft.characters), tags: splitAo3Tags(draft.tags),
    rating: draft.rating, category: draft.category, warning: draft.warning.trim() || 'Creator Chose Not To Use Archive Warnings',
    summary: draft.summary.trim(), notes: draft.notes.trim(), chapters: draft.chapters.map((c, i) => ({ title: c.title.trim() || `Chapter ${i + 1}`, body: c.body.trim() })),
    complete: draft.complete, language: existing?.language ?? '中文', createdAt: existing?.createdAt ?? now, updatedAt: now,
    kudos: existing?.kudos ?? 0, hits: existing?.hits ?? 0, comments: existing?.comments ?? [], owned: true };
}
