import type { UserPersona } from '../types';

/** Older personas stored the player's name in `name`; new personas use it as the preset label. */
export const getUserRealName = (persona: UserPersona): string => {
  if (persona.realName !== undefined) return persona.realName.trim();
  const legacyName = persona.name.trim();
  return legacyName === '默认人设' || legacyName === '未命名人设' ? '' : legacyName;
};
