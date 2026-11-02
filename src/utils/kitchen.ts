import { isObject, nonemptyText } from './divination';
import { readStoredValue, readStorageString } from './localStorage';
import { setStorageItemsAtomically } from './dbStorage';

export const KITCHEN_KEY = 'yyphone:kitchen';
export type KitchenCategory = 'dish' | 'dessert';
export type KitchenGroup = 'staple' | 'vegetable' | 'protein' | 'dairy' | 'baking' | 'fruit' | 'seasoning' | 'decoration';
export const KITCHEN_GROUPS: Record<KitchenGroup, string> = {
  staple: '米面与汤底', vegetable: '新鲜蔬菜', protein: '肉类与豆制品', dairy: '蛋与乳制品',
  baking: '烘焙基础', fruit: '鲜果与坚果', seasoning: '调味小罐', decoration: '甜蜜装饰',
};
export interface KitchenIngredient { id: string; name: string; group: KitchenGroup; color: string; shape: 'grain' | 'leaf' | 'chunk' | 'slice' | 'berry' | 'cream' | 'sprinkle' }
export const KITCHEN_INGREDIENTS: KitchenIngredient[] = [
  { id: 'rice', name: '米饭', group: 'staple', color: '#f4e9c9', shape: 'grain' },
  { id: 'noodles', name: '面条', group: 'staple', color: '#ecd09a', shape: 'grain' },
  { id: 'broth', name: '清汤底', group: 'staple', color: '#e5c27e', shape: 'cream' },
  { id: 'tomato', name: '番茄', group: 'vegetable', color: '#d98275', shape: 'slice' },
  { id: 'carrot', name: '胡萝卜', group: 'vegetable', color: '#e8a062', shape: 'chunk' },
  { id: 'broccoli', name: '西兰花', group: 'vegetable', color: '#8fa675', shape: 'leaf' },
  { id: 'potato', name: '土豆', group: 'vegetable', color: '#e5cd90', shape: 'chunk' },
  { id: 'mushroom', name: '蘑菇', group: 'vegetable', color: '#bca58b', shape: 'slice' },
  { id: 'corn', name: '玉米粒', group: 'vegetable', color: '#e6c46c', shape: 'grain' },
  { id: 'spinach', name: '菠菜', group: 'vegetable', color: '#86a584', shape: 'leaf' },
  { id: 'onion', name: '洋葱', group: 'vegetable', color: '#d8b8cb', shape: 'slice' },
  { id: 'scallion', name: '小葱', group: 'vegetable', color: '#9bad81', shape: 'grain' },
  { id: 'cabbage', name: '白菜', group: 'vegetable', color: '#b8c79b', shape: 'leaf' },
  { id: 'bok-choy', name: '小青菜', group: 'vegetable', color: '#8fae7e', shape: 'leaf' },
  { id: 'lettuce', name: '生菜', group: 'vegetable', color: '#afc28f', shape: 'leaf' },
  { id: 'bell-pepper', name: '彩椒', group: 'vegetable', color: '#dca46d', shape: 'slice' },
  { id: 'eggplant', name: '茄子', group: 'vegetable', color: '#a18aa8', shape: 'slice' },
  { id: 'cucumber', name: '黄瓜', group: 'vegetable', color: '#aac38c', shape: 'slice' },
  { id: 'zucchini', name: '西葫芦', group: 'vegetable', color: '#bccb94', shape: 'slice' },
  { id: 'pumpkin', name: '南瓜', group: 'vegetable', color: '#e5b279', shape: 'chunk' },
  { id: 'lotus-root', name: '莲藕', group: 'vegetable', color: '#e5d6bd', shape: 'slice' },
  { id: 'snow-pea', name: '荷兰豆', group: 'vegetable', color: '#a0b981', shape: 'leaf' },
  { id: 'green-bean', name: '四季豆', group: 'vegetable', color: '#91aa77', shape: 'slice' },
  { id: 'enoki', name: '金针菇', group: 'vegetable', color: '#e2d4b8', shape: 'grain' },
  { id: 'wood-ear', name: '木耳', group: 'vegetable', color: '#998378', shape: 'leaf' },
  { id: 'seaweed', name: '海带', group: 'vegetable', color: '#91a18a', shape: 'leaf' },
  { id: 'pork', name: '猪肉', group: 'protein', color: '#c99483', shape: 'slice' },
  { id: 'pork-belly', name: '五花肉', group: 'protein', color: '#c89583', shape: 'slice' },
  { id: 'ribs', name: '排骨', group: 'protein', color: '#bb947f', shape: 'chunk' },
  { id: 'chicken', name: '鸡肉', group: 'protein', color: '#dfb799', shape: 'chunk' },
  { id: 'beef', name: '牛肉', group: 'protein', color: '#ab7766', shape: 'chunk' },
  { id: 'lamb', name: '羊肉', group: 'protein', color: '#ba9280', shape: 'chunk' },
  { id: 'duck', name: '鸭肉', group: 'protein', color: '#bc977e', shape: 'chunk' },
  { id: 'bacon', name: '培根', group: 'protein', color: '#c18e81', shape: 'slice' },
  { id: 'sausage', name: '香肠', group: 'protein', color: '#c79583', shape: 'slice' },
  { id: 'ham', name: '火腿', group: 'protein', color: '#d0a095', shape: 'chunk' },
  { id: 'shrimp', name: '虾仁', group: 'protein', color: '#e4a397', shape: 'slice' },
  { id: 'fish', name: '鱼肉', group: 'protein', color: '#e3c9b9', shape: 'slice' },
  { id: 'squid', name: '鱿鱼', group: 'protein', color: '#dbc2b8', shape: 'slice' },
  { id: 'clam', name: '蛤蜊', group: 'protein', color: '#c5b29c', shape: 'slice' },
  { id: 'crab-stick', name: '蟹柳', group: 'protein', color: '#d7a094', shape: 'slice' },
  { id: 'tofu', name: '豆腐', group: 'protein', color: '#eee1be', shape: 'chunk' },
  { id: 'tofu-skin', name: '豆皮', group: 'protein', color: '#d9c69e', shape: 'slice' },
  { id: 'egg', name: '鸡蛋', group: 'dairy', color: '#e9c776', shape: 'slice' },
  { id: 'milk', name: '牛奶', group: 'dairy', color: '#f3e7d2', shape: 'cream' },
  { id: 'cream', name: '奶油', group: 'dairy', color: '#fff2dd', shape: 'cream' },
  { id: 'butter', name: '黄油', group: 'dairy', color: '#ead28e', shape: 'chunk' },
  { id: 'cheese', name: '芝士', group: 'dairy', color: '#dfc179', shape: 'slice' },
  { id: 'yogurt', name: '酸奶', group: 'dairy', color: '#f0e5d8', shape: 'cream' },
  { id: 'cream-cheese', name: '奶油奶酪', group: 'dairy', color: '#ece0c7', shape: 'cream' },
  { id: 'condensed-milk', name: '炼乳', group: 'dairy', color: '#edddbf', shape: 'cream' },
  { id: 'coconut-milk', name: '椰奶', group: 'dairy', color: '#eee5d5', shape: 'cream' },
  { id: 'flour', name: '面粉', group: 'baking', color: '#e9ddc9', shape: 'cream' },
  { id: 'cocoa', name: '可可粉', group: 'baking', color: '#96715f', shape: 'sprinkle' },
  { id: 'matcha', name: '抹茶粉', group: 'baking', color: '#9ba978', shape: 'sprinkle' },
  { id: 'mochi', name: '软糯麻薯', group: 'baking', color: '#e9d8d2', shape: 'chunk' },
  { id: 'red-bean', name: '蜜红豆', group: 'baking', color: '#b08080', shape: 'grain' },
  { id: 'taro', name: '芋泥', group: 'baking', color: '#c6b0ca', shape: 'cream' },
  { id: 'sweet-potato', name: '紫薯泥', group: 'baking', color: '#b39ab9', shape: 'cream' },
  { id: 'strawberry', name: '草莓', group: 'fruit', color: '#d58a8b', shape: 'berry' },
  { id: 'blueberry', name: '蓝莓', group: 'fruit', color: '#9995b6', shape: 'berry' },
  { id: 'mango', name: '芒果', group: 'fruit', color: '#e5b967', shape: 'chunk' },
  { id: 'peach', name: '蜜桃', group: 'fruit', color: '#eab9ac', shape: 'slice' },
  { id: 'banana', name: '香蕉', group: 'fruit', color: '#e6d39c', shape: 'slice' },
  { id: 'lemon', name: '柠檬', group: 'fruit', color: '#e1d18d', shape: 'slice' },
  { id: 'almond', name: '杏仁', group: 'fruit', color: '#c4a27d', shape: 'slice' },
  { id: 'raspberry', name: '覆盆子', group: 'fruit', color: '#c58a98', shape: 'berry' },
  { id: 'cherry', name: '樱桃', group: 'fruit', color: '#bb7c8b', shape: 'berry' },
  { id: 'kiwi', name: '猕猴桃', group: 'fruit', color: '#b0bf83', shape: 'slice' },
  { id: 'orange', name: '橙子', group: 'fruit', color: '#e8b779', shape: 'slice' },
  { id: 'pineapple', name: '菠萝', group: 'fruit', color: '#e5ca86', shape: 'chunk' },
  { id: 'grape', name: '葡萄', group: 'fruit', color: '#ac98b8', shape: 'berry' },
  { id: 'apple', name: '苹果', group: 'fruit', color: '#d7a49a', shape: 'slice' },
  { id: 'walnut', name: '核桃', group: 'fruit', color: '#baa184', shape: 'chunk' },
  { id: 'pistachio', name: '开心果', group: 'fruit', color: '#bdc18f', shape: 'chunk' },
  { id: 'salt', name: '盐', group: 'seasoning', color: '#eee9dd', shape: 'sprinkle' },
  { id: 'soy', name: '酱油', group: 'seasoning', color: '#aa826b', shape: 'cream' },
  { id: 'pepper', name: '黑胡椒', group: 'seasoning', color: '#8d7b6b', shape: 'sprinkle' },
  { id: 'sesame', name: '芝麻', group: 'seasoning', color: '#d4b989', shape: 'grain' },
  { id: 'honey', name: '蜂蜜', group: 'seasoning', color: '#dcb26e', shape: 'cream' },
  { id: 'sugar', name: '砂糖', group: 'seasoning', color: '#f2e7d7', shape: 'sprinkle' },
  { id: 'garlic', name: '蒜末', group: 'seasoning', color: '#dfd1af', shape: 'grain' },
  { id: 'ginger', name: '姜丝', group: 'seasoning', color: '#d8bc86', shape: 'grain' },
  { id: 'chili', name: '小米椒', group: 'seasoning', color: '#c98676', shape: 'slice' },
  { id: 'cilantro', name: '香菜', group: 'seasoning', color: '#93aa7e', shape: 'leaf' },
  { id: 'vinegar', name: '香醋', group: 'seasoning', color: '#a58a73', shape: 'cream' },
  { id: 'oyster-sauce', name: '蚝油', group: 'seasoning', color: '#aa8c73', shape: 'cream' },
  { id: 'curry', name: '咖喱', group: 'seasoning', color: '#c6a363', shape: 'cream' },
  { id: 'tomato-sauce', name: '番茄酱', group: 'seasoning', color: '#cb8f7a', shape: 'cream' },
  { id: 'maple', name: '枫糖浆', group: 'seasoning', color: '#c5a176', shape: 'cream' },
  { id: 'vanilla', name: '香草籽', group: 'seasoning', color: '#a69784', shape: 'sprinkle' },
  { id: 'cinnamon', name: '肉桂粉', group: 'seasoning', color: '#ba9478', shape: 'sprinkle' },
  { id: 'chocolate', name: '巧克力碎', group: 'decoration', color: '#9f7b6e', shape: 'chunk' },
  { id: 'sprinkles', name: '彩糖', group: 'decoration', color: '#cea9bd', shape: 'sprinkle' },
  { id: 'mint', name: '薄荷叶', group: 'decoration', color: '#9bac88', shape: 'leaf' },
  { id: 'heart', name: '爱心插牌', group: 'decoration', color: '#d8a1ac', shape: 'berry' },
  { id: 'coconut-flakes', name: '椰蓉', group: 'decoration', color: '#f1e7d6', shape: 'sprinkle' },
  { id: 'cookie-crumb', name: '饼干碎', group: 'decoration', color: '#ceb590', shape: 'chunk' },
  { id: 'marshmallow', name: '棉花糖', group: 'decoration', color: '#ead7dd', shape: 'chunk' },
  { id: 'wafer', name: '威化卷', group: 'decoration', color: '#d7bd94', shape: 'slice' },
  { id: 'caramel', name: '焦糖淋酱', group: 'decoration', color: '#c6a077', shape: 'cream' },
  { id: 'strawberry-jam', name: '草莓果酱', group: 'decoration', color: '#ca929a', shape: 'cream' },
];
export const KITCHEN_METHODS = { stir: '翻炒', pan: '香煎', steam: '清蒸', simmer: '慢炖', boil: '煮一煮', bake: '烘烤', chill: '冷藏定型', freeze: '冷冻搅拌' } as const;
export type KitchenMethod = keyof typeof KITCHEN_METHODS;
export type KitchenTypeId = 'rice' | 'noodles' | 'saute' | 'soup' | 'cake' | 'pudding' | 'cookie' | 'icecream';
interface KitchenType { id: KitchenTypeId; name: string; category: KitchenCategory; subtitle: string; methods: KitchenMethod[]; required: string[]; base: string[]; groups: KitchenGroup[] }
const dishGroups: KitchenGroup[] = ['vegetable', 'protein', 'dairy', 'seasoning'];
const dessertGroups: KitchenGroup[] = ['dairy', 'baking', 'fruit', 'seasoning', 'decoration'];
export const KITCHEN_TYPES: KitchenType[] = [
  { id: 'rice', name: '米饭料理', category: 'dish', subtitle: '把日常炒得香香的', methods: ['stir', 'steam'], required: ['rice'], base: ['rice'], groups: ['staple', ...dishGroups] },
  { id: 'noodles', name: '一碗好面', category: 'dish', subtitle: '热乎乎，慢慢吃', methods: ['boil', 'stir'], required: ['noodles'], base: ['noodles'], groups: ['staple', ...dishGroups] },
  { id: 'saute', name: '家常小菜', category: 'dish', subtitle: '为喜欢的人多做一点', methods: ['stir', 'pan', 'steam'], required: [], base: ['tomato', 'egg'], groups: dishGroups },
  { id: 'soup', name: '一盅暖汤', category: 'dish', subtitle: '把心意炖进汤里', methods: ['simmer', 'boil'], required: ['broth'], base: ['broth', 'mushroom'], groups: ['staple', ...dishGroups] },
  { id: 'cake', name: '手作小蛋糕', category: 'dessert', subtitle: '留给你柔软的一角', methods: ['bake'], required: ['flour', 'egg', 'butter'], base: ['flour', 'egg', 'butter', 'cream'], groups: dessertGroups },
  { id: 'pudding', name: '摇摇布丁', category: 'dessert', subtitle: '轻轻晃动的小甜蜜', methods: ['steam', 'chill'], required: ['milk', 'egg'], base: ['milk', 'egg'], groups: dessertGroups },
  { id: 'cookie', name: '手作小饼干', category: 'dessert', subtitle: '藏进衣兜的喜欢', methods: ['bake'], required: ['flour', 'butter'], base: ['flour', 'butter'], groups: dessertGroups },
  { id: 'icecream', name: '冰淇淋小碗', category: 'dessert', subtitle: '一口凉凉的快乐', methods: ['freeze'], required: ['milk', 'cream'], base: ['milk', 'cream'], groups: dessertGroups },
];
export const KITCHEN_PLATES = { porcelain: '奶油瓷器', sage: '鼠尾草绿', rose: '草莓奶油', bear: '小熊餐具' } as const;
export type KitchenPlate = keyof typeof KITCHEN_PLATES;
export interface KitchenPart { id: string; amount: number }
export interface KitchenRecipe {
  id: string; name: string; typeId: KitchenTypeId; parts: KitchenPart[]; method: KitchenMethod;
  heat: number; sweetness: number; plate: KitchenPlate; cover?: string;
  maker: { name: string; actorId?: string; note?: string }; adapted: boolean; origin?: string;
}
export interface KitchenTasting { id: string; createdAt: string; status: 'pending' | 'done' | 'error'; text: string; error?: string }
export interface KitchenServing { actorId: string; actorName: string; servedAt: string; tastings: KitchenTasting[] }
export interface KitchenMeal { id: string; createdAt: string; recipe: KitchenRecipe; servings: KitchenServing[] }
export interface KitchenStore { recipes: KitchenRecipe[]; meals: KitchenMeal[] }
export type KitchenRequest = { actorId: string; signal: AbortSignal } & (
  { kind: 'recipe'; category: KitchenCategory; requirements: string } | { kind: 'taste'; meal: KitchenMeal });
