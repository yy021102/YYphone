import { currentAliasUser } from './aliasAccounts';
import { activityChatChanges, assertActivityChatScope, type ActivityChatScope } from './activityChat';
import { createKitchenMeal, kitchenRecipeText, saveKitchenMeal, updateKitchen, type KitchenMeal, type KitchenRecipe } from './kitchen';

export interface KitchenResponse { text: string; scope: ActivityChatScope }
export type KitchenRecordRequest = { scope: ActivityChatScope; syncToChat: boolean; signal?: AbortSignal } & (
  { kind: 'recipe'; recipe: KitchenRecipe } | { kind: 'taste'; mealId: string; tastingId: string; text: string });
export function kitchenChatChanges(scope: ActivityChatScope, meal: KitchenMeal, kind: 'recipe' | 'taste' | 'serve', tastingId?: string): Record<string, unknown> {
  const user = currentAliasUser();
  let title: string, detail: string, id: string;
  if (kind === 'recipe') {
    if (meal.recipe.maker.actorId !== scope.actorId) throw new Error('料理署名与角色不符，未同步。');
    id = `kitchen-made-${meal.id}-${scope.actorId}`;
    title = `${meal.recipe.name} · 制作记录`;
    detail = `【下厨房的制作经历记录，并非角色在主号发出的新消息】\n${meal.recipe.adapted
      ? `${meal.recipe.maker.name}提供配方，${user.name}调整后完成了这份料理`
      : `${meal.recipe.maker.name}为${user.name}做了这份料理`}，玩家已确认收下并加入餐桌。\n${kitchenRecipeText(meal.recipe)}`;
  } else {
    const serving = meal.servings.find(s => s.actorId === scope.actorId);
    if (!serving) throw new Error('这份料理尚未送给所选角色。');
    if (kind === 'taste') {
      const tasting = serving.tastings.find(t => t.id === tastingId && t.status === 'done');
      if (!tasting) throw new Error('这次品尝尚未完成，不能同步。');
      id = `kitchen-taste-${meal.id}-${tasting.id}`;
      title = `${meal.recipe.name} · ${serving.actorName}的品尝记录`;
      detail = `【下厨房的用餐经历记录，并非角色在主号发出的新消息】\n${user.name}请${serving.actorName}品尝这份料理。\n${kitchenRecipeText(meal.recipe)}\n${serving.actorName}的本次实际反馈：\n${tasting.text}`;
    } else {
      id = `kitchen-serve-${meal.id}-${scope.actorId}`;
      title = `${meal.recipe.name} · 给${serving.actorName}的一餐`;
      detail = `下厨房 · ${user.name}送给${serving.actorName}的料理卡\n${kitchenRecipeText(meal.recipe)}\n制作于${new Date(meal.createdAt).toLocaleString('zh-CN')}；送出于${new Date(serving.servedAt).toLocaleString('zh-CN')}`;
    }
  }
  return activityChatChanges(scope, { id, title, detail, source: '下厨房' });
}
export async function recordKitchenResult(input: KitchenRecordRequest): Promise<KitchenMeal> {
  const created = input.kind === 'recipe' ? createKitchenMeal(input.recipe) : undefined;
  let saved: KitchenMeal | undefined;
  await updateKitchen(state => {
    input.signal?.throwIfAborted();
    assertActivityChatScope(input.scope);
    if (input.kind === 'recipe' && created) {
      if (created.recipe.maker.actorId !== input.scope.actorId) throw new Error('料理署名与角色不符，未保存。');
      const next = saveKitchenMeal(state, created);
      saved = next.meals.find(m => m.recipe.id === created.recipe.id);
      return next;
    }
    if (input.kind !== 'taste') throw new Error('料理记录类型无效。');
    const meal = state.meals.find(m => m.id === input.mealId);
    const tasting = meal?.servings.find(s => s.actorId === input.scope.actorId)?.tastings.find(t => t.id === input.tastingId);
    if (!meal || !tasting || tasting.status !== 'pending' || !input.text.trim() || input.text.length > 5000)
      throw new Error('品尝记录已变化或反馈无效，请重新邀请品尝。');
    const completed = { ...meal, servings: meal.servings.map(s => s.actorId === input.scope.actorId ? { ...s,
      tastings: s.tastings.map(t => t.id === input.tastingId ? { ...t, status: 'done' as const, text: input.text.trim() } : t) } : s) };
    saved = completed;
    return { ...state, meals: state.meals.map(m => m.id === meal.id ? completed : m) };
  }, () => {
    input.signal?.throwIfAborted();
    if (!saved) throw new Error('料理记录未生成。');
    return input.syncToChat ? kitchenChatChanges(input.scope, saved, input.kind, input.kind === 'taste' ? input.tastingId : undefined) : {};
  });
  if (!saved) throw new Error('料理记录未保存。');
  return saved;
}
