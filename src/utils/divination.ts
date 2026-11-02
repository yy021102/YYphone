export type DivinationReader = { mode: 'oracle' } | { mode: 'character'; actorId: string; actorName: string };
export const DIVINATION_RESPONSE_STYLE = [
  '【正文表达】页面底部已统一保留占卜说明。解读正文和出生草稿的 reason 直接进入问题、牌面、星盘或角色补设理由，保持当前角色的口吻，不主动添加免责声明段落。',
  '不要在开头、结尾或每段反复强调“仅供娱乐”“不是科学预测”“只是虚构”“不能替代专业建议”等通用说明，也不要复述内部规则。创作来源与补全字段由档案信息呈现，不需要在每次解读里重新声明。',
  '仍须遵守数据和事实边界，不把补设当作原作明确设定，不编造计算结果，不给确定的医疗、投资或灾祸结论。确实因资料缺失无法回答当前问题时，只简短指出具体缺项，不复制整段免责声明。',
].join('\n');
export interface DivinationInterpretation {
  id: string;
  reader: DivinationReader;
  status: 'pending' | 'done' | 'error';
  text: string;
  error?: string;
  createdAt: string;
}
export const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const nonemptyText = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
export function isDivinationInterpretation(value: unknown): value is DivinationInterpretation {
  if (!isObject(value) || !nonemptyText(value.id, 200) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
      !isObject(value.reader) || typeof value.text !== 'string' || value.text.length > 12000 ||
      value.error !== undefined && (typeof value.error !== 'string' || value.error.length > 1000)) return false;
  const reader = value.reader;
  if (!(reader.mode === 'oracle' || reader.mode === 'character' && nonemptyText(reader.actorId, 200) && nonemptyText(reader.actorName, 100))) return false;
  return value.status === 'pending' || value.status === 'done' && !!value.text.trim() ||
    value.status === 'error' && nonemptyText(value.error, 1000);
}