export const kitchenType = (id: KitchenTypeId): KitchenType => {
  const found = KITCHEN_TYPES.find(type => type.id === id);
  if (!found) throw new Error('这款料理类型不存在，请重新选择。');
  return found;
};
export const kitchenIngredient = (id: string): KitchenIngredient => {
  const found = KITCHEN_INGREDIENTS.find(ingredient => ingredient.id === id);
  if (!found) throw new Error('食材不在厨房的食材柜里，请重新选择。');
  return found;
};
export function kitchenIngredients(typeId: KitchenTypeId): KitchenIngredient[] {
  const type = kitchenType(typeId);
  return KITCHEN_INGREDIENTS.filter(i => type.groups.includes(i.group) &&
    (i.group !== 'staple' || i.id === typeId || i.id === 'broth') &&
    (type.category !== 'dessert' || i.group !== 'seasoning' || ['honey', 'sugar', 'maple', 'vanilla', 'cinnamon'].includes(i.id)));
}
export const kitchenAmount = (amount: number) => ['少许', '适量', '多一点'][amount - 1];
export function freshKitchenRecipe(userName: string, typeId: KitchenTypeId = 'rice'): KitchenRecipe {
  const type = kitchenType(typeId);
  return { id: `recipe-${crypto.randomUUID()}`, name: '', typeId, parts: type.base.map(id => ({ id, amount: 2 })),
    method: type.methods[0], heat: 0, sweetness: 50, plate: 'porcelain', maker: { name: userName }, adapted: false };
}
export const copyKitchenRecipe = (recipe: KitchenRecipe): KitchenRecipe => ({
  ...recipe, parts: recipe.parts.map(part => ({ ...part })), maker: { ...recipe.maker },
});
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
export const isKitchenCover = (value: unknown): value is string => typeof value === 'string' && value.length <= 1_500_000 &&
  (/^https?:\/\/[^\s]+$/i.test(value) || /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value));
