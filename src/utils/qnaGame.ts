import { readStoredValue, writeStoredValue } from './localStorage';

export type QnaQuestionType = 'choice' | 'text';
export interface QnaQuestion { id: string; type: QnaQuestionType; text: string; options: string[] }
export interface QnaBank {
  id: string;
  title: string;
  description: string;
  category: string;
  emoji: string;
  questions: QnaQuestion[];
  builtIn?: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface QnaPerson { id: string; name: string; avatarUrl?: string }
export type QnaCharacterStatus = 'pending' | 'done' | 'error';
export interface QnaCharacterResult { status: QnaCharacterStatus; answers: Record<string, string>; error?: string }
export interface QnaRecord {
  id: string;
  bankId: string;
  bankTitle: string;
  bankCategory: string;
  emoji: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  questions: QnaQuestion[];
  userName: string;
  userAnswers: Record<string, string>;
  people: QnaPerson[];
  results: Record<string, QnaCharacterResult>;
}

export const QNA_BANKS_KEY = 'yyphone:qna-banks';
export const QNA_RECORDS_KEY = 'yyphone:qna-records';
export const QNA_EXPORT_FORMAT = 'yyphone-qna-bank';
export const QNA_MAX_OPTIONS = 6;
export const QNA_MAX_QUESTIONS = 40;
export const QNA_CATEGORIES = ['相性问答', '默契问答', '恋爱', '日常', '深聊', '趣味'];

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const qnaId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export const normalizeQuestion = (value: unknown, fallbackId: string): QnaQuestion | null => {
  if (typeof value === 'string') {
    const text = clean(value, 200);
    return text ? { id: fallbackId, type: 'text', text, options: [] } : null;
  }
  if (!isRecord(value)) return null;
  const text = clean(value.text ?? value.question ?? value.title, 200);
  if (!text) return null;
  const options = Array.isArray(value.options)
    ? [...new Set(value.options.map(option => clean(option, 60)).filter(Boolean))].slice(0, QNA_MAX_OPTIONS)
    : [];
  const type: QnaQuestionType = options.length >= 2 && value.type !== 'text' ? 'choice' : 'text';
  return { id: clean(value.id, 60) || fallbackId, type, text, options: type === 'choice' ? options : [] };
};

export const normalizeBank = (value: unknown): QnaBank | null => {
  if (!isRecord(value) || !Array.isArray(value.questions)) return null;
  const seen = new Set<string>();
  const questions: QnaQuestion[] = [];
  value.questions.slice(0, QNA_MAX_QUESTIONS).forEach((raw, index) => {
    const question = normalizeQuestion(raw, qnaId(`q${index + 1}`));
    if (!question) return;
    if (seen.has(question.id)) question.id = qnaId(`q${index + 1}`);
    seen.add(question.id);
    questions.push(question);
  });
  if (!questions.length) return null;
  const now = new Date().toISOString();
  return {
    id: qnaId('bank'),
    title: clean(value.title, 30) || '未命名题库',
    description: clean(value.description, 120),
    category: clean(value.category, 12) || '趣味',
    emoji: clean(value.emoji, 4) || '💌',
    questions,
    createdAt: now,
    updatedAt: now,
  };
};

export const parseBankImport = (text: string): QnaBank[] => {
  let parsed: unknown;
  try { parsed = JSON.parse(text.trim().replace(/^\uFEFF/, '')); } catch { throw new Error('文件不是有效的 JSON。'); }
  const candidates = Array.isArray(parsed) && parsed.every(item => isRecord(item) && Array.isArray(item.questions)) ? parsed
    : isRecord(parsed) && Array.isArray(parsed.banks) ? parsed.banks
      : Array.isArray(parsed) ? [{ title: '导入的题库', questions: parsed }]
        : [parsed];
  const banks = candidates.map(normalizeBank).filter((bank): bank is QnaBank => !!bank);
  if (!banks.length) throw new Error('没有找到可用的题目。题库需要包含 questions 数组。');
  return banks;
};

export const exportBanks = (banks: QnaBank[]): string => JSON.stringify({
  format: QNA_EXPORT_FORMAT,
  version: 1,
  banks: banks.map(({ title, description, category, emoji, questions }) => ({
    title, description, category, emoji,
    questions: questions.map(({ type, text, options }) => ({ type, text, ...(type === 'choice' ? { options } : {}) })),
  })),
}, null, 2);

const q = (id: string, text: string, ...options: string[]): QnaQuestion => ({ id, type: options.length ? 'choice' : 'text', text, options });
const builtIn = (id: string, title: string, emoji: string, category: string, description: string, questions: QnaQuestion[]): QnaBank =>
  ({ id: `builtin:${id}`, title, emoji, category, description, questions, builtIn: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' });

export const BUILTIN_QNA_BANKS: QnaBank[] = [
  builtIn('affinity', '相性初测', '💞', '相性问答', '十道生活选择题，看看你们的节奏合不合拍。', [
    q('q1', '理想的周末是？', '窝在家里放空', '出门探店逛街', '说走就走去远方', '各忙各的，晚上见面'),
    q('q2', '吵架之后更倾向于？', '马上说开', '先冷静再聊', '写下来或发消息', '做点好吃的当作没发生'),
    q('q3', '更喜欢哪种相处节奏？', '形影不离', '各有空间，定时见面', '随缘，想见就见'),
    q('q4', '你更像？', '早起鸟', '夜猫子', '看心情'),
    q('q5', '旅行风格是？', '提前做满攻略', '订好机票走到哪算哪', '找个地方躺平发呆'),
    q('q6', '表达爱意的方式？', '直接说出口', '默默照顾陪伴', '送礼物', '拥抱和亲近'),
    q('q7', '更期待哪种惊喜？', '精心准备的小仪式', '刚好需要的实用礼物', '突然出现的陪伴', '一封手写的信'),
    q('q8', '压力大的时候希望对方？', '安静陪着我', '逗我开心', '认真听我倾诉', '给我一点独处时间'),
    q('q9', '最喜欢的天气？', '晴天', '雨天', '雪天', '微风的阴天'),
    q('q10', '想拥有哪种超能力？', '读心术', '瞬间移动', '时间暂停', '过目不忘'),
  ]),
  builtIn('tacit', '默契大考验', '🎯', '默契问答', '选择与填写混合，看看你们答案撞了几题。', [
    q('q1', '最爱的一种食物是？'),
    q('q2', '一天里最喜欢的时段？', '清晨', '午后', '黄昏', '深夜'),
    q('q3', '最想一起去的城市是？'),
    q('q4', '更爱哪个季节？', '春', '夏', '秋', '冬'),
    q('q5', '遇到困难的第一反应？', '立刻行动', '先找人商量', '先自己想清楚', '先逃避一下'),
    q('q6', '最喜欢的颜色是？'),
    q('q7', '只能选一种口味，你选？', '甜', '咸', '辣', '酸'),
    q('q8', '睡前最常做的事？', '刷手机', '看书', '听音乐', '倒头就睡'),
    q('q9', '用一个词形容今天的心情。'),
    q('q10', '最近一直在循环的一首歌或一个习惯是？'),
  ]),
  builtIn('love', '恋爱观速写', '🌸', '恋爱', '从心动到吵架，聊聊各自的恋爱观。', [
    q('q1', '心动往往来自？', '一个细微的小动作', '聊天时的默契', '对方认真的样子', '突如其来的温柔'),
    q('q2', '你怎么看纪念日？', '很重要，要认真过', '简单有心意就好', '每一天都是纪念日', '记不住，但会补偿'),
    q('q3', '理想的联系频率？', '随时分享日常', '早晚各聊一次', '有事再聊', '看心情'),
    q('q4', '吃醋的时候会？', '直接说出来', '闷在心里', '开玩笑试探', '假装没事'),
    q('q5', '约会首选？', '看电影', '散步聊天', '美食探店', '宅家点外卖'),
    q('q6', '更想要的告白方式？', '当面认真说', '写信或发消息', '用行动暗示', '等对方先开口'),
    q('q7', '最不能接受？', '欺骗隐瞒', '冷暴力', '不守约', '控制欲'),
    q('q8', '最浪漫的小事是？', '一起看日落', '深夜的一通电话', '默默帮我留好吃的', '一句“我在”'),
    q('q9', '向往的生活？', '小城安稳', '大城拼搏', '到处旅居', '田园慢生活'),
    q('q10', '吵架时最怕？', '沉默', '翻旧账', '恶语相向', '被敷衍'),
  ]),
  builtIn('midnight', '深夜灵魂拷问', '🌙', '深聊', '没有选项，只有真心话。适合夜深人静时慢慢写。', [
    q('q1', '最近让你感到最开心的一件小事是什么？'),
    q('q2', '有没有一件一直想做却没做的事？'),
    q('q3', '你觉得自己最被低估的优点是什么？'),
    q('q4', '如果可以回到过去的某一天，你想回到哪一天？'),
    q('q5', '什么样的瞬间会让你觉得“被理解了”？'),
    q('q6', '说一件你很少对别人提起的小秘密（可以很小）。'),
    q('q7', '对未来的自己说一句话。'),
    q('q8', '你希望对方记住你的哪一面？'),
  ]),
];

const isBankList = (value: unknown): value is QnaBank[] => Array.isArray(value) && value.every(item => isRecord(item) && typeof item.id === 'string' && Array.isArray(item.questions));
const isRecordList = (value: unknown): value is QnaRecord[] => Array.isArray(value) && value.every(item => isRecord(item) && typeof item.id === 'string' && Array.isArray(item.questions) && isRecord(item.results) && isRecord(item.userAnswers));

const listeners = new Set<() => void>();
export const subscribeQna = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const notify = () => listeners.forEach(listener => listener());

export const loadCustomBanks = (): QnaBank[] => readStoredValue(QNA_BANKS_KEY, [] as QnaBank[], isBankList);
export const saveCustomBanks = (banks: QnaBank[]) => { writeStoredValue(QNA_BANKS_KEY, banks); notify(); };
export const loadRecords = (): QnaRecord[] => readStoredValue(QNA_RECORDS_KEY, [] as QnaRecord[], isRecordList);
export const saveRecords = (records: QnaRecord[]) => { writeStoredValue(QNA_RECORDS_KEY, records); notify(); };

export const updateRecord = (id: string, patch: (record: QnaRecord) => QnaRecord) => {
  const records = loadRecords();
  if (!records.some(record => record.id === id)) return;
  saveRecords(records.map(record => record.id === id ? { ...patch(record), updatedAt: new Date().toISOString() } : record));
};

// Generation lives only in memory, so a pending result with no live request was interrupted by a reload.
const inflight = new Set<string>();
export const inflightKey = (recordId: string, personId: string) => `${recordId}:${personId}`;
export const markInflight = (recordId: string, personId: string, active: boolean) => {
  if (active) inflight.add(inflightKey(recordId, personId)); else inflight.delete(inflightKey(recordId, personId));
};
export const reconcileInterrupted = () => {
  const records = loadRecords();
  let changed = false;
  const next = records.map(record => {
    const results = { ...record.results };
    let recordChanged = false;
    for (const [personId, result] of Object.entries(results)) {
      if (result.status === 'pending' && !inflight.has(inflightKey(record.id, personId))) {
        results[personId] = { ...result, status: 'error', error: '生成被中断，可以重试。' };
        recordChanged = true;
      }
    }
    if (recordChanged) changed = true;
    return recordChanged ? { ...record, results } : record;
  });
  if (changed) saveRecords(next);
};

export const questionKey = (text: string) => text.replace(/[\s，。！？、,.!?：:“”"'（）()]/g, '').toLowerCase();

export interface ReusableAnswers { record: QnaRecord; answers: Record<string, string>; matched: number }

// Matches earlier answers by question wording, so they can be reused even across banks.
export const findReusableAnswers = (records: QnaRecord[], questions: QnaQuestion[]): ReusableAnswers[] => {
  const found: ReusableAnswers[] = [];
  for (const record of [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const answers: Record<string, string> = {};
    for (const question of questions) {
      const previous = record.questions.find(item => questionKey(item.text) === questionKey(question.text));
      const answer = previous ? record.userAnswers[previous.id]?.trim() : '';
      if (!answer) continue;
      if (question.type === 'choice' && !question.options.includes(answer)) continue;
      answers[question.id] = answer;
    }
    const matched = Object.keys(answers).length;
    if (matched > 0) found.push({ record, answers, matched });
  }
  return found;
};

export const normalizeCharacterAnswers = (questions: QnaQuestion[], raw: unknown): Record<string, string> => {
  const list = Array.isArray(raw) ? raw : isRecord(raw) ? Object.entries(raw).map(([id, answer]) => ({ id, answer })) : [];
  const answers: Record<string, string> = {};
  for (const [index, question] of questions.entries()) {
    const item = list.find(entry => isRecord(entry) && (entry.id === question.id || (entry.id === index + 1))) ?? list[index];
    let answer = isRecord(item) ? clean(item.answer ?? item.text ?? item.value, 200) : clean(item, 200);
    if (question.type === 'choice' && answer) {
      const letter = /^[A-Fa-f]$/.test(answer) ? answer.toUpperCase().charCodeAt(0) - 65 : -1;
      answer = question.options.find(option => option === answer)
        ?? question.options.find(option => questionKey(option) === questionKey(answer))
        ?? question.options[letter]
        ?? question.options.find(option => questionKey(answer).includes(questionKey(option)) || questionKey(option).includes(questionKey(answer)))
        ?? '';
    }
    if (answer) answers[question.id] = answer;
  }
  if (!Object.keys(answers).length) throw new Error('角色没有返回有效的作答，请重试。');
  return answers;
};

export const matchStats = (record: QnaRecord, personId: string) => {
  const answers = record.results[personId]?.answers ?? {};
  let matched = 0;
  let total = 0;
  for (const question of record.questions) {
    if (question.type !== 'choice' || !record.userAnswers[question.id] || !answers[question.id]) continue;
    total += 1;
    if (record.userAnswers[question.id] === answers[question.id]) matched += 1;
  }
  return { matched, total, percent: total ? Math.round(matched / total * 100) : 0 };
};

export const matchLabel = (percent: number, total: number) => {
  if (!total) return '没有选择题可以对照';
  if (percent >= 90) return '灵魂共鸣';
  if (percent >= 70) return '默契十足';
  if (percent >= 50) return '渐入佳境';
  if (percent >= 30) return '各有风景';
  return '互补型选手';
};

export const buildShareText = (record: QnaRecord): string => {
  const lines = [`【${record.bankTitle}】${record.userName} × ${record.people.map(person => person.name).join('、')}`];
  for (const person of record.people) {
    const stats = matchStats(record, person.id);
    if (stats.total) lines.push(`${person.name}：${stats.matched}/${stats.total} 题选项一致（${stats.percent}%）`);
  }
  record.questions.forEach((question, index) => {
    lines.push('', `${index + 1}. ${question.text}`, `  ${record.userName}：${record.userAnswers[question.id] || '（未作答）'}`);
    for (const person of record.people) lines.push(`  ${person.name}：${record.results[person.id]?.answers[question.id] || '（未作答）'}`);
  });
  return lines.join('\n');
};
