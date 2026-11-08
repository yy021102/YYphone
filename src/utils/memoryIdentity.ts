import { readStoredValue } from './localStorage';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** Prefer the active persona's real name, not its preset label or desktop profile. */
export function readMemoryUserName(): string {
  const personas = readStoredValue('pocketos:personas', null, record);
  const active = personas && Array.isArray(personas.profiles)
    ? personas.profiles.find(value => record(value) && value.id === personas.activeProfileId) : undefined;
  if (record(active)) {
    const legacyName = active.realName === undefined && !['默认人设', '未命名人设'].includes(text(active.name)) ? text(active.name) : '';
    const name = text(active.realName) || legacyName || text(active.nickname);
    if (name) return name;
  }
  const profile = readStoredValue('yyphone:wechat-profile', null, record);
  const desktop = readStoredValue('pocketos:user-profile', null, record);
  return [text(profile?.name), text(desktop?.name)].find(name => name && !['user', '玩家'].includes(name.toLowerCase())) || '对方';
}