export function validateKitchenRecipe(recipe: KitchenRecipe, complete = true): void {
  const type = kitchenType(recipe.typeId), allowed = kitchenIngredients(recipe.typeId);
  if (!nonemptyText(recipe.id, 200) || typeof recipe.name !== 'string' || recipe.name.length > 40 ||
    !Array.isArray(recipe.parts) || recipe.parts.length > 16 || recipe.parts.some(p => !allowed.some(i => i.id === p.id) || !integer(p.amount, 1, 3)) ||
    new Set(recipe.parts.map(p => p.id)).size !== recipe.parts.length || !type.methods.includes(recipe.method) ||
    !integer(recipe.heat, 0, 3) || ![0, 25, 50, 75, 100].includes(recipe.sweetness) || !Object.hasOwn(KITCHEN_PLATES, recipe.plate) ||
    !isObject(recipe.maker) || !nonemptyText(recipe.maker.name, 100) || typeof recipe.adapted !== 'boolean' ||
    recipe.maker.actorId !== undefined && !nonemptyText(recipe.maker.actorId, 200) ||
    recipe.maker.note !== undefined && !nonemptyText(recipe.maker.note, 500) ||
    recipe.cover !== undefined && !isKitchenCover(recipe.cover) || recipe.origin !== undefined && !nonemptyText(recipe.origin, 200))
    throw new Error('料理的食材、用量、做法或署名无效，未保存。');
  if (!complete) return;
  if (!recipe.name.trim()) throw new Error('先为这份料理取个名字吧。');
  const missing = type.required.filter(id => !recipe.parts.some(p => p.id === id));
  if (missing.length) throw new Error(`还缺少基础食材：${missing.map(id => kitchenIngredient(id).name).join('、')}。`);
  if (!recipe.parts.some(p => !['seasoning', 'decoration'].includes(kitchenIngredient(p.id).group) && p.id !== 'broth'))
    throw new Error('除了汤底和调料，还需要至少一种主要食材。');
}
export function isKitchenRecipe(value: unknown): value is KitchenRecipe {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || !Array.isArray(value.parts) ||
    !value.parts.every((p): p is KitchenPart => isObject(p) && typeof p.id === 'string' && typeof p.amount === 'number') ||
    typeof value.heat !== 'number' || typeof value.sweetness !== 'number' || typeof value.adapted !== 'boolean' ||
    !isObject(value.maker) || typeof value.maker.name !== 'string' ||
    value.maker.actorId !== undefined && typeof value.maker.actorId !== 'string' ||
    value.maker.note !== undefined && typeof value.maker.note !== 'string' ||
    value.origin !== undefined && typeof value.origin !== 'string' ||
    value.cover !== undefined && !isKitchenCover(value.cover)) return false;
  const type = KITCHEN_TYPES.find(t => t.id === value.typeId);
  const method = type?.methods.find(m => m === value.method);
  const plate = (['porcelain', 'sage', 'rose', 'bear'] as const).find(p => p === value.plate);
  if (!type || !method || !plate) return false;
  const checked: KitchenRecipe = { id: value.id, name: value.name, typeId: type.id, parts: value.parts, method,
    heat: value.heat, sweetness: value.sweetness, plate, adapted: value.adapted, cover: value.cover,
    origin: value.origin, maker: { name: value.maker.name, actorId: value.maker.actorId, note: value.maker.note } };
  try { validateKitchenRecipe(checked); return true; } catch { return false; }
}
export function parseKitchenRecipe(text: string, actor: { id: string; name: string }, category: KitchenCategory): KitchenRecipe {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('角色没有返回有效的料理配方 JSON，请手动重试。'); }
  if (!isObject(value) || !nonemptyText(value.note, 500)) throw new Error('角色配方缺少制作留言，请手动重试。');
  const candidate = { id: `recipe-${crypto.randomUUID()}`, name: value.name, typeId: value.typeId, parts: value.parts,
    method: value.method, heat: value.heat, sweetness: value.sweetness, plate: value.plate,
    maker: { name: actor.name, actorId: actor.id, note: value.note }, adapted: false };
  if (!isKitchenRecipe(candidate) || kitchenType(candidate.typeId).category !== category)
    throw new Error('角色配方的分类、食材或做法不符合厨房规则，未采用；请修改需求后手动重试。');
  return copyKitchenRecipe(candidate);
}
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isTasting = (value: unknown): value is KitchenTasting => isObject(value) && nonemptyText(value.id, 200) && date(value.createdAt) &&
  typeof value.text === 'string' && value.text.length <= 5000 && (value.error === undefined || nonemptyText(value.error, 1000)) &&
  (value.status === 'pending' || value.status === 'done' && !!value.text.trim() || value.status === 'error' && nonemptyText(value.error, 1000));
