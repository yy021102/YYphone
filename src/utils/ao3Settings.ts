import { readStoredValue, writeStoredValue } from './localStorage';
import { setStorageItemsAtomically } from './dbStorage';
import { getWorldBookEntriesForContacts, readWorldBookOptions } from './worldBookPrompt';
import { AO3_KEY, AO3_DRAFT_KEY, isAo3State, isAo3Draft, readAo3State, readAo3Draft, type Ao3State } from './ao3Data';
export const AO3_SETTINGS_KEY = 'yyphone:ao3-settings';
interface Ao3Settings { prompt: string; topPrompt?: string; worldBookIds?: string[]; penNames?: Record<string, string> }
const valid = (v: unknown): v is Ao3Settings => !!v && typeof v === 'object' && 'prompt' in v && typeof v.prompt === 'string' && v.prompt.length <= 20000 &&
  (!('topPrompt' in v) || typeof v.topPrompt === 'string' && v.topPrompt.length <= 20000) &&
  (!('worldBookIds' in v) || Array.isArray(v.worldBookIds) && v.worldBookIds.every(id => typeof id === 'string' && !!id && id.length <= 200)) &&
  (!('penNames' in v) || !!v.penNames && typeof v.penNames === 'object' && !Array.isArray(v.penNames) &&
    Object.entries(v.penNames).every(([id, name]) => !!id && id.length <= 200 && typeof name === 'string' && !!name.trim() && name.length <= 200));
export const readAo3Settings = (): Ao3Settings => readStoredValue(AO3_SETTINGS_KEY, { prompt: '' }, valid);
export const readAo3WorldBookIds = () => readAo3Settings().worldBookIds ?? readWorldBookOptions().filter(book => book.isGlobal).map(book => book.id);
export const ao3WorldBooks = (contactIds: string[]) => getWorldBookEntriesForContacts(contactIds, readAo3WorldBookIds(), undefined, { includeLinkedBooks: true });
export const ao3TopPrompt = () => readAo3Settings().topPrompt?.trim() || '';
export function saveAo3GenerationSettings(settings: Pick<Ao3Settings, 'prompt' | 'topPrompt' | 'worldBookIds'>) {
  const next = { ...readAo3Settings(), ...settings };
  if (!valid(next)) throw new Error('提示词最多 20000 字，请检查设置。');
  writeStoredValue(AO3_SETTINGS_KEY, next);
}
export function readAo3PenName(charId: string): string | undefined {
  const contacts = readStoredValue<unknown[]>('pocketos:wechat-contacts', [], (value): value is unknown[] => Array.isArray(value));
  const contact = contacts.find(value => !!value && typeof value === 'object' && 'id' in value && value.id === charId);
  const forumName = contact && typeof contact === 'object' && 'forumHandle' in contact && typeof contact.forumHandle === 'string' ?
    contact.forumHandle.trim().replace(/^@/, '').trim() : '';
  if (forumName.length > 200) throw new Error('角色论坛名超过 200 字，请先修改角色设定。');
  const names = readAo3Settings().penNames;
  return forumName || (names && Object.hasOwn(names, charId) ? names[charId] : undefined);
}
export function lockAo3PenName(charId: string, name: string) {
  if (!charId || charId.length > 200 || !name.trim() || name.trim().length > 200) throw new Error('角色笔名无效，未能保存。');
  const settings = readAo3Settings();
  writeStoredValue(AO3_SETTINGS_KEY, { ...settings, penNames: { ...settings.penNames, [charId]: readAo3PenName(charId) || name.trim() } });
}
export function saveAo3Prompt(prompt: string) {
  if (!valid({ prompt })) throw new Error('提示词最多 20000 字。');
  writeStoredValue(AO3_SETTINGS_KEY, { ...readAo3Settings(), prompt });
}
export const ao3Preferences = () => `【玩家的 AO3 创作偏好】\n${readAo3Settings().prompt || '未填写，按人物与本次创作要求发挥。'}\n偏好用于文风、情绪和评论氛围，不改变输出格式、评论身份权限或玩家已有设定；本次具体要求优先。`;
export const AO3_NARRATIVE_RULES = [
  '叙述视角：路人作者的正文使用第三人称。角色作者写自己与玩家的梦向文时，必须使用角色第一人称“我”，玩家是我凝视、牵挂的梦角，可以称“你”或使用玩家名字，不切换成旁观者讲述。角色写其他作品同人时按作品需要选择视角。',
  '梦向正文的重心是“我”怎样看见你、在你的细小动作中产生什么感受，以及我如何面对自己的欲望、顾虑与偏爱。视角单向凝视，但感情可以唯一、双向奔赴；酸涩题材保留不确定与距离，不强行圆满。不能把单向凝视写成强迫、占有或替玩家安排人格。',
  '细腻来自角色独有的感受与表达。让感官细节、生活质地、心理转折和具体行动承载情感，文句长短有呼吸，温柔文艺但不堆辞藻或套用情话。犬儒者可有自嘲与克制，外放者可直率热烈；不要把所有角色写成同一种温柔文青。玩家的回应要符合其设定，不凭空添加经历或性格。',
  '使用原创表达，不仿写或拼贴特定作家的标志性句式。追求鲜活、细腻、有生活观察和余味的文字。续章也遵守上述视角和人物内核。',
].join('\n');
export const exportAo3Data = () => ({ format: 'yyphone-ao3', version: 1, state: readAo3State(), draft: readAo3Draft(), settings: readAo3Settings() });
export async function importAo3Data(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('不是有效的 AO3 备份。');
  const v = value as ReturnType<typeof exportAo3Data>;
  if (v.format !== 'yyphone-ao3' || v.version !== 1 || !isAo3State(v.state) || !(v.draft === null || isAo3Draft(v.draft)) || !valid(v.settings)) throw new Error('备份内容不完整或格式不支持，原数据已保留。');
  await setStorageItemsAtomically({ [AO3_KEY]: v.state, [AO3_DRAFT_KEY]: v.draft, [AO3_SETTINGS_KEY]: v.settings });
}
export async function clearAo3Data() {
  const state: Ao3State = { version: 1, works: [], bookmarks: [], kudosed: [], later: [], history: [] };
  await setStorageItemsAtomically({ [AO3_KEY]: state, [AO3_DRAFT_KEY]: null, [AO3_SETTINGS_KEY]: { prompt: '' } });
}
