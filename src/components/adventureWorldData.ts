import { WORLD_LORE, type WorldLore } from './textAdventureLore';
import { worlds, type Choice, type World } from './textAdventureWorlds';

export type AdventureWorld = { world: World; lore: WorldLore; worldBookIds: string[] };
export type CustomWorlds = Record<string, AdventureWorld>;
export const CUSTOM_WORLDS_KEY = 'yyppphh_adventure_worlds_v1';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown, label: string, max: number) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`请填写${label}。`);
  return value.trim().slice(0, max);
};
const lines = (value: unknown, label: string) => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20 || !value.every(item => typeof item === 'string' && item.trim())) {
    throw new Error(`${label}需要至少一条文字。`);
  }
  return value.map(item => String(item).trim().slice(0, 350));
};

export const WORLD_PALETTES = [
  { accent: '#eecba1', card: 'from-[#493644] via-[#75607a] to-[#b88870]', label: '烬金' },
  { accent: '#c6e5db', card: 'from-[#163c45] via-[#537a7b] to-[#b7d4be]', label: '山青' },
  { accent: '#dfb4ad', card: 'from-[#302c35] via-[#6a4649] to-[#9a6b60]', label: '夜红' },
  { accent: '#e1c799', card: 'from-[#293b43] via-[#5e6b62] to-[#b99c75]', label: '荒沙' },
];

export function validateAdventureWorld(value: unknown, id?: string): AdventureWorld {
  if (!record(value)) throw new Error('世界文件格式不正确。');
  const source = record(value.world) ? value.world : value;
  const loreSource = record(value.lore) ? value.lore : null;
  if (!loreSource) throw new Error('世界文件缺少详细世界设定。');
  const scenes = source.scenes;
  if (!Array.isArray(scenes) || !record(scenes[0])) throw new Error('请填写固定开场。');
  const opening = scenes[0];
  const rawChoices = opening.choices;
  if (!Array.isArray(rawChoices) || rawChoices.length !== 3) throw new Error('固定开场必须有三个选项。');
  const choices: Choice[] = rawChoices.map((choice, index) => {
    if (!record(choice)) throw new Error(`选项${index + 1}格式不正确。`);
    return { title: string(choice.title, `选项${index + 1}标题`, 50), detail: string(choice.detail, `选项${index + 1}说明`, 100) };
  });
  const palette = WORLD_PALETTES.find(item => item.card === source.card) ?? WORLD_PALETTES[0];
  const world: World = {
    id: id ?? string(source.id, '世界 ID', 100),
    title: string(source.title, '世界名称', 50), subtitle: string(source.subtitle, '世界简介', 200),
    tag: string(source.tag, '世界类型', 30), accent: palette.accent, card: palette.card,
    ending: typeof source.ending === 'string' ? source.ending.slice(0, 500) : '',
    scenes: [{ chapter: string(opening.chapter, '开场章节', 50), place: string(opening.place, '开场地点', 60),
      title: string(opening.title, '开场标题', 80), text: string(opening.text, '开场正文', 1500), choices }],
  };
  const lore: WorldLore = {
    premise: string(loreSource.premise, '核心设定', 2500),
    rules: lines(loreSource.rules, '世界规则'), factions: lines(loreSource.factions, '阵营'),
    npcs: lines(loreSource.npcs, 'NPC'), conflicts: lines(loreSource.conflicts, '冲突'),
    secrets: lines(loreSource.secrets, '隐秘真相'), tone: string(loreSource.tone, '叙事氛围', 500),
  };
  const worldBookIds = Array.isArray(value.worldBookIds)
    ? [...new Set(value.worldBookIds.filter((item): item is string => typeof item === 'string' && !!item.trim()))].slice(0, 20)
    : [];
  return { world, lore, worldBookIds };
}

export function isCustomWorlds(value: unknown): value is CustomWorlds {
  if (!record(value)) return false;
  try {
    Object.entries(value).forEach(([id, entry]) => validateAdventureWorld(entry, id));
    return true;
  } catch { return false; }
}

export function builtinWorlds(): AdventureWorld[] {
  return worlds.map(world => ({ world, lore: WORLD_LORE[world.id as keyof typeof WORLD_LORE], worldBookIds: [] }));
}

export function blankWorld(): AdventureWorld {
  return { world: {
    id: `custom-${crypto.randomUUID()}`, title: '', subtitle: '', tag: '',
    accent: WORLD_PALETTES[0].accent, card: WORLD_PALETTES[0].card, ending: '',
    scenes: [{ chapter: '序章', place: '', title: '', text: '', choices: Array.from({ length: 3 }, () => ({ title: '', detail: '' })) }],
  }, lore: { premise: '', rules: [], factions: [], npcs: [], conflicts: [], secrets: [], tone: '' }, worldBookIds: [] };
}