export function isKitchenMeal(value: unknown): value is KitchenMeal {
  return isObject(value) && nonemptyText(value.id, 200) && date(value.createdAt) && isKitchenRecipe(value.recipe) &&
    Array.isArray(value.servings) && value.servings.every(s => isObject(s) && nonemptyText(s.actorId, 200) &&
      nonemptyText(s.actorName, 100) && date(s.servedAt) && Array.isArray(s.tastings) && s.tastings.every(isTasting) &&
      new Set(s.tastings.map(t => t.id)).size === s.tastings.length) && new Set(value.servings.map(s => s.actorId)).size === value.servings.length;
}
export const isKitchenStore = (value: unknown): value is KitchenStore => isObject(value) && Array.isArray(value.recipes) &&
  value.recipes.every(isKitchenRecipe) && new Set(value.recipes.map(r => r.id)).size === value.recipes.length &&
  Array.isArray(value.meals) && value.meals.every(isKitchenMeal) && new Set(value.meals.map(m => m.id)).size === value.meals.length;
export const emptyKitchen = (): KitchenStore => ({ recipes: [], meals: [] });
export function loadKitchen(): KitchenStore {
  const raw = readStorageString(KITCHEN_KEY);
  if (raw === null) return emptyKitchen();
  const value = readStoredValue<unknown>(KITCHEN_KEY, null, (_v): _v is unknown => true);
  if (!isKitchenStore(value)) throw new Error('厨房记录格式异常，原数据已保留，请恢复有效备份后再试。');
  return value;
}
export function createKitchenMeal(recipe: KitchenRecipe): KitchenMeal {
  validateKitchenRecipe(recipe);
  return { id: `meal-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), recipe: copyKitchenRecipe(recipe), servings: [] };
}
export function saveKitchenMeal(state: KitchenStore, meal: KitchenMeal): KitchenStore {
  const existing = state.meals.find(m => m.recipe.id === meal.recipe.id);
  if (existing && JSON.stringify(existing.recipe) !== JSON.stringify(meal.recipe)) throw new Error('配方已变化，请另存一份，不会覆盖原成品。');
  const prior = state.recipes.find(r => r.id === meal.recipe.id);
  if (prior && JSON.stringify(prior) !== JSON.stringify(meal.recipe)) throw new Error('料理本中的配方已变化，请另存一份。');
  return { recipes: prior ? state.recipes : [copyKitchenRecipe(meal.recipe), ...state.recipes],
    meals: existing ? state.meals : [meal, ...state.meals] };
}
export const serveKitchenMeal = (meal: KitchenMeal, actor: { id: string; name: string }): KitchenMeal => meal.servings.some(s => s.actorId === actor.id)
  ? meal : { ...meal, servings: [...meal.servings, { actorId: actor.id, actorName: actor.name, servedAt: new Date().toISOString(), tastings: [] }] };
let writes = Promise.resolve();
const listeners = new Set<() => void>();
export function subscribeKitchen(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function updateKitchen(change: (state: KitchenStore) => KitchenStore, extra?: (state: KitchenStore) => Record<string, unknown>): Promise<void> {
  const pending = writes.then(async () => {
    const next = change(loadKitchen());
    if (!isKitchenStore(next)) throw new Error('料理记录格式无效，未保存。');
    const additional = extra?.(next) ?? {};
    if (Object.hasOwn(additional, KITCHEN_KEY)) throw new Error('不能覆盖厨房的存储事务。');
    await setStorageItemsAtomically({ ...additional, [KITCHEN_KEY]: next });
    listeners.forEach(listener => listener());
  });
  writes = pending.catch(error => { console.error('Could not persist kitchen:', error); });
  return pending;
}
export const patchKitchenMeal = (id: string, change: (meal: KitchenMeal) => KitchenMeal): Promise<void> => updateKitchen(state => {
  if (!state.meals.some(m => m.id === id)) throw new Error('这份料理已不在餐桌记录中。');
  return { ...state, meals: state.meals.map(m => m.id === id ? change(m) : m) };
});
export const recoverKitchen = (state: KitchenStore): KitchenStore => ({ ...state, meals: state.meals.map(meal => ({ ...meal,
  servings: meal.servings.map(s => ({ ...s, tastings: s.tastings.map(t => t.status === 'pending'
    ? { ...t, status: 'error', error: '上次品尝已中断，不会自动重试。' } : t) })) })) });
export function kitchenRecipeText(recipe: KitchenRecipe): string {
  const type = kitchenType(recipe.typeId);
  return [`${recipe.name} · ${type.name}`, `食材：${recipe.parts.map(p => `${kitchenIngredient(p.id).name}（${kitchenAmount(p.amount)}）`).join('、')}`,
    `做法：${KITCHEN_METHODS[recipe.method]}；${type.category === 'dish' ? `辣度：${['不辣', '微辣', '中辣', '很辣'][recipe.heat]}` : `甜度偏好：${recipe.sweetness}%`}；餐具：${KITCHEN_PLATES[recipe.plate]}`,
    `署名：${recipe.maker.name}${recipe.adapted ? '提供配方，经玩家调整完成' : ''}`,
    ...(recipe.maker.note ? [`制作留言：${recipe.maker.note}`] : []), ...(recipe.origin ? [`配方来源：${recipe.origin}`] : [])].join('\n');
}
export function kitchenPrompt(input: KitchenRequest): string {
  if (input.kind === 'taste') return kitchenRecipeText(input.meal.recipe);
  const types = KITCHEN_TYPES.filter(t => t.category === input.category);
  const sample = freshKitchenRecipe('角色', types[0].id);
  const example = JSON.stringify({ name: '40字内料理名', typeId: sample.typeId, parts: sample.parts, method: sample.method,
    heat: 0, sweetness: 50, plate: 'porcelain', note: '符合角色语气的500字内制作留言' });
  return [`玩家想要：${input.category === 'dish' ? '菜品' : '甜品'}。${input.requirements || '请按你的喜好，为我做一份。'}`,
    '这是虚拟厨房的配方设计，不提供现实火候、时间、医疗或过敏安全承诺。尊重玩家明确要求，无法满足时不要谎称满足。',
    ...types.map(t => `${t.id}=${t.name}；做法只能选${t.methods.join('/')}；必选${t.required.join('/') || '至少一种主要食材'}；可用食材${kitchenIngredients(t.id).map(i => `${i.id}=${i.name}`).join('、')}`),
    '选1种料理类型，最多16种不重复的食材，amount只能1/2/3（少许/适量/多一点）；不得编造ID。只能使用该类型的做法和食材。署名由程序确定。',
    `只在JSON的reply数组里返回一个JSON字符串；对象格式示例：${example}。`,
    'heat只能0/1/2/3；sweetness只能0/25/50/75/100；plate只能porcelain/sage/rose/bear。生成供玩家确认的草稿，不声称已保存或送出。'].join('\n');
}
